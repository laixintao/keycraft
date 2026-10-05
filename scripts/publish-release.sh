#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  "") verify_only=false ;;
  --verify-only) verify_only=true ;;
  *) printf 'Usage: scripts/publish-release.sh [--verify-only]\n' >&2; exit 2 ;;
esac
tag="${RELEASE_TAG:-${GITHUB_REF_NAME:?Release tag is required}}"
node scripts/bumpversion.cjs --check "$tag"
version="${tag#v}"
assets=()
checksums=()
for arch in arm64 x86_64; do
  for extension in dmg zip; do
    file="Keycraft-${version}-macos-${arch}.${extension}"
    test -s "release-assets/$file"
    test -s "release-assets/$file.sha256"
    (cd release-assets && shasum -a 256 -c "$file.sha256")
    checksums+=("$(cat "release-assets/$file.sha256")")
    assets+=("release-assets/$file")
  done
done
printf '%s\n' "${checksums[@]}" > release-assets/SHA256SUMS
assets+=("release-assets/SHA256SUMS")

if [[ "$verify_only" == true ]]; then
  printf 'Verified %s release assets and wrote SHA256SUMS.\n' "$((${#assets[@]} - 1))"
  exit 0
fi

# A retry can finish a partially uploaded draft, but never replace published binaries.
if release="$(gh release view "$tag" --json isDraft,isPrerelease)"; then
  if ! jq -e '.isDraft and .isPrerelease' <<< "$release" >/dev/null; then
    printf 'Release %s is already published or is not a prerelease; refusing to overwrite it.\n' "$tag" >&2
    exit 1
  fi
else
  gh release create "$tag" --verify-tag --draft --prerelease --latest=false \
    --title "Keycraft $tag" --notes-file .github/release-notes.md --generate-notes
fi
gh release upload "$tag" "${assets[@]}" --clobber
gh release edit "$tag" --draft=false --prerelease --latest=false
