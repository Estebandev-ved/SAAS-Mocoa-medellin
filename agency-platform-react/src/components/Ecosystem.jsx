import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Settings,
  BarChart3,
  Target,
  Zap,
  Cpu,
  Smartphone,
  Database,
  Search,
  Users,
  CreditCard,
  Layers,
  Globe,
  Monitor,
  Truck,
  Bell,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const MODULES = [
  {
    id: 'comm',
    label: 'Comunicación',
    color: '#E53935',
    icon: MessageSquare,
    title: 'Flujos de Conversación con IA',
    desc: 'Nuestra capa de comunicación utiliza modelos de lenguaje avanzados para gestionar diálogos naturales y efectivos.',
    features: [
      { icon: Smartphone, title: 'WhatsApp Business API', desc: 'Integración oficial para máxima estabilidad y seguridad.' },
      { icon: MessageSquare, title: 'Procesamiento de Voz', desc: 'Transcripción y respuesta a audios en tiempo real.' },
      { icon: Globe, title: 'Multi-idioma Nativo', desc: 'Detección automática de idioma y respuesta localizada.' }
    ]
  },
  {
    id: 'ops',
    label: 'Operaciones',
    color: '#FF7043',
    icon: Settings,
    title: 'Gestión y Logística Automatizada',
    desc: 'Optimizamos la ejecución de tareas críticas, desde la toma de pedidos hasta la confirmación de entrega.',
    features: [
      { icon: Layers, title: 'Gestor de Pedidos', desc: 'Panel centralizado para control total de ventas.' },
      { icon: Zap, title: 'Inventario en Vivo', desc: 'Sincronización instantánea entre el bot y tu stock.' },
      { icon: Truck, title: 'Ruta de Entregas', desc: 'Cálculo inteligente para despachos y tiempos de espera.' }
    ]
  },
  {
    id: 'intel',
    label: 'Inteligencia',
    color: '#29B6F6',
    icon: BarChart3,
    title: 'Análisis de Datos y Predicción',
    desc: 'Convertimos cada interacción en datos accionables para el crecimiento de tu negocio.',
    features: [
      { icon: BarChart3, title: 'Reportes Mensuales', desc: 'Análisis profundo de rendimiento y tendencias.' },
      { icon: Search, title: 'Análisis de Sentimiento', desc: 'Entiende cómo se sienten tus clientes en cada chat.' },
      { icon: Target, title: 'KPIs Predictivos', desc: 'Visualiza proyecciones de ventas basadas en histórico.' }
    ]
  },
  {
    id: 'mkt',
    label: 'Marketing',
    color: '#AB47BC',
    icon: Target,
    title: 'Crecimiento y Retención',
    desc: 'Herramientas diseñadas para atraer nuevos clientes y mantener a los actuales comprometidos.',
    features: [
      { icon: Users, title: 'Campañas Masivas', desc: 'Envío segmentado de promociones y novedades.' },
      { icon: Target, title: 'Re-engagement', desc: 'Bots que reactivan clientes inactivos automáticamente.' },
      { icon: Zap, title: 'Venta Cruzada', desc: 'Sugerencias inteligentes basadas en el carrito.' }
    ]
  },
  {
    id: 'int',
    label: 'Integración',
    color: '#FFB300',
    icon: Zap,
    title: 'Ecosistema Conectado',
    desc: 'Nos conectamos con las herramientas que ya usas para un flujo de trabajo sin fricciones.',
    features: [
      { icon: CreditCard, title: 'Pasarelas de Pago', desc: 'Integración directa con Wompi, Bold, Stripe y más.' },
      { icon: Database, title: 'Webhooks & APIs', desc: 'Conexión con tu CRM, ERP o base de datos propia.' },
      { icon: Bell, title: 'Notificaciones Push', desc: 'Alertas en tiempo real vía Slack, Discord o Email.' }
    ]
  },
  {
    id: 'pers',
    label: 'Personalización',
    color: '#66BB6A',
    icon: Cpu,
    title: 'Identidad de Marca Única',
    desc: 'Adaptamos cada detalle para que la solución sea una extensión natural de tu empresa.',
    features: [
      { icon: Globe, title: 'White Label', desc: 'Sin logos de terceros, tu marca es la protagonista.' },
      { icon: Cpu, title: 'Personalidad Propia', desc: 'Tono de voz y estilo de respuesta a la medida.' },
      { icon: Monitor, title: 'Landing Page', desc: 'Sitio web optimizado incluido para cada cliente.' }
    ]
  }
];

