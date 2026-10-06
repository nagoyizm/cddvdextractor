import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { DriveDetector } from './driveDetector';
import { DiscScanner } from './discScanner';
import { TranscoderService } from './transcoder';
import { MetadataService } from './metadataService';
import { OpticalDrive, ExtractionConfig, ExtractionProgress } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
const driveDetector = new DriveDetector();
const discScanner = new DiscScanner();
const transcoder = new TranscoderService();
const metadataService = new MetadataService();

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#090d16',
    title: 'DVD & CD Audio Extractor - Pro Edition',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Habilitar atajos de teclado para consola / DevTools (F12 o Ctrl+Shift+I)
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow?.webContents.toggleDevTools();
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Interceptar cierre de ventana para pedir confirmación
  mainWindow.on('close', async (event) => {
    if (isQuitting) return;

    event.preventDefault();

    const isExtracting = transcoder.isExtracting();
    const title = isExtracting ? 'Extracción en curso' : 'Confirmar salida';
    const message = isExtracting
      ? 'Hay un proceso de extracción de audio en curso.'
      : '¿Estás seguro de que deseas salir del programa?';
    const detail = isExtracting
      ? 'Si cierras el programa ahora, la extracción se cancelará y los archivos en proceso se descartarán.'
      : 'Se cerrará DVD & CD Audio Extractor.';

    const result = await dialog.showMessageBox(mainWindow!, {
      type: isExtracting ? 'warning' : 'question',
      buttons: ['No, continuar', 'Sí, salir'],
      defaultId: 0,
      cancelId: 0,
      title,
      message,
      detail,
    });

    if (result.response === 1) {
      if (isExtracting) {
        transcoder.cancelExtraction();
      }
      isQuitting = true;
      mainWindow?.destroy();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupAutoUpdater() {
  if (isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log(`[AutoUpdater] Actualización encontrada: v${info.version}`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (!mainWindow) return;
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Actualización Disponible',
      message: `Se ha descargado la versión ${info.version} de DVD & CD Audio Extractor.`,
      detail: '¿Deseas reiniciar la aplicación ahora para instalar la nueva versión?',
      buttons: ['Reiniciar y Actualizar', 'Instalar al Salir'],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        isQuitting = true;
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error verificando actualizaciones:', err);
  });

  // Chequear actualizaciones 3 segundos después del inicio
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.warn('[AutoUpdater] No se pudo comprobar actualización:', err?.message);
    });
  }, 3000);
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function setupIpcHandlers() {
  // 1. Obtener Unidades Ópticas
  ipcMain.handle('optical:getDrives', async () => {
    return await driveDetector.getOpticalDrives();
  });

  // 2. Escanear Disco
  ipcMain.handle('optical:scanDisc', async (_event, drive: OpticalDrive) => {
    return await discScanner.scanDisc(drive);
  });

  // 3. Expulsar Bandeja
  ipcMain.handle('optical:ejectDrive', async (_event, driveLetter: string) => {
    return await driveDetector.ejectDrive(driveLetter);
  });

  // 4. Selector de Carpeta Destino
  ipcMain.handle('dialog:selectFolder', async (_event, defaultPath?: string) => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleccionar carpeta de destino para el audio extraído',
      defaultPath: defaultPath || undefined,
      buttonLabel: 'Guardar aquí',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // 5. Abrir carpeta en explorador de Windows
  ipcMain.handle('shell:openFolder', async (_event, folderPath: string) => {
    await shell.openPath(folderPath);
  });

  // 6. Búsqueda de metadatos manual o automática
  ipcMain.handle('metadata:search', async (_event, query: string) => {
    return await metadataService.searchAlbum(query);
  });

  // 7. Iniciar Extracción y Transcodificación
  ipcMain.handle('extraction:start', async (_event, config: ExtractionConfig, sourceDrive: string) => {
    return await transcoder.extractTracks(config, sourceDrive, (progress: ExtractionProgress) => {
      mainWindow?.webContents.send('extraction:progress', progress);
    });
  });

  // 8. Cancelar Extracción
  ipcMain.handle('extraction:cancel', async () => {
    transcoder.cancelExtraction();
  });

  // 9. Abrir o alternar DevTools (Consola)
  ipcMain.handle('app:toggleDevTools', async () => {
    mainWindow?.webContents.toggleDevTools();
  });

  // 10. Verificación manual de actualizaciones
  ipcMain.handle('app:checkForUpdates', async () => {
    if (isDev) {
      return { success: false, message: 'Modo desarrollo: auto-update inactivo.' };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
