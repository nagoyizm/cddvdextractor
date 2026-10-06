import React, { useState } from 'react';
import { ExtractionProgress } from '../../shared/types';
import { X, CheckCircle, AlertTriangle, FolderOpen, Activity, Disc, Check } from 'lucide-react';

interface ExtractionProgressModalProps {
  progress: ExtractionProgress;
  onCancel: () => void;
  onClose: () => void;
  onOpenFolder: () => void;
}

export const ExtractionProgressModal: React.FC<ExtractionProgressModalProps> = ({
  progress,
  onCancel,
  onClose,
  onOpenFolder,
}) => {
  const [confirmCancel, setConfirmCancel] = useState(false);

  const isFinished = progress.status === 'completed';
  const isError = progress.status === 'error';
  const isCancelled = progress.status === 'cancelled';
  const isExtracting = progress.status === 'extracting';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(4, 7, 13, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div className="glass-panel" style={{ width: '580px', padding: '28px', border: '1px solid rgba(0, 242, 254, 0.25)', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
        {/* Header Modal */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isFinished ? (
              <CheckCircle size={24} color="#10b981" />
            ) : isError ? (
              <AlertTriangle size={24} color="#ef4444" />
            ) : isCancelled ? (
              <AlertTriangle size={24} color="#f59e0b" />
            ) : (
              <Activity size={24} color="#00f2fe" style={{ animation: 'pulse 1.5s infinite' }} />
            )}
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#fff' }}>
              {isFinished
                ? 'Extracción Completada con Éxito'
                : isError
                ? 'Error en la Extracción'
                : isCancelled
                ? 'Extracción Cancelada'
                : 'Extrayendo Pistas de Audio...'}
            </h3>
          </div>

          {(isFinished || isError || isCancelled) && (
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
              title="Cerrar ventana"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Indicador destacado de Etapa / Paso Actual */}
        <div style={{
          padding: '12px 16px',
          background: isFinished
            ? 'rgba(16, 185, 129, 0.1)'
            : isCancelled
            ? 'rgba(245, 158, 11, 0.1)'
            : isError
            ? 'rgba(239, 68, 68, 0.1)'
            : 'linear-gradient(135deg, rgba(0, 242, 254, 0.1) 0%, rgba(79, 172, 254, 0.05) 100%)',
          border: isFinished
            ? '1px solid rgba(16, 185, 129, 0.3)'
            : isCancelled
            ? '1px solid rgba(245, 158, 11, 0.3)'
            : isError
            ? '1px solid rgba(239, 68, 68, 0.3)'
            : '1px solid rgba(0, 242, 254, 0.3)',
          borderRadius: '10px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: isFinished
                ? 'rgba(16, 185, 129, 0.2)'
                : isCancelled
                ? 'rgba(245, 158, 11, 0.2)'
                : isError
                ? 'rgba(239, 68, 68, 0.2)'
                : 'rgba(0, 242, 254, 0.2)',
              color: isFinished ? '#10b981' : isCancelled ? '#f59e0b' : isError ? '#ef4444' : '#00f2fe',
              fontSize: '0.72rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              padding: '4px 8px',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
            }}>
              {isFinished ? (
                <>
                  <Check size={13} />
                  Estado
                </>
              ) : isExtracting ? (
                <>
                  <Disc size={13} style={{ animation: 'spin 3s linear infinite' }} />
                  Paso en curso
                </>
              ) : (
                'Estado'
              )}
            </span>
            <span style={{
              fontSize: '0.92rem',
              fontWeight: '600',
              color: '#f8fafc',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {progress.currentPhase || (isExtracting ? 'Iniciando proceso...' : 'Listo')}
            </span>
          </div>

          <span style={{
            fontSize: '0.95rem',
            fontWeight: '700',
            fontFamily: 'var(--font-mono)',
            color: isFinished ? '#10b981' : '#38bdf8',
            whiteSpace: 'nowrap',
          }}>
            {progress.trackProgressPercent}%
          </span>
        </div>

        {/* Visualizador de Ondas Animadas mientras está activo */}
        {isExtracting && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
            <div className="audio-visualizer">
              {[...Array(24)].map((_, i) => (
                <div
                  key={i}
                  className="audio-bar"
                  style={{
                    animationDelay: `${(i * 0.05).toFixed(2)}s`,
                    animationDuration: `${0.8 + (i % 5) * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Información y Barras de Progreso */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Pista en proceso:</span>
            <span style={{ color: '#fff', fontWeight: '600' }}>
              {progress.currentTrackTitle || 'Iniciando...'}
            </span>
          </div>

          {/* Barra de progreso de pista individual */}
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden', marginBottom: '14px' }}>
            <div
              style={{
                height: '100%',
                width: `${progress.trackProgressPercent}%`,
                background: 'linear-gradient(90deg, #00f2fe, #4facfe)',
                transition: 'width 0.2s linear',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Progreso total ({progress.currentTrackIndex} de {progress.totalTracks}):</span>
            <span style={{ color: '#00f2fe', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
              {progress.overallProgressPercent}%
            </span>
          </div>

          {/* Barra de progreso general */}
          <div style={{ height: '12px', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${progress.overallProgressPercent}%`,
                background: 'linear-gradient(90deg, #38bdf8, #8b5cf6)',
                transition: 'width 0.2s linear',
              }}
            />
          </div>
        </div>

        {/* Métricas: Velocidad, ETA, Pistas Listas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px', textAlign: 'center' }}>
          <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Velocidad</div>
            <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#fff', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {progress.currentSpeed || '--'}
            </div>
          </div>

          <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tiempo Estimado</div>
            <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#fff', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {progress.eta || '--:--'}
            </div>
          </div>

          <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pistas Listas</div>
            <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#10b981', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {progress.currentTrackIndex - (isFinished ? 0 : 1)} / {progress.totalTracks}
            </div>
          </div>
        </div>

        {/* Consola de logs y actividad en tiempo real */}
        {progress.logMessage && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(0,0,0,0.45)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.76rem',
            color: '#cbd5e1',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflow: 'hidden',
          }}>
            <span style={{ color: '#00f2fe', fontWeight: '700' }}>&gt;</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {progress.logMessage}
            </span>
          </div>
        )}

        {/* Detalle del error si ocurrió */}
        {isError && progress.errorMessage && (
          <div style={{
            padding: '12px 14px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '8px',
            marginBottom: '16px',
            color: '#fca5a5',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: '130px',
            overflowY: 'auto',
          }}>
            <strong style={{ color: '#ef4444' }}>Causa del error:</strong>
            <div style={{ marginTop: '4px', color: '#f1f5f9' }}>{progress.errorMessage}</div>
          </div>
        )}

        {/* Diálogo de Confirmación para Cancelar Extracción */}
        {confirmCancel && isExtracting && (
          <div style={{
            padding: '14px 16px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '10px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#fca5a5' }}>
                  ¿Estás seguro de que deseas cancelar la extracción?
                </div>
                <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '3px' }}>
                  Se detendrá la lectura óptica y se descartará el archivo en proceso.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmCancel(false)}
                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
              >
                No, continuar extracción
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setConfirmCancel(false);
                  onCancel();
                }}
                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
              >
                Sí, cancelar extracción
              </button>
            </div>
          </div>
        )}

        {/* Acciones principales */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          {isExtracting ? (
            !confirmCancel && (
              <button className="btn btn-danger" onClick={() => setConfirmCancel(true)}>
                Cancelar Extracción
              </button>
            )
          ) : (
            <>
              {isFinished && (
                <button className="btn btn-primary" onClick={onOpenFolder}>
                  <FolderOpen size={16} />
                  Abrir Carpeta de Destino
                </button>
              )}
              <button className="btn btn-secondary" onClick={onClose}>
                Cerrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
