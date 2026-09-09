const fs = require("node:fs/promises");
const path = require("node:path");

const emptyWorkspace = () => ({ version: 1, profiles: [] });

function validateWorkspace(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.profiles)) {
    throw new Error("Unrecognized workspace format. Your saved file has not been changed.");
  }
  const ids = new Set();
  for (const profile of value.profiles) {
    if (!profile || typeof profile.id !== "string" || ids.has(profile.id) ||
        typeof profile.name !== "string" || !["vim", "tmux"].includes(profile.kind) ||
        !Array.isArray(profile.mappings) || profile.mappings.some((m) =>
          !m || typeof m.lhs !== "string" || typeof m.rhs !== "string")) {
      throw new Error("Invalid mapping profile. Your saved file has not been changed.");
    }
    ids.add(profile.id);
  }
  return value;
}

async function loadWorkspace(filename) {
  try {
    return validateWorkspace(JSON.parse(await fs.readFile(filename, "utf8")));
  } catch (error) {
    if (error.code === "ENOENT") return emptyWorkspace();
    throw error;
  }
}

async function saveWorkspace(filename, value) {
  const content = JSON.stringify(validateWorkspace(value), null, 2);
  if (Buffer.byteLength(content) > 20 * 1024 * 1024) throw new Error("Workspace exceeds 20 MB.");
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.tmp`;
  await fs.writeFile(temporary, content, { mode: 0o600 });
  await fs.rename(temporary, filename);
}

module.exports = { emptyWorkspace, validateWorkspace, loadWorkspace, saveWorkspace };
