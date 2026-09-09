#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
version="$(node -p 'require("./desktop/package.json").version')"
build_arch="$(node -p 'process.arch')"
node scripts/bumpversion.cjs --check

cd dist/desktop
archive="keycraft-${version}-macos-${build_arch}"
app_dir="keycraft-darwin-${build_arch}"
test -d "$app_dir/keycraft.app"
app_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app_dir/keycraft.app/Contents/Info.plist")"
if [[ "$app_version" != "$version" ]]; then
  printf 'Packaged app version %s does not match %s; rebuild the app first.\n' "$app_version" "$version" >&2
  exit 1
fi
stage_dir="$(mktemp -d "$PWD/.release-build.XXXXXX")"
trap 'rm -rf "$stage_dir"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Preserve executable permissions, framework symlinks, and the bundled licenses.
ditto -c -k --sequesterRsrc --keepParent "$app_dir" "$stage_dir/$archive.zip"
ditto "$app_dir" "$stage_dir/contents"
ln -s /Applications "$stage_dir/contents/Applications"
# Use HFS+ explicitly instead of the host's default APFS and its helper devices.
hdiutil create -fs HFS+ -volname "keycraft $version" -srcfolder "$stage_dir/contents" \
  -format UDZO "$stage_dir/$archive.dmg"
hdiutil verify "$stage_dir/$archive.dmg"
for extension in zip dmg; do
  mv -f "$stage_dir/$archive.$extension" "$archive.$extension"
  shasum -a 256 "$archive.$extension" > "$archive.$extension.sha256"
done
