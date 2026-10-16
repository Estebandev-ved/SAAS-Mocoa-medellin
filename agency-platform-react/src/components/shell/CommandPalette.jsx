import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CornerDownLeft, Lock } from 'lucide-react';

// Paleta de comandos (Ctrl/⌘ + K): saltar a cualquier pantalla escribiendo unas letras.
const normalizar = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function CommandPalette({ abierto, onCerrar, items, onIr, accionesExtra = [] }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);

  const todos = useMemo(() => [...items, ...accionesExtra], [items, accionesExtra]);
  const lista = useMemo(() => {
    const n = normalizar(q.trim());
    return n ? todos.filter((i) => normalizar(i.label).includes(n) || normalizar(i.grupo || '').includes(n)) : todos;
  }, [q, todos]);

  useEffect(() => {
    if (abierto) setTimeout(() => inputRef.current?.focus(), 30);
  }, [abierto]);

  const ejecutar = (item) => {
    if (!item || item.bloqueado) return;
    onCerrar();
    setQ('');
    setSel(0);
    if (item.accion) item.accion();
    else onIr(item.path);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, lista.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); ejecutar(lista[sel]); }
    else if (e.key === 'Escape') onCerrar();
  };

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4"
          onClick={onCerrar}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Buscar pantalla"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-bg border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
              <Search size={18} className="text-muted shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setSel(0); }}
                onKeyDown={onKey}
                placeholder="¿A dónde quieres ir? Pedidos, cupones, ajustes…"
                className="flex-1 bg-transparent border-none outline-none text-text text-sm placeholder:text-muted"
                aria-label="Buscar pantalla"
              />
              <kbd className="hidden sm:inline text-[10px] font-mono text-muted border border-border rounded px-1.5 py-0.5">Esc</kbd>
            </div>
            <ul className="max-h-[50vh] overflow-auto p-2 m-0 list-none">
              {lista.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">No encontré nada con “{q}”.</li>}
              {lista.map((item, i) => {
                const Icon = item.icon;
                return (
                  <li key={item.path || item.label}>
                    <button
                      onClick={() => ejecutar(item)}
                      onMouseEnter={() => setSel(i)}
                      disabled={item.bloqueado}
                      className={`w-full flex items-center gap-3 px-3 h-11 rounded-xl text-sm border-none text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        i === sel ? 'bg-accent-dim text-accent' : 'bg-transparent text-text'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="font-medium">{item.label}</span>
                      {item.grupo && <span className="text-xs text-muted">{item.grupo}</span>}
                      {item.bloqueado ? <Lock size={14} className="ml-auto text-muted" /> : i === sel && <CornerDownLeft size={14} className="ml-auto" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
