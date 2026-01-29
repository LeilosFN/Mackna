const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  launch: (path, user) => ipcRenderer.invoke('launch', path, user),
  onLog: (callback) => ipcRenderer.on('log-message', (_event, value) => callback(value)),
  onLaunchStatus: (callback) => ipcRenderer.on('launch-status', (_event, value) => callback(value)),
});
