import { useState } from 'react';
import { Receipt, History } from 'lucide-react';
import { formatDate, formatPrice } from './format';

const ESTADO_FACTURA = {
  pagada: { texto: 'Pagada', clase: 'bg-success/10 text-success' },
  pendiente: { texto: 'Pendiente', clase: 'bg-warn/15 text-warn-text' },
  vencida: { texto: 'Vencida', clase: 'bg-danger/10 text-danger-text' },
  cancelada: { texto: 'Cancelada', clase: 'bg-bg3 text-muted' },
};

const TIPO_CAMBIO = {
  upgrade: 'Mejora de plan',
  downgrade: 'Cambio a plan menor',
  renewal: 'Renovación',
  trial_start: 'Inicio de la prueba',
  trial_end: 'Fin de la prueba',
  payment_success: 'Pago recibido',
  payment_failed: 'Pago fallido',
  cancellation: 'Cancelación',
  reactivation: 'Reactivación',
};

function Vacio({ children }) {
  return <p className="text-sm text-muted text-center py-8">{children}</p>;
}

function Facturas({ facturas }) {
  if (!facturas.length) return <Vacio>Aún no tienes facturas. Aparecerán aquí cuando hagas tu primer pago.</Vacio>;
  return (
    <ul className="divide-y divide-border">
      {facturas.map((f) => {
        const estado = ESTADO_FACTURA[f.estado] || ESTADO_FACTURA.pendiente;
        return (
          <li key={f.id} className="py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text truncate">{f.descripcion || `Plan ${f.plan}`}</p>
              <p className="text-xs text-muted">
                {f.numero} · {formatDate(f.fecha_pago || f.fecha_emision || f.created_at)}
                {f.metodo_pago === 'emulado' && ' · pago de prueba'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-text">{formatPrice(Number(f.monto))}</span>
              <span className={`h-6 px-2.5 rounded-full text-xs font-semibold inline-flex items-center ${estado.clase}`}>{estado.texto}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Cambios({ historial }) {
  if (!historial.length) return <Vacio>Todavía no hay movimientos en tu suscripción.</Vacio>;
  return (
    <ul className="divide-y divide-border">
      {historial.map((h) => (
        <li key={h.id} className="py-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text">{TIPO_CAMBIO[h.tipo] || h.tipo}</p>
            {h.descripcion && <p className="text-xs text-muted">{h.descripcion}</p>}
          </div>
          <span className="text-xs text-muted shrink-0">{formatDate(h.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function HistorialCard({ facturas, historial }) {
  const [tab, setTab] = useState('facturas');
  const tabs = [
    { id: 'facturas', texto: 'Facturas', icono: Receipt, n: facturas.length },
    { id: 'cambios', texto: 'Movimientos', icono: History, n: historial.length },
  ];

  return (
    <section className="bg-white rounded-2xl border border-border p-6" aria-label="Facturas y movimientos">
      <div className="flex gap-2 mb-4" role="tablist">
        {tabs.map(({ id, texto, icono, n }) => {
          const Icono = icono;
          return (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`h-8 px-3 rounded-full text-xs font-semibold inline-flex items-center gap-2 transition-colors ${
              tab === id ? 'bg-primary-soft text-accent' : 'bg-bg3 text-muted hover:text-text'
            }`}
          >
            <Icono size={14} aria-hidden="true" /> {texto}
            {n > 0 && <span className="opacity-70">{n}</span>}
          </button>
          );
        })}
      </div>
      <div role="tabpanel">
        {tab === 'facturas' ? <Facturas facturas={facturas} /> : <Cambios historial={historial} />}
      </div>
    </section>
  );
}
