// Gate-to-Gate Desktop (Electron) – Hauptprozess
// Fenster + Datei-Speicher für Videos auf der Festplatte.
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

// Videos landen hier: ~/Library/Application Support/Gate-to-Gate/videos (Mac)
//                     %APPDATA%/Gate-to-Gate/videos (Windows)
function videoDir(){ return path.join(app.getPath('userData'), 'videos'); }
async function ensureDir(){ await fsp.mkdir(videoDir(), { recursive: true }); }
function safeId(id){ return String(id).replace(/[^a-zA-Z0-9._|=-]/g, '_'); }
function pathFor(id){ return path.join(videoDir(), safeId(id) + '.vid'); }

// --- IPC: Video-Bytes schreiben / lesen / löschen ---
ipcMain.handle('gtg:saveVideo', async (_e, { id, buf }) => {
  try {
    await ensureDir();
    const b = Buffer.from(buf);
    await fsp.writeFile(pathFor(id), b);
    return { ok: true, size: b.length, file: safeId(id) + '.vid' };
  } catch (err) {
    const full = !!(err && (err.code === 'ENOSPC'));
    return { ok: false, error: String((err && err.message) || err), full };
  }
});

ipcMain.handle('gtg:getVideo', async (_e, { id }) => {
  try {
    const b = await fsp.readFile(pathFor(id));
    // Als ArrayBuffer zurückgeben (strukturierte Kopie über IPC)
    return { buffer: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
  } catch (_err) {
    return null;
  }
});

ipcMain.handle('gtg:deleteVideo', async (_e, { id }) => {
  try { await fsp.unlink(pathFor(id)); } catch (_err) { /* egal, wenn schon weg */ }
  return { ok: true };
});

ipcMain.handle('gtg:usage', async () => {
  try {
    await ensureDir();
    const files = await fsp.readdir(videoDir());
    let used = 0;
    for (const f of files) { try { used += (await fsp.stat(path.join(videoDir(), f))).size; } catch (_) {} }
    let free = 0, total = 0;
    try { const s = await fsp.statfs(videoDir()); free = s.bavail * s.bsize; total = s.blocks * s.bsize; } catch (_) {}
    return { used, free, total, dir: videoDir() };
  } catch (_err) {
    return { used: 0, free: 0, total: 0 };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1320, height: 880, minWidth: 900, minHeight: 600,
    backgroundColor: '#0f1115',
    title: 'Gate-to-Gate',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // externe Links (GitHub, Cloudflare-Anleitung usw.) im Standardbrowser öffnen
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
