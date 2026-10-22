import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import api from '../../services/api';
import { TIPOS } from './catalogo';

// Resultados del flujo guardado en los últimos 30 días: cuántos clientes entraron, terminaron y dónde se quedan.
export default function MetricasFlujo({ flujoId, nodos }) {
  const [m, setM] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!flujoId) { setM(null); return undefined; }
    let vivo = true;
    setError(false);
    api.get(`/flujos/${flujoId}/metricas`)
      .then((r) => { if (vivo) setM(r.data); })
      .catch(() => { if (vivo) setError(true); });
    return () => { vivo = false; };
  }, [flujoId]);

  const nombrePaso = (id) => {
    const n = nodos.find((x) => x.id === id);
    return n ? `${TIPOS[n.tipo]?.etiqueta || 'Paso'}: ${(TIPOS[n.tipo]?.resumen(n.config) || '').slice(0, 40)}` : 'Un paso que ya no existe';
  };

  const dato = (valor, etiqueta) => (
    <div className="rounded-xl bg-bg2 p-3 text-center">
      <p className="text-xl font-bold text-text">{valor}</p>
      <p className="text-xs text-muted">{etiqueta}</p>
    </div>
  );

  return (
    <section className="rounded-2xl border border-[#C9C9C9] bg-white p-4" aria-label="Resultados del flujo">
      <h2 className="font-head text-lg text-text flex items-center gap-2 mb-2"><BarChart3 className="w-4 h-4 text-accent" /> Resultados (30 días)</h2>
      {!flujoId && <p className="text-xs text-muted">Guarda el flujo y enciéndelo para ver aquí cuántos clientes lo usan.</p>}
      {error && <p className="text-xs text-muted">No se pudieron cargar los resultados.</p>}
      {m && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {dato(m.entraron, 'Entraron')}{dato(m.terminaron, 'Terminaron')}{dato(m.en_curso, 'En curso')}{dato(m.abandonaron, 'Se quedaron')}
          </div>
          {m.entraron === 0 && <p className="text-xs text-muted mt-2">Aún nadie ha entrado a este flujo.</p>}
          {m.abandonos.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-text mb-1">Dónde se quedan los clientes</p>
              <ul className="text-xs text-muted space-y-1">
                {m.abandonos.map((a) => <li key={a.nodo}>{a.total} en «{nombrePaso(a.nodo)}»</li>)}
              </ul>
            </div>
          )}
          {m.con_error > 0 && <p className="text-xs text-danger mt-2">{m.con_error} ejecuciones se cortaron por error: revisa que no haya pasos repetidos sin pausa.</p>}
        </>
      )}
    </section>
  );
}
