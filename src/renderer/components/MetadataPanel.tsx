import React, { useState } from 'react';
import { DiscMetadata } from '../../shared/types';
import { Music, Calendar, Tag, User, Search, Image as ImageIcon, Barcode, Hash, CheckCircle2 } from 'lucide-react';

interface MetadataPanelProps {
  metadata: DiscMetadata;
  onChange: (updated: DiscMetadata) => void;
  onSearchMetadata: (query: string) => void;
  isSearching: boolean;
}

export const MetadataPanel: React.FC<MetadataPanelProps> = ({
  metadata,
  onChange,
  onSearchMetadata,
  isSearching,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (term: string) => {
    const clean = term.trim();
    if (clean) {
      onSearchMetadata(clean);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '18px 22px', marginBottom: '20px' }}>
      {/* Encabezado y Barra de Búsqueda Online */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Music size={18} color="#00f2fe" />
          <h2 style={{ fontSize: '0.98rem', fontWeight: '600', color: '#fff' }}>
            Metadatos del Álbum y Carátula
          </h2>
          {metadata.source && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              fontWeight: '600',
              padding: '2px 8px',
              borderRadius: '4px',
              background: metadata.source === 'Discogs' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)',
              color: metadata.source === 'Discogs' ? '#f59e0b' : '#38bdf8',
              border: `1px solid ${metadata.source === 'Discogs' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
            }}>
              <CheckCircle2 size={11} />
              {metadata.source}
            </span>
          )}
        </div>

        {/* Buscador inteligente: Código de barras, N° catálogo, Discogs ID o Texto */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Código de barras, N° catálogo, ID Discogs o álbum..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(searchQuery || metadata.barcode || metadata.catalogNumber || metadata.album);
              }
            }}
            style={{ width: '310px', padding: '6px 12px', fontSize: '0.8rem' }}
          />
          <button
            className="btn btn-secondary"
            onClick={() => handleSearch(searchQuery || metadata.barcode || metadata.catalogNumber || metadata.album)}
            disabled={isSearching || (!searchQuery.trim() && !metadata.barcode && !metadata.catalogNumber && !metadata.album)}
            style={{ padding: '6px 14px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            title="Buscar en Discogs y MusicBrainz"
          >
            <Search size={14} />
            {isSearching ? 'Buscando...' : 'Buscar en Discogs'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '22px', alignItems: 'center' }}>
        {/* Cover Art Box */}
        <div style={{
          width: '130px',
          height: '130px',
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
          position: 'relative'
        }}>
          {metadata.coverBase64 || metadata.coverUrl ? (
            <img
              src={metadata.coverBase64 || metadata.coverUrl}
              alt="Carátula"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '10px' }}>
              <ImageIcon size={32} style={{ margin: '0 auto 6px auto', display: 'block', opacity: 0.5 }} />
              <span style={{ fontSize: '0.72rem' }}>Sin Carátula</span>
            </div>
          )}
        </div>

        {/* Input Fields Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {/* Título */}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <Music size={12} /> Título del Álbum / DVD:
            </label>
            <input
              type="text"
              className="form-input"
              value={metadata.album}
              onChange={(e) => onChange({ ...metadata, album: e.target.value })}
              placeholder="Ej. De Raíz / Namco"
            />
          </div>

          {/* Artista */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <User size={12} /> Artista / Banda:
            </label>
            <input
              type="text"
              className="form-input"
              value={metadata.artist}
              onChange={(e) => onChange({ ...metadata, artist: e.target.value })}
              placeholder="Ej. Ernesto Holman Trío"
            />
          </div>

          {/* Año */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <Calendar size={12} /> Año de Lanzamiento:
            </label>
            <input
              type="text"
              className="form-input"
              value={metadata.year}
              onChange={(e) => onChange({ ...metadata, year: e.target.value })}
              placeholder="Ej. 2016"
            />
          </div>

          {/* Género */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <Tag size={12} /> Género:
            </label>
            <input
              type="text"
              className="form-input"
              value={metadata.genre}
              onChange={(e) => onChange({ ...metadata, genre: e.target.value })}
              placeholder="Ej. Jazz / Etnojazz"
            />
          </div>

          {/* Código de Barras (Barcode) */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Barcode size={12} /> Código de Barras:
              </span>
              {metadata.barcode && (
                <button
                  type="button"
                  onClick={() => metadata.barcode && handleSearch(metadata.barcode)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#00f2fe',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    padding: 0,
                    textDecoration: 'underline'
                  }}
                >
                  Buscar
                </button>
              )}
            </label>
            <input
              type="text"
              className="form-input"
              value={metadata.barcode || ''}
              onChange={(e) => onChange({ ...metadata, barcode: e.target.value })}
              placeholder="Ej. 780460143005"
            />
          </div>

          {/* Número de Catálogo / Matriz */}
          <div style={{ gridColumn: 'span 3' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Hash size={12} /> N° de Catálogo / Código Matriz en Disco:
              </span>
              {metadata.catalogNumber && (
                <button
                  type="button"
                  onClick={() => metadata.catalogNumber && handleSearch(metadata.catalogNumber)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#00f2fe',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    padding: 0,
                    textDecoration: 'underline'
                  }}
                >
                  Buscar
                </button>
              )}
            </label>
            <input
              type="text"
              className="form-input"
              value={metadata.catalogNumber || ''}
              onChange={(e) => onChange({ ...metadata, catalogNumber: e.target.value })}
              placeholder="Ej. WPCR-13420, TDV 1081, L.D.CHILE 31388, n° 10 o URL de Discogs"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
