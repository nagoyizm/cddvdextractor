import React from 'react';
import { AudioTrack } from '../../shared/types';
import { ListMusic, CheckSquare, Square, Clock, AudioWaveform } from 'lucide-react';

interface TrackListProps {
  tracks: AudioTrack[];
  onToggleTrack: (trackId: string) => void;
  onToggleAll: (selectAll: boolean) => void;
  onUpdateTrackTitle: (trackId: string, newTitle: string) => void;
  isDvd?: boolean;
  onSplitDvdTracks?: (count: number) => void;
}

export const TrackList: React.FC<TrackListProps> = ({
  tracks,
  onToggleTrack,
  onToggleAll,
  onUpdateTrackTitle,
  isDvd,
  onSplitDvdTracks,
}) => {
  const selectedCount = tracks.filter(t => t.selected).length;
  const allSelected = selectedCount === tracks.length && tracks.length > 0;
  const totalDurationSeconds = tracks
    .filter(t => t.selected)
    .reduce((acc, curr) => acc + curr.duration, 0);

  const formatTotalTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  return (
    <div className="glass-panel" style={{ padding: '18px 22px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ListMusic size={18} color="#00f2fe" />
          <h2 style={{ fontSize: '0.98rem', fontWeight: '600', color: '#fff' }}>
            Pistas y Capítulos de Audio Detectados ({selectedCount} de {tracks.length} seleccionados)
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isDvd && onSplitDvdTracks && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(0, 242, 254, 0.08)',
              border: '1px solid rgba(0, 242, 254, 0.25)',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.76rem',
            }}>
              <span style={{ color: 'var(--text-muted)' }}>Dividir DVD:</span>
              <button
                className={`btn ${tracks.length === 1 ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                onClick={() => onSplitDvdTracks(1)}
                title="Extraer el concierto completo en 1 solo archivo continuo"
              >
                1 Completo
              </button>
              <button
                className={`btn ${tracks.length === 12 ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                onClick={() => onSplitDvdTracks(12)}
                title="Dividir en 12 pistas"
              >
                12 Pistas
              </button>
            </div>
          )}

          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Duración: <strong style={{ color: '#00f2fe' }}>{formatTotalTime(totalDurationSeconds)}</strong>
          </span>

          <button
            className="btn btn-secondary"
            onClick={() => onToggleAll(!allSelected)}
            style={{ padding: '5px 10px', fontSize: '0.78rem' }}
          >
            {allSelected ? <Square size={13} /> : <CheckSquare size={13} />}
            {allSelected ? 'Deseleccionar todas' : 'Seleccionar todas'}
          </button>
        </div>
      </div>

      <div style={{ maxHeight: '280px', overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '10px 14px', width: '40px' }}></th>
              <th style={{ padding: '10px 14px', width: '60px' }}>#</th>
              <th style={{ padding: '10px 14px' }}>Título de la Pista</th>
              <th style={{ padding: '10px 14px', width: '220px' }}>Formato de Origen</th>
              <th style={{ padding: '10px 14px', width: '100px', textAlign: 'right' }}>Duración</th>
            </tr>
          </thead>
          <tbody>
            {tracks.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>
                  No hay pistas disponibles en la unidad seleccionada.
                </td>
              </tr>
            ) : (
              tracks.map((track) => (
                <tr
                  key={track.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: track.selected ? 'rgba(0, 242, 254, 0.03)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={track.selected}
                      onChange={() => onToggleTrack(track.id)}
                      style={{ cursor: 'pointer', accentColor: '#00f2fe' }}
                    />
                  </td>
                  <td style={{ padding: '8px 14px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    {String(track.trackNumber).padStart(2, '0')}
                  </td>
                  <td style={{ padding: '8px 14px' }}>
                    <input
                      type="text"
                      value={track.title}
                      onChange={(e) => onUpdateTrackTitle(track.id, e.target.value)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: track.selected ? '#fff' : 'var(--text-dim)',
                        fontSize: '0.85rem',
                        width: '100%',
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                  </td>
                  <td style={{ padding: '8px 14px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.05)',
                      color: track.sourceFormat.includes('24-bit') ? '#34d399' : '#94a3b8',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      <AudioWaveform size={11} />
                      {track.sourceFormat}
                    </span>
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {track.durationFormatted}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
