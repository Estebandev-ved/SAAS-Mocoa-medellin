import { Check, Loader2, Lock, AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Illustration, { Character } from '../Illustration';
import { formatPrice } from './format';

const BTN_PRIMARIO =
  'h-12 px-6 rounded-xl bg-accent hover:bg-accent2 text-white text-base font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
const BTN_SECUNDARIO =
  'h-12 px-5 rounded-xl bg-white hover:bg-bg2 text-text text-sm font-semibold border border-[#C9C9C9] transition-colors';

// Lo que de verdad pasa con el dinero depende de la pasarela. Efipay es un pago único por 30 días
// (no hay cobro automático), Stripe sí renueva solo: el texto no puede prometer lo que no ocurre.
function NotaDePago({ modo, reiniciaCiclo }) {
  if (modo === 'efipay') {
    return (
      <ul className="space-y-2 text-sm text-text">
        <li className="flex gap-2"><Lock size={16} className="text-success mt-0.5 shrink-0" aria-hidden="true" />
          <span>Pagas en la página segura de <strong>Efipay</strong>. Nosotros nunca vemos los datos de tu tarjeta ni de tu cuenta.</span>
        </li>
        <li className="flex gap-2"><Check size={16} className="text-success mt-0.5 shrink-0" aria-hidden="true" />
          <span>Es un pago por <strong>1 mes</strong>. No hay cobros automáticos: renuevas cuando tú quieras.</span>
        </li>
        <li className="flex gap-2"><Check size={16} className="text-success mt-0.5 shrink-0" aria-hidden="true" />
          <span>{reiniciaCiclo ? 'Tu mes se cuenta desde hoy con este pago.' : 'Tu plan se activa en cuanto Efipay confirma el pago.'}</span>
        </li>
      </ul>
    );
  }
  if (modo === 'stripe') {
    return (
      <p className="text-sm text-text flex gap-2">
        <Lock size={16} className="text-success mt-0.5 shrink-0" aria-hidden="true" />
        <span>Te llevamos a Stripe para pagar con tarjeta. Se cobra hoy y luego cada mes hasta que canceles.</span>
      </p>
    );
  }
  if (modo === 'emulado') {
    return <p className="text-sm text-muted">Es un pago de prueba (entorno de desarrollo): no se cobra dinero real.</p>;
  }
  return null;
}

export default function CheckoutModal({ info, cargando, error, modo, enviando, onConfirm, onClose }) {
  const destino = info?.plan_destino;
  const sinPagos = info && modo === 'no_disponible';
  const hayBloqueo = !!(info && (info.bloqueos?.length || info.motivo_bloqueo));
  const deshabilitado = enviando || cargando || !info || hayBloqueo || sinPagos || info.tipo === 'mismo';
  const pasarela = modo === 'efipay' ? 'Efipay' : modo === 'stripe' ? 'Stripe' : null;

  return (
    <Modal titulo="Activar tu plan" onClose={enviando ? () => {} : onClose} ancho="max-w-xl">
      {/* Preparando el pago: Nova trabaja mientras se crea la sesión y se redirige. */}
      {enviando && (
        <div className="py-8 flex flex-col items-center text-center" role="status" aria-live="polite">
          <Illustration name="carga" size={112} alt="" />
          <p className="font-head text-lg font-bold text-text mt-5">Preparando tu pago seguro…</p>
          <p className="text-sm text-muted mt-1 max-w-xs">
            {pasarela ? `En un momento te llevamos a ${pasarela} para que pagues.` : 'Un momento, estamos activando tu plan.'} No cierres esta ventana.
          </p>
        </div>
      )}

      {!enviando && (
        <>
          {cargando && (
            <div className="py-10 flex justify-center text-muted" role="status" aria-label="Cargando">
              <Loader2 className="animate-spin" />
            </div>
          )}

          {info && !cargando && (
            <div className="space-y-5">
              {/* Sofía recibe al dueño: es quien le "vende", así que también lo acompaña a pagar. */}
              <div className="relative flex items-end gap-3 rounded-2xl bg-[#FDECEA] pl-2 pr-4 pt-3 overflow-hidden">
                <div className="noma-cheer shrink-0 -mb-1">
                  <Character name="sofia" height={104} alt="Sofía, de ventas" />
                </div>
                <div className="py-4 min-w-0">
                  <p className="font-head text-lg font-bold text-text leading-6">
                    ¡Estás a un paso de activar {destino.nombre}!
                  </p>
                  <p className="text-sm text-muted mt-0.5">Revisa tu pedido y listo: tu bot sigue vendiendo por ti.</p>
                </div>
              </div>

              {/* Resumen del pedido */}
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.04em] text-muted uppercase">Tu pedido</p>
                    <p className="font-head text-base font-bold text-text">Plan {destino.nombre}</p>
                    <p className="text-sm text-muted">{modo === 'efipay' ? '1 mes de servicio' : 'Suscripción mensual'}</p>
                  </div>
                  <p className="font-mono text-lg font-bold text-text">{formatPrice(destino.precio)}</p>
                </div>
                <div className="px-4 py-3 bg-bg2 border-t border-border flex items-center justify-between">
                  <span className="text-sm font-semibold text-text">Total a pagar hoy</span>
                  <span className="font-mono text-xl font-bold text-accent">{formatPrice(destino.precio)}</span>
                </div>
              </div>

              {info.ganas?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold tracking-[0.04em] text-muted uppercase mb-2">Con este plan ganas</p>
                  <ul className="space-y-1.5">
                    {info.ganas.slice(0, 5).map((t) => (
                      <li key={t} className="flex items-start gap-2 text-sm text-text">
                        <Check size={16} className="text-success mt-0.5 shrink-0" aria-hidden="true" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <NotaDePago modo={modo} reiniciaCiclo={info.reinicia_ciclo} />

              {(hayBloqueo || sinPagos) && (
                <div className="flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3" role="alert">
                  <AlertTriangle size={18} className="text-danger-text mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="text-sm text-danger-text space-y-1">
                    {info.bloqueos?.map((b) => <p key={b}>{b}</p>)}
                    {info.motivo_bloqueo && <p>{info.motivo_bloqueo}</p>}
                    {sinPagos && <p>Los pagos no están disponibles ahora mismo. Escríbenos y activamos tu plan.</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error: Nova se disculpa y deja una salida clara (reintentar o escribirnos). */}
          {error && !cargando && (
            <div className="mt-5 flex items-center gap-4 rounded-2xl border border-danger/40 bg-danger/5 p-4" role="alert">
              <div className="shrink-0 rounded-xl bg-[#FDECEA] p-1.5">
                <Illustration name="error" size={64} framed={false} alt="Nova se disculpa" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-danger-text">No pudimos iniciar tu pago</p>
                <p className="text-sm text-text mt-0.5">{error}</p>
                <p className="text-xs text-muted mt-1">No se te cobró nada. Puedes intentarlo otra vez.</p>
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-3 justify-end flex-wrap">
            <button type="button" onClick={onClose} className={BTN_SECUNDARIO}>Volver</button>
            <button type="button" onClick={onConfirm} disabled={deshabilitado} data-autofocus className={BTN_PRIMARIO}>
              <Lock size={16} aria-hidden="true" />
              {error ? 'Reintentar el pago' : info ? `Pagar ${formatPrice(destino.precio)}${pasarela ? ` con ${pasarela}` : ''}` : 'Pagar'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
