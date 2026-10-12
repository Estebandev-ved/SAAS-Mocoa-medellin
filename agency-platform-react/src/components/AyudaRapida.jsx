import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, X } from 'lucide-react';

// Botón "¿Cómo funciona?": abre un recuadro con 3 pasos cortos y un enlace a la sección
// completa de la guía. Pensado para quien no lee manuales: la ayuda está en la misma pantalla.
// `guia` es el id de la sección en /guia (ver GuiaPage.jsx).
export default function AyudaRapida({ titulo = '¿Cómo funciona?', pasos, guia, className = '' }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className={className}>
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="inline-flex items-center gap-2 h-10 px-3 rounded-xl bg-white border border-[#C9C9C9] text-sm font-semibold text-text cursor-pointer hover:bg-bg2 transition-colors"
      >
        <HelpCircle size={16} className="text-accent" /> {titulo}
      </button>
      {abierto && (
        <div role="region" aria-label={titulo} className="mt-3 bg-white border border-border rounded-2xl p-5 relative">
          <button
            onClick={() => setAbierto(false)}
            aria-label="Cerrar ayuda"
            className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-transparent border-none text-muted hover:bg-bg2 cursor-pointer flex items-center justify-center"
          >
            <X size={16} />
          </button>
          <ol className="list-none p-0 m-0 space-y-3 pr-8">
            {pasos.map((p, i) => (
              <li key={p} className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm text-text leading-5">{p}</span>
              </li>
            ))}
          </ol>
          {guia && (
            <Link to={`/guia#${guia}`} className="inline-block mt-4 text-xs font-semibold text-accent hover:underline">
              Ver la explicación completa en la Guía →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
