const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { importVim, commandEnvironment } = require("../import.cjs");

test("Vim import reads effective normal and insert maps from a controlled vimrc", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "keymap-import-test-"));
  const vimrc = path.join(directory, "test vimrc");
  try {
    await fs.writeFile(vimrc, 'set nocompatible\nnnoremap <silent> <Space>w :write<CR>\ninoremap jk <Esc>\n');
    const result = await importVim({ vimrc, executable: "/usr/bin/vim" });
    const data = JSON.parse(result.text);
    assert.equal(result.kind, "vim");
    assert.ok(data.mappings.some((m) => m.lhs === "<Space>w" && m.rhs === ":write<CR>" && m.mode === "n"));
    assert.ok(data.mappings.some((m) => m.lhs === "jk" && m.mode === "i"));
    const canonicalVimrc = await fs.realpath(vimrc);
    assert.ok(data.scripts.some((s) => s.name === canonicalVimrc));
    assert.deepEqual(result.warnings, []);
    assert.equal(await fs.readFile(vimrc, "utf8"), 'set nocompatible\nnnoremap <silent> <Space>w :write<CR>\ninoremap jk <Esc>\n');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("Finder imports include Homebrew locations without losing the inherited PATH", () => {
  const env = commandEnvironment();
  assert.ok(env.PATH.includes("/opt/homebrew/bin"));
  assert.ok(env.PATH.includes("/usr/local/bin"));
});

test("Vim export retains literal angle brackets alongside special keys", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "keycraft-literal-keys-test-"));
  const vimrc = path.join(directory, "vimrc");
  try {
    await fs.writeFile(vimrc, [
      "set nocompatible",
      "nnoremap <lt>foo> literal-foo",
      "nnoremap <lt>CR> literal-cr",
      "nnoremap <CR> special-cr",
      "nnoremap <lt>F1><F2> mixed-keys",
      "nnoremap <lt>Plug>Foo literal-plug",
      "inoremap {} <Esc>",
    ].join("\n"));
    const result = await importVim({ vimrc, executable: "/usr/bin/vim" });
    const { mappings } = JSON.parse(result.text);
    const notationFor = (rhs) => mappings.find((m) => m.rhs === rhs)?.lhsNotation;
    assert.equal(notationFor("literal-foo"), "<lt>foo>");
    assert.equal(notationFor("literal-cr"), "<lt>CR>");
    assert.equal(notationFor("special-cr"), "<CR>");
    assert.equal(notationFor("mixed-keys"), "<lt>F1><F2>");
    assert.equal(notationFor("literal-plug"), "<lt>Plug>Foo");
    assert.equal(notationFor("<Esc>"), "{}");
    assert.deepEqual(result.warnings, []);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("default Vim startup reads HOME vimrc and mappings installed on VimEnter", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "keycraft-startup-test-"));
  try {
    await fs.writeFile(path.join(directory, ".vimrc"), 'set nocompatible\nnnoremap <F3> :echo "vimrc loaded"<CR>\nautocmd VimEnter * nnoremap <F4> :echo "startup loaded"<CR>\n');
    const result = await importVim({ executable: "/usr/bin/vim", env: { HOME: directory, VIMINIT: "", EXINIT: "" } });
    const data = JSON.parse(result.text);
    assert.ok(data.mappings.some((m) => m.lhs === "<F3>"));
    assert.ok(data.mappings.some((m) => m.lhs === "<F4>"));
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