// Posición de cada planeta: órbita (1-3) y ángulo
const PLACEMENT = {
  comm: { orbit: 1, angle: 30, size: 18 },
  ops: { orbit: 1, angle: 150, size: 16 },
  intel: { orbit: 2, angle: 80, size: 20 },
  mkt: { orbit: 2, angle: 220, size: 15 },
  int: { orbit: 3, angle: 330, size: 17 },
  pers: { orbit: 3, angle: 170, size: 14 }
};
const ORBITS = [
  { rx: 160, ry: 80 },
  { rx: 230, ry: 110 },
  { rx: 300, ry: 140 }
];
const CX = 450;
const CY = 260;

// Estrellas deterministas: no se regeneran con cada render
const makeStars = (n, seed) => {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  return Array.from({ length: n }, () => ({
    size: 1 + rnd() * 2,
    top: rnd() * 100,
    left: rnd() * 100,
    opacity: 0.15 + rnd() * 0.45,
    dur: 2 + rnd() * 3,
    delay: rnd() * 3
  }));
};

const TILT = (-20 * Math.PI) / 180;
const SPEEDS = [14, 9, 6]; // grados por segundo según la órbita

// Punto sobre la elipse inclinada, para que el planeta siga exactamente el anillo dibujado
const orbitPoint = (orbitIdx, angleDeg) => {
  const o = ORBITS[orbitIdx];
  const a = (angleDeg * Math.PI) / 180;
  const ex = o.rx * Math.cos(a);
  const ey = o.ry * Math.sin(a);
  return {
    x: CX + ex * Math.cos(TILT) - ey * Math.sin(TILT),
    y: CY + ex * Math.sin(TILT) + ey * Math.cos(TILT),
    depth: Math.sin(a) // >0 = delante del núcleo
  };
};

const Planet = ({ p, time, activeId, onSelect, onHover }) => {
  const { m, x, y, size, depth } = p;
  const isActive = activeId === m.id;
  const base = size * (1 + depth * 0.12); // más grande al pasar por delante
  const r = isActive ? base * 1.25 : base;
  const label = m.label.toUpperCase();
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Ver módulo ${m.label}`}
      aria-pressed={isActive}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={() => onSelect(m.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(m.id);
        }
      }}
      className="cursor-pointer outline-none group"
      opacity={depth < 0 ? 0.8 : 1}
    >
      <circle cx={x} cy={y} r={size + 22} fill="transparent" />
      {isActive && (
        <circle cx={x} cy={y} r={r + 16} fill={m.color} opacity="0.15">
          <animate attributeName="r" values={`${r + 12};${r + 22};${r + 12}`} dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.18;0.04;0.18" dur="2.4s" repeatCount="indefinite" />
        </circle>
      )}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={`url(#planet-${m.id})`}
        filter={isActive ? 'url(#planet-glow)' : undefined}
        stroke={isActive ? '#fff' : m.color}
        strokeWidth={isActive ? 2 : 0.8}
        strokeOpacity={isActive ? 0.9 : 0.35}
      />
      <circle cx={x - r * 0.25} cy={y - r * 0.25} r={r * 0.38} fill="#fff" opacity="0.18" />
      <ellipse cx={x} cy={y} rx={r + 9} ry={r * 0.3} fill="none" stroke={m.color} strokeWidth="1" opacity="0.45" transform={`rotate(-20 ${x} ${y})`} />

      {/* Lunas en órbita */}
      {[0, 1].map((mi) => {
        const ma = (time * (70 + mi * 45) + mi * 160) * (Math.PI / 180);
        const dist = r + 13 + mi * 7;
        return <circle key={mi} cx={x + dist * Math.cos(ma)} cy={y + dist * 0.45 * Math.sin(ma)} r={mi ? 2.2 : 3} fill={m.color} opacity="0.75" />;
      })}

      {isActive && (
        <rect x={x - label.length * 4.1 - 10} y={y + r + 18} width={label.length * 8.2 + 20} height="22" rx="11" fill={m.color} />
      )}
      <text
        x={x}
        y={y + r + 33}
        textAnchor="middle"
        fill={isActive ? '#fff' : 'rgba(255,255,255,0.7)'}
        fontSize="11"
        fontFamily="var(--font-mono)"
        fontWeight="700"
        letterSpacing="1.4"
      >
        {label}
      </text>
      <circle cx={x} cy={y} r={r + 8} fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="3 3" className="opacity-0 group-focus-visible:opacity-100" />
    </g>
  );
};

