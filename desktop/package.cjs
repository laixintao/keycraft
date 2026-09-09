const fs = require("node:fs/promises");
const path = require("node:path");
const { packager } = require("@electron/packager");

(async () => {
  const stage = path.join(__dirname, "build", "app");
  await fs.mkdir(stage, { recursive: true });
  for (const file of ["main.cjs", "preload.cjs", "workspace.cjs", "import.cjs"]) {
    await fs.copyFile(path.join(__dirname, file), path.join(stage, file));
  }
  const metadata = require("./package.json");
  const { devDependencies, scripts, ...manifest } = metadata;
  await fs.writeFile(path.join(stage, "package.json"), JSON.stringify(manifest, null, 2));
  await fs.copyFile(path.join(__dirname, "../LICENSE"), path.join(stage, "LICENSE"));
  await fs.rm(path.join(stage, "web"), { recursive: true, force: true });
  await fs.cp(path.join(__dirname, "../keycraft/build"), path.join(stage, "web"), { recursive: true });
  const locations = await packager({
    dir: stage, name: "keycraft", platform: "darwin", arch: process.arch,
    electronVersion: devDependencies.electron, appBundleId: "io.xbin.keycraft",
    appCategoryType: "public.app-category.developer-tools", asar: true, overwrite: true,
    // Ad-hoc signing is for a local build without an Apple Developer team.
    osxSign: { identity: "-", identityValidation: false, optionsForFile: () => ({ hardenedRuntime: false }) },
    out: path.join(__dirname, "../dist/desktop"),
  });
  console.log(locations.join("\n"));
})().catch((error) => { console.error(error); process.exitCode = 1; });
