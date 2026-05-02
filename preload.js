const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron:      true,
  notify:          (title, body) => ipcRenderer.send('show-notification', { title, body }),
  readSettings:    ()            => ipcRenderer.invoke('read-settings'),
  writeSettings:   (data)        => ipcRenderer.invoke('write-settings', data),
  openLog:         ()            => ipcRenderer.invoke('open-log'),
  installUpdate:   ()            => ipcRenderer.send('install-update'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_e, info) => cb(info)),
  onUpdateReady:     (cb) => ipcRenderer.on('update-ready',     (_e, info) => cb(info)),
});
