import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';

// Tarjeta de pedido para celular: se desliza a la derecha para pasar al siguiente estado
// (la misma acción del botón del detalle) y se toca para abrir el detalle.
// siguiente = { estado, label } o null si el pedido ya no avanza.
const UMBRAL = 90;

export default function PedidoSwipeCard({ pedido, siguiente, badge, total, fecha, onAbrir, onAvanzar }) {
  const x = useMotionValue(0);
  const reducir = useReducedMotion();
  const [enviando, setEnviando] = useState(false);
  const fondo = useTransform(x, [0, UMBRAL], ['rgba(46,125,50,0)', 'rgba(46,125,50,0.18)']);

  const soltar = async (_, info) => {
    if (!siguiente || enviando || info.offset.x < UMBRAL) return;
    setEnviando(true);
    try { await onAvanzar(pedido, siguiente.estado); } finally { setEnviando(false); }
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border bg-bg">
      {siguiente && (
        <motion.div style={{ background: fondo }} className="absolute inset-0 flex items-center pl-5 gap-2 text-success text-sm font-semibold" aria-hidden="true">
          <Check size={18} /> {siguiente.label}
        </motion.div>
      )}
      <motion.div
        style={{ x }}
        drag={siguiente && !reducir ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.45 }}
        onDragEnd={soltar}
        className="relative bg-bg p-4 touch-pan-y"
      >
        <button onClick={() => onAbrir(pedido)} className="w-full text-left bg-transparent border-none p-0 cursor-pointer text-text">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted">#{pedido.numero_pedido || pedido.id} · {fecha}</p>
              <p className="font-semibold text-sm truncate">{pedido.cliente_nombre || 'Sin nombre'}</p>
            </div>
            <p className="font-mono font-bold text-sm shrink-0">{total}</p>
          </div>
          <div className="flex items-center justify-between mt-3">
            {badge}
            {siguiente && <span className="text-[11px] text-muted inline-flex items-center gap-1">{enviando ? 'Guardando…' : <>Desliza <ArrowRight size={12} /></>}</span>}
          </div>
        </button>
        {siguiente && (
          <button
            onClick={() => !enviando && onAvanzar(pedido, siguiente.estado)}
            className="mt-3 w-full h-11 rounded-xl bg-accent-dim text-accent text-sm font-semibold border-none cursor-pointer"
          >
            {siguiente.label}
          </button>
        )}
      </motion.div>
    </div>
  );
}
