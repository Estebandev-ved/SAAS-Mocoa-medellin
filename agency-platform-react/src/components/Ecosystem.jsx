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

        {/* Interactive SVG Ecosystem */}
        <div className="relative max-w-4xl mx-auto mb-20 bg-bg p-8 rounded-3xl border border-border overflow-hidden">
          <div className="absolute inset-0 bg-[#00FFD1]/[0.02] bg-[radial-gradient(circle_at_center,rgba(0,255,209,0.05)_0%,transparent_70%)]" />
          
          <svg viewBox="0 0 800 500" className="w-full h-auto relative z-10 drop-shadow-[0_0_15px_rgba(0,255,209,0.1)]">
            {/* Center Node */}
            <motion.circle 
              cx="400" cy="250" r="50" 
              fill="rgba(0,255,209,0.1)" 
              stroke="var(--accent)" 
              strokeWidth="2"
              animate={{ r: [50, 55, 50], opacity: [0.8, 1, 0.8] }}
              transition={{ repeat: Infinity, duration: 4 }}
            />
            <text x="400" y="245" textAnchor="middle" fill="var(--accent)" className="font-head font-bold text-xl uppercase" style={{ fontSize: '12px' }}>CORE</text>
            <text x="400" y="260" textAnchor="middle" fill="var(--text)" className="font-mono text-xs opacity-60" style={{ fontSize: '10px' }}>ANTIGRAVITY</text>

            {/* Connection Lines (Animated) */}
            {[
              { x: 150, y: 120, color: 'var(--comm)' },
              { x: 650, y: 120, color: 'var(--ops)' },
              { x: 750, y: 250, color: 'var(--intel)' },
              { x: 650, y: 380, color: 'var(--mkt)' },
              { x: 150, y: 380, color: 'var(--int)' },
              { x: 50, y: 250, color: 'var(--pers)' }
            ].map((node, i) => (
              <g key={i}>
                <motion.line 
                  x1="400" y1="250" x2={node.x} y2={node.y} 
                  stroke={node.color} strokeWidth="1" strokeDasharray="4 4"
                  initial={{ strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: -20 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="opacity-30"
                />
              </g>
            ))}

            {/* Orbital Nodes */}
            {Object.values(modules).map((m, i) => {
              const positions = [
                { x: 150, y: 120 }, { x: 650, y: 120 }, { x: 750, y: 250 },
                { x: 650, y: 380 }, { x: 150, y: 380 }, { x: 50, y: 250 }
              ];
              const pos = positions[i];
              const IS_ACTIVE = activeModule === m.id;

              return (
                <g 
                  key={m.id} 
                  className="cursor-pointer group" 
                  onClick={() => setActiveModule(m.id)}
                >
                  <motion.circle 
                    cx={pos.x} cy={pos.y} r={IS_ACTIVE ? 35 : 30} 
                    fill="var(--bg2)" 
                    stroke={IS_ACTIVE ? m.color : 'var(--border)'} 
                    strokeWidth="2"
                    whileHover={{ scale: 1.1, stroke: m.color }}
                  />
                  <foreignObject x={pos.x - 15} y={pos.y - 15} width="30" height="30">
                    <div className={`w-full h-full flex items-center justify-center transition-colors ${IS_ACTIVE ? 'text-[var(--text)]' : 'text-muted'}`} style={{ color: IS_ACTIVE ? 'var(--text)' : 'var(--muted)' }}>
                      <m.icon size={20} strokeWidth={IS_ACTIVE ? 2.5 : 1.5} />
                    </div>
                  </foreignObject>
                  <text 
                    x={pos.x} y={pos.y + 50} 
                    textAnchor="middle" 
                    fill={IS_ACTIVE ? m.color : 'var(--text-muted)'} 
                    className="font-mono text-[10px] uppercase tracking-widest font-bold"
                    style={{ fontSize: '9px' }}
                  >
                    {m.label}
                  </text>
                </g>
              );
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
                  ? 'bg-accent text-bg border-accent shadow-[0_0_20px_rgba(0,255,209,0.3)]' 
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
                  <div className="w-full h-full bg-bg3 rounded-[22px] flex items-center justify-center p-8">
                    {/* Visual representation of the module */}
                    <motion.div 
                      key={activeModule}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-center"
                    >
                      <div className="text-9xl opacity-10 mb-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none">
                        {React.createElement(modules[activeModule].icon, { size: 200, strokeWidth: 0.5 })}
                      </div>
                      <div className="relative z-10">
                        <div className="w-24 h-24 mx-auto rounded-3xl bg-accent-dim border border-accent/20 flex items-center justify-center mb-6 shadow-2xl">
                          {React.createElement(modules[activeModule].icon, { size: 40, className: "text-accent" })}
                        </div>
                        <h4 className="font-head text-2xl font-bold mb-2">Módulo {modules[activeModule].label}</h4>
                        <p className="font-mono text-xs text-accent uppercase tracking-[0.3em]">Sistema Operativo v4.0</p>
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
