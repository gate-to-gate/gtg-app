// Brücke zwischen der Web-App (renderer) und dem Datei-Speicher (main).
// Die Web-App erkennt window.gtgDesktop und schreibt Videos dann auf die Festplatte.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gtgDesktop', {
  saveVideo: (id, buf, ext) => ipcRenderer.invoke('gtg:saveVideo', { id, buf, ext }),
  saveVideoPath: (id, src, ext) => ipcRenderer.invoke('gtg:saveVideoPath', { id, src, ext }),
  getVideo: (id) => ipcRenderer.invoke('gtg:getVideo', { id }),
  deleteVideo: (id) => ipcRenderer.invoke('gtg:deleteVideo', { id }),
  usage: () => ipcRenderer.invoke('gtg:usage'),
  checkUpdate: () => ipcRenderer.invoke('gtg:checkUpdate'),
  downloadUpdate: () => ipcRenderer.invoke('gtg:downloadUpdate'),
  onUpdateProgress: (cb) => ipcRenderer.on('gtg:updateProgress', (_e, pct) => { try { cb(pct); } catch (e) {} }),
  appVersion: () => ipcRenderer.invoke('gtg:appVersion'),
  fetchText: (url) => ipcRenderer.invoke('gtg:fetchText', { url }),
  platform: process.platform,
  version: '1.0.0'
});
