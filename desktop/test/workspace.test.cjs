const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { loadWorkspace, saveWorkspace } = require("../workspace.cjs");

test("workspace survives a fresh load; invalid writes preserve the previous snapshot", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "keymap-store-test-"));
  const filename = path.join(directory, "workspace.json");
  try {
    assert.deepEqual(await loadWorkspace(filename), { version: 1, profiles: [] });
    const snapshot = { version: 1, profiles: [{ id: "one", name: "My Vim", kind: "vim", mappings: [{ lhs: "<CR>", rhs: ":write<CR>" }] }] };
    await saveWorkspace(filename, snapshot);
    assert.deepEqual(await loadWorkspace(filename), snapshot);
    await assert.rejects(saveWorkspace(filename, { version: 2, profiles: [] }), /Unrecognized/);
    assert.deepEqual(await loadWorkspace(filename), snapshot);
    assert.equal((await fs.stat(filename)).mode & 0o777, 0o600);
    await fs.writeFile(filename, "broken JSON");
    await assert.rejects(loadWorkspace(filename), SyntaxError);
    assert.equal(await fs.readFile(filename, "utf8"), "broken JSON");
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
