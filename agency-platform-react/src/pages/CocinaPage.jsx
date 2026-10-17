import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, Maximize2, Minimize2, Check, Play, Clock, Volume2 } from 'lucide-react';
import api from '../services/api';
import { usePedidosLive } from '../context/PedidosLiveContext';
import { useNegocio } from '../hooks/useNegocio';
import { useAvanzarPedido } from '../hooks/useAvanzarPedido';
import { SkeletonList } from '../components/Skeleton';
import Illustration from '../components/Illustration';

const minutosDesde = (fecha, ahora) => Math.max(0, Math.floor((ahora - new Date(fecha).getTime()) / 60000));

function Tarjeta({ pedido, ahora, onAccion }) {
  const enPrep = pedido.estado === 'en_preparacion';
  const min = minutosDesde(pedido.created_at, ahora);
  const tarde = min >= 20;
  const items = pedido.items || [];
  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`rounded-3xl border-2 p-5 bg-white flex flex-col gap-3 ${tarde ? 'border-danger' : enPrep ? 'border-warn' : 'border-accent'}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-2xl sm:text-3xl font-bold text-text m-0 whitespace-nowrap">#{pedido.numero_pedido || pedido.id}</p>
          <p className="text-base text-muted truncate m-0">{pedido.cliente_nombre || 'Cliente'}</p>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-sm font-bold ${tarde ? 'bg-danger/10 text-danger-text' : 'bg-bg3 text-text'}`}>
          <Clock size={16} /> {min} min
        </span>
      </header>

      <ul className="list-none m-0 p-0 space-y-1.5 flex-1">
        {items.length === 0 && <li className="text-muted text-base">Mira el detalle en Pedidos</li>}
        {items.map((it, i) => (
          <li key={i} className="flex gap-3 text-xl leading-7">
            <span className="font-mono font-bold text-accent min-w-[2.2ch] text-right">{it.cantidad}×</span>
            <span className="text-text">{it.producto?.nombre || it.nombre}</span>
          </li>
        ))}
      </ul>

      {pedido.direccion_entrega && <p className="text-sm text-muted m-0">Entrega: {pedido.direccion_entrega}</p>}

      <button
        onClick={() => onAccion(pedido)}
        className={`h-16 rounded-2xl border-none text-white text-xl font-bold cursor-pointer inline-flex items-center justify-center gap-3 ${enPrep ? 'bg-success hover:opacity-90' : 'bg-accent hover:bg-accent2'}`}
      >
        {enPrep ? <><Check size={26} /> Listo</> : <><Play size={24} /> Empezar</>}
      </button>
    </motion.article>
  );
}

// Modo cocina: pantalla grande con solo lo que cocina necesita (pedidos ya pagados), sin números ni menús.
// Solo aparece para negocios tipo "restaurante" (ver utils/capacidades.js).
export default function CocinaPage() {
  const navigate = useNavigate();
  const { puede, cargando } = useNegocio();
  const { suscribir, conectado } = usePedidosLive();
  const [pedidos, setPedidos] = useState(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [pantalla, setPantalla] = useState(false);
  const raiz = useRef(null);
  const wake = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const r = await api.get('/pedidos');
      setPedidos(r.data?.pedidos || []);
    } catch {
      setPedidos((p) => p || []);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => suscribir('pedidos', cargar), [suscribir, cargar]);
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Pantalla encendida mientras se está en la cocina (si el navegador lo permite)
  useEffect(() => {
    let activo = true;
    const pedir = async () => {
      try { wake.current = await navigator.wakeLock?.request('screen'); } catch { /* no soportado o sin permiso */ }
    };
    pedir();
    const onVis = () => { if (activo && document.visibilityState === 'visible') pedir(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { activo = false; document.removeEventListener('visibilitychange', onVis); wake.current?.release?.().catch(() => {}); };
  }, []);

  useEffect(() => {
    const fn = () => setPantalla(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fn);
    return () => document.removeEventListener('fullscreenchange', fn);
  }, []);

  const poner = useCallback((id, estado) => setPedidos((l) => (l || []).map((p) => (p.id === id ? { ...p, estado } : p))), []);
  const avanzar = useAvanzarPedido(poner);
  const accion = (p) => {
    const sig = p.estado === 'en_preparacion' ? 'enviado' : 'en_preparacion';
    avanzar(p, sig, sig === 'enviado' ? `#${p.numero_pedido || p.id} listo` : `#${p.numero_pedido || p.id} en preparación`);
  };

  const alternarPantalla = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else raiz.current?.requestFullscreen?.().catch(() => {});
  };

  if (!cargando && !puede('cocina')) {
    return (
      <div className="p-6 lg:p-10 max-w-xl mx-auto text-center">
        <Illustration name="vacio-pedidos" size={150} alt="" />
        <h1 className="font-head text-2xl font-bold mt-4 mb-2">El modo cocina es para restaurantes</h1>
        <p className="text-muted mb-5">Si tu negocio prepara comida, cambia el tipo de negocio en Ajustes y esta pantalla se activa.</p>
        <button onClick={() => navigate('/ajustes')} className="h-12 px-6 rounded-xl bg-accent text-white font-semibold border-none cursor-pointer">Ir a Ajustes</button>
      </div>
    );
  }

  const lista = pedidos || [];
  const nuevos = lista.filter((p) => p.estado === 'pago_confirmado');
  const preparando = lista.filter((p) => p.estado === 'en_preparacion');

  return (
    <div ref={raiz} className="bg-bg2 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1600px] mx-auto">
        <header className="flex items-center gap-3 mb-6 flex-wrap">
          <span className="w-12 h-12 rounded-2xl bg-accent-dim text-accent flex items-center justify-center"><ChefHat size={26} /></span>
          <div>
            <h1 className="font-head text-2xl sm:text-3xl font-bold text-text m-0">Cocina</h1>
            <p className="text-sm text-muted m-0 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${conectado ? 'bg-success animate-pulse' : 'bg-muted'}`} />
              {conectado ? 'En vivo: suena cuando entra un pedido pagado' : 'Sin conexión en vivo'} <Volume2 size={14} />
            </p>
          </div>
          <button onClick={alternarPantalla} className="ml-auto h-12 px-4 rounded-xl bg-white border border-border text-text text-sm font-semibold cursor-pointer inline-flex items-center gap-2">
            {pantalla ? <Minimize2 size={18} /> : <Maximize2 size={18} />} {pantalla ? 'Salir' : 'Pantalla completa'}
          </button>
        </header>

        {pedidos === null ? (
          <SkeletonList filas={3} />
        ) : nuevos.length === 0 && preparando.length === 0 ? (
          <div className="text-center py-16 bg-white border border-border rounded-3xl">
            <Illustration name="vacio-pedidos" size={150} alt="" />
            <h2 className="text-xl font-bold mt-4 mb-1">Sin pedidos por preparar</h2>
            <p className="text-muted m-0">Aquí aparecen los pedidos apenas se confirma el pago.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {[{ t: 'Por empezar', l: nuevos, c: 'text-accent' }, { t: 'En preparación', l: preparando, c: 'text-warn-text' }].map((col) => (
              <section key={col.t} aria-label={col.t}>
                <h2 className={`font-head text-lg font-bold mb-3 m-0 ${col.c}`}>{col.t} · {col.l.length}</h2>
                <div className="grid 2xl:grid-cols-2 gap-4">
                  <AnimatePresence>
                    {col.l.map((p) => <Tarjeta key={p.id} pedido={p} ahora={ahora} onAccion={accion} />)}
                  </AnimatePresence>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
