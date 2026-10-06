import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { DriveSelector } from './components/DriveSelector';
import { MetadataPanel } from './components/MetadataPanel';
import { TrackList } from './components/TrackList';
import { OutputSettings } from './components/OutputSettings';
import { ExtractionProgressModal } from './components/ExtractionProgressModal';
import {
  OpticalDrive,
  AudioTrack,
  DiscMetadata,
  OutputFormat,
  QualitySettings,
  ExtractionProgress,
  ExtractionConfig,
} from '../shared/types';

// Tipado seguro para la API expuesta por el preload
declare global {
  interface Window {
    electronAPI: {
      getDrives: () => Promise<OpticalDrive[]>;
      scanDisc: (drive: OpticalDrive) => Promise<{ drive: OpticalDrive; tracks: AudioTrack[]; metadata: DiscMetadata }>;
      ejectDrive: (driveLetter: string) => Promise<boolean>;
      selectDestinationFolder: (defaultPath?: string) => Promise<string | null>;
      openFolder: (folderPath: string) => Promise<void>;
      searchMetadata: (query: string) => Promise<{ metadata: DiscMetadata; trackTitles: string[] } | null>;
      startExtraction: (config: ExtractionConfig, sourceDrive: string) => Promise<boolean>;
      cancelExtraction: () => Promise<void>;
      toggleDevTools: () => Promise<void>;
      checkForUpdates?: () => Promise<any>;
      onExtractionProgress: (callback: (progress: ExtractionProgress) => void) => () => void;
    };
  }
}

