import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useHitos } from '../context/HitosContext';
import { Character } from './Illustration';

// Consejo de Nova la primera vez que se visita una sección. Se descarta y no vuelve a salir (por cuenta,
// en cualquier navegador: el "visto" se guarda en el servidor junto con los logros).
export default function TipNova({ id, children, className = '' }) {
  const { user } = useAuth();
  const { cargado, haVisto, marcarVisto } = useHitos();
  const [descartado, setDescartado] = useState(false);
  const clave = `tip:${id}`;

  // Hasta que se sepa qué ha visto la cuenta no se muestra nada (evita que el consejo parpadee y desaparezca)
  if (!user || !cargado || descartado || haVisto(clave)) return null;

  const descartar = () => {
    marcarVisto(clave);
    setDescartado(true);
  };

  return (
    <aside
      aria-label="Consejo de Nova"
      className={`relative bg-[#FDECEA] border border-accent/20 rounded-2xl pl-3 pr-12 py-3 flex items-center gap-4 ${className}`}
    >
      <div className="shrink-0 noma-cheer">
        <Character name="nova" height={64} alt="" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-[0.04em] uppercase text-accent mb-0.5">Consejo de Nova</p>
        <p className="text-sm text-text leading-5">{children}</p>
      </div>
      <button
        onClick={descartar}
        aria-label="Entendido, cerrar consejo"
        className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-transparent border-none text-muted hover:bg-white cursor-pointer flex items-center justify-center"
      >
        <X size={16} />
      </button>
    </aside>
  );
}
