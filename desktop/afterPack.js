// Ad-hoc-Signatur für die Mac-App.
// electron-builder überspringt echtes Signieren (identity: null); danach signieren
// wir die App hier "ad hoc" (codesign -s -). Das macht sie auf Apple-Silicon lauffähig
// und verwandelt die harte "Malware"-Meldung in die mildere, per "Trotzdem öffnen"
// durchlassbare Warnung. Auf Windows/anderen Plattformen passiert nichts.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appName = context.packager.appInfo.productFilename; // "Gate-to-Gate"
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  try {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', appPath], { stdio: 'inherit' });
    console.log('✓ Ad-hoc signiert:', appPath);
  } catch (e) {
    console.warn('Ad-hoc-Signatur fehlgeschlagen:', e && e.message);
  }
};
