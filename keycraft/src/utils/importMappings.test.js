import { parseImport, parseTmuxList, parseVimMaplist, parseVimVerbose } from "./importMappings";
import { parseVimKeyMappings, matchKeyPressMappings, mappingModes } from "./keyMatching";

const event = (key, code = `Key${key.toUpperCase()}`, more = {}) => ({ key, code, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...more });

test("Vim exports retain modes, plugin provenance, and source line", () => {
  const mappings = parseVimMaplist(JSON.stringify({ scripts: [{ sid: 1, name: "/Users/me/.vimrc" }, { sid: 2, name: "/Users/me/.vim/plugged/foo/plugin/foo.vim" }], mappings: [{ mode: "n", lhs: "<Space>w", rhs: ":w<CR>", sid: 1, lnum: 22, noremap: 1 }, { mode: "!", lhs: "jk", rhs: "<Esc>", sid: 2 }] }));
  expect(mappings[0]).toMatchObject({ setting_source: "vimrc", verbose: "/Users/me/.vimrc:22", attr: "noremap" });
  expect(mappings[1].setting_source).toBe("plugin");
  expect(mappingModes(mappings[1])).toEqual(["i", "c"]);
  expect(mappingModes({ cmd: "" })).toEqual(["n", "x", "s", "o"]);
});

test("legacy verbose dumps keep global maps and surface unparsed lines", () => {
  const data = parseVimVerbose('noise\nsK7gstart\nn  <Space>w    * :w<CR>\n        Last set from ~/.vimrc line 8\n   <F2>       * :echo 1<CR>\nnot a mapping\naYx9end\nnoise');
  expect(data.mappings).toHaveLength(2);
  expect(data.mappings[0]).toMatchObject({ cmd: "n", lhs: "<Space>w", rhs: ":w<CR>", setting_source: "vimrc" });
  expect(data.mappings[1].cmd).toBe("");
  expect(data.warnings).toHaveLength(1);
  expect(() => parseVimVerbose("sK7gstart\nn foo bar")).toThrow(/incomplete/);
  expect(() => parseVimVerbose("nnoremap foo bar")).toThrow(/No Vim mappings/);
});

test.each([
  ["n  a             *", "", "*"],
  ["n  b           * @q", "*", "@q"],
  ["n  c             &foo", "", "&foo"],
  ["n  e           *@@q", "*@", "@q"],
  ["n  f            @*", "@", "*"],
  ["n  g           & &foo", "&", "&foo"],
  ["n  h           &@*", "&@", "*"],
  ["n  j             @q", "", "@q"],
  ["n  k           * *", "*", "*"],
  ["n  verylonglhs123456 * @x", "*", "@x"],
  ["n  你好        * @z", "*", "@z"],
  ["n  z           * :echo 'spaces'  ", "*", ":echo 'spaces'  "],
])("verbose mapping preserves the attribute columns and RHS: %s", (line, attr, rhs) => {
  const { mappings, warnings } = parseVimVerbose(line);
  expect(warnings).toEqual([]);
  expect(mappings).toHaveLength(1);
  expect(mappings[0]).toMatchObject({ attr, rhs, raw: line });
});

test("combined Vim modes retain their own source and do not overwrite adjacent mappings", () => {
  const { mappings, warnings } = parseVimVerbose([
    "n  b           * @q",
    "\tLast set from /Users/me/.vimrc line 2",
    "ox d           * gg",
    "\tLast set from /Users/me/.vim/plugged/foo/plugin/foo.vim line 6",
    "nox f          * zz",
    "\tLast set from /Users/me/.vimrc line 8",
  ].join("\n"));
  expect(warnings).toEqual([]);
  expect(mappings).toHaveLength(3);
  expect(mappings[0]).toMatchObject({ verbose: "Last set from /Users/me/.vimrc line 2", setting_source: "vimrc" });
  expect(mappings[1]).toMatchObject({ cmd: "ox", lhs: "d", rhs: "gg", setting_source: "plugin" });
  expect(mappingModes(mappings[1])).toEqual(["o", "x"]);
  expect(mappingModes(mappings[2])).toEqual(["n", "o", "x"]);
});

test("unrecognized Vim rows cannot attach their source to the previous mapping", () => {
  const { mappings, warnings } = parseVimVerbose([
    "n  b           * @q",
    "\tLast set from /Users/me/.vimrc line 2",
    "unsupported mapping output",
    "\tLast set from /Users/me/plugin.vim line 99",
    "n  c           * zz",
    "No mapping found",
    "\tLast set from /Users/me/plugin.vim line 100",
  ].join("\n"));
  expect(warnings).toHaveLength(1);
  expect(mappings[0]).toMatchObject({ verbose: "Last set from /Users/me/.vimrc line 2", setting_source: "vimrc" });
  expect(mappings[1]).toMatchObject({ verbose: "", setting_source: "unknown" });
});

