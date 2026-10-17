import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, GripVertical } from 'lucide-react';
import { SIGUIENTE_ESTADO, ETIQUETA_RAPIDA } from '../hooks/useAvanzarPedido';

const COLUMNAS = [
  { estado: 'pendiente_pago', titulo: 'Por pagar', color: 'bg-warn' },
  { estado: 'pago_enviado', titulo: 'Comprobante', color: 'bg-info' },
  { estado: 'pago_confirmado', titulo: 'Por preparar', color: 'bg-accent' },
  { estado: 'en_preparacion', titulo: 'Preparando', color: 'bg-warn' },
  { estado: 'enviado', titulo: 'En camino', color: 'bg-info' },
  { estado: 'entregado', titulo: 'Entregado', color: 'bg-success' },
];

// Tablero por estados. En computador se arrastra la tarjeta a la columna siguiente; en celular
// (donde arrastrar entre columnas es incómodo) cada tarjeta trae su botón de avanzar. El servidor
// solo permite el paso siguiente, así que soltar en otra columna avisa en vez de intentarlo.
export default function PedidosKanban({ pedidos, onAvanzar, onAbrir, onNoPermitido, formatCurrency }) {
  const [arrastrando, setArrastrando] = useState(null);
  const [sobre, setSobre] = useState(null);

  const soltar = (estadoDestino) => {
    const p = pedidos.find((x) => x.id === arrastrando);
    setArrastrando(null);
    setSobre(null);
    if (!p || p.estado === estadoDestino) return;
    if (SIGUIENTE_ESTADO[p.estado]?.estado === estadoDestino) onAvanzar(p, estadoDestino);
    else onNoPermitido?.(p, estadoDestino);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 -mx-6 px-6 lg:mx-0 lg:px-0 snap-x" role="list" aria-label="Tablero de pedidos">
      {COLUMNAS.map((col) => {
        const items = pedidos.filter((p) => p.estado === col.estado);
        const destinoValido = arrastrando && SIGUIENTE_ESTADO[pedidos.find((x) => x.id === arrastrando)?.estado]?.estado === col.estado;
        return (
          <section
            key={col.estado}
            role="listitem"
            aria-label={col.titulo}
            onDragOver={(e) => { e.preventDefault(); setSobre(col.estado); }}
            onDragLeave={() => setSobre((s) => (s === col.estado ? null : s))}
            onDrop={(e) => { e.preventDefault(); soltar(col.estado); }}
            className={`snap-start shrink-0 w-[260px] lg:flex-1 lg:min-w-[190px] lg:shrink rounded-2xl border p-2.5 transition-colors ${
              sobre === col.estado ? (destinoValido ? 'bg-success/10 border-success' : 'bg-danger/10 border-danger/50') : 'bg-bg2 border-border'
            }`}
          >
            <h3 className="flex items-center gap-2 text-xs font-semibold tracking-[0.04em] uppercase text-muted px-1.5 mb-2.5 m-0">
              <span className={`w-2 h-2 rounded-full ${col.color}`} />
              {col.titulo}
              <span className="ml-auto font-mono text-text">{items.length}</span>
            </h3>
            <div className="space-y-2 min-h-[60px]">
              {items.map((p) => {
                const sig = SIGUIENTE_ESTADO[p.estado];
                return (
                  <motion.article
                    layout
                    key={p.id}
                    draggable={!!sig}
                    onDragStart={() => setArrastrando(p.id)}
                    onDragEnd={() => { setArrastrando(null); setSobre(null); }}
                    onClick={() => onAbrir(p)}
                    className={`bg-white border border-border rounded-xl p-3 ${sig ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${arrastrando === p.id ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold">#{p.numero_pedido || p.id}</span>
                      <span className="font-mono text-sm text-accent font-bold">{formatCurrency(p.total)}</span>
                    </div>
                    <p className="text-sm text-text truncate m-0 mt-0.5">{p.cliente_nombre || 'Sin nombre'}</p>
                    {sig && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onAvanzar(p, sig.estado); }}
                        className="mt-2 w-full h-10 rounded-lg bg-accent-dim hover:bg-accent hover:text-white text-accent text-xs font-semibold border-none cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Zap size={13} /> {ETIQUETA_RAPIDA[p.estado]}
                        <GripVertical size={13} className="hidden lg:block opacity-40" />
                      </button>
                    )}
                  </motion.article>
                );
              })}
              {items.length === 0 && <p className="text-xs text-muted text-center py-4 m-0">Sin pedidos</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
