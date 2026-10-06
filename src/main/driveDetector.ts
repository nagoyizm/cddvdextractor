import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { OpticalDrive, MediaType } from '../shared/types';

const execAsync = promisify(exec);

export class DriveDetector {
  /**
   * Obtiene la lista de todas las unidades de CD/DVD detectadas en Windows
   */
  public async getOpticalDrives(): Promise<OpticalDrive[]> {
    try {
      const drives: OpticalDrive[] = [];
      const seenDrives = new Set<string>();

      // 1. Consultar Win32_CDROMDrive vía PowerShell
      try {
        const psCommand = `powershell -NoProfile -Command "Get-CimInstance Win32_CDROMDrive | Select-Object Drive, Caption, MediaLoaded, VolumeName, Size, MediaType | ConvertTo-Json"`;
        const { stdout } = await execAsync(psCommand);

        if (stdout && stdout.trim() !== '') {
          let parsed: any;
          try {
            parsed = JSON.parse(stdout);
          } catch {}

          if (parsed) {
            const items = Array.isArray(parsed) ? parsed : [parsed];
            for (const item of items) {
              if (!item || !item.Drive) continue;

              const driveLetter = item.Drive.endsWith('\\') ? item.Drive.slice(0, -1) : item.Drive;
              seenDrives.add(driveLetter.toUpperCase());

              // Comprobar presencia de disco real directamente en el sistema de archivos
              const rootPath = `${driveLetter}\\`;
              const hasVideoTs = fs.existsSync(path.join(rootPath, 'VIDEO_TS'));
              const hasAudioTs = fs.existsSync(path.join(rootPath, 'AUDIO_TS'));
              const mediaLoaded = Boolean(item.MediaLoaded) || hasVideoTs || hasAudioTs || fs.existsSync(rootPath);

              let volumeName = item.VolumeName || '';
              let mediaType: MediaType = 'Empty';
              let availableTracksCount = 0;

              if (mediaLoaded) {
                mediaType = await this.detectMediaType(driveLetter);
                if (mediaType === 'Empty' && (hasVideoTs || hasAudioTs)) {
                  mediaType = hasVideoTs ? 'DVD-Video' : 'DVD-Audio';
                }
                availableTracksCount = await this.estimateTrackCount(driveLetter, mediaType);
                if (!volumeName) {
                  volumeName = mediaType === 'DVD-Video' ? 'DVD de Video' : mediaType === 'CD-DA' ? 'CD de Audio' : 'Disco Óptico';
                }
              }

              const totalSize = typeof item.Size === 'number' && item.Size > 0 ? item.Size : 4661901312;
              const name = item.Caption || `Unidad Óptica (${driveLetter})`;

              drives.push({
                id: driveLetter,
                driveLetter,
                name,
                mediaLoaded,
                mediaType,
                volumeName: volumeName || (mediaLoaded ? 'Disco sin título' : 'Bandeja vacía'),
                totalSize,
                availableTracksCount,
              });
            }
          }
        }
      } catch (e) {
        console.warn('Advertencia en consulta WMI de unidades ópticas:', e);
      }

      // 2. Escaneo de respaldo de letras de unidad comunes (D: hasta Z:) para detectar DVD/CD montados
      const possibleLetters = ['D:', 'E:', 'F:', 'G:', 'H:'];
      for (const letter of possibleLetters) {
        if (seenDrives.has(letter.toUpperCase())) continue;

        const videoTsPath = path.join(`${letter}\\`, 'VIDEO_TS');
        const audioTsPath = path.join(`${letter}\\`, 'AUDIO_TS');

        if (fs.existsSync(videoTsPath)) {
          seenDrives.add(letter.toUpperCase());
          const tracksCount = await this.estimateTrackCount(letter, 'DVD-Video');
          drives.push({
            id: letter,
            driveLetter: letter,
            name: `Unidad DVD (${letter})`,
            mediaLoaded: true,
            mediaType: 'DVD-Video',
            volumeName: 'DVD de Video',
            totalSize: 4661901312,
            availableTracksCount: tracksCount,
          });
        } else if (fs.existsSync(audioTsPath)) {
          seenDrives.add(letter.toUpperCase());
          const tracksCount = await this.estimateTrackCount(letter, 'DVD-Audio');
          drives.push({
            id: letter,
            driveLetter: letter,
            name: `Unidad DVD-Audio (${letter})`,
            mediaLoaded: true,
            mediaType: 'DVD-Audio',
            volumeName: 'DVD de Audio',
            totalSize: 4661901312,
            availableTracksCount: tracksCount,
          });
        }
      }

      return drives;
    } catch (error) {
      console.error('Error al detectar unidades ópticas:', error);
      return [];
    }
  }

