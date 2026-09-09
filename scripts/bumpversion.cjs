const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc\.([1-9]\d*))?$/;

function nextVersion(version, part) {
  const match = versionPattern.exec(version);
  if (!match) throw new Error(`Unsupported version: ${version}`);
  const [, major, minor, patch, rc] = match;
  if (part === "patch") return `${major}.${minor}.${BigInt(patch) + 1n}-rc.1`;
  if (part === "rc" && rc) return `${major}.${minor}.${patch}-rc.${BigInt(rc) + 1n}`;
  throw new Error("Use patch to start the next patch candidate, or rc to increment an existing candidate.");
}

function validateVersion(root, tag) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "desktop/package.json")));
  const lock = JSON.parse(fs.readFileSync(path.join(root, "desktop/package-lock.json")));
  const version = manifest.version;
  if (!versionPattern.test(version)) throw new Error(`Unsupported version: ${version}`);
  if (lock.version !== version || lock.packages[""].version !== version) {
    throw new Error("Desktop package and lockfile versions must match.");
  }
  if (tag && (!version.includes("-rc.") || tag !== `v${version}`)) {
    throw new Error(`Release tag must be v${version} and use an -rc.N version.`);
  }
  return { manifest, lock, version };
}

function main(args) {
  const root = path.resolve(__dirname, "..");
  const git = (...argv) => execFileSync("git", argv, { cwd: root, encoding: "utf8" }).trim();
  const [part, option, ...extra] = args;
  if (part === "--check" && !extra.length) {
    validateVersion(root, option);
    return;
  }
  if (!["patch", "rc"].includes(part) || (option && option !== "--push") || extra.length) {
    throw new Error("Usage: npm run bumpversion -- <patch|rc> [--push]");
  }
  if (git("status", "--porcelain")) throw new Error("Commit or stash your changes before bumping the version.");
  const branch = git("symbolic-ref", "--quiet", "--short", "HEAD");
  const { manifest, lock, version } = validateVersion(root);
  const next = nextVersion(version, part);
  const tag = `v${next}`;
  if (git("tag", "--list", tag)) throw new Error(`Tag ${tag} already exists.`);
  // Check identity before changing files. Git hooks and signing settings still apply.
  git("var", "GIT_AUTHOR_IDENT");
  git("var", "GIT_COMMITTER_IDENT");
  manifest.version = lock.version = lock.packages[""].version = next;
  for (const [file, data] of [["package.json", manifest], ["package-lock.json", lock]]) {
    fs.writeFileSync(path.join(root, "desktop", file), `${JSON.stringify(data, null, 2)}\n`);
  }
  git("add", "--", "desktop/package.json", "desktop/package-lock.json");
  git("commit", "-m", `chore: bump version to ${next}`);
  git("tag", "-a", tag, "-m", `keycraft ${next}`);
  console.log(`${version} → ${next}\nCreated release commit and annotated tag ${tag}.`);
  console.log(`Push with: git push --atomic origin HEAD:refs/heads/${branch} refs/tags/${tag}`);
  if (option === "--push") {
    execFileSync("git", ["push", "--atomic", "origin", `HEAD:refs/heads/${branch}`, `refs/tags/${tag}`], {
      cwd: root, stdio: "inherit",
    });
  }
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { nextVersion, validateVersion };
