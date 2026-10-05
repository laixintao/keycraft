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

function requestedVersion(current, part, requested) {
  if (!requested) return nextVersion(current, part);
  if (part !== "patch" || !versionPattern.test(requested) || !requested.includes("-rc.")) {
    throw new Error("Use make release VERSION=X.Y.Z-rc.N for a specific newer release candidate.");
  }
  const order = (value) => {
    const [, major, minor, patch, rc] = versionPattern.exec(value);
    return [major, minor, patch, rc ? "0" : "1", rc || "0"].map(BigInt);
  };
  const before = order(current);
  const after = order(requested);
  const difference = after.findIndex((item, index) => item !== before[index]);
  if (difference < 0 || after[difference] < before[difference]) {
    throw new Error(`The next version must be newer than ${current}.`);
  }
  return requested;
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
  if (branch !== "main") throw new Error("Release from the main branch.");
  const { manifest, lock, version } = validateVersion(root);
  const next = requestedVersion(version, part, process.env.VERSION);
  const tag = `v${next}`;
  if (git("tag", "--list", tag)) throw new Error(`Tag ${tag} already exists.`);
  if (option === "--push") {
    if (git("remote", "get-url", "origin") !== git("remote", "get-url", "--push", "origin")) {
      throw new Error("Fetch and push URLs must be identical for releases.");
    }
    if (git("ls-remote", "origin", `refs/tags/${tag}`)) throw new Error(`${tag} already exists on origin.`);
    git("fetch", "--quiet", "origin", "refs/heads/main", "--tags");
    const remoteHead = git("rev-parse", "FETCH_HEAD");
    if (git("merge-base", remoteHead, "HEAD") !== remoteHead) {
      throw new Error("Remote main has changes you do not have. Pull/rebase before releasing.");
    }
  }
  if (git("tag", "--list", `v${version}`) && !git("log", "--no-merges", "--format=%h", `v${version}..HEAD`)) {
    throw new Error("There are no new commits since the current release.");
  }
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
    try {
      execFileSync("git", ["push", "--atomic", "origin", "HEAD:refs/heads/main", `refs/tags/${tag}`], {
        cwd: root, stdio: "inherit",
      });
    } catch (error) {
      throw new Error(`Commit and tag are kept locally. Retry: git push --atomic origin HEAD:refs/heads/main refs/tags/${tag}\nDo not run make release again to retry this version.`, { cause: error });
    }
    console.log("GitHub Actions will build, test, package, attest, and publish.");
    console.log("Follow progress: https://github.com/laixintao/keycraft/actions/workflows/release.yml");
  }
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { nextVersion, validateVersion, requestedVersion };