  /**
   * Identifica si el disco es un CD-DA, DVD-Video, DVD-Audio o Disco de Datos
   */
  private async detectMediaType(driveLetter: string): Promise<MediaType> {
    try {
      const rootPath = `${driveLetter}\\`;
      const files = await fs.promises.readdir(rootPath).catch(() => []);

      const hasVideoTs = files.some(f => f.toUpperCase() === 'VIDEO_TS');
      const hasAudioTs = files.some(f => f.toUpperCase() === 'AUDIO_TS');

      if (hasVideoTs) {
        // Verificar si contiene archivos VOB/IFO
        const videoTsPath = path.join(rootPath, 'VIDEO_TS');
        const videoFiles = await fs.promises.readdir(videoTsPath).catch(() => []);
        if (videoFiles.some(f => f.toUpperCase().endsWith('.VOB') || f.toUpperCase().endsWith('.IFO'))) {
          return 'DVD-Video';
        }
      }

      if (hasAudioTs) {
        const audioTsPath = path.join(rootPath, 'AUDIO_TS');
        const audioFiles = await fs.promises.readdir(audioTsPath).catch(() => []);
        if (audioFiles.some(f => f.toUpperCase().endsWith('.AOB'))) {
          return 'DVD-Audio';
        }
      }

      // Comprobar si hay archivos .cda (CD Audio Red Book en Windows Explorer)
      const cdaFiles = files.filter(f => f.toLowerCase().endsWith('.cda'));
      if (cdaFiles.length > 0) {
        return 'CD-DA';
      }

      // Si no hay archivos visibles pero el disco está cargado, suele ser CD-DA de audio puro
      if (files.length === 0) {
        return 'CD-DA';
      }

      return 'Data-Disc';
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Estima el número de pistas o capítulos disponibles
   */
  private async estimateTrackCount(driveLetter: string, mediaType: MediaType): Promise<number> {
    try {
      const rootPath = `${driveLetter}\\`;
      if (mediaType === 'CD-DA') {
        const files = await fs.promises.readdir(rootPath).catch(() => []);
        const cdas = files.filter(f => f.toLowerCase().endsWith('.cda'));
        return cdas.length > 0 ? cdas.length : 12; // Si no lista .cda directo, estimar
      } else if (mediaType === 'DVD-Video') {
        const videoTsPath = path.join(rootPath, 'VIDEO_TS');
        const videoFiles = await fs.promises.readdir(videoTsPath).catch(() => []);
        const vobs = videoFiles.filter(f => f.toUpperCase().endsWith('.VOB') && !f.toUpperCase().startsWith('VIDEO_TS'));
        return Math.max(vobs.length, 1);
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Expulsa o abre la bandeja de la unidad óptica
   */
  public async ejectDrive(driveLetter: string): Promise<boolean> {
    try {
      const psCommand = `powershell -NoProfile -Command "(New-Object -COM 'WMPlayer.OCX').cdromCollection.getByDriveSpecifier('${driveLetter}').Eject()"`;
      await execAsync(psCommand);
      return true;
    } catch (error) {
      console.error(`Error al expulsar unidad ${driveLetter}:`, error);
      return false;
    }
  }
}
