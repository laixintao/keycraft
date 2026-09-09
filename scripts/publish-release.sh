#!/usr/bin/env bash
set -euo pipefail

tag="${GITHUB_REF_NAME:?Release tag is required}"
node scripts/bumpversion.cjs --check "$tag"
version="${tag#v}"
assets=()
for arch in arm64 x64; do
  for extension in zip dmg; do
    file="keycraft-${version}-macos-${arch}.${extension}"
    test -s "release-assets/$file"
    test -s "release-assets/$file.sha256"
    (cd release-assets && shasum -a 256 -c "$file.sha256")
    assets+=("release-assets/$file" "release-assets/$file.sha256")
  done
done

# A retry can finish a partially uploaded draft, but never replace published binaries.
if release="$(gh release view "$tag" --json isDraft,isPrerelease)"; then
  if ! jq -e '.isDraft and .isPrerelease' <<< "$release" >/dev/null; then
    printf 'Release %s is already published or is not a prerelease; refusing to overwrite it.\n' "$tag" >&2
    exit 1
  fi
else
  gh release create "$tag" --verify-tag --draft --prerelease --latest=false \
    --title "keycraft $tag" --notes-file .github/release-notes.md --generate-notes
fi
gh release upload "$tag" "${assets[@]}" --clobber
gh release edit "$tag" --draft=false --prerelease --latest=false
