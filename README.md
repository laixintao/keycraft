# keycraft

![](./docs/keycraft.jpg)

A macOS app for reviewing and exploring Vim and tmux shortcuts.

- Import Vim mappings from your vimrc and plugins.
- Import tmux key tables and both prefix keys.
- Paste mappings or load an exported text file.
- Explore key sequences on the keyboard and filter mappings by mode, table, source, or command.
- Save imports as snapshots to revisit and compare your setups.
- Browse the Vim 9.0 reference with 737 entries.

## Use it

On macOS 12 Monterey or later, install with [Homebrew](https://brew.sh/):

```sh
brew install --cask laixintao/tap/keycraft
```

The [Homebrew tap](https://github.com/laixintao/homebrew-tap) distributes macOS release candidates and automatically selects the Apple Silicon or Intel build. To update, run `brew update` followed by `brew upgrade --cask laixintao/tap/keycraft`.

You can also download a macOS release candidate from [GitHub Releases](https://github.com/laixintao/keycraft/releases). Choose `macos-arm64` for Apple Silicon or `macos-x86_64` for Intel. Open the DMG and drag **keycraft.app** into **Applications**, or extract the ZIP and copy the app there. These builds are ad-hoc signed and not Apple-notarized; macOS Gatekeeper may block them, including when installed through Homebrew.

Open **keycraft.app** and click **Import from Vim**, **Import from tmux**, or **Import text or file**. Each import creates a new snapshot.

Choose **All snapshots**, **Vim**, or **tmux** in the sidebar. Use **Filter snapshots** to find a setup, then open it to explore its mappings.

Type a key sequence to narrow the results. For tmux's `prefix` table, enter your prefix first, release it, then type the command key. For copy-mode bindings, select their table and type the binding itself. Click a mapping to inspect its command and source.

Vim imports record your configured leader key and highlight it in gold on the keyboard. After entering the leader, continue typing to explore its mappings; Backspace resets the sequence. Text imports have an optional **Leader key** field. For older snapshots, use **Set leader** in the explorer; **Edit leader** updates the saved highlight without changing your Vim configuration or mappings. Use a character such as `,` or notation such as `<Space>` or `<C-a>`.

Press **Backspace** or click **Clear sequence** to reset the sequence. Text fields keep their usual editing behavior. Enter and Escape can be reviewed as bindings; turn off keyboard capture to use normal keyboard navigation. macOS may intercept reserved shortcuts before the app receives them.

Use the trash button beside a snapshot to delete it, or **Clear all snapshots** below the list to remove the entire library, including snapshots hidden by filters. Both actions require confirmation. Deleting snapshots keeps your Vim and tmux configuration and the bundled reference intact.

## Import details

Vim import starts Vim with your vimrc and plugins, so their startup behavior applies. It captures global mappings available at startup. To include buffer-local or filetype-specific mappings from an editing session, export from the relevant Vim buffer and import the text.

For Vim text imports, use `:verbose map` and `:verbose map!` output. For tmux, use `tmux list-keys` output and enter your `prefix` and `prefix2` values in the import dialog. **Import from tmux** reads these values automatically. For a custom tmux socket, paste the output of `tmux -L <name> list-keys`.

The bundled reference describes Vim 9.0 and may differ from newer versions.

## Build and run

Requirements: macOS, Node.js 22.12 or newer, npm, and Yarn Classic. Vim imports require Vim; tmux imports require tmux and a running session.

```sh
yarn --cwd keycraft install --frozen-lockfile --ignore-optional
npm --prefix desktop ci
npm run desktop
```

Dependency installation and packaging may download the Electron runtime. Optional native dependencies are skipped during UI installation.

To build the app:

```sh
npm run package:mac
```

The output is `dist/desktop/keycraft-darwin-arm64/keycraft.app` on Apple Silicon, or `darwin-x64` on an Intel Mac. Open it directly or copy it to Applications. Node.js is only needed to build it.

To build a DMG installer after installing the dependencies above:

```sh
make dmg
```

This rebuilds the app and creates `dist/desktop/keycraft-macos-arm64.dmg` on Apple Silicon, or `keycraft-macos-x64.dmg` on Intel. This local convenience command retains its historical filename; verified release assets use the standard `Keycraft-<version>-macos-<architecture>` names described below. The architecture follows the Node.js process, including when running under Rosetta. Open the DMG and drag **keycraft.app** into **Applications** to install it.

The script includes the app's license files, verifies the disk image, and cleans up temporary files. A previous DMG is replaced only after a successful build. You can also run `./scripts/build-dmg.sh` directly.

The packaging script currently uses an ad-hoc signature. Public distribution requires Developer ID signing and notarization.

## Automated tests and builds

The [CI workflow](.github/workflows/ci.yml) runs on pushes to `main` and pull requests, and can be started manually from GitHub's **Actions** tab. It calls the reusable [macOS build workflow](.github/workflows/build.yml), which is also used by releases. Development branch pushes are tested through their pull requests to avoid duplicate builds. It uses Node.js 24 and builds Apple Silicon (`arm64`) and Intel (`x86_64`) release packages on separate macOS runners; Electron internally calls the Intel build target `x64`.

Each build runs `npm test`, packages the app, runs the packaged app integration tests, and verifies the app signature. Successful builds upload `Keycraft-macos-arm64` and `Keycraft-macos-x86_64` artifacts, each containing a versioned ZIP, DMG, and internal SHA-256 checksums. Download them from the workflow run's **Artifacts** section within 14 days. Test screenshots are retained for 7 days, including screenshots available from failed runs.

The archives preserve the app's executable permissions and framework symlinks and include its license files. CI builds use the same ad-hoc signing as the packaging script and require no signing secrets. To archive an already built and tested local app, run `bash scripts/archive-macos.sh`.

## Publish a release candidate

Commit and merge your changes, then run this from a clean, up-to-date `main` branch:

```sh
make release
```

This follows the shared [make release SOP](https://github.com/laixintao/homebrew-tap/blob/main/docs/RELEASE_STANDARD.md#maintainer-command): no manual version edits, commit, or tag are needed for the release itself. It changes `0.4.0` to `0.4.1-rc.1`, updates `desktop/package.json` and both version fields in its lockfile, commits the change, creates an annotated tag, and atomically pushes `main` and the tag to `origin`. Make, Node.js, and Git are the only local requirements. The private UI package has its own version; the desktop package determines the shipped app version.

The command checks remote `main` and tag conflicts before editing files. It returns after pushing and prints the Actions URL; GitHub generates release notes and publishes after the full build succeeds. Homebrew then synchronizes through the tap's six-hour schedule or its manually triggered Update casks workflow.

For a specific newer RC, use `make release VERSION=0.5.0-rc.1`. The existing RC channel is unchanged; a stable version is rejected.

For another candidate of the same patch, use:

```sh
make rc  # 0.4.1-rc.1 → 0.4.1-rc.2
```

With no `VERSION` override, `make release` starts the next patch at `rc.1`; `make rc` remains an optional shortcut to increment the current candidate. Add `PUSH=0` to prepare only the local commit and tag, for example `make rc PUSH=0`; the command prints the exact push command. If a push fails, retry that printed command after resolving the Git error; do not run `make release` again to retry the same version. The helper requires a clean `main` worktree and never creates a stable version. Run `make` or `make help` to see the available commands.

Pushing a `vX.Y.Z-rc.N` tag triggers the dedicated [Release workflow](.github/workflows/release.yml). It validates that the tag and desktop versions match, reuses the same two-architecture build, verifies all four archives, writes one `SHA256SUMS` manifest, creates GitHub build-provenance attestations, and publishes a **Pre-release** on [GitHub Releases](https://github.com/laixintao/keycraft/releases). Release files follow `Keycraft-<version>-macos-{arm64,x86_64}.{dmg,zip}`. These downloads remain available beyond the Actions artifact retention period. The publishing job alone receives `contents: write`, `id-token: write`, and `attestations: write`; no personal access token is required. Stable tags do not publish releases.

If publication fails after creating a draft, rerun the failed job to finish the upload. Published releases are never overwritten; bump `rc` to publish a new candidate. Release candidates are never marked **Latest**.

## Development

```sh
npm run dev:ui    # Preview the React interface on port 3090
npm run build:ui  # Build the app interface
npm test          # Parsing, keyboard matching, UI flows, and storage
npm --prefix desktop run test:app # Test the packaged app
```

The UI preview supports text imports and stores preview snapshots in browser localStorage, separately from the app workspace. Use `npm run desktop` to test Vim and tmux process imports.

The packaged app test uses a temporary vimrc and isolated workspace. It checks imports, keyboard capture, tmux prefixes, window layout, filtering, dialogs, and persistence after adding or deleting snapshots. Screenshots are written to `dist/desktop/screenshots/`.

- `desktop/`: Electron window, import bridge, workspace storage, and packaging.
- `keycraft/`: React interface and keyboard visualization.
- `data/builtin_mappings.csv`: Vim reference data. Run `python3 scripts/bundle-builtin.py` to regenerate the bundled JSON after editing it.

Workspace data is stored in `~/Library/Application Support/keycraft/workspace.json`.

The Electron renderer uses context isolation and a sandbox. The import bridge exposes fixed Vim and tmux operations.
