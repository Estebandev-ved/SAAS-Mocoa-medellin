import { useEffect, useState } from 'react';
import { X, Loader2, Sparkles } from 'lucide-react';
import api from '../../services/api';
import { TIPOS } from './catalogo';

// Galería de plantillas de flujos (vienen del servidor, ordenadas por lo que se recomienda para el tipo de negocio).
export default function PlantillasFlujo({ onElegir, onCerrar }) {
  const [plantillas, setPlantillas] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    api.get('/flujos/plantillas')
      .then((r) => { if (vivo) setPlantillas(r.data.plantillas || []); })
      .catch(() => { if (vivo) setError('No se pudieron cargar las plantillas. Intenta de nuevo.'); });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    const alTeclear = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  const pasos = (p) => p.definicion.nodos.length - 1; // sin contar el disparador
  const empieza = (p) => TIPOS.disparador.resumen(p.definicion.nodos.find((n) => n.tipo === 'disparador').config);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Plantillas de flujos" onClick={onCerrar}>
      <div className="bg-white w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="font-head text-xl text-text">Empieza con una plantilla</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="h-11 w-11 inline-flex items-center justify-center rounded-xl bg-transparent border-none cursor-pointer text-muted"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-muted mb-4">Elige una, cambia los textos a tu gusto y enciéndela. Las recomendadas para tu tipo de negocio van primero.</p>

        {!plantillas && !error && <div className="py-10 flex justify-center text-muted"><Loader2 className="w-6 h-6 animate-spin" aria-label="Cargando" /></div>}
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}

        <div className="grid sm:grid-cols-2 gap-3">
          {(plantillas || []).map((p) => (
            <div key={p.id} className="rounded-2xl border border-[#C9C9C9] p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-text text-base">{p.nombre}</h3>
                {p.recomendada && p.familias.length > 0 && (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[11px] bg-accent/10 text-accent px-2 py-0.5 rounded-lg"><Sparkles className="w-3 h-3" /> Para tu negocio</span>
                )}
              </div>
              <p className="text-sm text-muted mt-1 flex-1">{p.descripcion}</p>
              <p className="text-xs text-muted mt-2">{pasos(p)} pasos · {empieza(p)}</p>
              <button type="button" onClick={() => onElegir(p)} className="mt-3 h-11 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold border-none cursor-pointer">Usar esta plantilla</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
