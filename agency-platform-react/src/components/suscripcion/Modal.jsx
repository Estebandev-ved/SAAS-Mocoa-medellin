import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Diálogo accesible: Escape y clic afuera cierran, el foco entra al abrirse y
// vuelve al botón que lo abrió al cerrarse.
export default function Modal({ titulo, onClose, children, ancho = 'max-w-lg' }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const previo = document.activeElement;
    const panel = panelRef.current;
    panel?.querySelector('[data-autofocus]')?.focus() || panel?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !panel) return;
      const focusables = panel.querySelectorAll('button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previo?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className={`w-full ${ancho} max-h-[90dvh] overflow-y-auto overscroll-contain bg-white rounded-t-2xl sm:rounded-2xl border border-border p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 outline-none`}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="font-head text-xl font-bold text-text">{titulo}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="tap-44 -mr-2 -mt-2 rounded-lg text-muted hover:text-text hover:bg-bg3 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
