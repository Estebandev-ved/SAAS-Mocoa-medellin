import React, { useState } from 'react';
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
  Bell,
  Layers,
  Globe,
  Monitor
} from 'lucide-react';

const Ecosystem = () => {
  const [activeModule, setActiveModule] = useState('comm');

  const modules = {
    comm: {
      id: 'comm',
      label: 'Comunicación',
      color: 'var(--comm)',
      icon: MessageSquare,
      title: 'Flujos de Conversación con IA',
      desc: 'Nuestra capa de comunicación utiliza modelos de lenguaje avanzados para gestionar diálogos naturales y efectivos.',
      features: [
        { icon: Smartphone, title: 'WhatsApp Business API', desc: 'Integración oficial para máxima estabilidad y seguridad.' },
        { icon: MessageSquare, title: 'Procesamiento de Voz', desc: 'Transcripción y respuesta a audios en tiempo real.' },
        { icon: Globe, title: 'Multi-idioma Nativo', desc: 'Detección automática de idioma y respuesta localizada.' }
      ]
    },
    ops: {
      id: 'ops',
      label: 'Operaciones',
      color: 'var(--ops)',
      icon: Settings,
      title: 'Gestión y Logística Automatizada',
      desc: 'Optimizamos la ejecución de tareas críticas, desde la toma de pedidos hasta la confirmación de entrega.',
      features: [
        { icon: Layers, title: 'Gestor de Pedidos', desc: 'Panel centralizado para control total de ventas.' },
        { icon: Zap, title: 'Inventario en Vivo', desc: 'Sincronización instantánea entre el bot y tu stock.' },
        { icon: Globe, title: 'Ruta de Entregas', desc: 'Cálculo inteligente para despachos y tiempos de espera.' }
      ]
    },
    intel: {
      id: 'intel',
      label: 'Inteligencia',
      color: 'var(--intel)',
      icon: BarChart3,
      title: 'Análisis de Datos y Predicción',
      desc: 'Convertimos cada interacción en datos accionables para el crecimiento de tu negocio.',
      features: [
        { icon: BarChart3, title: 'Reportes Mensuales', desc: 'Análisis profundo de rendimiento y tendencias.' },
        { icon: Search, title: 'Análisis de Sentimiento', desc: 'Entiende cómo se sienten tus clientes en cada chat.' },
        { icon: Target, title: 'Kpis Predictivos', desc: 'Visualiza proyecciones de ventas basadas en histórico.' }
      ]
    },
    mkt: {
      id: 'mkt',
      label: 'Marketing',
      color: 'var(--mkt)',
      icon: Target,
      title: 'Crecimiento y Retención',
      desc: 'Herramientas diseñadas para atraer nuevos clientes y mantener a los actuales comprometidos.',
      features: [
        { icon: Users, title: 'Campañas Masivas', desc: 'Envío segmentado de promociones y novedades.' },
        { icon: Target, title: 'Re-engagement', desc: 'Bots que reactivan clientes inactivos automáticamente.' },
        { icon: Zap, title: 'Venta Cruzada', desc: 'Sugerencias inteligentes basadas en el carrito.' }
      ]
    },
    int: {
      id: 'int',
      label: 'Integración',
      color: 'var(--int)',
      icon: Zap,
      title: 'Ecosistema Conectado',
      desc: 'Nos conectamos con las herramientas que ya usas para un flujo de trabajo sin fricciones.',
      features: [
        { icon: CreditCard, title: 'Pasarelas de Pago', desc: 'Integración directa con Wompi, Bold, Stripe y más.' },
        { icon: Database, title: 'Webhooks & APIs', desc: 'Conexión con tu CRM, ERP o base de datos propia.' },
        { icon: Globe, title: 'Notificaciones Push', desc: 'Alertas en tiempo real vía Slack, Discord o Email.' }
      ]
    },
    pers: {
      id: 'pers',
      label: 'Personalización',
      color: 'var(--pers)',
      icon: Cpu,
      title: 'Identidad de Marca Única',
      desc: 'Adaptamos cada detalle para que la solución sea una extensión natural de tu empresa.',
      features: [
        { icon: Globe, title: 'White Label', desc: 'Sin logos de terceros, tu marca es la protagonista.' },
        { icon: Cpu, title: 'Personalidad Propia', desc: 'Tono de voz y estilo de respuesta Taylor-made.' },
        { icon: Monitor, title: 'Landing Page', desc: 'Sitio web optimizado incluido para cada cliente.' }
      ]
    }
  };

  return (
    <section id="ecosistema" className="py-32 bg-bg2 relative overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="text-center mb-20">
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
            Un ecosistema robusto diseñado para escalar tu operatividad sin límites humanos.
          </motion.p>
        </div>

        {/* Antigravity Universe Diagram */}
        <div className="relative max-w-5xl mx-auto mb-20 bg-bg p-6 md:p-10 rounded-3xl border border-border overflow-hidden">
          {/* Starfield background */}
          <div className="absolute inset-0">
            {[...Array(60)].map((_, i) => (
              <div
                key={`star-${i}`}
                className="absolute rounded-full bg-white"
                style={{
                  width: `${1 + Math.random() * 2}px`,
                  height: `${1 + Math.random() * 2}px`,
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  opacity: 0.1 + Math.random() * 0.4,
                  animation: `pulse ${2 + Math.random() * 3}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 3}s`
                }}
              />
            ))}
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(229,57,53,0.06)_0%,transparent_60%)]" />
          
          <svg viewBox="0 0 900 540" className="w-full h-auto relative z-10">
            <defs>
              {/* Sun glow */}
              <radialGradient id="sun-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#E53935" stopOpacity="0.4"/>
                <stop offset="40%" stopColor="#E53935" stopOpacity="0.15"/>
                <stop offset="100%" stopColor="#E53935" stopOpacity="0"/>
              </radialGradient>
              {/* Planet gradients */}
              {Object.entries({
                comm: '#E53935', ops: '#FF7043', intel: '#29B6F6',
                mkt: '#AB47BC', int: '#FFB300', pers: '#66BB6A'
              }).map(([id, color]) => (
                <radialGradient key={id} id={`planet-${id}`} cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor={color} stopOpacity="1"/>
                  <stop offset="100%" stopColor={color} stopOpacity="0.5"/>
                </radialGradient>
              ))}
              <filter id="planet-glow">
                <feGaussianBlur stdDeviation="6" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="sun-filter">
                <feGaussianBlur stdDeviation="8" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Orbital rings (isometric perspective) */}
            {[
              { rx: 160, ry: 80, rotation: -20 },
              { rx: 230, ry: 110, rotation: -20 },
              { rx: 300, ry: 140, rotation: -20 },
            ].map((orbit, i) => (
              <ellipse
                key={`orbit-${i}`}
                cx="450" cy="260"
                rx={orbit.rx} ry={orbit.ry}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="0.5"
                strokeDasharray="4 6"
                opacity={0.15 - i * 0.03}
                transform={`rotate(${orbit.rotation} 450 260)`}
              />
            ))}

            {/* Central Sun - ANTIGRAVITY */}
            <g filter="url(#sun-filter)">
              {/* Outer glow */}
              <circle cx="450" cy="260" r="80" fill="url(#sun-glow)"/>
              {/* Corona */}
              <circle cx="450" cy="260" r="45" fill="none" stroke="#E53935" strokeWidth="1" opacity="0.3">
                <animate attributeName="r" values="45;50;45" dur="4s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.3;0.15;0.3" dur="4s" repeatCount="indefinite"/>
              </circle>
              {/* Sun body */}
              <circle cx="450" cy="260" r="35" fill="#E53935" opacity="0.9"/>
              <circle cx="450" cy="260" r="35" fill="none" stroke="#FF7043" strokeWidth="1.5" opacity="0.5"/>
              {/* Surface detail */}
              <circle cx="440" cy="252" r="8" fill="#FF7043" opacity="0.3"/>
              <circle cx="458" cy="268" r="5" fill="#C62828" opacity="0.4"/>
              {/* Label */}
              <text x="450" y="256" textAnchor="middle" fill="white" fontSize="11" fontFamily="var(--font-head)" fontWeight="800" letterSpacing="3">CORE</text>
              <text x="450" y="272" textAnchor="middle" fill="white" fontSize="7" fontFamily="var(--font-mono)" opacity="0.7" letterSpacing="1.5">ANTIGRAVITY</text>
            </g>

            {/* Planets */}
            {[
              { id: 'comm', label: 'COMUNICACIÓN', color: '#E53935', orbit: 1, angle: 30, size: 18, moons: 2 },
              { id: 'ops', label: 'OPERACIONES', color: '#FF7043', orbit: 1, angle: 150, size: 16, moons: 1 },
              { id: 'intel', label: 'INTELIGENCIA', color: '#29B6F6', orbit: 2, angle: 80, size: 20, moons: 3 },
              { id: 'mkt', label: 'MARKETING', color: '#AB47BC', orbit: 2, angle: 220, size: 15, moons: 1 },
              { id: 'int', label: 'INTEGRACIÓN', color: '#FFB300', orbit: 3, angle: 330, size: 17, moons: 2 },
              { id: 'pers', label: 'PERSONALIZACIÓN', color: '#66BB6A', orbit: 3, angle: 170, size: 14, moons: 1 },
            ].map((planet) => {
              const IS_ACTIVE = activeModule === planet.id;
              const orbits = [
                { rx: 160, ry: 80 },
                { rx: 230, ry: 110 },
                { rx: 300, ry: 140 }
              ];
              const orbit = orbits[planet.orbit - 1];
              const rad = (planet.angle - 20) * Math.PI / 180;
              const x = 450 + orbit.rx * Math.cos(rad);
              const y = 260 + orbit.ry * Math.sin(rad);
              const r = IS_ACTIVE ? planet.size * 1.2 : planet.size;

              return (
                <g
                  key={planet.id}
                  className="cursor-pointer"
                  onClick={() => setActiveModule(planet.id)}
                  style={{ transition: 'transform 0.3s ease' }}
                >
                  {/* Planet glow */}
                  {IS_ACTIVE && (
                    <circle cx={x} cy={y} r={r + 15} fill={planet.color} opacity="0.1">
                      <animate attributeName="opacity" values="0.1;0.05;0.1" dur="2s" repeatCount="indefinite"/>
                    </circle>
                  )}
                  {/* Planet body */}
                  <circle
                    cx={x} cy={y} r={r}
                    fill={`url(#planet-${planet.id})`}
                    filter={IS_ACTIVE ? 'url(#planet-glow)' : undefined}
                    stroke={IS_ACTIVE ? planet.color : 'transparent'}
                    strokeWidth={IS_ACTIVE ? 2 : 0}
                  />
                  {/* Surface highlight */}
                  <circle cx={x - r * 0.2} cy={y - r * 0.2} r={r * 0.4} fill="white" opacity="0.15"/>
                  {/* Ring for some planets */}
                  {planet.moons > 1 && (
                    <ellipse
                      cx={x} cy={y}
                      rx={r + 8} ry={r * 0.3}
                      fill="none" stroke={planet.color} strokeWidth="1" opacity="0.4"
                      transform={`rotate(-20 ${x} ${y})`}
                    />
                  )}
                  {/* Moons */}
                  {[...Array(Math.min(planet.moons, 2))].map((_, mi) => {
                    const moonAngle = (planet.angle + 60 + mi * 90) * Math.PI / 180;
                    const moonDist = r + 12 + mi * 6;
                    const mx = x + moonDist * Math.cos(moonAngle);
                    const my = y + moonDist * 0.5 * Math.sin(moonAngle);
                    return (
                      <circle key={`moon-${mi}`} cx={mx} cy={my} r={3} fill={planet.color} opacity="0.6"/>
                    );
                  })}
                  {/* Label */}
                  <text
                    x={x} y={y + r + 16}
                    textAnchor="middle"
                    fill={IS_ACTIVE ? planet.color : 'var(--text-muted)'}
                    fontSize="8"
                    fontFamily="var(--font-mono)"
                    fontWeight="700"
                    letterSpacing="1.5"
                    opacity={IS_ACTIVE ? 1 : 0.6}
                  >
                    {planet.label}
                  </text>
                </g>
              );
            })}

            {/* Animated comet / shooting star */}
            <g opacity="0.4">
              <circle r="2" fill="white">
                <animateMotion dur="8s" repeatCount="indefinite" path="M100,80 Q450,200 800,420"/>
                <animate attributeName="opacity" values="0;0.8;0" dur="8s" repeatCount="indefinite"/>
              </circle>
              <circle r="1" fill="white">
                <animateMotion dur="8s" repeatCount="indefinite" path="M100,80 Q450,200 800,420" begin="0.3s"/>
                <animate attributeName="opacity" values="0;0.5;0" dur="8s" repeatCount="indefinite" begin="0.3s"/>
              </circle>
            </g>

            {/* Connection lines (subtle) */}
            {[
              { x: 160, y: 80 }, { x: 230, y: 110 }, { x: 300, y: 140 }
            ].map((_, i) => {
              const orbits = [
                { rx: 160, ry: 80 }, { rx: 230, ry: 110 }, { rx: 300, ry: 140 }
              ];
              const planetAngles = [30, 150, 80, 220, 330, 170];
              const planetOrbits = [1, 1, 2, 2, 3, 3];
              return planetOrbits.map((po, pi) => {
                if (po !== i + 1) return null;
                const orbit = orbits[po - 1];
                const rad = (planetAngles[pi] - 20) * Math.PI / 180;
                const px = 450 + orbit.rx * Math.cos(rad);
                const py = 260 + orbit.ry * Math.sin(rad);
                return (
                  <line
                    key={`line-${pi}`}
                    x1="450" y1="260" x2={px} y2={py}
                    stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="3 5"
                    opacity="0.1"
                  />
                );
              });
            })}
          </svg>
        </div>

        {/* Module Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {Object.values(modules).map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveModule(m.id)}
              className={`px-6 py-3 font-mono text-xs uppercase tracking-wider rounded-xl transition-all border ${
                activeModule === m.id 
                  ? 'bg-accent text-bg border-accent shadow-[0_0_20px_rgba(229,57,53,0.3)]' 
                  : 'bg-transparent text-muted border-border hover:border-accent/40'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Active Module Panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeModule}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="grid lg:grid-cols-2 gap-12 items-center"
          >
            <div>
              <div className="inline-flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-accent-dim border border-border" style={{ color: modules[activeModule].color, backgroundColor: `${modules[activeModule].color}15`, borderColor: `${modules[activeModule].color}30` }}>
                  {React.createElement(modules[activeModule].icon, { size: 24 })}
                </div>
                <h3 className="font-head text-3xl font-bold">{modules[activeModule].title}</h3>
              </div>
              <p className="text-muted text-lg leading-relaxed mb-8">
                {modules[activeModule].desc}
              </p>
              <div className="grid gap-4">
                {modules[activeModule].features.map((f, i) => (
                  <div key={i} className="flex items-start gap-4 p-5 bg-bg/40 border border-border rounded-2xl hover:border-accent/20 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-bg flex items-center justify-center text-accent shrink-0">
                      <f.icon size={18} />
                    </div>
                    <div>
                      <h4 className="font-mono text-sm font-bold text-text mb-1 uppercase tracking-tight">{f.title}</h4>
                      <p className="text-muted text-xs leading-normal">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative aspect-square">
               <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent rounded-3xl border border-border p-1">
                  <div className="w-full h-full bg-bg3 rounded-[22px] flex flex-col items-center justify-center p-8 relative overflow-hidden">
                    {/* Starfield */}
                    <div className="absolute inset-0">
                      {[...Array(20)].map((_, i) => (
                        <div
                          key={`star2-${i}`}
                          className="absolute rounded-full bg-white"
                          style={{
                            width: `${1 + Math.random()}px`,
                            height: `${1 + Math.random()}px`,
                            top: `${Math.random() * 100}%`,
                            left: `${Math.random() * 100}%`,
                            opacity: 0.1 + Math.random() * 0.3
                          }}
                        />
                      ))}
                    </div>
                    {/* Radial glow */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(229,57,53,0.08)_0%,transparent_60%)]"/>
                    
                    <motion.div 
                      key={activeModule}
                      initial={{ scale: 0.9, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className="text-center relative z-10 w-full"
                    >
                      {/* Planet visualization */}
                      <div className="relative mx-auto mb-6" style={{ width: '140px', height: '140px' }}>
                        {/* Orbit ring */}
                        <div className="absolute inset-0 border border-white/5 rounded-full" style={{ transform: 'rotateX(60deg)' }}/>
                        <div className="absolute inset-2 border border-white/5 rounded-full" style={{ transform: 'rotateX(60deg) rotateZ(15deg)' }}/>
                        {/* Planet */}
                        <div 
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                          style={{
                            width: '60px',
                            height: '60px',
                            background: `radial-gradient(circle at 35% 35%, ${modules[activeModule].color}, ${modules[activeModule].color}88)`,
                            boxShadow: `0 0 30px ${modules[activeModule].color}40, 0 0 60px ${modules[activeModule].color}20`
                          }}
                        >
                          {/* Surface highlight */}
                          <div className="absolute top-2 left-3 w-5 h-5 bg-white/15 rounded-full blur-sm"/>
                          {/* Ring */}
                          <div 
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border rounded-full"
                            style={{
                              width: '90px',
                              height: '25px',
                              borderColor: `${modules[activeModule].color}40`,
                              transform: 'translate(-50%, -50%) rotateX(75deg) rotateZ(-15deg)'
                            }}
                          />
                        </div>
                        {/* Small moons */}
                        <div className="absolute top-4 right-6 w-2 h-2 rounded-full bg-white/20"/>
                        <div className="absolute bottom-8 left-4 w-1.5 h-1.5 rounded-full bg-white/15"/>
                      </div>

                      {/* Module title */}
                      <h4 className="font-head text-xl font-bold mb-1">{modules[activeModule].title}</h4>
                      <p className="font-mono text-[10px] uppercase tracking-[0.25em] mb-6" style={{ color: modules[activeModule].color }}>
                        {modules[activeModule].label}
                      </p>
                      
                      {/* Features grid */}
                      <div className="grid grid-cols-3 gap-3">
                        {modules[activeModule].features.map((f, i) => (
                          <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center backdrop-blur-sm">
                            <div 
                              className="w-8 h-8 mx-auto rounded-lg flex items-center justify-center mb-2"
                              style={{ backgroundColor: `${modules[activeModule].color}15` }}
                            >
                              <f.icon size={14} style={{ color: modules[activeModule].color }}/>
                            </div>
                            <p className="font-mono text-[8px] text-muted uppercase tracking-wider leading-tight">{f.title.split(' ')[0]}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </div>
               </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default Ecosystem;
