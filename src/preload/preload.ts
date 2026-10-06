import { contextBridge, ipcRenderer } from 'electron';
import { OpticalDrive, ExtractionConfig, ExtractionProgress, DiscDetectionResult } from '../shared/types';

export const api = {
  getDrives: (): Promise<OpticalDrive[]> => ipcRenderer.invoke('optical:getDrives'),
  scanDisc: (drive: OpticalDrive): Promise<DiscDetectionResult> => ipcRenderer.invoke('optical:scanDisc', drive),
  ejectDrive: (driveLetter: string): Promise<boolean> => ipcRenderer.invoke('optical:ejectDrive', driveLetter),
  selectDestinationFolder: (defaultPath?: string): Promise<string | null> => ipcRenderer.invoke('dialog:selectFolder', defaultPath),
  openFolder: (folderPath: string): Promise<void> => ipcRenderer.invoke('shell:openFolder', folderPath),
  searchMetadata: (query: string): Promise<any> => ipcRenderer.invoke('metadata:search', query),
  startExtraction: (config: ExtractionConfig, sourceDrive: string): Promise<boolean> =>
    ipcRenderer.invoke('extraction:start', config, sourceDrive),
  cancelExtraction: (): Promise<void> => ipcRenderer.invoke('extraction:cancel'),
  toggleDevTools: (): Promise<void> => ipcRenderer.invoke('app:toggleDevTools'),
  checkForUpdates: (): Promise<any> => ipcRenderer.invoke('app:checkForUpdates'),
  onExtractionProgress: (callback: (progress: ExtractionProgress) => void) => {
    const subscription = (_event: any, progress: ExtractionProgress) => callback(progress);
    ipcRenderer.on('extraction:progress', subscription);
    return () => {
      ipcRenderer.removeListener('extraction:progress', subscription);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
