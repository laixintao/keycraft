const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { nextVersion, validateVersion } = require("../bumpversion.cjs");

function fixture(t, version = "0.4.0") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "keycraft-release-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "desktop"));
  fs.mkdirSync(path.join(root, "scripts"));
  fs.copyFileSync(path.join(__dirname, "../bumpversion.cjs"), path.join(root, "scripts/bumpversion.cjs"));
  const write = (file, value) => fs.writeFileSync(path.join(root, file), JSON.stringify(value, null, 2) + "\n");
  write("desktop/package.json", { name: "keycraft", version, private: true });
  write("desktop/package-lock.json", {
    name: "keycraft", version, lockfileVersion: 3,
    packages: { "": { name: "keycraft", version }, "node_modules/example": { version: "1.0.0" } },
  });
  // Keep tests independent of the user's signing, hooks, and Git identity.
  const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete env[key];
  const git = (...args) => execFileSync("git", args, { cwd: root, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-b", "test-release");
  git("config", "user.name", "Release test");
  git("config", "user.email", "release@example.invalid");
  git("add", ".");
  git("commit", "-m", "Initial fixture");
  const run = (...args) => spawnSync(process.execPath, ["scripts/bumpversion.cjs", ...args], { cwd: root, env, encoding: "utf8" });
  return { root, write, git, run };
}

test("patch starts a candidate and rc advances only an existing candidate", () => {
  assert.equal(nextVersion("0.4.0", "patch"), "0.4.1-rc.1");
  assert.equal(nextVersion("0.4.1-rc.9", "rc"), "0.4.1-rc.10");
  assert.equal(nextVersion("0.4.1-rc.9", "patch"), "0.4.2-rc.1");
  assert.throws(() => nextVersion("0.4.0", "rc"));
  assert.throws(() => nextVersion("0.4.0", "minor"));
  for (const version of ["01.2.3", "1.2.3-rc.0", "1.2.3-rc.01", "1.2.3-beta.1", "v1.2.3"]) {
    assert.throws(() => nextVersion(version, "patch"));
  }
});

test("bump creates a clean commit and annotated tag with synchronized app metadata", (t) => {
  const { root, git, run } = fixture(t);
  const before = git("rev-parse", "HEAD");
  const result = run("patch");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(validateVersion(root, "v0.4.1-rc.1").version, "0.4.1-rc.1");
  assert.equal(git("rev-parse", "HEAD^"), before);
  assert.equal(git("cat-file", "-t", "v0.4.1-rc.1"), "tag");
  assert.equal(git("rev-parse", "v0.4.1-rc.1^{}"), git("rev-parse", "HEAD"));
  assert.equal(git("status", "--porcelain"), "");
  assert.equal(validateVersion(root).lock.packages["node_modules/example"].version, "1.0.0");
  assert.match(result.stdout, /git push --atomic origin HEAD:refs\/heads\/test-release refs\/tags\/v0\.4\.1-rc\.1/);
  assert.equal(run("rc").status, 0);
  assert.equal(validateVersion(root, "v0.4.1-rc.2").version, "0.4.1-rc.2");
});

test("dirty worktrees, duplicate tags, and invalid arguments fail without a release commit", (t) => {
  const { root, git, run } = fixture(t);
  const before = git("rev-parse", "HEAD");
  fs.writeFileSync(path.join(root, "uncommitted.txt"), "do not include me");
  assert.match(run("patch").stderr, /Commit or stash/);
  fs.unlinkSync(path.join(root, "uncommitted.txt"));
  git("tag", "v0.4.1-rc.1");
  assert.match(run("patch").stderr, /already exists/);
  assert.equal(run("patch", "--force").status, 1);
  assert.equal(run("minor").status, 1);
  assert.equal(git("rev-parse", "HEAD"), before);
  assert.equal(validateVersion(root).version, "0.4.0");
});

test("release validation rejects stable tags, tag mismatches, and either stale lockfile version", (t) => {
  const { root, write, run } = fixture(t, "0.4.1-rc.1");
  assert.equal(run("--check", "v0.4.1-rc.1").status, 0);
  assert.equal(run("--check", "v0.4.1-rc.2").status, 1);
  assert.equal(run("--check", "v0.4.1").status, 1);
  for (const field of ["top", "package"]) {
    const lock = { version: "0.4.1-rc.1", packages: { "": { version: "0.4.1-rc.1" } } };
    if (field === "top") lock.version = "0.4.0";
    else lock.packages[""].version = "0.4.0";
    write("desktop/package-lock.json", lock);
    assert.throws(() => validateVersion(root), /must match/);
  }
});

test("--push publishes only the current branch and new tag to a local bare remote", (t) => {
  const { root, git, run } = fixture(t);
  const remote = fs.mkdtempSync(path.join(os.tmpdir(), "keycraft-remote-"));
  t.after(() => fs.rmSync(remote, { recursive: true, force: true }));
  git("init", "--bare", remote);
  git("remote", "add", "origin", remote);
  git("tag", "unrelated-local-tag");
  const result = run("patch", "--push");
  assert.equal(result.status, 0, result.stderr);
  const refs = git("ls-remote", "origin");
  assert.match(refs, /refs\/heads\/test-release/);
  assert.match(refs, /refs\/tags\/v0\.4\.1-rc\.1/);
  assert.ok(!refs.includes("unrelated-local-tag"));
  assert.equal(validateVersion(root).version, "0.4.1-rc.1");
});
