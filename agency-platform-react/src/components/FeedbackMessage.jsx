import React from 'react';
import Illustration from './Illustration';

// Mensaje en línea de éxito o error, con el personaje correspondiente.
export default function FeedbackMessage({ type = 'success', children, className = '' }) {
  const ok = type === 'success';

  return (
    <div
      role={ok ? 'status' : 'alert'}
      className={`flex items-center gap-4 p-3 pr-6 rounded-2xl border bg-white ${
        ok ? 'border-success/40' : 'border-danger/50'
      } ${className}`}
    >
      <div className="rounded-xl bg-[#FDECEA] p-2 shrink-0">
        <Illustration
          name={ok ? 'exito' : 'error'}
          size={88}
          framed={false}
          alt={ok ? 'Sofía celebra' : 'Nova se disculpa'}
        />
      </div>
      <span className={`text-sm font-medium ${ok ? 'text-text' : 'text-danger-text'}`}>{children}</span>
    </div>
  );
}