const Universe = ({ activeId, onSelect }) => {
  const stars = useMemo(() => makeStars(60, 42), []);
  const [time, setTime] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  useEffect(() => {
    let raf;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!pausedRef.current) setTime((t) => t + dt * (reduced ? 0.25 : 1)); // con 'reducir movimiento' gira 4x más lento
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const active = MODULES.find((m) => m.id === activeId);
  const planets = MODULES.map((m) => {
    const pl = PLACEMENT[m.id];
    const angle = pl.angle + time * SPEEDS[pl.orbit - 1];
    return { m, size: pl.size, angle, ...orbitPoint(pl.orbit - 1, angle) };
  });
  const activePlanet = planets.find((p) => p.m.id === activeId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative max-w-5xl mx-auto mb-10 bg-inverse p-4 md:p-10 rounded-3xl border border-white/10 overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)]"
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="absolute inset-0" aria-hidden="true">
        {stars.map((st, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: `${st.size}px`,
              height: `${st.size}px`,
              top: `${st.top}%`,
              left: `${st.left}%`,
              opacity: st.opacity,
              animation: `pulse ${st.dur}s ease-in-out infinite`,
              animationDelay: `${st.delay}s`
            }}
          />
        ))}
      </div>
      <div
        className="absolute inset-0 transition-[background] duration-700"
        style={{ background: `radial-gradient(ellipse at center, ${active.color}18 0%, transparent 62%)` }}
        aria-hidden="true"
      />

      <svg
        viewBox="0 0 900 540"
        className="w-full h-auto relative z-10"
        role="group"
        aria-label="Diagrama del ecosistema: seis módulos orbitando el núcleo"
      >
        <defs>
          <radialGradient id="sun-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E53935" stopOpacity="0.45" />
            <stop offset="40%" stopColor="#E53935" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#E53935" stopOpacity="0" />
          </radialGradient>
          {MODULES.map((m) => (
            <radialGradient key={m.id} id={`planet-${m.id}`} cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor={m.color} stopOpacity="1" />
              <stop offset="100%" stopColor={m.color} stopOpacity="0.55" />
            </radialGradient>
          ))}
          <filter id="planet-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="sun-filter" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {ORBITS.map((o, i) => (
          <ellipse
            key={i}
            cx={CX}
            cy={CY}
            rx={o.rx}
            ry={o.ry}
            fill="none"
            stroke="#fff"
            strokeWidth="0.8"
            strokeDasharray="4 7"
            opacity={0.18 - i * 0.04}
            transform={`rotate(-20 ${CX} ${CY})`}
          />
        ))}

        <line x1={CX} y1={CY} x2={activePlanet.x} y2={activePlanet.y} stroke={active.color} strokeWidth="1.5" strokeDasharray="4 6" opacity="0.7">
          <animate attributeName="stroke-dashoffset" values="0;-20" dur="1.2s" repeatCount="indefinite" />
        </line>

        {planets.filter((p) => p.depth < 0).map((p) => (
          <Planet key={p.m.id} p={p} time={time} activeId={activeId} onSelect={onSelect} onHover={setPaused} />
        ))}

        <g filter="url(#sun-filter)">
          <circle cx={CX} cy={CY} r="80" fill="url(#sun-glow)" />
          <circle cx={CX} cy={CY} r="45" fill="none" stroke="#E53935" strokeWidth="1" opacity="0.3">
            <animate attributeName="r" values="45;52;45" dur="4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0.1;0.3" dur="4s" repeatCount="indefinite" />
          </circle>
          <circle cx={CX} cy={CY} r="35" fill="#E53935" opacity="0.95" />
          <circle cx={CX} cy={CY} r="35" fill="none" stroke="#FF7043" strokeWidth="1.5" opacity="0.6" />
          <circle cx="440" cy="252" r="8" fill="#FF7043" opacity="0.3" />
          <circle cx="458" cy="268" r="5" fill="#C62828" opacity="0.4" />
        </g>
        <text x={CX} y={CY - 2} textAnchor="middle" fill="#fff" fontSize="12" fontFamily="var(--font-head)" fontWeight="800" letterSpacing="3">CORE</text>
        <text x={CX} y={CY + 12} textAnchor="middle" fill="#fff" fontSize="7" fontFamily="var(--font-mono)" opacity="0.75" letterSpacing="0.5">antigravity</text>

        {planets.filter((p) => p.depth >= 0).map((p) => (
          <Planet key={p.m.id} p={p} time={time} activeId={activeId} onSelect={onSelect} onHover={setPaused} />
        ))}

        <g opacity="0.5">
          <circle r="2" fill="#fff">
            <animateMotion dur="8s" repeatCount="indefinite" path="M100,80 Q450,200 800,420" />
            <animate attributeName="opacity" values="0;0.9;0" dur="8s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>

      <p className="relative z-10 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-white/40 mt-2">
        {paused ? 'Órbita en pausa' : 'Pasa el cursor sobre un planeta para detenerlo'}
      </p>
    </motion.div>
  );
};

