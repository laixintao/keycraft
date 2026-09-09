const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("keymapDesktop", {
  loadWorkspace: () => ipcRenderer.invoke("workspace:load"),
  saveWorkspace: (workspace) => ipcRenderer.invoke("workspace:save", workspace),
  importMappings: (kind) => ipcRenderer.invoke("mappings:import", kind),
});
