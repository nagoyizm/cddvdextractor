const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const staging = path.join(rootDir, 'dist-package');

if (fs.existsSync(staging)) {
  fs.rmSync(staging, { recursive: true, force: true });
}
fs.mkdirSync(staging, { recursive: true });

// Copiar dist y package.json
fs.cpSync(path.join(rootDir, 'dist'), path.join(staging, 'dist'), { recursive: true });
fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(staging, 'package.json'));

const targetAsar = path.join(rootDir, 'release', 'win-unpacked', 'resources', 'app.asar');
const targetBin = path.join(rootDir, 'release', 'win-unpacked', 'resources', 'bin');

console.log('Empaquetando app.asar actualizado en:', targetAsar);
execSync(`npx --yes @electron/asar pack "${staging}" "${targetAsar}"`, { stdio: 'inherit' });

// Asegurar que rip_cd_track.ps1 esté presente en release/win-unpacked/resources/bin
const scriptSrc = path.join(rootDir, 'resources', 'bin', 'rip_cd_track.ps1');
const scriptDst = path.join(targetBin, 'rip_cd_track.ps1');
if (fs.existsSync(scriptSrc)) {
  if (!fs.existsSync(targetBin)) {
    fs.mkdirSync(targetBin, { recursive: true });
  }
  fs.copyFileSync(scriptSrc, scriptDst);
}

fs.rmSync(staging, { recursive: true, force: true });
console.log('✓ La carpeta win-unpacked ha sido actualizada con éxito con la nueva versión.');
