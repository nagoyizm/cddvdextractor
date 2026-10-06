import { spawn, ChildProcess, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { ExtractionConfig, AudioTrack, ExtractionProgress } from '../shared/types';

export class TranscoderService {
  private activeProcess: ChildProcess | null = null;
  private isCancelled = false;
  private isBusy = false;
  private currentTempWavPath: string | null = null;
  private currentOutputPath: string | null = null;

  /**
   * Indica si hay una extracción en curso activa
   */
  public isExtracting(): boolean {
    return this.isBusy;
  }

  /**
   * Resuelve la ruta al ejecutable de FFmpeg (empaquetado o instalado en el sistema)
   */
  public getFfmpegPath(): string {
    const resPath = (process as any).resourcesPath;
    if (resPath) {
      const packagedPath = path.join(resPath, 'bin', 'ffmpeg.exe');
      if (fs.existsSync(packagedPath)) {
        return packagedPath;
      }
    }

    // 2. Probar en carpeta local de desarrollo ./resources/bin/ffmpeg.exe
    const devPath = path.join(__dirname, '..', '..', 'resources', 'bin', 'ffmpeg.exe');
    if (fs.existsSync(devPath)) {
      return devPath;
    }

    // 3. Probar en AppData local de winget Gyan FFmpeg
    const userProfile = process.env.LOCALAPPDATA || '';
    const wingetGyanPath = path.join(userProfile, 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(wingetGyanPath)) {
      try {
        const pkgs = fs.readdirSync(wingetGyanPath);
        for (const pkg of pkgs) {
          if (pkg.includes('Gyan.FFmpeg')) {
            const candidate = path.join(wingetGyanPath, pkg, 'bin', 'ffmpeg.exe');
            if (fs.existsSync(candidate)) return candidate;
          }
        }
      } catch {}
    }

    // 4. Fallback al PATH del sistema
    return 'ffmpeg';
  }

  /**
   * Resuelve la ruta al script de extracción nativa de CD
   */
  public getRipScriptPath(): string {
    const resPath = (process as any).resourcesPath;
    if (resPath) {
      const packaged = path.join(resPath, 'bin', 'rip_cd_track.ps1');
      if (fs.existsSync(packaged)) return packaged;
    }

    const devPath = path.join(__dirname, '..', '..', 'resources', 'bin', 'rip_cd_track.ps1');
    if (fs.existsSync(devPath)) return devPath;

    const cwdPath = path.join(process.cwd(), 'resources', 'bin', 'rip_cd_track.ps1');
    if (fs.existsSync(cwdPath)) return cwdPath;

    return devPath;
  }

  /**
   * Cancela la extracción en curso cerrando los procesos hijos de manera forzada y limpiando archivos incompletos
   */
  public cancelExtraction(): void {
    this.isCancelled = true;
    if (this.activeProcess && this.activeProcess.pid) {
      const pid = this.activeProcess.pid;
      try {
        if (process.platform === 'win32') {
          // Terminar todo el árbol de procesos de PowerShell / FFmpeg inmediatamente
          require('child_process').execSync(`taskkill /pid ${pid} /T /F`);
        } else {
          this.activeProcess.kill('SIGKILL');
        }
      } catch {
        try {
          this.activeProcess.kill('SIGKILL');
        } catch {}
      }
      this.activeProcess = null;
    }

    // Eliminar archivo temporal si existe
    if (this.currentTempWavPath && fs.existsSync(this.currentTempWavPath)) {
      try {
        fs.unlinkSync(this.currentTempWavPath);
      } catch {}
      this.currentTempWavPath = null;
    }

    // Eliminar archivo destino a medio escribir si existe
    if (this.currentOutputPath && fs.existsSync(this.currentOutputPath)) {
      try {
        fs.unlinkSync(this.currentOutputPath);
      } catch {}
      this.currentOutputPath = null;
    }
  }

  private formatEta(seconds: number): string {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Transcodifica una lista de pistas de audio
   */
  public async extractTracks(
    config: ExtractionConfig,
    sourceDrive: string,
    onProgress: (progress: ExtractionProgress) => void
  ): Promise<boolean> {
    this.isBusy = true;
    this.isCancelled = false;

    try {
      const selectedTracks = config.tracks.filter(t => t.selected);
      const totalTracks = selectedTracks.length;

      if (totalTracks === 0) {
        onProgress({
          currentTrackIndex: 0,
          totalTracks: 0,
          currentTrackTitle: '',
          trackProgressPercent: 0,
          overallProgressPercent: 0,
          currentSpeed: '0x',
          eta: '00:00',
          currentPhase: 'Sin selección',
          status: 'error',
          errorMessage: 'No se seleccionaron pistas para extraer',
        });
        return false;
      }

    // Asegurar directorio destino
    if (!fs.existsSync(config.destinationFolder)) {
      fs.mkdirSync(config.destinationFolder, { recursive: true });
    }

    const ffmpegPath = this.getFfmpegPath();

    for (let i = 0; i < totalTracks; i++) {
      if (this.isCancelled) {
        onProgress({
          currentTrackIndex: i + 1,
          totalTracks,
          currentTrackTitle: 'Extracción cancelada',
          trackProgressPercent: 0,
          overallProgressPercent: Math.round((i / totalTracks) * 100),
          currentSpeed: '0x',
          eta: '00:00',
          currentPhase: 'Cancelado por el usuario',
          status: 'cancelled',
          logMessage: 'Extracción cancelada por el usuario.',
        });
        return false;
      }

      const track = selectedTracks[i];
      const overallBasePercent = (i / totalTracks) * 100;

      // Generar nombre de archivo de salida sanitizado
      const cleanTitle = (track.title || `Pista_${track.trackNumber}`).replace(/[\\/:*?"<>|]/g, '_');
      const cleanArtist = (config.metadata.artist || 'Artista').replace(/[\\/:*?"<>|]/g, '_');
      const cleanAlbum = (config.metadata.album || 'Álbum').replace(/[\\/:*?"<>|]/g, '_');
      const trackPadded = String(track.trackNumber).padStart(2, '0');

      let outFileName = config.fileNamePattern
        .replace(/{track}/g, trackPadded)
        .replace(/{title}/g, cleanTitle)
        .replace(/{artist}/g, cleanArtist)
        .replace(/{album}/g, cleanAlbum);

      const outExt = config.outputFormat.toLowerCase();
      outFileName = `${outFileName}.${outExt}`;
      const outputPath = path.join(config.destinationFolder, outFileName);
      this.currentOutputPath = outputPath;

      onProgress({
        currentTrackIndex: i + 1,
        totalTracks,
        currentTrackTitle: `${trackPadded}. ${track.title}`,
        trackProgressPercent: 0,
        overallProgressPercent: Math.round(overallBasePercent),
        currentSpeed: 'Iniciando...',
        eta: '--:--',
        currentPhase: 'Preparando pista...',
        status: 'extracting',
        logMessage: `Iniciando [${trackPadded}/${totalTracks}] -> ${outFileName}`,
      });

      try {
        await this.transcodeSingleTrack(
          ffmpegPath,
          sourceDrive,
          track,
          outputPath,
          config,
          (trackPercent, speed, eta, phase, logMsg) => {
            if (this.isCancelled) return;
            const overallPercent = Math.min(
              99,
              Math.round(overallBasePercent + ((trackPercent / 100) * (100 / totalTracks)))
            );
            onProgress({
              currentTrackIndex: i + 1,
              totalTracks,
              currentTrackTitle: `${trackPadded}. ${track.title}`,
              trackProgressPercent: trackPercent,
              overallProgressPercent: overallPercent,
              currentSpeed: speed || '12.4x',
              eta: eta || '--:--',
              currentPhase: phase || 'Extrayendo...',
              status: 'extracting',
              logMessage: logMsg || `Procesando [${trackPadded}] -> ${outFileName}`,
            });
          }
        );
        this.currentOutputPath = null;

        if (this.isCancelled) {
          onProgress({
            currentTrackIndex: i + 1,
            totalTracks,
            currentTrackTitle: 'Extracción cancelada',
            trackProgressPercent: 0,
            overallProgressPercent: Math.round(overallBasePercent),
            currentSpeed: '0x',
            eta: '00:00',
            currentPhase: 'Cancelado por el usuario',
            status: 'cancelled',
            logMessage: 'Extracción cancelada por el usuario.',
          });
          return false;
        }

        // Notificar brevemente que la pista finalizó antes de continuar con la siguiente
        onProgress({
          currentTrackIndex: i + 1,
          totalTracks,
          currentTrackTitle: `${trackPadded}. ${track.title}`,
          trackProgressPercent: 100,
          overallProgressPercent: Math.round(((i + 1) / totalTracks) * 100),
          currentSpeed: 'Listo',
          eta: '--:--',
          currentPhase: `Pista ${i + 1} completada ✓`,
          status: 'extracting',
          logMessage: `[${trackPadded}] Completada con éxito -> ${outFileName}`,
        });
      } catch (err: any) {
        this.currentOutputPath = null;
        if (this.isCancelled) {
          onProgress({
            currentTrackIndex: i + 1,
            totalTracks,
            currentTrackTitle: 'Extracción cancelada',
            trackProgressPercent: 0,
            overallProgressPercent: Math.round(overallBasePercent),
            currentSpeed: '0x',
            eta: '00:00',
            currentPhase: 'Cancelado por el usuario',
            status: 'cancelled',
            logMessage: 'Extracción cancelada por el usuario.',
          });
          return false;
        }

        console.error(`Error transcodificando pista ${track.trackNumber}:`, err);
        onProgress({
          currentTrackIndex: i + 1,
          totalTracks,
          currentTrackTitle: track.title,
          trackProgressPercent: 0,
          overallProgressPercent: Math.round(overallBasePercent),
          currentSpeed: '0x',
          eta: '--:--',
          currentPhase: 'Error en la pista',
          status: 'error',
          errorMessage: `Error en pista ${track.trackNumber} (${track.title}): ${err.message}`,
        });
        return false;
      }
    }

    if (this.isCancelled) {
      onProgress({
        currentTrackIndex: totalTracks,
        totalTracks,
        currentTrackTitle: 'Extracción cancelada',
        trackProgressPercent: 0,
        overallProgressPercent: 0,
        currentSpeed: '0x',
        eta: '00:00',
        currentPhase: 'Cancelado por el usuario',
        status: 'cancelled',
        logMessage: 'Extracción cancelada por el usuario.',
      });
      return false;
    }

    onProgress({
      currentTrackIndex: totalTracks,
      totalTracks,
      currentTrackTitle: 'Completado con éxito',
      trackProgressPercent: 100,
      overallProgressPercent: 100,
      currentSpeed: '0x',
      eta: '00:00',
      currentPhase: '✓ Extracción Finalizada',
      status: 'completed',
      logMessage: `Todas las ${totalTracks} pistas fueron extraídas satisfactoriamente en: ${config.destinationFolder}`,
    });

    return true;
  } finally {
    this.isBusy = false;
    this.currentTempWavPath = null;
    this.currentOutputPath = null;
  }
  }

  /**
   * Ejecuta la transcodificación de una pista individual
   */
  private transcodeSingleTrack(
    ffmpegPath: string,
    sourceDrive: string,
    track: AudioTrack,
    outputPath: string,
    config: ExtractionConfig,
    onTrackProgress: (percent: number, speed: string, eta: string, phase?: string, logMessage?: string) => void
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      let tempWavPath: string | null = null;
      const cleanUpTemp = () => {
        if (tempWavPath && fs.existsSync(tempWavPath)) {
          try {
            fs.unlinkSync(tempWavPath);
          } catch {}
          tempWavPath = null;
          this.currentTempWavPath = null;
        }
      };

      const isCd = !track.startTimecode && track.startSector !== undefined && track.endSector !== undefined;

      // Determinar parámetros de entrada según el tipo de medio
      const args: string[] = ['-y']; // Sobrescribir archivo destino

      // 1. Input Source
      if (track.startTimecode && track.durationTimecode) {
        // Modo DVD: corte por timecodes de capítulo
        const videoTsDir = path.join(`${sourceDrive}\\`, 'VIDEO_TS');
        let inputTarget = '';

        if (fs.existsSync(videoTsDir)) {
          const allFiles = fs.readdirSync(videoTsDir);
          const titleVobs = allFiles.filter(f => {
            const up = f.toUpperCase();
            return up.endsWith('.VOB') && !up.startsWith('VIDEO_TS') && !up.endsWith('_0.VOB');
          });

          const sets: { [key: string]: string[] } = {};
          for (const vob of titleVobs) {
            const prefix = vob.substring(0, 6).toUpperCase();
            if (!sets[prefix]) sets[prefix] = [];
            sets[prefix].push(vob);
          }

          let mainSetKey = '';
          let maxCount = 0;
          for (const prefix of Object.keys(sets)) {
            if (sets[prefix].length > maxCount) {
              maxCount = sets[prefix].length;
              mainSetKey = prefix;
            }
          }

          if (mainSetKey && sets[mainSetKey].length > 0) {
            const sortedVobs = sets[mainSetKey].sort();
            const fullVobPaths = sortedVobs.map(v => path.join(videoTsDir, v));
            if (fullVobPaths.length === 1) {
              inputTarget = fullVobPaths[0];
            } else {
              inputTarget = `concat:${fullVobPaths.join('|')}`;
            }
          }
        }

        if (inputTarget) {
          args.push('-ss', track.startTimecode, '-i', inputTarget, '-t', track.durationTimecode);
          const streamIdx = typeof track.streamIndex === 'number' ? track.streamIndex : 0;
          args.push('-map', `0:a:${streamIdx}`);
        } else {
          cleanUpTemp();
          return reject(new Error(`No se encontraron archivos VOB del DVD en ${sourceDrive}\\VIDEO_TS`));
        }
      } else {
        // Modo CD de Audio: extraer sectores de audio crudo (CDDA)
        if (isCd) {
          const sectorCount = track.endSector! - track.startSector!;
          const tempDir = app.getPath('temp');
          tempWavPath = path.join(tempDir, `cdda_${Date.now()}_trk${track.trackNumber}.wav`);
          this.currentTempWavPath = tempWavPath;

          const scriptPath = this.getRipScriptPath();

          onTrackProgress(
            0,
            'Iniciando...',
            '--:--',
            'Paso 1/2: Leyendo disco CD-DA (0%)...',
            `Iniciando lectura óptica de ${sectorCount} sectores desde unidad ${sourceDrive}`
          );

          try {
            await this.ripCdTrack(
              scriptPath,
              sourceDrive,
              track.startSector!,
              sectorCount,
              tempWavPath,
              (cdPct, current, total, speedStr, etaStr) => {
                // Mapear lectura física a 0% - 70% del progreso de la pista
                const mappedPercent = Math.min(70, Math.round((cdPct / 100) * 70));
                onTrackProgress(
                  mappedPercent,
                  speedStr,
                  etaStr,
                  `Paso 1/2: Leyendo disco CD-DA (${cdPct}% - sector ${current}/${total})`,
                  `Lectura SPTI (${sourceDrive}): ${current}/${total} sectores a ${speedStr}`
                );
              }
            );

            if (this.isCancelled) {
              cleanUpTemp();
              return resolve();
            }

            onTrackProgress(
              70,
              'Listo',
              '--:--',
              `Paso 2/2: Codificando a ${config.outputFormat.toUpperCase()} y metadatos...`,
              'Lectura física de CD-DA finalizada. Iniciando codificación FFmpeg.'
            );

            args.push('-i', tempWavPath);
          } catch (e: any) {
            cleanUpTemp();
            if (this.isCancelled) return resolve();
            return reject(new Error(`Error extrayendo sectores del CD: ${e.message}`));
          }
        } else {
          cleanUpTemp();
          return reject(new Error(`No se detectaron sectores de audio válidos para la pista ${track.trackNumber} en el CD.`));
        }
      }

      if (this.isCancelled) {
        cleanUpTemp();
        return resolve();
      }

      // 2. Filtros de audio y canales
      if (config.qualitySettings.downmixToStereo) {
        args.push('-ac', '2');
      }

      if (config.qualitySettings.sampleRate > 0) {
        args.push('-ar', String(config.qualitySettings.sampleRate));
      }

      // 3. Codec de salida
      switch (config.outputFormat) {
        case 'flac':
          args.push('-c:a', 'flac');
          if (config.qualitySettings.bitDepth === 24) {
            args.push('-sample_fmt', 's32');
          } else {
            args.push('-sample_fmt', 's16');
          }
          args.push('-compression_level', String(config.qualitySettings.compressionLevel || 8));
          break;

        case 'wav':
          if (config.qualitySettings.bitDepth === 24) {
            args.push('-c:a', 'pcm_s24le');
          } else {
            args.push('-c:a', 'pcm_s16le');
          }
          break;

        case 'mp3':
          args.push('-c:a', 'libmp3lame');
          if (config.qualitySettings.bitrate === 'vbr-v0') {
            args.push('-q:a', '0');
          } else {
            args.push('-b:a', config.qualitySettings.bitrate || '320k');
          }
          break;

        case 'aac':
          args.push('-c:a', 'aac', '-b:a', config.qualitySettings.bitrate || '256k');
          break;

        case 'opus':
          args.push('-c:a', 'libopus', '-b:a', '128k');
          break;

        case 'ogg':
          args.push('-c:a', 'libvorbis', '-q:a', '6');
          break;
      }

      // 4. Inyección de Metadatos
      args.push('-metadata', `title=${track.title || `Pista ${track.trackNumber}`}`);
      args.push('-metadata', `artist=${config.metadata.artist || 'Artista Desconocido'}`);
      args.push('-metadata', `album=${config.metadata.album || 'Álbum Desconocido'}`);
      args.push('-metadata', `track=${track.trackNumber}`);
      if (config.metadata.year) {
        args.push('-metadata', `date=${config.metadata.year}`);
      }
      if (config.metadata.genre) {
        args.push('-metadata', `genre=${config.metadata.genre}`);
      }

      // 5. Archivo de salida (al final de los argumentos de FFmpeg)
      args.push(outputPath);

      // Inyectar la carpeta de binarios en PATH para que FFmpeg encuentre libdvdcss-2.dll
      const binDir = path.dirname(ffmpegPath);
      const customEnv = {
        ...process.env,
        PATH: `${binDir};${process.env.PATH || ''}`,
        DVDCSS_METHOD: 'key',
        DVDCSS_VERBOSE: '0',
      };

      // Lanzar subproceso FFmpeg
      let ffmpegProcess: ChildProcess;
      try {
        ffmpegProcess = spawn(ffmpegPath, args, { env: customEnv });
        this.activeProcess = ffmpegProcess;
      } catch (err: any) {
        cleanUpTemp();
        return reject(new Error(`No se pudo iniciar FFmpeg en "${ffmpegPath}": ${err.message}`));
      }

      let stderrOutput = '';
      ffmpegProcess.stderr?.on('data', (data) => {
        const str = data.toString();
        stderrOutput += str;

        const timeMatch = str.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        const speedMatch = str.match(/speed=\s*([\d\.]+)x/);

        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const seconds = parseFloat(timeMatch[3]);
          const currentSeconds = hours * 3600 + minutes * 60 + seconds;
          const totalDuration = Math.max(track.duration, 1);
          const ffmpegPercent = Math.min(100, Math.round((currentSeconds / totalDuration) * 100));
          const speed = speedMatch ? `${speedMatch[1]}x` : '14x';
          const remSec = Math.max(0, totalDuration - currentSeconds);
          const eta = this.formatEta(Math.round(remSec / 12));

          if (isCd) {
            // Mapear 0%-100% de FFmpeg al rango 70% - 99% de la pista
            const trackPercent = Math.min(99, 70 + Math.round((ffmpegPercent / 100) * 29));
            onTrackProgress(
              trackPercent,
              speed,
              eta,
              `Paso 2/2: Codificando a ${config.outputFormat.toUpperCase()} (${ffmpegPercent}%)`,
              `FFmpeg: ${speed} - procesado ${timeMatch[0]}`
            );
          } else {
            // DVD directo
            onTrackProgress(
              ffmpegPercent,
              speed,
              eta,
              `Paso 1/1: Extrayendo y codificando audio del DVD (${ffmpegPercent}%)`,
              `FFmpeg VOB: ${speed} - procesado ${timeMatch[0]}`
            );
          }
        }
      });

      ffmpegProcess.on('close', (code) => {
        this.activeProcess = null;
        cleanUpTemp();

        if (this.isCancelled) {
          if (fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch {}
          }
          resolve();
          return;
        }

        if (code === 0) {
          onTrackProgress(100, 'Listo', '00:00', 'Pista completada ✓', `Guardada en: ${path.basename(outputPath)}`);
          resolve();
        } else {
          if (fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch {}
          }
          reject(new Error(`FFmpeg finalizó con código ${code}. Detalles: ${stderrOutput.slice(-300)}`));
        }
      });

      ffmpegProcess.on('error', (err) => {
        this.activeProcess = null;
        cleanUpTemp();
        if (this.isCancelled) {
          if (fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch {}
          }
          resolve();
          return;
        }
        reject(err);
      });
    });
  }

  /**
   * Extrae sectores de audio crudo (CDDA) a WAV usando PowerShell y SPTI en Windows con progreso en tiempo real
   */
  private ripCdTrack(
    scriptPath: string,
    driveLetter: string,
    startSector: number,
    sectorCount: number,
    outputPath: string,
    onProgress: (pct: number, current: number, total: number, speed: string, eta: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const psArgs = [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        '-DriveLetter',
        driveLetter,
        '-StartSector',
        String(startSector),
        '-SectorCount',
        String(sectorCount),
        '-OutputPath',
        outputPath,
        '-Batch',
        '25',
      ];

      const startTime = Date.now();
      const child = spawn('powershell', psArgs);
      this.activeProcess = child;

      let buffer = '';
      child.stdout?.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) {
          const match = line.match(/CD_PROGRESS:(\d+):(\d+):(\d+)/);
          if (match) {
            const current = parseInt(match[1], 10);
            const total = parseInt(match[2], 10);
            const pct = parseInt(match[3], 10);
            const elapsedSec = (Date.now() - startTime) / 1000;
            let speedStr = '--';
            let etaStr = '--:--';
            if (elapsedSec > 0.5 && current > 0) {
              const sectorsPerSec = current / elapsedSec;
              const speedX = (sectorsPerSec / 75).toFixed(1);
              speedStr = `${speedX}x`;
              const remainingSectors = Math.max(0, total - current);
              const remainingSec = Math.round(remainingSectors / Math.max(sectorsPerSec, 1));
              etaStr = this.formatEta(remainingSec);
            }
            onProgress(pct, current, total, speedStr, etaStr);
          }
        }
      });

      let errorMsg = '';
      child.stderr?.on('data', (data) => {
        errorMsg += data.toString();
      });

      child.on('close', (code) => {
        this.activeProcess = null;
        if (this.isCancelled) {
          if (fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch {}
          }
          resolve();
          return;
        }

        if (code === 0 && fs.existsSync(outputPath)) {
          resolve();
        } else {
          reject(new Error(`Fallo extracción de sectores CD: ${errorMsg || `Código ${code}`}`));
        }
      });

      child.on('error', (err) => {
        this.activeProcess = null;
        if (this.isCancelled) {
          if (fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch {}
          }
          resolve();
          return;
        }
        reject(err);
      });
    });
  }
}
