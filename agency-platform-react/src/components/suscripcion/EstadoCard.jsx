import { ArrowRight, RefreshCw, Undo2 } from 'lucide-react';
import { Character } from '../Illustration';
import { formatDate, formatPrice, pluralDias } from './format';

const CHIP = {
  trial: 'bg-warn/15 text-warn-text',
  activa: 'bg-success/10 text-success',
  cancelada: 'bg-warn/15 text-warn-text',
  vencida: 'bg-danger/10 text-danger-text',
  inactiva: 'bg-bg3 text-muted',
};
const ETIQUETA = {
  trial: 'Prueba gratis',
  activa: 'Activa',
  cancelada: 'Cancelada',
  vencida: 'Vencida',
  inactiva: 'Sin activar',
};

const BTN_PRIMARIO =
  'h-11 px-5 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

// Un solo lugar dice en qué estado está la cuenta y cuál es LA acción que toca.
export default function EstadoCard({ sub, onElegirPlan, onReactivar, onCancelar, onDeshacerCambio, ocupado }) {
  const { estado } = sub;
  const fechaFin = formatDate(sub.acceso_hasta);

  let titulo;
  let detalle;
  let accion = null;

  if (estado === 'trial') {
    titulo = `Te quedan ${pluralDias(sub.dias_trial_restantes)} de prueba`;
    detalle = 'No se te cobra nada durante la prueba. Cuando elijas un plan, empieza tu primer ciclo.';
    accion = <button onClick={onElegirPlan} className={BTN_PRIMARIO}>Elegir plan <ArrowRight size={16} /></button>;
  } else if (estado === 'activa') {
    titulo = sub.proximo_pago
      ? (sub.modo_pagos === 'efipay' ? `Tu plan está pagado hasta el ${formatDate(sub.proximo_pago)}` : `Se renueva el ${formatDate(sub.proximo_pago)}`)
      : 'Cuenta activa sin cobro recurrente';
    detalle = sub.proximo_pago
      ? (sub.modo_pagos === 'efipay'
        ? `${formatPrice(sub.plan_precio)} al mes · ${pluralDias(sub.dias_restantes)} para que venza. Renuévalo cuando quieras: no hay cobros automáticos.`
        : `${formatPrice(sub.plan_precio)} al mes · ${pluralDias(sub.dias_restantes)} para la renovación.`)
      : 'Tu plan no tiene fecha de renovación.';
  } else if (estado === 'cancelada') {
    titulo = `Conservas el acceso hasta el ${fechaFin}`;
    detalle = `Cancelaste la renovación: no se te volverá a cobrar. Te quedan ${pluralDias(sub.dias_restantes)} con tu plan.`;
    accion = (
      <button onClick={onReactivar} disabled={ocupado} className={BTN_PRIMARIO}>
        <RefreshCw size={16} /> Reactivar suscripción
      </button>
    );
  } else {
    titulo = estado === 'vencida' ? 'Tu período terminó' : 'Aún no has activado un plan';
    detalle = 'Elige un plan para seguir usando el bot, tus pedidos y tus domicilios.';
    accion = <button onClick={onElegirPlan} className={BTN_PRIMARIO}>Elegir plan <ArrowRight size={16} /></button>;
  }

  return (
    <section className="bg-white rounded-2xl border border-border p-6 flex flex-col md:flex-row gap-6 items-start" aria-labelledby="estado-titulo">
      <div className="hidden md:block shrink-0 self-end -mb-6">
        <Character name={estado === 'vencida' || estado === 'inactiva' ? 'nova' : 'sofia'} height={132} alt="" />
      </div>

      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-xs font-semibold tracking-[0.04em] text-muted uppercase">Tu plan</span>
          <span className="font-head text-lg font-bold text-text">{sub.plan_nombre}</span>
          <span className={`h-7 px-3 rounded-full text-xs font-semibold inline-flex items-center ${CHIP[estado]}`}>
            {ETIQUETA[estado]}
          </span>
        </div>

        <h2 id="estado-titulo" className="font-head text-2xl font-bold text-text">{titulo}</h2>
        <p className="text-muted text-sm mt-1 max-w-xl">{detalle}</p>

        {sub.plan_pendiente && (
          <div className="mt-4 flex items-center gap-3 flex-wrap rounded-xl bg-bg2 border border-border px-4 py-3 text-sm">
            <span className="text-text">
              Pasarás a <strong>{sub.plan_pendiente.nombre}</strong> ({formatPrice(sub.plan_pendiente.precio)}/mes) el {fechaFin}.
            </span>
            <button
              onClick={onDeshacerCambio}
              disabled={ocupado}
              className="inline-flex items-center gap-1 font-semibold text-accent hover:text-accent2 transition-colors"
            >
              <Undo2 size={14} /> Deshacer
            </button>
          </div>
        )}

        <div className="mt-5 flex items-center gap-4 flex-wrap">
          {accion}
          {sub.puede_cancelar && (
            <button onClick={onCancelar} className="text-sm text-muted hover:text-danger-text underline underline-offset-2 transition-colors">
              Cancelar suscripción
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
