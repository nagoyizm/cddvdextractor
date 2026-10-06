import React from 'react';
import { OutputFormat, QualitySettings } from '../../shared/types';
import { Sliders, Folder, FileAudio, Settings2, Play } from 'lucide-react';

interface OutputSettingsProps {
  format: OutputFormat;
  onFormatChange: (format: OutputFormat) => void;
  quality: QualitySettings;
  onQualityChange: (quality: QualitySettings) => void;
  destinationFolder: string;
  onSelectFolder: () => void;
  hasUserSelectedFolder?: boolean;
  onDestinationFolderChange?: (folder: string) => void;
  fileNamePattern: string;
  onFileNamePatternChange: (pattern: string) => void;
  onStartExtraction: () => void;
  isExtracting: boolean;
  selectedTracksCount: number;
}

export const OutputSettings: React.FC<OutputSettingsProps> = ({
  format,
  onFormatChange,
  quality,
  onQualityChange,
  destinationFolder,
  onSelectFolder,
  hasUserSelectedFolder = false,
  onDestinationFolderChange,
  fileNamePattern,
  onFileNamePatternChange,
  onStartExtraction,
  isExtracting,
  selectedTracksCount,
}) => {
  const isLossless = format === 'flac' || format === 'wav';

  return (
    <div className="glass-panel" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={18} color="#00f2fe" />
          <h2 style={{ fontSize: '0.98rem', fontWeight: '600', color: '#fff' }}>
            Configuración de Salida y Calidad de Audio
          </h2>
        </div>

        <button
          className="btn btn-primary"
          onClick={onStartExtraction}
          disabled={isExtracting || selectedTracksCount === 0 || !destinationFolder}
          style={{ padding: '10px 24px', fontSize: '0.95rem' }}
        >
          <Play size={16} fill="#040914" />
          {isExtracting ? 'Extrayendo...' : `Extraer ${selectedTracksCount} Pistas Ahora`}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
        {/* Formato de Salida */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
            Formato de Archivo:
          </label>
          <select
            className="form-select"
            value={format}
            onChange={(e) => onFormatChange(e.target.value as OutputFormat)}
          >
            <option value="flac">FLAC (Lossless de Alta Definición)</option>
            <option value="wav">WAV (PCM Crudo sin Compresión)</option>
            <option value="mp3">MP3 (LAME Máxima Compatibilidad)</option>
            <option value="aac">AAC / M4A (Móviles y Apple)</option>
            <option value="opus">OPUS (Ultra Eficiente)</option>
            <option value="ogg">OGG Vorbis</option>
          </select>
        </div>

        {/* Calidad / Parámetros específicos */}
        {isLossless ? (
          <>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                Profundidad de Bits:
              </label>
              <select
                className="form-select"
                value={quality.bitDepth}
                onChange={(e) => onQualityChange({ ...quality, bitDepth: Number(e.target.value) as 16 | 24 })}
              >
                <option value={16}>16-bit (Calidad CD Estándar)</option>
                <option value={24}>24-bit (Hi-Res Audio Studio)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                Frecuencia de Muestreo:
              </label>
              <select
                className="form-select"
                value={quality.sampleRate}
                onChange={(e) => onQualityChange({ ...quality, sampleRate: Number(e.target.value) })}
              >
                <option value={0}>Preservar Original del Disco</option>
                <option value={44100}>44.1 kHz (CD Audio)</option>
                <option value={48000}>48.0 kHz (DVD Estándar)</option>
                <option value={96000}>96.0 kHz (DVD Hi-Res Master)</option>
                <option value={192000}>192.0 kHz (Audiophile Ultra HD)</option>
              </select>
            </div>
          </>
        ) : (
          <>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                Tasa de Bits (Bitrate):
              </label>
              <select
                className="form-select"
                value={quality.bitrate}
                onChange={(e) => onQualityChange({ ...quality, bitrate: e.target.value })}
              >
                <option value="320k">320 kbps (Máxima Fidelidad CBR)</option>
                <option value="256k">256 kbps (Muy Alta Calidad)</option>
                <option value="192k">192 kbps (Estándar)</option>
                <option value="vbr-v0">VBR V0 (~245 kbps Variable Óptimo)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                Canales:
              </label>
              <select
                className="form-select"
                value={quality.downmixToStereo ? 'stereo' : 'original'}
                onChange={(e) => onQualityChange({ ...quality, downmixToStereo: e.target.value === 'stereo' })}
              >
                <option value="stereo">Downmix Inteligente a Estéreo (2.0)</option>
                <option value="original">Preservar Canales Originales (ej. 5.1)</option>
              </select>
            </div>
          </>
        )}

        {/* Canales para Lossless */}
        {isLossless && (
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
              Mezcla de Canales:
            </label>
            <select
              className="form-select"
              value={quality.downmixToStereo ? 'stereo' : 'original'}
              onChange={(e) => onQualityChange({ ...quality, downmixToStereo: e.target.value === 'stereo' })}
            >
              <option value="stereo">Downmix a Estéreo 2.0 (Normalizado)</option>
              <option value="original">Mantener Original (5.1 si existe)</option>
            </select>
          </div>
        )}
      </div>

      {/* Fila Inferior: Carpeta Destino y Patrón de Nombres */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '16px', alignItems: 'flex-start' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
            Carpeta de Destino en tu PC:
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="form-input"
              value={destinationFolder || ''}
              onChange={(e) => onDestinationFolderChange?.(e.target.value)}
              placeholder="Elige una carpeta destino..."
              style={{ color: '#fff' }}
            />
            <button
              className="btn btn-secondary"
              onClick={onSelectFolder}
              style={{ whiteSpace: 'nowrap' }}
            >
              <Folder size={15} />
              Examinar...
            </button>
          </div>
          <div style={{ marginTop: '5px', fontSize: '0.73rem' }}>
            {!hasUserSelectedFolder ? (
              <span style={{ color: '#ffb300', display: 'flex', alignItems: 'center', gap: '5px' }}>
                ℹ️ Carpeta por defecto. Al presionar "Extraer pistas" se abrirá la ventana para elegir dónde guardar.
              </span>
            ) : (
              <span style={{ color: '#00e676', display: 'flex', alignItems: 'center', gap: '5px' }}>
                ✓ Carpeta destino confirmada
              </span>
            )}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
            Plantilla de Nombre de Archivo:
          </label>
          <input
            type="text"
            className="form-input"
            value={fileNamePattern}
            onChange={(e) => onFileNamePatternChange(e.target.value)}
            placeholder="{track} - {artist} - {title}"
          />
        </div>
      </div>
    </div>
  );
};
