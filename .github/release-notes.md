This is a release candidate for testing.

| Mac | Download |
| --- | --- |
| Apple Silicon (M1 and newer) | `macos-arm64.dmg` or `macos-arm64.zip` |
| Intel | `macos-x86_64.dmg` or `macos-x86_64.zip` |

Asset names include the version number. Open the DMG and drag **keycraft.app** into **Applications**, or extract the ZIP and copy the app there. Node.js is not required to run the app. Vim imports require Vim; tmux imports require tmux and a running session.

These test builds use ad-hoc signing and are not Apple-notarized. macOS Gatekeeper may block the downloaded app. Developer ID signing and notarization are still needed for normal public distribution.

SHA-256 checksums for all downloads are in `SHA256SUMS`; run `shasum -a 256 -c SHA256SUMS` after downloading all four files. GitHub build-provenance attestations are also available for each DMG and ZIP.
