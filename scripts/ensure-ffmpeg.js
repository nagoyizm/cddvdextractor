const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binDir = path.join(__dirname, '..', 'resources', 'bin');
const ffmpegPath = path.join(binDir, 'ffmpeg.exe');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function main() {
  ensureDir(binDir);

  if (fs.existsSync(ffmpegPath) && fs.statSync(ffmpegPath).size > 1000000) {
    console.log('✓ ffmpeg.exe ya está presente en resources/bin/');
    return;
  }

  console.log('ffmpeg.exe no encontrado en resources/bin/. Buscando alternativa local...');

  // 1. Intentar copiar desde winget Gyan FFmpeg si existe
  const localAppData = process.env.LOCALAPPDATA || '';
  const wingetGyan = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(wingetGyan)) {
    try {
      const pkgs = fs.readdirSync(wingetGyan);
      for (const pkg of pkgs) {
        if (pkg.includes('Gyan.FFmpeg')) {
          const candidate = path.join(wingetGyan, pkg, 'bin', 'ffmpeg.exe');
          if (fs.existsSync(candidate)) {
            console.log(`Copiando ffmpeg desde WinGet local: ${candidate}`);
            fs.copyFileSync(candidate, ffmpegPath);
            console.log('✓ ffmpeg.exe copiado exitosamente.');
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Error escaneando winget local:', e.message);
    }
  }

  // 2. Intentar buscar en PATH del sistema
  try {
    const whereOutput = execSync('where ffmpeg', { encoding: 'utf8' }).trim().split('\n')[0].trim();
    if (whereOutput && fs.existsSync(whereOutput)) {
      console.log(`Copiando ffmpeg desde PATH: ${whereOutput}`);
      fs.copyFileSync(whereOutput, ffmpegPath);
      console.log('✓ ffmpeg.exe copiado exitosamente.');
      return;
    }
  } catch (e) {
    // No está en PATH
  }

  // 3. Descargar build essentials de Gyan
  console.log('Descargando ffmpeg-release-essentials.zip desde gyan.dev...');
  const zipPath = path.join(binDir, 'ffmpeg.zip');
  try {
    execSync(`curl -L -o "${zipPath}" https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip`, {
      stdio: 'inherit',
    });
    console.log('Extrayendo ffmpeg.exe...');
    execSync(`tar -xf "${zipPath}" --strip-components=2 --wildcards "*/bin/ffmpeg.exe" -C "${binDir}"`, {
      stdio: 'inherit',
    });
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    console.log('✓ ffmpeg.exe descargado y configurado exitosamente.');
  } catch (err) {
    console.error('Error al descargar ffmpeg:', err.message);
  }
}

main();
