// Sichere Brücke: Das Dashboard bekommt nur diese Funktionen, keinen Node-Zugriff.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('godseye', {
  isElectron: true,
  fetch: (url, opts) => ipcRenderer.invoke('net:fetch', url, opts),
  saveFile: (name, data, encoding) => ipcRenderer.invoke('file:save', { name, data, encoding }),
  openFile: (filters) => ipcRenderer.invoke('file:open', { filters }),
  capture: (rect) => ipcRenderer.invoke('capture', rect),
  pdfReport: (html, name) => ipcRenderer.invoke('pdf:report', { html, name }),
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
  openExternal: (url) => ipcRenderer.invoke('open:external', url),
  ais: {
    start: (apiKey, bbox) => ipcRenderer.invoke('ais:start', { apiKey, bbox }),
    stop: () => ipcRenderer.invoke('ais:stop'),
    onMessage: (cb) => ipcRenderer.on('ais:msg', (_e, m) => cb(m)),
    onStatus: (cb) => ipcRenderer.on('ais:status', (_e, s) => cb(s))
  }
});
