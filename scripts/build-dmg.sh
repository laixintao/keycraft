#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

if [[ "$(uname -s)" != "Darwin" ]]; then
  printf 'DMG builds require macOS.\n' >&2
  exit 1
fi

for tool in node npm ditto hdiutil; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf 'Required command not found: %s\n' "$tool" >&2
    exit 1
  fi
done

# Match the architecture used by desktop/package.cjs, including under Rosetta.
build_arch="$(node -p 'process.arch')"
npm run package:mac

output_dir="$project_root/dist/desktop"
app_dir="$output_dir/keycraft-darwin-$build_arch"
dmg_path="$output_dir/keycraft-macos-$build_arch.dmg"
stage_dir="$(mktemp -d "$output_dir/.dmg-build.XXXXXX")"
trap 'rm -rf "$stage_dir"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Copy the full app distribution to preserve its licenses and framework links.
ditto "$app_dir" "$stage_dir/contents"
ln -s /Applications "$stage_dir/contents/Applications"
hdiutil create \
  -volname "keycraft" \
  -srcfolder "$stage_dir/contents" \
  -format UDZO \
  "$stage_dir/keycraft.dmg"
hdiutil verify "$stage_dir/keycraft.dmg"

# Replace the previous installer only after the new image has been verified.
mv -f "$stage_dir/keycraft.dmg" "$dmg_path"
printf '\nBuilt installer: %s\n' "$dmg_path"
