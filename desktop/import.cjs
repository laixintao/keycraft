const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const runFile = promisify(execFile);

// Finder does not inherit the PATH from an interactive terminal.
function commandEnvironment() {
  return { ...process.env, PATH: [...new Set([
    ...(process.env.PATH || "").split(path.delimiter),
    "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin",
  ].filter(Boolean))].join(path.delimiter) };
}

async function run(command, args, options = {}) {
  return runFile(command, args, {
    env: commandEnvironment(), cwd: os.homedir(), timeout: 20000,
    maxBuffer: 10 * 1024 * 1024, encoding: "utf8", ...options,
  });
}

async function importVim(options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "keymap-vim-"));
  const output = path.join(directory, "mappings.json");
  const script = path.join(directory, "export.vim");
  const quote = (value) => `'${value.replace(/'/g, "''")}'`;
  try {
    await fs.writeFile(script, [
      "set nomore",
      "function! s:ExportKeycraft() abort",
      "  let s:data = {'mappings': maplist(), 'scripts': getscriptinfo()}",
      "  for mapping in s:data.mappings",
      "    let mapping.lhsNotation = keytrans(mapping.lhsraw)",
      "  endfor",
      `  call writefile([json_encode(s:data)], ${quote(output)})`,
      "  qall!",
      "endfunction",
      "autocmd VimEnter * ++once call <SID>ExportKeycraft()",
    ].join("\n"));
    // Silent Ex mode (-es) skips the user's normal vimrc. Use normal startup
    // with pipe-friendly terminal handling, then export after VimEnter.
    const args = ["-N", "-n", "-i", "NONE", "--not-a-term"];
    if (options.vimrc) args.push("-u", options.vimrc);
    args.push("-S", script);
    let failure;
    try { await run(options.executable || "vim", args, { env: { ...commandEnvironment(), ...options.env } }); }
    catch (error) { failure = error; }
    if (failure?.code === "ENOENT") throw new Error("Vim was not found. Install Vim or paste exported mappings instead.");
    if (failure?.killed) throw new Error("Vim import timed out. A plugin may be waiting for input; try a text export instead.");
    let text;
    try { text = await fs.readFile(output, "utf8"); }
    catch { throw new Error("Vim could not export mappings. Check that your vimrc loads and Vim supports maplist() and getscriptinfo()."); }
    return {
      kind: "vim", format: "vim-maplist", text,
      sourceLabel: "Vim · global mappings",
      warnings: failure ? ["Vim reported a startup error. Exported mappings may be incomplete; check your vimrc."] : [],
    };
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

async function importTmux() {
  try {
    const { stdout: text } = await run("tmux", ["list-keys"]);
    const { stdout: prefix } = await run("tmux", ["show-options", "-gv", "prefix"]);
    const { stdout: prefix2 } = await run("tmux", ["show-options", "-gv", "prefix2"]);
    return {
      kind: "tmux", format: "tmux-list", text,
      prefix: prefix.trim(), prefix2: prefix2.trim(),
      sourceLabel: "tmux · key bindings", warnings: [],
    };
  } catch (error) {
    if (error.code === "ENOENT") throw new Error("tmux was not found. Install tmux or paste the output of tmux list-keys.");
    throw new Error("Could not read the default tmux server. Start a tmux session, then import again. For a custom socket, paste its list-keys output.");
  }
}

module.exports = { importVim, importTmux, commandEnvironment };