test("tmux handles table scope, custom/secondary prefixes, repeat and quoted keys", () => {
  const text = `bind-key -r -T prefix h select-pane -L
bind-key -T root M-Left previous-window
bind-key -T copy-mode-vi y send-keys -X copy-selection-and-cancel
bind-key -T prefix '"' split-window -v
bind-key -T prefix '\\' split-window -h
bind-key -T prefix ';' last-pane`;
  const { mappings, warnings } = parseTmuxList(text, "C-a", "C-b");
  expect(warnings).toEqual([]);
  expect(mappings).toHaveLength(10);
  expect(mappings[0]).toMatchObject({ lhs: "<C-a>h", table: "prefix", attr: "repeat" });
  expect(mappings[1].lhs).toBe("<C-b>h");
  expect(mappings[2].lhs).toBe("<M-Left>");
  expect(mappings[3]).toMatchObject({ table: "copy-mode-vi", lhs: "y" });
  expect(mappings[4].lhs).toBe('<C-a>"');
  expect(mappings[6].lhs).toBe("<C-a>\\");
  expect(mappings[8].lhs).toBe("<C-a>;");
});

test("mapping matching supports Enter, literal less-than, Ctrl-special keys and prefixes", () => {
  const map = (lhs) => parseVimKeyMappings([{ lhs, rhs: "test" }])[0];
  expect(matchKeyPressMappings([event("Enter", "Enter")], map("<CR>"))).toBe(true);
  expect(matchKeyPressMappings([event("<", "Comma", { shiftKey: true })], map("<lt>"))).toBe(true);
  expect(matchKeyPressMappings([event("ArrowLeft", "ArrowLeft", { ctrlKey: true })], map("<C-Left>"))).toBe(true);
  expect(matchKeyPressMappings([event("k", "KeyK", { ctrlKey: true })], map("<C-K>"))).toBe(true);
  expect(matchKeyPressMappings([event("K", "KeyK", { ctrlKey: true, shiftKey: true })], map("<C-K>"))).toBe(false);
  expect(matchKeyPressMappings([event("b", "KeyB", { ctrlKey: true }), event("c")], map("<C-b>c"))).toBe(true);
  expect(matchKeyPressMappings([event("g"), event("g"), event("g")], map("gg"))).toBe(false);
  expect(parseVimKeyMappings([{ lhs: "<Plug>Foo", rhs: "bar" }])).toEqual([]);
  expect(() => parseImport({ kind: "tmux", text: "garbage" })).toThrow(/No tmux bindings/);
});

test("tmux imports a bare hyphen as the only binding, including after options", () => {
  const { mappings, warnings } = parseTmuxList("bind-key -T prefix - delete-buffer");
  expect(warnings).toEqual([]);
  expect(mappings).toHaveLength(1);
  expect(mappings[0]).toMatchObject({ lhs: "<C-b>-", bindingKey: "-", rhs: "delete-buffer" });
  expect(matchKeyPressMappings([
    event("b", "KeyB", { ctrlKey: true }), event("-", "Minus"),
  ], parseVimKeyMappings(mappings)[0])).toBe(true);
  expect(parseTmuxList("bind-key -r -n - display-menu").mappings[0]).toMatchObject({ lhs: "-", table: "root", attr: "repeat" });
  expect(parseTmuxList("bind-key -T prefix -- - delete-buffer").mappings[0].bindingKey).toBe("-");
  expect(() => parseTmuxList("bind-key -unsupported x foo")).toThrow(/No tmux bindings/);
});

test("only bundled reference entries strip documentation placeholders", () => {
  const { mappings } = parseVimVerbose("i  {}          * <Esc>\nn  a{word}b    * x");
  const parsed = parseVimKeyMappings(mappings);
  expect(parsed).toHaveLength(2);
  expect(parsed[0].jsKeys.map((key) => key.key)).toEqual(["{", "}"]);
  expect(parsed[1].jsKeys.map((key) => key.key).join("")).toBe("a{word}b");
  expect(matchKeyPressMappings([
    event("{", "BracketLeft", { shiftKey: true }), event("}", "BracketRight", { shiftKey: true }),
  ], parsed[0])).toBe(true);
  expect(parseVimKeyMappings([{ lhs: "f{char}", setting_source: "builtin" }])[0].jsKeys.map((key) => key.key)).toEqual(["f"]);
  expect(parseVimKeyMappings([{ lhs: "{}" }])).toHaveLength(1);
});

