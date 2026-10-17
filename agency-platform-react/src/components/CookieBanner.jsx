import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';

const CLAVE = 'antigravity_cookie_consent';
const VERSION = 1;

// Lee la decisión guardada. Si el almacenamiento está bloqueado, se trata como "sin decidir".
export function leerConsentimiento() {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    return v && v.v === VERSION ? v : null;
  } catch {
    return null;
  }
}

// Hoy la app solo usa almacenamiento esencial (sesión, preferencias, avisos). Si algún día se agrega
// analítica o publicidad, debe cargarse SOLO cuando leerConsentimiento()?.analitica sea true.
function guardar(analitica) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ v: VERSION, necesarias: true, analitica, ts: new Date().toISOString() }));
    window.dispatchEvent(new Event('noma-consent'));
  } catch {
    /* sin almacenamiento: el aviso volverá a salir, no se rompe nada */
  }
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(leerConsentimiento() === null);
  }, []);

  if (!visible) return null;

  const decidir = (analitica) => {
    guardar(analitica);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies y almacenamiento"
      className="fixed inset-x-0 bottom-0 z-[100] p-2 sm:p-4 max-lg:bottom-[calc(64px+env(safe-area-inset-bottom))]"
      
    >
      <div className="max-w-3xl mx-auto bg-bg border border-border rounded-2xl shadow-lg p-3 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Cookie className="text-accent shrink-0 hidden sm:block" size={28} aria-hidden="true" />
        <p className="text-[13px] sm:text-sm text-text leading-5 sm:leading-6 flex-1">
          <span className="sm:hidden">Usamos almacenamiento necesario y, si aceptas, medimos el uso del sitio. </span>
          <span className="hidden sm:inline">
            Usamos cookies y almacenamiento local <strong>necesarios</strong> para que tu sesión y tus preferencias funcionen.
            Si aceptas, también podremos medir el uso del sitio para mejorarlo. Puedes cambiar tu decisión cuando quieras.{' '}
          </span>
          <Link to="/cookies" className="text-accent underline">Política de cookies</Link>
        </p>
        <div className="flex gap-2 shrink-0 w-full sm:w-auto">
          <button
            type="button" onClick={() => decidir(false)}
            className="flex-1 sm:flex-none min-h-11 px-4 rounded-xl border border-border bg-bg text-sm font-semibold text-text cursor-pointer hover:border-[#C9C9C9]"
          >
            Solo necesarias
          </button>
          <button
            type="button" onClick={() => decidir(true)}
            className="flex-1 sm:flex-none min-h-11 px-4 rounded-xl bg-accent text-white text-sm font-bold cursor-pointer border-none hover:opacity-90"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}

// Para el enlace "Cambiar mis preferencias de cookies" del pie de página y de la política.
export function reabrirCookies() {
  try { localStorage.removeItem(CLAVE); } catch { /* ignorar */ }
  window.location.reload();
}
