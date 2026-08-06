// Brücke zwischen der Web-App (renderer) und dem Datei-Speicher (main).
// Die Web-App erkennt window.gtgDesktop und schreibt Videos dann auf die Festplatte.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gtgDesktop', {
  saveVideo: (id, buf, ext) => ipcRenderer.invoke('gtg:saveVideo', { id, buf, ext }),
  getVideo: (id) => ipcRenderer.invoke('gtg:getVideo', { id }),
  deleteVideo: (id) => ipcRenderer.invoke('gtg:deleteVideo', { id }),
  usage: () => ipcRenderer.invoke('gtg:usage'),
  platform: process.platform,
  version: '1.0.0'
});
