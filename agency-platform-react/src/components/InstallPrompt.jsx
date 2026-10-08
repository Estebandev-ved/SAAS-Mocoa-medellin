import React, { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';

const CLAVE = 'noma_instalar_descartado';

// Invita a instalar el dashboard como app en el celular (PWA). Solo aparece en pantallas
// pequeñas, si la app aún no está instalada y el dueño no la descartó. Android/Chrome
// dispara `beforeinstallprompt`; iOS Safari no lo tiene, así que ahí se explica el gesto manual.
export default function InstallPrompt() {
  const [evento, setEvento] = useState(null);
  const [visible, setVisible] = useState(false);

  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  useEffect(() => {
    let descartado = false;
    try { descartado = localStorage.getItem(CLAVE) === '1'; } catch { /* sin almacenamiento */ }
    if (instalada || descartado || window.innerWidth >= 768) return undefined;

    if (esIOS) {
      setVisible(true);
      return undefined;
    }
    const onPrompt = (e) => {
      e.preventDefault();
      setEvento(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [esIOS, instalada]);

  const cerrar = () => {
    setVisible(false);
    try { localStorage.setItem(CLAVE, '1'); } catch { /* sin almacenamiento */ }
  };

  const instalar = async () => {
    if (!evento) return;
    evento.prompt();
    await evento.userChoice.catch(() => {});
    setEvento(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-accent/30 bg-[#FDECEA] p-4" role="region" aria-label="Instalar la app">
      <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">Lleva tu negocio en el celular</p>
        <p className="mt-0.5 text-sm text-muted">
          {esIOS
            ? 'En Safari toca Compartir y luego "Agregar a pantalla de inicio".'
            : 'Instala la app para abrir tus pedidos con un toque, sin buscar el navegador.'}
        </p>
        {!esIOS && (
          <button
            type="button"
            onClick={instalar}
            className="mt-3 h-10 cursor-pointer rounded-xl border-none bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent2"
          >
            Instalar app
          </button>
        )}
      </div>
      <button type="button" onClick={cerrar} aria-label="Cerrar" className="cursor-pointer rounded-lg border-none bg-transparent p-1 text-muted hover:bg-bg2">
        <X size={16} />
      </button>
    </div>
  );
}
