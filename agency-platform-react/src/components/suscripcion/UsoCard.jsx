import { formatLimite } from './format';

function Medidor({ etiqueta, ayuda, usado, limite }) {
  const ilimitado = limite === -1;
  const pct = ilimitado || !limite ? 0 : Math.min(100, Math.round((usado / limite) * 100));
  const alto = pct >= 80;
  const lleno = pct >= 100;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-semibold text-text">{etiqueta}</p>
          <p className="text-xs text-muted">{ayuda}</p>
        </div>
        <p className={`font-mono text-sm shrink-0 ${alto ? 'text-danger-text font-semibold' : 'text-text'}`}>
          {ilimitado ? `${usado} · sin tope` : `${usado} de ${formatLimite(limite)}`}
        </p>
      </div>
      {!ilimitado && (
        <div
          className="h-2 rounded-full bg-bg3 overflow-hidden"
          role="progressbar"
          aria-label={etiqueta}
          aria-valuemin={0}
          aria-valuemax={limite}
          aria-valuenow={Math.min(usado, limite)}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${alto ? 'bg-danger' : 'bg-accent'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {lleno && <p className="text-xs text-danger-text mt-1">Llegaste al límite de tu plan.</p>}
    </div>
  );
}

export default function UsoCard({ uso }) {
  if (!uso) return null;
  return (
    <section className="bg-white rounded-2xl border border-border p-6" aria-labelledby="uso-titulo">
      <div className="flex items-baseline justify-between mb-5 gap-3 flex-wrap">
        <h2 id="uso-titulo" className="font-head text-lg font-bold text-text">Uso de tu plan</h2>
        <span className="text-xs text-muted">Período {uso.periodo}</span>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Medidor etiqueta="Mensajes de IA" ayuda="Este mes" usado={uso.uso.mensajes_usados} limite={uso.limites.mensajes.limit} />
        <Medidor etiqueta="Clientes nuevos" ayuda="Este mes" usado={uso.uso.clientes_nuevos} limite={uso.limites.clientes.limit} />
        <Medidor etiqueta="Productos" ayuda="En tu catálogo" usado={uso.uso.productos_creados} limite={uso.limites.productos.limit} />
      </div>
    </section>
  );
}
