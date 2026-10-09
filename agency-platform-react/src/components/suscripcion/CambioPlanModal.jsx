import { Check, Loader2, Minus, AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import { formatDate, formatLimite, formatPrice } from './format';

const BTN_PRIMARIO =
  'h-11 px-5 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
const BTN_SECUNDARIO =
  'h-11 px-5 rounded-xl bg-white hover:bg-bg2 text-text text-sm font-semibold border border-[#C9C9C9] transition-colors';

function Resumen({ info, modo }) {
  const destino = info.plan_destino;

  if (info.tipo === 'downgrade') {
    return info.efectivo === 'fin_de_ciclo' ? (
      <p className="text-sm text-text">
        Sigues con <strong>{info.plan_actual.nombre}</strong> hasta el <strong>{formatDate(info.efectivo_el)}</strong>. Después
        pasas a <strong>{destino.nombre}</strong> por {formatPrice(destino.precio)} al mes. No se cobra nada ahora y puedes deshacerlo antes de esa fecha.
      </p>
    ) : (
      <p className="text-sm text-text">
        Tu plan pasará a <strong>{destino.nombre}</strong> ({formatPrice(destino.precio)} al mes) desde ya. Como no hay un ciclo pagado, no hay nada que esperar.
      </p>
    );
  }

  const nota =
    modo === 'efipay' ? 'Te llevaremos a Efipay para completar el pago de forma segura.'
      : modo === 'stripe' ? 'Te llevaremos a Stripe para completar el pago con tarjeta.'
      : modo === 'emulado' ? 'Es un pago de prueba (entorno de desarrollo): no se cobra dinero real.'
      : null;

  return (
    <div className="text-sm text-text space-y-2">
      <p>
        Se cobra <strong>{formatPrice(destino.precio)}</strong> hoy y luego cada mes. Tu ciclo de facturación
        {info.reinicia_ciclo ? ' se reinicia hoy con este pago.' : ' empieza hoy.'}
      </p>
      {nota && <p className="text-muted">{nota}</p>}
    </div>
  );
}

function Lista({ titulo, items, icono, color }) {
  if (!items.length) return null;
  const Icono = icono;
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.04em] text-muted uppercase mb-2">{titulo}</p>
      <ul className="space-y-1.5">
        {items.map((t) => (
          <li key={t} className="flex items-start gap-2 text-sm text-text">
            <Icono size={16} className={`${color} mt-0.5 shrink-0`} aria-hidden="true" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TITULO = { activar: 'Elegir plan', upgrade: 'Mejorar tu plan', downgrade: 'Cambiar a un plan menor' };

export default function CambioPlanModal({ info, cargando, error, modo, enviando, onConfirm, onClose }) {
  const titulo = info ? TITULO[info.tipo] || 'Cambiar de plan' : 'Cambiar de plan';
  const sinPagos = info && info.tipo !== 'downgrade' && modo === 'no_disponible';
  const hayBloqueo = !!(info && (info.bloqueos?.length || info.motivo_bloqueo));
  const deshabilitado = enviando || cargando || !info || hayBloqueo || sinPagos || info.tipo === 'mismo';

  const limitesQueBajan = (info?.limites || []).filter((l) => l.nuevo !== -1 && (l.actual === -1 || l.nuevo < l.actual));

  return (
    <Modal titulo={titulo} onClose={onClose}>
      {cargando && (
        <div className="py-10 flex justify-center text-muted" role="status" aria-label="Cargando">
          <Loader2 className="animate-spin" />
        </div>
      )}

      {error && !cargando && (
        <p className="text-sm text-danger-text" role="alert">{error}</p>
      )}

      {info && !cargando && (
        <div className="space-y-5">
          <div className="rounded-xl bg-bg2 border border-border px-4 py-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">{info.plan_actual.nombre}</span>
            <span aria-hidden="true">→</span>
            <span className="font-semibold text-text">{info.plan_destino.nombre} · {formatPrice(info.plan_destino.precio)}/mes</span>
          </div>

          <Resumen info={info} modo={modo} />

          {(info.bloqueos?.length > 0 || info.motivo_bloqueo || sinPagos) && (
            <div className="flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3" role="alert">
              <AlertTriangle size={18} className="text-danger-text mt-0.5 shrink-0" aria-hidden="true" />
              <div className="text-sm text-danger-text space-y-1">
                {info.bloqueos?.map((b) => <p key={b}>{b}</p>)}
                {info.motivo_bloqueo && <p>{info.motivo_bloqueo}</p>}
                {sinPagos && <p>Los pagos no están disponibles ahora mismo. Escríbenos y activamos tu plan.</p>}
              </div>
            </div>
          )}

          <Lista titulo="Ganas" items={info.ganas} icono={Check} color="text-success" />
          <Lista titulo="Dejas de tener" items={info.pierdes} icono={Minus} color="text-danger-text" />

          {limitesQueBajan.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-[0.04em] text-muted uppercase mb-2">Límites que bajan</p>
              <ul className="space-y-1 text-sm text-text">
                {limitesQueBajan.map((l) => (
                  <li key={l.key} className="flex justify-between gap-3">
                    <span className="text-muted">{l.label}</span>
                    <span className="font-semibold">{formatLimite(l.actual)} → {formatLimite(l.nuevo)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex gap-3 justify-end flex-wrap">
        <button type="button" onClick={onClose} className={BTN_SECUNDARIO}>Volver</button>
        <button type="button" onClick={onConfirm} disabled={deshabilitado} data-autofocus className={BTN_PRIMARIO}>
          {enviando && <Loader2 size={16} className="animate-spin" />}
          {info?.tipo === 'downgrade' ? 'Confirmar cambio' : info?.se_cobra_ahora ? `Pagar ${formatPrice(info.plan_destino.precio)}` : 'Confirmar'}
        </button>
      </div>
    </Modal>
  );
}
