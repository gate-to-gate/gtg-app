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

// Update-Prüfung: vergleicht die installierte Version mit version.json auf GitHub Pages.
// Läuft im Hauptprozess (Node) -> kein CORS-Problem.
const UPDATE_URL = 'https://gate-to-gate.github.io/gtg-app/version.json';
ipcMain.handle('gtg:checkUpdate', async () => {
  const current = app.getVersion();
  try {
    const res = await fetch(UPDATE_URL + '?t=' + Date.now());
    if (!res.ok) return { current };
    const info = await res.json();
    return { current, latest: info.desktopVersion, url: info.downloadUrl, notes: info.notes };
  } catch (_err) {
    return { current };
  }
});

// Update direkt herunterladen: passenden Installer in den Download-Ordner laden und dort anzeigen.
ipcMain.handle('gtg:downloadUpdate', async () => {
  try {
    const plat = process.platform;
    const file = plat === 'darwin' ? 'Gate-to-Gate-mac.dmg' : plat === 'win32' ? 'Gate-to-Gate-win.exe' : null;
    if (!file) { shell.openExternal('https://github.com/gate-to-gate/gtg-app/releases/latest'); return { ok: false }; }
    const url = 'https://github.com/gate-to-gate/gtg-app/releases/latest/download/' + file;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    const dest = path.join(app.getPath('downloads'), file);
    await fsp.writeFile(dest, buf);
    shell.showItemInFolder(dest);
    return { ok: true, path: dest };
  } catch (err) {
    try { shell.openExternal('https://github.com/gate-to-gate/gtg-app/releases/latest'); } catch (_) {}
    return { ok: false, error: String((err && err.message) || err) };
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