export const App: React.FC = () => {
  const [drives, setDrives] = useState<OpticalDrive[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<OpticalDrive | null>(null);
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [metadata, setMetadata] = useState<DiscMetadata>({
    album: 'Cargando información del disco...',
    artist: 'Artista Desconocido',
    year: '2026',
    genre: 'Música',
  });

  const [outputFormat, setOutputFormat] = useState<OutputFormat>('flac');
  const [quality, setQuality] = useState<QualitySettings>({
    bitDepth: 24,
    sampleRate: 0,
    bitrate: '320k',
    compressionLevel: 8,
    downmixToStereo: true,
  });

  const [destinationFolder, setDestinationFolder] = useState<string>('C:\\Music\\Extracted');
  const [hasUserSelectedFolder, setHasUserSelectedFolder] = useState<boolean>(false);
  const [fileNamePattern, setFileNamePattern] = useState<string>('{track} - {title}');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isSearchingMb, setIsSearchingMb] = useState<boolean>(false);
  const [extractionProgress, setExtractionProgress] = useState<ExtractionProgress | null>(null);

  // 1. Cargar unidades ópticas al montar
  useEffect(() => {
    loadDrives();
  }, []);

  // 2. Suscribirse a los eventos de progreso de extracción
  useEffect(() => {
    if (window.electronAPI?.onExtractionProgress) {
      const unsubscribe = window.electronAPI.onExtractionProgress((progress) => {
        setExtractionProgress(progress);
      });
      return () => unsubscribe();
    }
  }, []);

  const loadDrives = async () => {
    setIsScanning(true);
    try {
      if (window.electronAPI?.getDrives) {
        const driveList = await window.electronAPI.getDrives();
        setDrives(driveList);
        if (driveList.length > 0) {
          const firstLoaded = driveList.find(d => d.mediaLoaded) || driveList[0];
          setSelectedDrive(firstLoaded);
          scanSelectedDisc(firstLoaded);
        } else {
          setSelectedDrive(null);
          setTracks([]);
          setMetadata({
            album: '',
            artist: '',
            year: '',
            genre: '',
          });
        }
      }
    } catch (err) {
      console.error('Error cargando unidades:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const scanSelectedDisc = async (drive: OpticalDrive) => {
    setIsScanning(true);
    try {
      if (window.electronAPI?.scanDisc) {
        const result = await window.electronAPI.scanDisc(drive);
        setTracks(result.tracks);
        setMetadata(result.metadata);
      }
    } catch (err) {
      console.error('Error escaneando disco:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectDrive = (drive: OpticalDrive) => {
    setSelectedDrive(drive);
    scanSelectedDisc(drive);
  };

  const handleEject = async () => {
    if (selectedDrive && window.electronAPI?.ejectDrive) {
      await window.electronAPI.ejectDrive(selectedDrive.driveLetter);
      setTimeout(loadDrives, 1000);
    }
  };

  const handleSelectFolder = async () => {
    if (window.electronAPI?.selectDestinationFolder) {
      const folder = await window.electronAPI.selectDestinationFolder(destinationFolder);
      if (folder) {
        setDestinationFolder(folder);
        setHasUserSelectedFolder(true);
      }
    }
  };

  const handleDestinationFolderChange = (folder: string) => {
    setDestinationFolder(folder);
    setHasUserSelectedFolder(true);
  };

  const handleSearchMetadata = async (query: string) => {
    setIsSearchingMb(true);
    try {
      if (window.electronAPI?.searchMetadata) {
        const res = await window.electronAPI.searchMetadata(query);
        if (res) {
          setMetadata(res.metadata);
          if (res.trackTitles.length > 0) {
            setTracks(prev => {
              // Si es un DVD-Video y el álbum en Discogs/MusicBrainz tiene un número de pistas definido
              if (selectedDrive?.mediaType === 'DVD-Video') {
                const count = res.trackTitles.length;
                const totalSec = prev.reduce((acc, curr) => acc + curr.duration, 0) || 6922;
                const partDuration = Math.floor(totalSec / count);
                const formatTime = (secs: number) => {
                  const h = Math.floor(secs / 3600);
                  const m = Math.floor((secs % 3600) / 60);
                  const s = Math.floor(secs % 60);
                  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                };
                const formatDur = (secs: number) => {
                  const m = Math.floor(secs / 60);
                  const s = Math.floor(secs % 60);
                  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                };

                return res.trackTitles.map((trackTitle, idx) => {
                  const startSec = idx * partDuration;
                  const dur = (idx === count - 1) ? (totalSec - startSec) : partDuration;
                  return {
                    id: `dvd-track-${idx + 1}`,
                    trackNumber: idx + 1,
                    chapterIndex: idx + 1,
                    title: trackTitle,
                    artist: res.metadata.artist,
                    duration: dur,
                    durationFormatted: formatDur(dur),
                    startTimecode: formatTime(startSec),
                    durationTimecode: formatTime(dur),
                    sourceFormat: prev[0]?.sourceFormat || 'Dolby AC-3 48kHz Estéreo',
                    selected: true,
                  };
                });
              } else {
                return prev.map((t, idx) => ({
                  ...t,
                  title: res.trackTitles[idx] || t.title,
                  artist: res.metadata.artist,
                }));
              }
            });
          }
        }
      }
    } catch (err) {
      console.error('Error buscando metadatos:', err);
    } finally {
      setIsSearchingMb(false);
    }
  };

  const handleToggleTrack = (trackId: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, selected: !t.selected } : t));
  };

  const handleToggleAll = (selectAll: boolean) => {
    setTracks(prev => prev.map(t => ({ ...t, selected: selectAll })));
  };

  const handleUpdateTrackTitle = (trackId: string, newTitle: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, title: newTitle } : t));
  };

  const handleSplitDvdTracks = (count: number) => {
    if (!selectedDrive || tracks.length === 0) return;
    const totalSec = tracks.reduce((acc, curr) => acc + curr.duration, 0);
    if (totalSec <= 0) return;

    const partDuration = Math.floor(totalSec / count);
    const formatTime = (secs: number) => {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = Math.floor(secs % 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    const formatDur = (secs: number) => {
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const newTracks: AudioTrack[] = [];
    for (let i = 0; i < count; i++) {
      const startSec = i * partDuration;
      const dur = (i === count - 1) ? (totalSec - startSec) : partDuration;
      const existing = tracks[i]?.title;
      const title = existing && !existing.startsWith('Pista ') && !existing.startsWith('Capítulo ')
        ? existing
        : (count === 1 ? 'Concierto / Audio Completo' : `Pista ${String(i + 1).padStart(2, '0')}`);

      newTracks.push({
        id: `dvd-split-${count}-${i + 1}`,
        trackNumber: i + 1,
        chapterIndex: i + 1,
        title,
        artist: metadata.artist || 'DVD Audio',
        duration: dur,
        durationFormatted: formatDur(dur),
        startTimecode: formatTime(startSec),
        durationTimecode: formatTime(dur),
        sourceFormat: tracks[0]?.sourceFormat || 'Dolby AC-3 48kHz Estéreo',
        selected: true,
      });
    }

    setTracks(newTracks);
  };

  const handleStartExtraction = async () => {
    if (!selectedDrive) return;

    let targetFolder = destinationFolder;

    // Si el usuario no ha tocado ni seleccionado una carpeta destino manualmente,
    // abrir el selector de carpetas ("Guardar como...") para que elija dónde guardarla
    if (!hasUserSelectedFolder) {
      if (window.electronAPI?.selectDestinationFolder) {
        const chosen = await window.electronAPI.selectDestinationFolder(destinationFolder);
        if (!chosen) {
          // Si el usuario canceló la ventana de selección, se aborta la extracción
          return;
        }
        targetFolder = chosen;
        setDestinationFolder(chosen);
        setHasUserSelectedFolder(true);
      }
    }

    const config: ExtractionConfig = {
      outputFormat,
      destinationFolder: targetFolder,
      fileNamePattern,
      qualitySettings: quality,
      tracks,
      metadata,
    };

    setExtractionProgress({
      currentTrackIndex: 1,
      totalTracks: tracks.filter(t => t.selected).length,
      currentTrackTitle: 'Iniciando pipeline de transcodificación...',
      trackProgressPercent: 0,
      overallProgressPercent: 0,
      currentSpeed: '0x',
      eta: '--:--',
      status: 'extracting',
      logMessage: `Configurado formato ${outputFormat.toUpperCase()} en ${targetFolder}`,
    });

    try {
      if (window.electronAPI?.startExtraction) {
        await window.electronAPI.startExtraction(config, selectedDrive.driveLetter);
      }
    } catch (err) {
      console.error('Error durante extracción:', err);
    }
  };

  const handleCancelExtraction = async () => {
    if (window.electronAPI?.cancelExtraction) {
      await window.electronAPI.cancelExtraction();
    }
  };

  const handleOpenDestinationFolder = () => {
    if (destinationFolder && window.electronAPI?.openFolder) {
      window.electronAPI.openFolder(destinationFolder);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px' }}>
      <Header
        mediaType={selectedDrive?.mediaType || 'Desconocido'}
        driveLetter={selectedDrive?.driveLetter || ''}
        onToggleDevTools={() => window.electronAPI?.toggleDevTools?.()}
      />

      <DriveSelector
        drives={drives}
        selectedDrive={selectedDrive}
        onSelectDrive={handleSelectDrive}
        onRefreshDrives={loadDrives}
        onEjectDrive={handleEject}
        isScanning={isScanning}
      />

      <MetadataPanel
        metadata={metadata}
        onChange={setMetadata}
        onSearchMetadata={handleSearchMetadata}
        isSearching={isSearchingMb}
      />

      <TrackList
        tracks={tracks}
        onToggleTrack={handleToggleTrack}
        onToggleAll={handleToggleAll}
        onUpdateTrackTitle={handleUpdateTrackTitle}
        isDvd={selectedDrive?.mediaType === 'DVD-Video'}
        onSplitDvdTracks={handleSplitDvdTracks}
      />

      <OutputSettings
        format={outputFormat}
        onFormatChange={setOutputFormat}
        quality={quality}
        onQualityChange={setQuality}
        destinationFolder={destinationFolder}
        onSelectFolder={handleSelectFolder}
        hasUserSelectedFolder={hasUserSelectedFolder}
        onDestinationFolderChange={handleDestinationFolderChange}
        fileNamePattern={fileNamePattern}
        onFileNamePatternChange={setFileNamePattern}
        onStartExtraction={handleStartExtraction}
        isExtracting={extractionProgress?.status === 'extracting'}
        selectedTracksCount={tracks.filter(t => t.selected).length}
      />

      {/* Modal de progreso si está activo */}
      {extractionProgress && extractionProgress.status !== 'idle' && (
        <ExtractionProgressModal
          progress={extractionProgress}
          onCancel={handleCancelExtraction}
          onClose={() => setExtractionProgress(null)}
          onOpenFolder={handleOpenDestinationFolder}
        />
      )}
    </div>
  );
};
