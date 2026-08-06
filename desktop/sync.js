// Kopiert das aktuelle index.html (aus dem Repo-Root) in den Desktop-Renderer.
// Läuft automatisch vor jedem Start/Build (npm-Scripts).
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'index.html');
const dstDir = path.join(__dirname, 'renderer');
const dst = path.join(dstDir, 'index.html');

if (!fs.existsSync(src)) {
  console.error('FEHLER: index.html nicht gefunden unter', src, '\nBitte zuerst im Repo-Root "node build.mjs" ausführen.');
  process.exit(1);
}
fs.mkdirSync(dstDir, { recursive: true });
fs.copyFileSync(src, dst);
console.log('index.html kopiert ->', dst);
