const { app, BrowserWindow, ipcMain, Menu, protocol, session } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { loadWorkspace, saveWorkspace } = require("./workspace.cjs");
const { importVim, importTmux } = require("./import.cjs");

app.setName("keycraft");
protocol.registerSchemesAsPrivileged([
  { scheme: "keymap", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
let window;
let saving = Promise.resolve();
let importing = false;
const origin = "keymap://app";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf" };

function trusted(event) {
  if (event.sender !== window?.webContents || event.senderFrame !== event.sender.mainFrame ||
      !event.senderFrame.url.startsWith(`${origin}/`)) throw new Error("Unknown application window.");
}

function createWindow() {
  window = new BrowserWindow({
    width: 1280, height: 900, minWidth: 1024, minHeight: 760,
    title: "keycraft", backgroundColor: "#f7f8f4", show: false,
    ...(process.platform === "darwin" ? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 16, y: 20 } } : {}),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => { window = null; });
  window.loadURL(`${origin}/index.html`);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(() => {
    const assets = app.isPackaged ? path.join(__dirname, "web") : path.join(__dirname, "../keycraft/build");
    protocol.handle("keymap", async (request) => {
      try {
        const url = new URL(request.url);
        if (url.hostname !== "app") return new Response("Not found", { status: 404 });
        const filename = path.resolve(assets, `.${decodeURIComponent(url.pathname)}`);
        if (!filename.startsWith(`${assets}${path.sep}`)) return new Response("Not found", { status: 404 });
        return new Response(await fs.readFile(filename), { headers: {
          "Content-Type": types[path.extname(filename)] || "application/octet-stream",
          "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'",
        } });
      } catch { return new Response("Not found", { status: 404 }); }
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    const filename = path.join(app.getPath("userData"), "workspace.json");
    ipcMain.handle("workspace:load", (event) => { trusted(event); return loadWorkspace(filename); });
    ipcMain.handle("workspace:save", (event, value) => {
      trusted(event);
      const pending = saving.then(() => saveWorkspace(filename, value));
      saving = pending.catch(() => {});
      return pending;
    });
    ipcMain.handle("mappings:import", async (event, kind) => {
      trusted(event);
      if (!["vim", "tmux"].includes(kind)) throw new Error("Unsupported mapping source.");
      if (importing) throw new Error("An import is already running.");
      importing = true;
      try { return await (kind === "vim" ? importVim() : importTmux()); }
      finally { importing = false; }
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { role: "appMenu" }, { role: "editMenu" },
      { label: "View", submenu: [{ role: "reload" }, { role: "toggleDevTools" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { role: "togglefullscreen" }] },
      { role: "windowMenu" },
    ]));
    createWindow();
    app.on("activate", () => { if (!window) createWindow(); });
  });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
}
