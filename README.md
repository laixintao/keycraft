# keycraft

A macOS app for reviewing and exploring Vim and tmux shortcuts.

- Import Vim mappings from your vimrc and plugins.
- Import tmux key tables and both prefix keys.
- Paste mappings or load an exported text file.
- Explore key sequences on the keyboard and filter mappings by mode, table, source, or command.
- Save imports as snapshots to revisit and compare your setups.
- Browse the Vim 9.0 reference with 737 entries.

## Use it

Download a release candidate from [GitHub Releases](https://github.com/laixintao/keycraft/releases). Choose `macos-arm64` for Apple Silicon or `macos-x64` for Intel. Open the DMG and drag **keycraft.app** into **Applications**, or extract the ZIP and copy the app there. These builds are ad-hoc signed and not Apple-notarized; macOS Gatekeeper may block them.

Open **keycraft.app** and click **Import from Vim**, **Import from tmux**, or **Import text or file**. Each import creates a new snapshot.

Choose **All snapshots**, **Vim**, or **tmux** in the sidebar. Use **Filter snapshots** to find a setup, then open it to explore its mappings.

Type a key sequence to narrow the results. For tmux's `prefix` table, enter your prefix first, release it, then type the command key. For copy-mode bindings, select their table and type the binding itself. Click a mapping to inspect its command and source.

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

The packaging script currently uses an ad-hoc signature. Public distribution requires Developer ID signing and notarization.

## Automated tests and builds

The [Test, build and release workflow](.github/workflows/ci.yml) runs on pushes to `main`, RC tag pushes, and pull requests, and can be started manually from GitHub's **Actions** tab. Development branch pushes are tested through their pull requests to avoid duplicate builds; branches without a pull request can be tested with a manual run. It uses Node.js 24 and builds Apple Silicon (`arm64`) and Intel (`x64`) versions on separate macOS runners.

Each build runs `npm test`, packages the app, runs the packaged app integration tests, and verifies the app signature. Successful builds upload `keycraft-macos-arm64` and `keycraft-macos-x64` artifacts, each containing a versioned ZIP, DMG, and SHA-256 checksums. Download them from the workflow run's **Artifacts** section within 14 days. Test screenshots are retained for 7 days, including screenshots available from failed runs.

The archives preserve the app's executable permissions and framework symlinks and include its license files. CI builds use the same ad-hoc signing as the packaging script and require no signing secrets. To archive an already built and tested local app, run `bash scripts/archive-macos.sh`.

## Publish a release candidate

Commit your changes, then run this from the branch you want to release:

```sh
make release
```

This changes `0.4.0` to `0.4.1-rc.1`, updates `desktop/package.json` and both version fields in its lockfile, commits the change, creates an annotated `v0.4.1-rc.1` tag, and atomically pushes the current branch and that tag to `origin`. Make, Node.js, and Git are the only local requirements for this command. The private UI package has its own version; the desktop package determines the shipped app version.

For another candidate of the same patch, use:

```sh
make rc  # 0.4.1-rc.1 → 0.4.1-rc.2
```

`make release` always starts the next patch at `rc.1`; `make rc` increments the current candidate. Add `PUSH=0` to prepare only the local commit and tag, for example `make rc PUSH=0`; the command prints the exact push command. If a push fails, retry that printed command after resolving the Git error. The helper requires a clean working tree and never creates a stable version. Run `make` or `make help` to see the available commands.

Pushing a `vX.Y.Z-rc.N` tag triggers the full build. The workflow validates that the tag and desktop versions match, waits for both architectures to pass, verifies all four archives against their checksums, and uploads all eight files before publishing a **Pre-release** on [GitHub Releases](https://github.com/laixintao/keycraft/releases). These downloads remain available beyond the Actions artifact retention period. It uses the built-in `GITHUB_TOKEN` with `contents: write` only in the publishing job; no personal access token is required. Branch pushes, pull requests, manual runs, and stable tags do not publish releases.

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
