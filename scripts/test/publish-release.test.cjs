const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "keycraft-publish-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const directory of ["scripts", "desktop", "release-assets", "bin"]) fs.mkdirSync(path.join(root, directory));
  for (const file of ["bumpversion.cjs", "publish-release.sh"]) {
    fs.copyFileSync(path.join(__dirname, "..", file), path.join(root, "scripts", file));
  }
  const version = "0.4.1-rc.1";
  fs.writeFileSync(path.join(root, "desktop/package.json"), JSON.stringify({ version }));
  fs.writeFileSync(path.join(root, "desktop/package-lock.json"), JSON.stringify({ version, packages: { "": { version } } }));
  const assets = [];
  for (const arch of ["arm64", "x64"]) {
    for (const extension of ["zip", "dmg"]) {
      const file = `keycraft-${version}-macos-${arch}.${extension}`;
      const content = `archive fixture: ${file}`;
      fs.writeFileSync(path.join(root, "release-assets", file), content);
      const digest = crypto.createHash("sha256").update(content).digest("hex");
      fs.writeFileSync(path.join(root, "release-assets", `${file}.sha256`), `${digest}  ${file}\n`);
      assets.push(file);
    }
  }
  const log = path.join(root, "gh-calls.jsonl");
  fs.writeFileSync(path.join(root, "bin/gh"), `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.RELEASE_TEST_LOG, JSON.stringify(args) + "\\n");
if (args[1] === "view") {
  const state = process.env.RELEASE_TEST_STATE;
  if (state === "missing") process.exit(1);
  console.log(JSON.stringify({ isDraft: state !== "published", isPrerelease: state !== "stable" }));
}
if (args[1] === "upload" && process.env.RELEASE_TEST_FAIL_UPLOAD) process.exit(1);
`, { mode: 0o755 });
  const run = (state = "missing", extraEnv = {}) => spawnSync("bash", ["scripts/publish-release.sh"], {
    cwd: root, encoding: "utf8",
    env: { ...process.env, PATH: `${root}/bin:${process.env.PATH}`, GITHUB_REF_NAME: `v${version}`,
      RELEASE_TEST_LOG: log, RELEASE_TEST_STATE: state, ...extraEnv },
  });
  const calls = () => fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").map(JSON.parse) : [];
  return { root, assets, run, calls };
}

test("publishes an RC only after all eight assets are uploaded to a draft", (t) => {
  const { run, calls, assets } = fixture(t);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const commands = calls();
  assert.deepEqual(commands.map((args) => args[1]), ["view", "create", "upload", "edit"]);
  for (const flag of ["--draft", "--prerelease", "--latest=false", "--verify-tag"]) assert.ok(commands[1].includes(flag));
  for (const file of assets) {
    assert.ok(commands[2].includes(`release-assets/${file}`));
    assert.ok(commands[2].includes(`release-assets/${file}.sha256`));
  }
  for (const flag of ["--draft=false", "--prerelease", "--latest=false"]) assert.ok(commands[3].includes(flag));
});

test("retries an existing RC draft without recreating it", (t) => {
  const { run, calls } = fixture(t);
  const result = run("draft");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls().map((args) => args[1]), ["view", "upload", "edit"]);
});

for (const state of ["published", "stable"]) {
  test(`never overwrites a ${state} release`, (t) => {
    const { run, calls } = fixture(t);
    assert.equal(run(state).status, 1);
    assert.deepEqual(calls().map((args) => args[1]), ["view"]);
  });
}

test("an upload failure leaves the release as a draft", (t) => {
  const { run, calls } = fixture(t);
  assert.equal(run("missing", { RELEASE_TEST_FAIL_UPLOAD: "1" }).status, 1);
  assert.deepEqual(calls().map((args) => args[1]), ["view", "create", "upload"]);
});

for (const failure of ["missing", "corrupt", "wrong-tag"]) {
  test(`${failure} assets or metadata block every GitHub operation`, (t) => {
    const { root, assets, run, calls } = fixture(t);
    const file = path.join(root, "release-assets", assets.at(-1));
    if (failure === "missing") fs.unlinkSync(file);
    if (failure === "corrupt") fs.appendFileSync(file, "corruption");
    const result = run("missing", failure === "wrong-tag" ? { GITHUB_REF_NAME: "v0.4.1" } : {});
    assert.notEqual(result.status, 0);
    assert.deepEqual(calls(), []);
  });
}
