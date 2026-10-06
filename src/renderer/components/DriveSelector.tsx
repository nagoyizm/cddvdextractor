import React from 'react';
import { OpticalDrive } from '../../shared/types';
import { RefreshCw, Disc, LogOut, HardDrive, CheckCircle2, AlertCircle } from 'lucide-react';

interface DriveSelectorProps {
  drives: OpticalDrive[];
  selectedDrive: OpticalDrive | null;
  onSelectDrive: (drive: OpticalDrive) => void;
  onRefreshDrives: () => void;
  onEjectDrive: () => void;
  isScanning: boolean;
}

export const DriveSelector: React.FC<DriveSelectorProps> = ({
  drives,
  selectedDrive,
  onSelectDrive,
  onRefreshDrives,
  onEjectDrive,
  isScanning,
}) => {
  const getBadgeClass = (mediaType: string) => {
    switch (mediaType) {
      case 'CD-DA': return 'badge-cd';
      case 'DVD-Video':
      case 'DVD-Audio': return 'badge-dvd';
      case 'Empty': return 'badge-empty';
      default: return 'badge-hires';
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '18px 22px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HardDrive size={18} color="#00f2fe" />
          <h2 style={{ fontSize: '0.98rem', fontWeight: '600', color: '#fff' }}>
            Unidad de Lectura Óptica
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            onClick={onRefreshDrives}
            disabled={isScanning}
            title="Volver a escanear unidades de disco"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          >
            <RefreshCw size={14} className={isScanning ? 'spin' : ''} />
            {isScanning ? 'Escaneando...' : 'Actualizar'}
          </button>

          {selectedDrive && (
            <button
              className="btn btn-secondary"
              onClick={onEjectDrive}
              title="Abrir / Expulsar bandeja"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              <LogOut size={14} />
              Expulsar
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '16px', alignItems: 'center' }}>
        {/* Selector Dropdown */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
            Selecciona la unidad:
          </label>
          {drives.length === 0 ? (
            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.85rem', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              No se detectaron unidades ópticas físicas.
            </div>
          ) : (
            <select
              className="form-select"
              value={selectedDrive?.driveLetter || ''}
              onChange={(e) => {
                const found = drives.find(d => d.driveLetter === e.target.value);
                if (found) onSelectDrive(found);
              }}
            >
              {drives.map(drive => (
                <option key={drive.driveLetter} value={drive.driveLetter}>
                  {drive.driveLetter} ({drive.name}) - {drive.volumeName}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Info del Disco Activo */}
        {selectedDrive && (
          <div style={{ padding: '10px 16px', borderRadius: '10px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Disc size={20} color={selectedDrive.mediaLoaded ? '#00f2fe' : '#64748b'} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.92rem', fontWeight: '600', color: '#fff' }}>
                    {selectedDrive.volumeName}
                  </span>
                  <span className={`badge ${getBadgeClass(selectedDrive.mediaType)}`}>
                    {selectedDrive.mediaType}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {selectedDrive.mediaLoaded
                    ? `${selectedDrive.availableTracksCount} pistas/capítulos de audio detectados`
                    : 'Bandeja vacía o sin disco insertado'}
                </div>
              </div>
            </div>

            {selectedDrive.mediaLoaded && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.8rem', fontWeight: '500' }}>
                <CheckCircle2 size={16} />
                Listo para extraer
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
