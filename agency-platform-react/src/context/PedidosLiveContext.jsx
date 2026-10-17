import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, ArrowRight, Volume2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import { Character } from '../components/Illustration';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3002';

const PedidosLiveContext = createContext({ conectado: false, eventos: 0, pendientes: 0, alertaSuscripcion: null, suscribir: () => () => {}, refrescarPendientes: () => {} });
export const usePedidosLive = () => useContext(PedidosLiveContext);

// Sonidos generados con Web Audio (sin archivos de audio que mantener). Cada tipo de
// evento suena distinto para que el dueño sepa qué pasó sin mirar la pantalla:
//  - pago: dos notas ascendentes (hay dinero, prepara el pedido)
//  - pedido: una nota media (nuevo pedido, aún sin pagar)
//  - mensaje: golpecito suave
//  - alerta: tres notas graves (cliente pide asesor / algo requiere atención)
const SONIDOS = {
  pago: { notas: [880, 1174.66], paso: 0.14, vol: 0.22, vibra: [180, 80, 180] },
  pedido: { notas: [660], paso: 0.14, vol: 0.14, vibra: [120] },
  mensaje: { notas: [988], paso: 0.1, vol: 0.08, vibra: [60] },
  alerta: { notas: [523.25, 440, 523.25], paso: 0.16, vol: 0.2, vibra: [250, 100, 250, 100, 250] },
};

const CLAVE_SONIDO = 'noma_sonido_activo';
export const sonidoActivo = () => {
  try { return localStorage.getItem(CLAVE_SONIDO) !== '0'; } catch { return true; }
};
export const guardarSonidoActivo = (v) => {
  try { localStorage.setItem(CLAVE_SONIDO, v ? '1' : '0'); } catch { /* sin almacenamiento */ }
};

export function reproducirAviso(tipo = 'pago') {
  if (!sonidoActivo()) return;
  const cfg = SONIDOS[tipo] || SONIDOS.pago;
  try {
    if (navigator.vibrate) navigator.vibrate(cfg.vibra);
  } catch { /* vibración no disponible */ }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    cfg.notas.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * cfg.paso;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(cfg.vol, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* el navegador puede bloquear audio sin interacción previa: no rompe nada */
  }
}

// Insignia en el ícono de la app instalada (pedidos que esperan acción del dueño).
function ponerInsignia(n) {
  try {
    if (n > 0 && navigator.setAppBadge) navigator.setAppBadge(n);
    else if (navigator.clearAppBadge) navigator.clearAppBadge();
  } catch { /* no soportado */ }
}

const formatCOP = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

