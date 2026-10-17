import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, Package, CreditCard, Smartphone, Tag, Zap, MessageSquare } from 'lucide-react';
import api from '../services/api';
import { Character } from './Illustration';
import { lanzarConfeti } from '../utils/confeti';

// Activación guiada: al registrarse solo se piden los datos mínimos; aquí se completa lo que el bot necesita,
// paso a paso. La prueba gratuita de 7 días empieza con la primera conexión de WhatsApp.
export default function ActivationChecklist({ user, onActivando }) {
  const navigate = useNavigate();
  const [estado, setEstado] = useState(null); // null = cargando
  const [abierto, setAbierto] = useState(false); // 2.ª etapa (opcional): empieza colapsada para no estorbar

  const previo = useRef(null);

  // Lee el estado real del negocio. Se repite al volver a la pestaña (p. ej. después de cargar un
  // producto en otra pantalla), así el paso se marca solo y se celebra al completar la etapa.
  const cargar = useCallback(async () => {
    const [prod, perfil, wa, cup, aut, conv] = await Promise.allSettled([
      api.get('/productos'),
      api.get('/business/perfil'),
      api.get('/whatsapp/status'),
      api.get('/cupones'),
      api.get('/automations'),
      api.get('/conversaciones', { params: { limit: 1 } }),
    ]);
    const productos = prod.status === 'fulfilled' ? (prod.value.data.productos || prod.value.data.data || []) : [];
    const negocio = perfil.status === 'fulfilled' ? (perfil.value.data.negocio || perfil.value.data) : {};
    const metodos = Array.isArray(negocio.metodos_pago_activos) ? negocio.metodos_pago_activos : [];
    const nuevo = {
      catalogo: productos.length > 0,
      pagos: metodos.length > 0,
      whatsapp: wa.status === 'fulfilled' && !!wa.value.data.conectado,
      // Segunda etapa (opcional): sacarle más provecho al bot
      probado: conv.status === 'fulfilled' && (conv.value.data.conversaciones || []).length > 0,
      automatizacion:
        aut.status === 'fulfilled' &&
        Object.entries(aut.value.data.automations || {}).some(([tipo, a]) => tipo !== 'agentes' && a.activa),
      cupon: cup.status === 'fulfilled' && (cup.value.data.cupones || []).length > 0,
    };
    // Confeti solo si en esta visita se pasó de "incompleto" a "completo" (no al cargar ya completo)
    const base = (e) => e && e.catalogo && e.pagos && e.whatsapp;
    const extra = (e) => e && e.probado && e.automatizacion && e.cupon;
    if (previo.current && ((!base(previo.current) && base(nuevo)) || (!extra(previo.current) && extra(nuevo)))) lanzarConfeti();
    previo.current = nuevo;
    setEstado(nuevo);
  }, []);

  useEffect(() => {
    cargar();
    const alVolver = () => document.visibilityState === 'visible' && cargar();
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [cargar]);

  // Avisa al panel si aún hay pasos pendientes (para no repetir a Nova en otras tarjetas)
  useEffect(() => {
    if (estado && onActivando) onActivando(!(estado.catalogo && estado.pagos && estado.whatsapp));
  }, [estado, onActivando]);

  if (!estado) return null;

  const pasos = [
    {
      id: 'catalogo',
      icon: Package,
      titulo: 'Carga tu catálogo',
      desc: 'Agrega al menos un producto o servicio para que el bot sepa qué vender.',
      hecho: estado.catalogo,
      cta: 'Ir a productos',
      to: '/productos',
    },
    {
      id: 'pagos',
      icon: CreditCard,
      titulo: 'Elige cómo cobras',
      desc: 'Nequi, Bancolombia, efectivo… el bot los ofrece al cerrar la venta.',
      hecho: estado.pagos,
      cta: 'Configurar pagos',
      to: '/bienvenida',
    },
    {
      id: 'whatsapp',
      icon: Smartphone,
      titulo: 'Conecta tu WhatsApp',
      desc: 'Al conectarlo se enciende tu bot y empieza tu prueba gratis de 7 días.',
      hecho: estado.whatsapp,
      cta: 'Conectar WhatsApp',
      to: '/whatsapp',
    },
  ];

  const baseCompleta = pasos.every((p) => p.hecho);
  const extras = [
    {
      id: 'probado',
      icon: MessageSquare,
      titulo: 'Prueba tu bot como si fueras un cliente',
      desc: 'Escríbele desde otro número, pide un producto y envía un pago de prueba. Verás cómo atiende.',
      hecho: estado.probado,
      cta: 'Ver conversaciones',
      to: '/conversaciones',
    },
    {
      id: 'automatizacion',
      icon: Zap,
      titulo: 'Activa tu primera automatización',
      desc: 'Por ejemplo, el recordatorio de pago: el bot avisa solo a quien no pagó.',
      hecho: estado.automatizacion,
      cta: 'Ir a Automatizaciones',
      to: '/automatizaciones',
    },
    {
      id: 'cupon',
      icon: Tag,
      titulo: 'Crea tu primer cupón',
      desc: 'Un código de descuento para atraer o recuperar clientes. Lo creas con un ejemplo en un clic.',
      hecho: estado.cupon,
      cta: 'Crear cupón',
      to: '/cupones',
    },
  ];
  const lista = baseCompleta ? extras : pasos;
  const completados = lista.filter((p) => p.hecho).length;
  if (completados === lista.length) return null; // todo listo: el panel queda limpio

  const siguiente = lista.find((p) => !p.hecho);
  const pct = Math.round((completados / lista.length) * 100);
  const trialSinIniciar = !baseCompleta && !estado.whatsapp && !user?.trial_hasta;

  // Base lista: barra compacta (un clic la despliega). Lo urgente deja de ocupar media pantalla.
  if (baseCompleta && !abierto) {
    return (
      <section aria-label="Saca más provecho a tu bot" className="bg-bg border border-border rounded-2xl px-5 py-3 mb-6 flex items-center gap-4 flex-wrap">
        <span className="w-9 h-9 rounded-full bg-success text-white flex items-center justify-center shrink-0"><Check size={18} /></span>
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm font-semibold text-text">¡Tu bot ya está activo!</p>
          <p className="text-xs text-muted">Siguiente paso opcional: {siguiente?.titulo.toLowerCase()} ({completados} de {lista.length} listos)</p>
        </div>
        <button onClick={() => setAbierto(true)} className="h-10 px-4 rounded-xl bg-bg hover:bg-bg2 text-text text-sm font-semibold border border-border cursor-pointer">
          Ver pasos
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label="Activa tu bot"
      className="bg-bg border border-border rounded-2xl p-6 mb-8 flex flex-col md:flex-row gap-6 items-center md:items-stretch"
    >
      <div className="hidden md:flex items-end shrink-0 -mb-6 -ml-2">
        <Character name="nova" height={190} alt="Nova te guía para activar tu bot" />
      </div>

      <div className="flex-1 min-w-0 w-full">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h2 className="font-head text-xl font-bold text-text">{baseCompleta ? 'Saca más provecho a tu bot' : 'Activa tu bot'}</h2>
          <span className="text-sm font-semibold text-accent">{completados} de {lista.length} listos</span>
          {!baseCompleta && (
            <button onClick={() => navigate('/bienvenida')} className="basis-full text-left bg-transparent border-none p-0 text-sm font-semibold text-accent underline cursor-pointer">
              Hacerlo paso a paso con el asistente →
            </button>
          )}
        </div>
        <p className="text-sm text-muted mb-4">
          {baseCompleta
            ? '¡Tu bot ya está listo! Estos pasos opcionales te ayudan a vender más:'
            : trialSinIniciar
              ? 'Tu prueba gratis de 7 días empieza cuando conectes tu WhatsApp. Antes, deja todo listo:'
              : 'Completa estos pasos para que tu bot empiece a vender.'}
        </p>

        <div
          className="h-2 rounded-full bg-bg3 overflow-hidden mb-5"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>

        <ul className="list-none p-0 m-0 space-y-2">
          {lista.map((p) => {
            const Icon = p.icon;
            const esSiguiente = siguiente && siguiente.id === p.id;
            return (
              <li
                key={p.id}
                className={`flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-3 p-3 rounded-xl border ${
                  esSiguiente ? 'border-accent/40 bg-accent-dim' : 'border-border bg-bg'
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    p.hecho ? 'bg-success text-white' : 'bg-bg3 text-muted'
                  }`}
                >
                  {p.hecho ? <Check size={18} /> : <Icon size={18} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${p.hecho ? 'text-muted line-through' : 'text-text'}`}>{p.titulo}</p>
                  {!p.hecho && <p className="text-xs text-muted leading-5">{p.desc}</p>}
                </div>
                {esSiguiente && (
                  <button
                    onClick={() => navigate(p.to)}
                    className="h-10 px-4 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 border-none cursor-pointer transition-colors shrink-0 w-full sm:w-auto"
                  >
                    {p.cta} <ArrowRight size={16} />
                  </button>
                )}
                {!p.hecho && !esSiguiente && (
                  <button
                    onClick={() => navigate(p.to)}
                    className="h-10 px-4 rounded-xl bg-bg hover:bg-bg2 text-text text-sm font-semibold border border-border cursor-pointer transition-colors shrink-0 w-full sm:w-auto"
                  >
                    {p.cta}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
