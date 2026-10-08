import { useEffect } from 'react';
import Illustration from './ui/Illustration';
import './Toast.css';

// Aviso flotante con personaje (Sofía = éxito, Nova = error), igual que
// agency-platform-react/src/components/Toast.jsx. Sin la rama de avatar del
// dueño: este frontend es panel admin + portal de domicilios, sin cuentas
// de negocio con avatar propio.
//
// `action` (opcional): { label, onClick } — un botón de "Reintentar" para
// acciones que fallaron por mala señal en la calle (portal del domiciliario).
// Con acción presente no se cierra solo: el domiciliario decide cuándo,
// en vez de perder el aviso mientras busca señal.
export default function Toast({ type = 'success', message, onClose, duration = 4000, action = null }) {
  useEffect(() => {
    if (action) return undefined;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration, action]);

  const ok = type === 'success';

  return (
    <div className="toast-wrap" role={ok ? 'status' : 'alert'}>
      <div className={`toast-card ${ok ? 'toast-success' : 'toast-error'}`}>
        <div className="toast-icon">
          <Illustration
            name={ok ? 'exito' : 'error'}
            size={92}
            framed={false}
            alt={ok ? 'Sofía celebra' : 'Nova se disculpa'}
          />
        </div>
        <div className="toast-body">
          <span className="toast-message">{message}</span>
          {action && (
            <button type="button" className="toast-action" onClick={action.onClick}>
              {action.label}
            </button>
          )}
        </div>
        {action && (
          <button type="button" className="toast-close" onClick={onClose} aria-label="Cerrar">×</button>
        )}
      </div>
    </div>
  );
}