const Ecosystem = () => {
  const [activeId, setActiveId] = useState('comm');
  const index = MODULES.findIndex((m) => m.id === activeId);
  const active = MODULES[index];
  const go = (delta) => setActiveId(MODULES[(index + delta + MODULES.length) % MODULES.length].id);

  return (
    <section id="ecosistema" className="py-24 md:py-32 bg-bg2 relative overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="text-center mb-14 md:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-label"
          >
            NUESTRO ECOSISTEMA
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="section-title"
          >
            Arquitectura <span className="text-accent underline decoration-accent/20">360°</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="section-sub mx-auto"
          >
            Seis módulos conectados a un mismo núcleo. Toca un planeta para explorar qué hace cada uno.
          </motion.p>
        </div>

        <Universe activeId={activeId} onSelect={setActiveId} />

        {/* Pestañas de módulos */}
        <div
          role="tablist"
          aria-label="Módulos del ecosistema"
          className="flex md:flex-wrap md:justify-center gap-2 mb-10 overflow-x-auto pb-2 -mx-6 px-6 md:mx-0 md:px-0 snap-x"
        >
          {MODULES.map((m) => {
            const selected = activeId === m.id;
            return (
              <button
                key={m.id}
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveId(m.id)}
                className={`relative shrink-0 snap-start inline-flex items-center gap-2 px-5 py-3 font-mono text-xs uppercase tracking-wider rounded-xl transition-all border ${
                  selected ? 'text-white border-transparent' : 'bg-transparent text-muted border-border hover:border-accent/40 hover:text-text'
                }`}
                style={selected ? { backgroundColor: m.color, boxShadow: `0 8px 24px -8px ${m.color}` } : undefined}
              >
                <m.icon size={14} />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Panel del módulo activo */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeId}
            role="tabpanel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-stretch max-w-5xl mx-auto"
          >
            {/* Tarjeta resumen */}
            <div className="lg:col-span-2 relative rounded-3xl bg-inverse text-inverse-text p-8 overflow-hidden flex flex-col justify-between min-h-[320px]">
              <div
                className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-40"
                style={{ background: active.color }}
                aria-hidden="true"
              />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <span className="font-mono text-[11px] tracking-[0.25em] opacity-60">
                    {String(index + 1).padStart(2, '0')} / {String(MODULES.length).padStart(2, '0')}
                  </span>
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: `${active.color}26`, color: active.color, border: `1px solid ${active.color}55` }}
                  >
                    <active.icon size={22} />
                  </div>
                </div>
                <p className="font-mono text-[11px] uppercase tracking-[0.25em] mb-3" style={{ color: active.color }}>
                  {active.label}
                </p>
                <h3 className="font-head text-2xl md:text-3xl font-bold leading-tight mb-4">{active.title}</h3>
                <p className="text-sm leading-relaxed opacity-70">{active.desc}</p>
              </div>
              <div className="relative z-10 flex items-center justify-between mt-8">
                <div className="flex gap-1.5" aria-hidden="true">
                  {MODULES.map((m) => (
                    <span
                      key={m.id}
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: m.id === activeId ? 22 : 6, backgroundColor: m.id === activeId ? active.color : 'rgba(255,255,255,0.25)' }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => go(-1)} aria-label="Módulo anterior" className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={() => go(1)} aria-label="Módulo siguiente" className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Funcionalidades */}
            <div className="lg:col-span-3 grid gap-4 content-center">
              {active.features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 * i + 0.1, duration: 0.4 }}
                  className="group flex items-start gap-5 p-6 bg-bg border border-border rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ borderLeft: `3px solid ${active.color}` }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${active.color}1f`, color: active.color }}
                  >
                    <f.icon size={20} />
                  </div>
                  <div>
                    <h4 className="font-head text-base font-bold text-text mb-1">{f.title}</h4>
                    <p className="text-muted text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default Ecosystem;
