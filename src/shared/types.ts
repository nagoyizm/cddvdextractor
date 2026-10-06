export type MediaType = 'CD-DA' | 'DVD-Video' | 'DVD-Audio' | 'Data-Disc' | 'Empty' | 'Unknown';

export interface OpticalDrive {
  id: string;
  driveLetter: string;
  name: string;
  mediaLoaded: boolean;
  mediaType: MediaType;
  volumeName: string;
  totalSize: number;
  availableTracksCount: number;
}

export interface AudioTrack {
  id: string;
  trackNumber: number;
  title: string;
  artist: string;
  duration: number; // in seconds
  durationFormatted: string; // e.g. "03:45"
  sourceFormat: string; // e.g. "LPCM 24-bit 96kHz", "PCM 16-bit 44.1kHz", "Dolby AC-3 5.1"
  streamIndex?: number;
  chapterIndex?: number;
  startSector?: number;
  endSector?: number;
  startTimecode?: string;
  durationTimecode?: string;
  selected: boolean;
}

export interface DiscMetadata {
  album: string;
  artist: string;
  year: string;
  genre: string;
  coverUrl?: string;
  coverBase64?: string;
  discId?: string;
  barcode?: string;
  catalogNumber?: string;
  source?: 'Discogs' | 'MusicBrainz';
}

export type OutputFormat = 'flac' | 'wav' | 'mp3' | 'aac' | 'opus' | 'ogg';

export interface QualitySettings {
  bitDepth: 16 | 24;
  sampleRate: number; // 0 = keep original, 44100, 48000, 96000, 192000
  bitrate: string; // '320k', '256k', '192k', 'vbr-v0'
  compressionLevel: number; // 0-8 for FLAC
  downmixToStereo: boolean;
}

export interface ExtractionConfig {
  outputFormat: OutputFormat;
  destinationFolder: string;
  fileNamePattern: string; // e.g. "{track} - {title}"
  qualitySettings: QualitySettings;
  tracks: AudioTrack[];
  metadata: DiscMetadata;
}

export interface ExtractionProgress {
  currentTrackIndex: number;
  totalTracks: number;
  currentTrackTitle: string;
  trackProgressPercent: number;
  overallProgressPercent: number;
  currentSpeed: string;
  eta: string;
  currentPhase?: string;
  status: 'idle' | 'scanning' | 'extracting' | 'completed' | 'error' | 'cancelled';
  errorMessage?: string;
  logMessage?: string;
}

export interface DiscDetectionResult {
  drive: OpticalDrive;
  tracks: AudioTrack[];
  metadata: DiscMetadata;
}
