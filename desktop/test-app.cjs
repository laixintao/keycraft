const { _electron } = require("playwright-core");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "keycraft-ui-"));
  const profileDirectory = path.join(directory, "profile");
  const fixtureHome = path.join(directory, "home");
  const artifacts = path.join(__dirname, "../dist/desktop/screenshots");
  await fs.mkdir(fixtureHome);
  await fs.mkdir(profileDirectory);
  await fs.mkdir(artifacts, { recursive: true });
  await fs.writeFile(path.join(fixtureHome, ".vimrc"), 'set nocompatible\nnnoremap <CR> :write<CR>\ninoremap jk <Esc>\n');
  const executable = path.join(__dirname, `../dist/desktop/keycraft-darwin-${process.arch}/keycraft.app/Contents/MacOS/keycraft`);
  let app;
  const errors = [];
  const launch = async () => {
    app = await _electron.launch({
      executablePath: executable, args: [`--user-data-dir=${profileDirectory}`],
      env: { ...process.env, HOME: fixtureHome, VIMINIT: "", EXINIT: "" }, timeout: 20000,
    });
    const page = await app.firstWindow();
    page.on("pageerror", (error) => errors.push(error.message));
    const actualPath = await app.evaluate(({ app }) => app.getPath("userData"));
    assert.equal(await fs.realpath(actualPath), await fs.realpath(profileDirectory), "UI test must use isolated data");
    await page.getByRole("heading", { name: "Workspace", exact: true }).waitFor();
    return page;
  };
  const assertWindowLayout = async (page) => {
    const layout = await page.evaluate(() => ({
      width: innerWidth, height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
      appHeight: document.querySelector(".app-window").scrollHeight,
    }));
    assert.equal(layout.scrollWidth, layout.width, "No horizontal page overflow");
    assert.equal(layout.scrollHeight, layout.height, "No outer page scrollbar");
    assert.equal(layout.appHeight, layout.height, "App content fits the window without clipping");
  };
  try {
    let page = await launch();
    await assertWindowLayout(page);
    await page.screenshot({ path: path.join(artifacts, "home.png") });
    await page.getByRole("link", { name: "Explore Vim built-ins" }).click();
    await page.getByRole("heading", { name: "Vim built-ins" }).waitFor();
    if (await page.getByRole("button", { name: "Clear sequence" }).isVisible()) await page.getByRole("button", { name: "Clear sequence" }).click();
    assert.ok(parseInt(await page.getByRole("status").innerText(), 10) > 500);
    await assertWindowLayout(page);
    await page.screenshot({ path: path.join(artifacts, "vim-reference.png") });
    await page.getByRole("link", { name: "← Workspace" }).click();
    await page.getByRole("button", { name: "Import from Vim" }).click();
    await page.getByRole("button", { name: "Keyboard capture on" }).waitFor();
    await page.keyboard.press("Enter");
    assert.equal(await page.getByRole("status").innerText(), "1 mappings");
    await page.getByRole("button", { name: "Clear sequence" }).click();
    await page.getByRole("link", { name: "← Workspace" }).click();
    await page.getByRole("button", { name: "Paste tmux bindings" }).click();
    await page.getByLabel("Snapshot name").fill("tmux review fixture");
    await page.getByLabel("Prefix", { exact: true }).fill("C-a");
    await page.getByLabel("Exported mappings").fill("bind-key -T prefix c new-window\nbind-key -T root M-Left previous-window\nbind-key -T copy-mode-vi y send-keys -X copy-selection-and-cancel");
    await page.getByRole("button", { name: "Save and explore →" }).click();
    await page.getByRole("heading", { name: "tmux review fixture" }).waitFor();
    const prefixPanel = page.getByRole("region", { name: "tmux prefix" });
    assert.ok(await prefixPanel.getByText("Ctrl + A", { exact: true }).isVisible());
    assert.ok(await page.getByTitle("Part of the tmux prefix").count() >= 2);
    await page.screenshot({ path: path.join(artifacts, "tmux-prefix.png") });
    await page.keyboard.press("Control+a");
    assert.ok(await prefixPanel.getByText("Prefix received — press the next key.", { exact: true }).isVisible());
    await page.screenshot({ path: path.join(artifacts, "tmux-prefix-ready.png") });
    await page.keyboard.press("c");
    assert.equal(await page.getByRole("status").innerText(), "1 mappings");
    await page.screenshot({ path: path.join(artifacts, "tmux-review.png") });
    const search = page.getByRole("textbox", { name: "Search mappings" });
    await search.fill("new-windowx");
    await search.press("Backspace");
    assert.equal(await search.inputValue(), "new-window");
    assert.ok(await page.getByRole("button", { name: "Clear sequence" }).isVisible());
    await search.fill("");
    await page.locator(".pressed-key-box").click({ position: { x: 2, y: 2 } });
    await page.keyboard.press("Backspace");
    assert.equal(await page.getByRole("status").innerText(), "3 mappings");
    assert.equal(await page.getByRole("button", { name: "Clear sequence" }).count(), 0);
    assert.ok(await prefixPanel.getByText("Press a prefix, release it, then press a command key.", { exact: true }).isVisible());
    await app.close(); app = null;
    page = await launch();
    await page.getByRole("link").filter({ hasText: "tmux review fixture" }).click();
    await page.getByRole("heading", { name: "tmux review fixture" }).waitFor();
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent === '3 mappings');
    assert.equal(await page.getByRole("status").innerText(), "3 mappings");
    assert.ok(await page.getByRole("region", { name: "tmux prefix" }).getByText("Ctrl + A", { exact: true }).isVisible());
    const saved = JSON.parse(await fs.readFile(path.join(profileDirectory, "workspace.json"), "utf8"));
    assert.equal(saved.profiles.length, 2);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1024, 760));
    await page.waitForFunction(() => innerWidth === 1024 && innerHeight === 760);
    await assertWindowLayout(page);
    const keyboard = await page.locator(".keyboard-container").boundingBox();
    assert.ok(keyboard.y + keyboard.height <= 760, "Keyboard stays inside the minimum window size");
    const mappings = await page.locator(".key-mapping-card").boundingBox();
    assert.ok(mappings.height >= 100, "Mapping list remains usable at minimum window size");
    await page.screenshot({ path: path.join(artifacts, "tmux-compact.png") });
    await app.close(); app = null;
    // Populate only the isolated test workspace to exercise a long, scrollable library.
    saved.profiles.push(...Array.from({ length: 30 }, (_, i) => ({
      ...saved.profiles[i % 2], id: `library-${i}`, name: `Saved setup ${String(i + 1).padStart(2, "0")}`,
    })));
    await fs.writeFile(path.join(profileDirectory, "workspace.json"), JSON.stringify(saved));
    page = await launch();
    await page.getByRole("link").filter({ hasText: "Saved setup 30" }).waitFor();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1024, 760));
    await page.waitForFunction(() => innerWidth === 1024 && innerHeight === 760);
    await assertWindowLayout(page);
    const list = page.getByRole("region", { name: "Snapshot list", exact: true });
    const overflow = await list.evaluate((element) => element.scrollHeight > element.clientHeight);
    assert.ok(overflow, "Long libraries scroll inside their own pane");
    const toolbarBefore = await page.locator(".workspace-toolbar").boundingBox();
    await list.hover();
    await page.mouse.wheel(0, 2500);
    await page.waitForFunction(() => document.querySelector(".snapshot-list").scrollTop > 0);
    await list.getByRole("link").last().scrollIntoViewIfNeeded();
    assert.deepEqual(await page.locator(".workspace-toolbar").boundingBox(), toolbarBefore, "Scrolling leaves the toolbar fixed");
    await assertWindowLayout(page);
    await page.screenshot({ path: path.join(artifacts, "workspace-compact.png") });
    await page.getByRole("button", { name: "tmux snapshots", exact: true }).click();
    assert.equal(await list.getByRole("link").count(), 16);
    const snapshotSearch = page.getByRole("searchbox", { name: "Search snapshots" });
    await snapshotSearch.fill("tmux review fixture");
    assert.equal(await list.getByRole("link").count(), 1);
    await snapshotSearch.fill("no-such-snapshot");
    assert.ok(await list.getByText("No matching snapshots").isVisible());
    await snapshotSearch.fill("");
    await page.getByRole("button", { name: "All snapshots", exact: true }).click();
    await page.getByRole("button", { name: "Paste tmux bindings" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await page.getByLabel("Exported mappings").fill("bind-key -T prefix c new-window\n".repeat(100));
    await assertWindowLayout(page);
    const submit = await dialog.getByRole("button", { name: "Save and explore →" }).boundingBox();
    assert.ok(submit.y > 0 && submit.y + submit.height < 760, "Import action remains inside the window");
    await page.screenshot({ path: path.join(artifacts, "import-dialog.png"), animations: "disabled" });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.ok(await page.getByRole("button", { name: "Paste tmux bindings" }).evaluate((element) => element === document.activeElement), "Closing import returns keyboard focus to its trigger");
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 900));
    await page.waitForFunction(() => innerWidth === 1280 && innerHeight === 900);
    await list.evaluate((element) => { element.scrollTop = 0; });
    await page.screenshot({ path: path.join(artifacts, "workspace.png") });

    // Deletions must reach disk and remain deleted after restarting the App.
    await page.getByRole("button", { name: "Delete snapshot tmux review fixture", exact: true }).click();
    let deletion = page.getByRole("dialog", { name: "Delete snapshot?", exact: true });
    await deletion.getByRole("button", { name: "Cancel", exact: true }).click();
    await deletion.waitFor({ state: "hidden" });
    assert.equal(JSON.parse(await fs.readFile(path.join(profileDirectory, "workspace.json"), "utf8")).profiles.length, 32);
    await page.getByRole("button", { name: "Delete snapshot tmux review fixture", exact: true }).click();
    await page.screenshot({ path: path.join(artifacts, "delete-snapshot.png"), animations: "disabled" });
    await deletion.getByRole("button", { name: "Delete snapshot", exact: true }).click();
    await deletion.waitFor({ state: "hidden" });
    const remaining = JSON.parse(await fs.readFile(path.join(profileDirectory, "workspace.json"), "utf8"));
    assert.equal(remaining.profiles.length, 31);
    assert.ok(!remaining.profiles.some((profile) => profile.name === "tmux review fixture"));
    await app.close(); app = null;
    page = await launch();
    await page.getByRole("button", { name: "Clear all snapshots", exact: true }).waitFor();
    await page.getByRole("link").filter({ hasText: "Saved setup 30" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Delete snapshot tmux review fixture", exact: true }).count(), 0);
    await page.getByRole("button", { name: "Vim snapshots", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search snapshots" }).fill("no-such-snapshot");
    await page.getByRole("button", { name: "Clear all snapshots", exact: true }).click();
    deletion = page.getByRole("dialog", { name: "Clear all snapshots?", exact: true });
    assert.ok(await deletion.getByText("Delete all 31 saved snapshots, including those hidden by filters?").isVisible());
    await page.screenshot({ path: path.join(artifacts, "clear-snapshots.png"), animations: "disabled" });
    await deletion.getByRole("button", { name: "Delete all snapshots", exact: true }).click();
    await deletion.waitFor({ state: "hidden" });
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(profileDirectory, "workspace.json"), "utf8")), { version: 1, profiles: [] });
    assert.equal((await fs.stat(path.join(profileDirectory, "workspace.json"))).mode & 0o777, 0o600);
    await app.close(); app = null;
    page = await launch();
    await page.getByText("No snapshots yet", { exact: true }).waitFor();
    assert.ok(await page.getByRole("button", { name: "Clear all snapshots", exact: true }).isDisabled());
    await page.getByRole("link", { name: "Explore Vim built-ins", exact: true }).click();
    await page.getByRole("heading", { name: "Vim built-ins", exact: true }).waitFor();
    assert.ok(parseInt(await page.getByRole("status").innerText(), 10) > 500);
    assert.deepEqual(errors, []);
    console.log("Packaged App passed: offline reference, native Vim import, Enter capture, tmux prefixes, Backspace reset, persistence, compact window, pane scrolling, library filters, import dialog, focus restoration, confirmed deletion and clearing all snapshots across restart; no renderer errors.");
    console.log(`Screenshots: ${artifacts}`);
  } finally {
    if (app) await app.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