test("maplist preserves literal angle brackets even when the text names a real special key", () => {
  const mappings = parseVimMaplist(JSON.stringify({ scripts: [], mappings: [
    { mode: "n", lhs: "<foo>", lhsraw: "<foo>", rhs: "x" },
    { mode: "n", lhs: "<CR>", lhsraw: "<CR>", rhs: "literal" },
    { mode: "n", lhs: "<CR>", lhsraw: "\r", rhs: "enter" },
    { mode: "n", lhs: "<F1><F2>", lhsNotation: "<lt>F1><F2>", rhs: "mixed" },
    { mode: "n", lhs: "<Plug>Foo", lhsNotation: "<lt>Plug>Foo", rhs: "literal plug" },
    { mode: "n", lhs: "<Plug>Foo", lhsNotation: "<Plug>Foo", rhs: "internal plug" },
  ] }));
  // Matching metadata must survive saving and reopening a snapshot.
  const parsed = parseVimKeyMappings(JSON.parse(JSON.stringify(mappings)));
  expect(parsed).toHaveLength(5);
  expect(parsed[0].jsKeys.map((key) => key.key)).toEqual(["<", "f", "o", "o", ">"]);
  expect(parsed[1].jsKeys.map((key) => key.key)).toEqual(["<", "C", "R", ">"]);
  expect(matchKeyPressMappings([event("Enter", "Enter")], parsed[1])).toBe(false);
  expect(matchKeyPressMappings([event("Enter", "Enter")], parsed[2])).toBe(true);
  expect(parsed[3].jsKeys.map((key) => key.key)).toEqual(["<", "F", "1", ">", "F2"]);
  expect(parsed[4].jsKeys.map((key) => key.key).join("")).toBe("<Plug>Foo");
  expect(matchKeyPressMappings([
    event("<", "Comma", { shiftKey: true }), event("f"), event("o"), event("o"), event(">", "Period", { shiftKey: true }),
  ], parsed[0])).toBe(true);
});

test("unknown angle-bracket groups remain literal and can precede special keys", () => {
  const parsed = parseVimKeyMappings([{ lhs: "<foo><CR>" }, { lhs: "<<CR>" }]);
  expect(parsed[0].jsKeys.map((key) => key.key)).toEqual(["<", "f", "o", "o", ">", "Enter"]);
  expect(parsed[1].jsKeys.map((key) => key.key)).toEqual(["<", "Enter"]);
});

test("canonical unsupported special keys cannot match literal text", () => {
  const mappings = parseVimMaplist(JSON.stringify({ scripts: [], mappings: [
    { mode: "n", lhs: "<LeftMouse>", lhsNotation: "<LeftMouse>", rhs: "mouse" },
    { mode: "n", lhs: "<LeftMouse>", lhsNotation: "<lt>LeftMouse>", rhs: "literal" },
    { mode: "n", lhs: "<foo>", rhs: "legacy literal" },
  ] }));
  const parsed = parseVimKeyMappings(mappings);
  expect(parsed[0].jsKeys.map((key) => key.key)).toEqual(["LeftMouse"]);
  expect(parsed[1].jsKeys.map((key) => key.key).join("")).toBe("<LeftMouse>");
  expect(matchKeyPressMappings([event("<", "Comma", { shiftKey: true })], parsed[0])).toBe(false);
  expect(parsed[2].jsKeys.map((key) => key.key)).toEqual(["<", "f", "o", "o", ">"]);
});

test.each([
  ["<M-b>", event("∫", "KeyB", { altKey: true })],
  ["<M-B>", event("ı", "KeyB", { altKey: true, shiftKey: true })],
  ["<M-S-b>", event("ı", "KeyB", { altKey: true, shiftKey: true })],
  ["<M-e>", event("Dead", "KeyE", { altKey: true })],
  ["<M-1>", event("¡", "Digit1", { altKey: true })],
  ["<M-!>", event("⁄", "Digit1", { altKey: true, shiftKey: true })],
  ["<M-[>", event("“", "BracketLeft", { altKey: true })],
  ["<M-{>", event("”", "BracketLeft", { altKey: true, shiftKey: true })],
  ["<C-M-b>", event("∫", "KeyB", { altKey: true, ctrlKey: true })],
  ["<M-Left>", event("ArrowLeft", "ArrowLeft", { altKey: true })],
])("macOS Option keys match their underlying printable identity: %s", (lhs, pressed) => {
  const mapping = parseVimKeyMappings([{ lhs }])[0];
  expect(matchKeyPressMappings([pressed], mapping)).toBe(true);
  expect(matchKeyPressMappings([{ ...pressed, altKey: false }], mapping)).toBe(false);
  expect(matchKeyPressMappings([{ ...pressed, metaKey: true }], mapping)).toBe(false);
  expect(matchKeyPressMappings([{ ...pressed, ctrlKey: !pressed.ctrlKey }], mapping)).toBe(false);
});

test("Option matching still distinguishes Shift and works with tmux previous-word", () => {
  const parsed = parseVimKeyMappings(parseTmuxList("bind-key -T copy-mode-vi M-b send-keys -X previous-word").mappings);
  expect(matchKeyPressMappings([event("∫", "KeyB", { altKey: true })], parsed[0])).toBe(true);
  expect(matchKeyPressMappings([event("ı", "KeyB", { altKey: true, shiftKey: true })], parsed[0])).toBe(false);
  expect(matchKeyPressMappings([event("∂", "KeyD", { altKey: true })], parsed[0])).toBe(false);
  expect(matchKeyPressMappings([event("b", "", { altKey: true })], parsed[0])).toBe(true);
});
