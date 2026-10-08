import React, { useEffect } from 'react';
import Illustration from './Illustration';
import OwnerAvatar from './avatar/OwnerAvatar';
import CheckBadge from './CheckBadge';
import { useAuth } from '../context/AuthContext';

// Aviso flotante: éxito (tu avatar con el sello animado; Sofía si aún no tienes uno) o error (Nova se disculpa).
// Las animaciones viven dentro de los SVG y se reinician cada vez que el aviso aparece.
export default function Toast({ type = 'success', message, onClose, duration = 4000 }) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const ok = type === 'success';
  const { user } = useAuth();
  const conAvatar = ok && !!user?.avatar;

  return (
    <div className="fixed top-6 right-6 z-50" role={ok ? 'status' : 'alert'}>
      <div
        className={`flex items-center gap-4 pl-3 pr-6 py-3 rounded-2xl border bg-white shadow-[0_8px_24px_rgba(10,10,10,0.12)] ${
          ok ? 'border-success/40' : 'border-danger/50'
        }`}
      >
        {conAvatar ? (
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full bg-[#FDECEA] overflow-hidden flex items-end justify-center">
              <div className="noma-cheer">
                <OwnerAvatar config={user.avatar} variant="busto" height={72} label="Tu avatar celebra" />
              </div>
            </div>
            <CheckBadge size={26} className="absolute -bottom-1 -right-1" />
          </div>
        ) : (
          <div className="rounded-xl bg-[#FDECEA] p-2 shrink-0">
            <Illustration
              name={ok ? 'exito' : 'error'}
              size={92}
              framed={false}
              alt={ok ? 'Sofía celebra' : 'Nova se disculpa'}
            />
          </div>
        )}
        <span className="text-sm font-medium text-text max-w-[260px] leading-5">{message}</span>
      </div>
    </div>
  );
}
