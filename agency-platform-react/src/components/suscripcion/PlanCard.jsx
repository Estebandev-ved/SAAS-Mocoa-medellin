import { Check, Star } from 'lucide-react';
import { formatLimite, formatPrice } from './format';

// relacion: 'actual' | 'sube' | 'baja' | 'elegir' (prueba, vencida o sin activar: cualquier plan se paga completo)
const TEXTO_BOTON = {
  sube: (n) => `Mejorar a ${n}`,
  baja: (n) => `Cambiar a ${n}`,
  elegir: (n) => `Elegir ${n}`,
};

export default function PlanCard({ plan, relacion, onSelect, bloqueado }) {
  const actual = relacion === 'actual';
  const primario = !actual && (relacion === 'sube' || relacion === 'elegir') && plan.popular;

  return (
    <article
      className={`relative bg-white rounded-2xl p-6 flex flex-col border ${
        actual ? 'border-accent border-2' : plan.popular ? 'border-[#C9C9C9]' : 'border-border'
      }`}
      aria-label={`Plan ${plan.nombre}`}
    >
      {plan.popular && (
        <span className="absolute -top-3 left-6 h-6 px-3 rounded-full bg-accent text-white text-xs font-semibold inline-flex items-center gap-1">
          <Star size={12} aria-hidden="true" /> Más elegido
        </span>
      )}

      <h3 className="font-head text-xl font-bold text-text">{plan.nombre}</h3>
      <p className="mt-3">
        <span className="font-head text-3xl font-bold text-text">{formatPrice(plan.precio)}</span>
        <span className="text-muted text-sm"> /mes</span>
      </p>

      <ul className="mt-5 space-y-2 text-sm text-text">
        {plan.limites.map((l) => (
          <li key={l.key} className="flex justify-between gap-3">
            <span className="text-muted">{l.label}</span>
            <span className="font-semibold text-right">{formatLimite(l.valor)}</span>
          </li>
        ))}
      </ul>

      <div className="my-5 border-t border-border" />

      {plan.incluye_todo_de && (
        <p className="text-xs font-semibold tracking-[0.04em] text-muted uppercase mb-3">
          Todo lo de {plan.incluye_todo_de}, más:
        </p>
      )}
      <ul className="space-y-2 flex-1">
        {plan.caracteristicas.map((c) => (
          <li key={c} className="flex items-start gap-2 text-sm text-text">
            <Check size={16} className="text-success mt-0.5 shrink-0" aria-hidden="true" />
            <span>{c}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {actual ? (
          <span className="h-11 rounded-xl bg-primary-soft text-accent text-sm font-semibold inline-flex items-center justify-center w-full">
            Tu plan actual
          </span>
        ) : (
          <button
            onClick={() => onSelect(plan.id)}
            disabled={bloqueado}
            className={`w-full h-11 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              primario
                ? 'bg-accent hover:bg-accent2 text-white'
                : 'bg-white hover:bg-bg2 text-text border border-[#C9C9C9]'
            }`}
          >
            {TEXTO_BOTON[relacion](plan.nombre)}
          </button>
        )}
      </div>
    </article>
  );
}
