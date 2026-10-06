import React from 'react';
import { Disc3, Terminal } from 'lucide-react';

interface HeaderProps {
  mediaType: string;
  driveLetter: string;
  onToggleDevTools?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ mediaType, driveLetter, onToggleDevTools }) => {
  return (
    <header className="glass-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 15px rgba(0, 242, 254, 0.3)',
        }}>
          <Disc3 size={26} color="#07090e" style={{ animation: 'spin 12s linear infinite' }} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.02em', background: 'linear-gradient(to right, #ffffff, #cbd5e1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              DVD & CD Audio Extractor
            </h1>
            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(0, 242, 254, 0.1)', color: '#00f2fe', border: '1px solid rgba(0, 242, 254, 0.25)', fontWeight: '600' }}>
              PRO v1.0
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Extracción bit-perfect de alta fidelidad • FLAC, WAV 24-bit y MP3
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {onToggleDevTools && (
          <button
            className="btn btn-secondary"
            onClick={onToggleDevTools}
            title="Abrir / Cerrar Consola de desarrollador (F12)"
            style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Terminal size={14} color="#00f2fe" />
            <span>Consola (F12)</span>
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)' }}>
          <span className="led-indicator led-green" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Unidad: <strong style={{ color: '#fff' }}>{driveLetter || 'Detectando...'}</strong>
          </span>
          <span style={{ color: 'var(--text-dim)' }}>|</span>
          <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: '500' }}>
            {mediaType}
          </span>
        </div>
      </div>
    </header>
  );
};