export function PedidosLiveProvider({ children }) {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const [conectado, setConectado] = useState(false);
  const [eventos, setEventos] = useState(0); // sube con cada pedido nuevo/confirmado: el menú lo usa para refrescar su contador
  const [avisos, setAvisos] = useState([]); // pedido_confirmado: acción real
  const [notas, setNotas] = useState([]); // nuevo_pedido: solo informativo
  const [pendientes, setPendientes] = useState(0); // pedidos que esperan acción del dueño
  const [alertaSuscripcion, setAlertaSuscripcion] = useState(null);
  const oyentes = useRef(new Map()); // evento -> Set<fn>: las pantallas se refrescan en vivo

  const emitirLocal = useCallback((evento, data) => {
    oyentes.current.get(evento)?.forEach((fn) => {
      try { fn(data); } catch { /* un oyente roto no afecta a los demás */ }
    });
  }, []);

  const suscribir = useCallback((evento, fn) => {
    if (!oyentes.current.has(evento)) oyentes.current.set(evento, new Set());
    oyentes.current.get(evento).add(fn);
    return () => oyentes.current.get(evento)?.delete(fn);
  }, []);

  const refrescarPendientes = useCallback(async () => {
    try {
      const r = await api.get('/pedidos');
      const lista = r.data?.pedidos || [];
      setPendientes(lista.filter((p) => p.estado === 'pago_enviado' || p.estado === 'pago_confirmado').length);
    } catch { /* sin conexión: se conserva el último valor */ }
  }, []);

  useEffect(() => { ponerInsignia(pendientes); }, [pendientes]);

  useEffect(() => {
    if (!token || !user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConectado(false);
      return undefined;
    }

    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => { setConectado(true); refrescarPendientes(); });
    socket.on('disconnect', () => setConectado(false));

    socket.on('nuevo_pedido', (data) => {
      reproducirAviso('pedido');
      emitirLocal('pedidos', data);
      refrescarPendientes();
      const id = `n-${data.pedido_id}-${Date.now()}`;
      setEventos((n) => n + 1);
      setNotas((prev) => [...prev, { ...data, id }]);
      setTimeout(() => setNotas((prev) => prev.filter((n) => n.id !== id)), 6000);
    });

    socket.on('nuevo_mensaje', (data) => {
      if (data?.tipo === 'salida') return;
      if (data?.requiere_humano || data?.atencion_humana) reproducirAviso('alerta');
      else reproducirAviso('mensaje');
      emitirLocal('mensajes', data);
    });

    socket.on('subscription_alert', (data) => setAlertaSuscripcion(data));

    socket.on('pedido_confirmado', (data) => {
      reproducirAviso('pago');
      setEventos((n) => n + 1);
      emitirLocal('pedidos', data);
      refrescarPendientes();
      setAvisos((prev) => (prev.some((a) => a.pedido_id === data.pedido_id) ? prev : [...prev, data]));
    });

    return () => socket.disconnect();
  }, [token, user, emitirLocal, refrescarPendientes]);

  const cerrarAviso = useCallback((pedidoId) => {
    setAvisos((prev) => prev.filter((a) => a.pedido_id !== pedidoId));
  }, []);

  const marcarEnPreparacion = useCallback(
    async (pedidoId) => {
      try {
        await api.patch(`/pedidos/${pedidoId}/estado`, { estado: 'en_preparacion' });
        refrescarPendientes();
      } catch (e) {
        // Si ya lo movieron desde otra pestaña o el estado cambió, no bloquea: se cierra igual
      } finally {
        cerrarAviso(pedidoId);
        navigate('/pedidos');
      }
    },
    [cerrarAviso, navigate, refrescarPendientes]
  );

  return (
    <PedidosLiveContext.Provider value={{ conectado, eventos, pendientes, alertaSuscripcion, suscribir, refrescarPendientes }}>
      {children}

      {/* Avisos suaves de "nuevo pedido, esperando pago": informativos, se van solos */}
      <div className="fixed top-6 right-6 z-[55] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {notas.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              className="pointer-events-auto flex items-center gap-3 bg-white border border-border rounded-xl pl-2 pr-4 py-2 shadow-[0_4px_16px_rgba(10,10,10,0.1)]"
            >
              <div className="w-9 h-9 rounded-lg bg-[#FDECEA] overflow-hidden flex items-end justify-center shrink-0">
                <Character name="sofia" height={40} alt="" />
              </div>
              <span className="text-sm text-text">
                Nuevo pedido de <strong>{n.cliente_nombre || 'un cliente'}</strong>, esperando el pago
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Avisos con acción real: pago verificado, hay que preparar el pedido */}
      <div className="fixed right-4 sm:right-6 z-[60] flex flex-col-reverse gap-3" style={{ bottom: 'calc(var(--nav-inferior, 0px) + 16px)' }}>
        <AnimatePresence>
          {avisos.map((a, i) => (
            <PedidoConfirmadoCard
              key={a.pedido_id}
              data={a}
              apilado={avisos.length - 1 - i}
              onCerrar={() => cerrarAviso(a.pedido_id)}
              onPreparar={() => marcarEnPreparacion(a.pedido_id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </PedidosLiveContext.Provider>
  );
}

function PedidoConfirmadoCard({ data, apilado, onCerrar, onPreparar }) {
  const reducir = useReducedMotion();

  return (
    <motion.div
      role="alert"
      initial={reducir ? false : { opacity: 0, y: 32, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 - Math.min(apilado, 2) * 0.03 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="w-[min(400px,calc(100vw-32px))] bg-white border-2 border-accent rounded-3xl shadow-[0_16px_40px_rgba(198,40,40,0.22)] p-4 pr-5 flex gap-4"
    >
      <div className="relative shrink-0 w-20 rounded-2xl bg-[#FDECEA] flex items-end justify-center overflow-visible">
        <div className="noma-hop -mt-4">
          <div className="noma-breathe">
            <Character name="sofia" height={100} alt="" />
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-xs font-bold tracking-[0.04em] uppercase text-accent flex items-center gap-1">
            <Volume2 size={12} /> Pago confirmado
          </p>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="w-7 h-7 rounded-lg bg-transparent border-none text-muted hover:bg-bg2 cursor-pointer flex items-center justify-center shrink-0"
          >
            <X size={14} />
          </button>
        </div>
        <h2 className="font-head text-base font-bold text-text leading-5 mb-0.5">
          Pedido #{data.numero_pedido}
        </h2>
        <p className="text-sm text-muted leading-5 mb-3">
          {data.cliente_nombre || 'Un cliente'} · {formatCOP(data.total)}. Ya tienes el dinero, prepáralo.
        </p>
        <button
          onClick={onPreparar}
          className="w-full h-10 px-4 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold border-none cursor-pointer transition-colors inline-flex items-center justify-center gap-2"
        >
          Marcar en preparación <ArrowRight size={16} />
        </button>
      </div>
    </motion.div>
  );
}
