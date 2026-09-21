import FeedbackMessage from '../components/FeedbackMessage';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bot, MessageSquare, Clock, Users, Zap, ShoppingCart, CreditCard,
  HelpCircle, AlertTriangle, UserMinus, Loader2, Save, Settings,
  Brain, Package, Bell, FileText, Lock, ArrowLeft, Sparkles, X,
  Check, ChevronDown, ChevronUp, Lightbulb, TestTube,
} from 'lucide-react';
import api from '../services/api';

const Toggle = ({ enabled, onToggle, disabled }) => (
  <button onClick={onToggle} disabled={disabled}
    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${enabled ? 'bg-accent' : 'bg-bg3'}`}>
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

const AGENTES_LIST = [
  { id: 'ventas', label: 'Ventas', icon: ShoppingCart, desc: 'Consultas de productos, precios y pedidos', plan: 'starter' },
  { id: 'pagos', label: 'Pagos', icon: CreditCard, desc: 'Verificación de pagos y cobros', plan: 'starter' },
  { id: 'pedidos', label: 'Pedidos', icon: Package, desc: 'Seguimiento y estado de pedidos', plan: 'starter' },
  { id: 'faq', label: 'FAQ', icon: HelpCircle, desc: 'Preguntas frecuentes del negocio', plan: 'starter' },
  { id: 'reclamos', label: 'Reclamos', icon: AlertTriangle, desc: 'Gestión de quejas y reclamos', plan: 'professional' },
  { id: 'retencion', label: 'Retención', icon: UserMinus, desc: 'Estrategias para recuperar clientes', plan: 'enterprise' },
];

const AI_SUGGESTIONS = {
  tono: {
    formal: { text: 'Ideal para negocios corporativos y profesionales', emoji: '🏢' },
    amigable: { text: 'El más popular. Genera confianza y cercanía', emoji: '😊' },
    casual: { text: 'Perfecto para marcas jóvenes y redes sociales', emoji: '😎' },
  },
  bienvenida: {
    formal: '¡Bienvenido/a! Soy el asistente virtual de {nombre}. ¿En qué puedo asistirle hoy?',
    amigable: '¡Hola! 👋 Soy {nombre}, tu asistente virtual. ¿En qué te puedo ayudar hoy?',
    casual: 'Hey! 👋 Soy {nombre}. ¿Qué necesitas?',
  },
  ausencia: {
    formal: 'Nuestro horario de atención es de {inicio} a {fin}. Le responderemos al día hábil siguiente.',
    amigable: '¡Hola! Estamos fuera de horario ⏰ Te respondemos de {inicio} a {fin}. ¡Gracias por tu paciencia!',
    casual: 'Hey, ahora no estamos. Volvemos a las {fin}. ¡Escríbenos entonces! 😴',
  },
  agentes: {
    starter: { max: 3, sugeridos: ['ventas', 'pagos', 'faq'] },
    professional: { max: 6, sugeridos: ['ventas', 'pagos', 'pedidos', 'faq', 'reclamos'] },
    enterprise: { max: 6, sugeridos: ['ventas', 'pagos', 'pedidos', 'faq', 'reclamos', 'retencion'] },
  },
};

function SuggestionBadge({ text, emoji }) {
  return (
    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-accent/5 border border-accent/20 rounded-xl">
      <Lightbulb className="w-3.5 h-3.5 text-warn-text flex-shrink-0" />
      <span className="text-xs text-muted">{emoji} {text}</span>
    </div>
  );
}

function AISuggestionButton({ onClick, label }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-xl text-xs text-accent hover:bg-accent/20 transition-all">
      <Sparkles className="w-3 h-3" /> {label}
    </button>
  );
}

function TestBotModal({ onClose }) {
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [respuesta, setRespuesta] = useState(null);

  async function handleTest() {
    if (!msg.trim()) return;
    setLoading(true);
    try {
      const res = await api.post('/bot/test', { mensaje: msg });
      setRespuesta(res.data);
    } catch (e) {
      setRespuesta({ error: 'Error al conectar con el bot' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="bg-bg2 border border-border rounded-3xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TestTube className="w-5 h-5 text-accent" />
            <h3 className="font-head text-lg font-bold text-text">Probar el Bot</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div className="bg-bg3 rounded-2xl p-3 border border-border">
            <span className="font-mono text-xs text-muted">Tú:</span>
            <input value={msg} onChange={e => setMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTest()}
              placeholder="Escribe un mensaje de prueba..."
              className="w-full bg-transparent text-text text-sm mt-1 focus:outline-none placeholder:text-muted/50" />
          </div>
          <button onClick={handleTest} disabled={loading || !msg.trim()}
            className="w-full bg-accent text-white py-2.5 rounded-xl font-mono text-sm hover:bg-accent/90 transition-all flex items-center justify-center gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <><Zap size={14} /> Enviar</>}
          </button>
          {respuesta && (
            <div className={`rounded-2xl p-3 border ${respuesta.error ? 'bg-danger/10 border-danger/30' : 'bg-success/10 border-success/30'}`}>
              <span className="font-mono text-xs text-muted">Bot:</span>
              <p className="text-sm text-text mt-1">{respuesta.respuesta || respuesta.error}</p>
              {respuesta.agente_usado && (
                <span className="font-mono text-[10px] text-muted mt-2 block">Agente: {respuesta.agente_usado} | Tokens: {respuesta.tokens_usados}</span>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function AutomatizacionesPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState({
    bot_nombre: '', bot_tono: 'amigable', bot_bienvenida: '',
    horario_inicio: '09:00', horario_fin: '18:00', mensaje_fuera_horario: '',
  });
  const [agentes, setAgentes] = useState({});
  const [saving, setSaving] = useState(null);
  const [message, setMessage] = useState(null);
  const [showTest, setShowTest] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [plan, setPlan] = useState('starter');

  useEffect(() => { loadConfig(); }, []);

  async function loadConfig() {
    try {
      const [configRes, planRes] = await Promise.all([
        api.get('/bot/config'),
        api.get('/suscripcion/actual').catch(() => ({ data: { plan: 'starter' } })),
      ]);
      const c = configRes.data;
      setConfig({
        bot_nombre: c.bot_nombre || '',
        bot_tono: c.bot_tono || 'amigable',
        bot_bienvenida: c.bot_bienvenida || '',
        horario_inicio: c.horario_inicio || '09:00',
        horario_fin: c.horario_fin || '18:00',
        mensaje_fuera_horario: c.mensaje_fuera_horario || '',
      });
      setPlan(planRes.data.plan || 'starter');

      // Parse agentes from array or object
      const agentesArr = c.agentes_activos || [];
      const agentesObj = {};
      AGENTES_LIST.forEach(a => {
        agentesObj[a.id] = Array.isArray(agentesArr) ? agentesArr.includes(a.id) : !!agentesArr[a.id];
      });
      setAgentes(agentesObj);
    } catch (e) {
      console.error('Error loading config:', e);
    }
  }

  async function saveConfig() {
    try {
      setSaving('config');
      setMessage(null);
      await api.put('/bot/config', {
        bot_nombre: config.bot_nombre,
        bot_tono: config.bot_tono,
        bot_bienvenida: config.bot_bienvenida,
        horario_inicio: config.horario_inicio,
        horario_fin: config.horario_fin,
        mensaje_fuera_horario: config.mensaje_fuera_horario,
      });
      setMessage({ type: 'success', text: 'Configuración del bot guardada' });
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.error || 'Error guardando' });
    } finally {
      setSaving(null);
    }
  }

  async function saveAgentes() {
    try {
      setSaving('agentes');
      setMessage(null);
      const agentesArray = Object.entries(agentes).filter(([_, v]) => v).map(([k]) => k);
      await api.put('/bot/config/agentes', { agentes: agentesArray });
      setMessage({ type: 'success', text: 'Agentes actualizados' });
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.error || 'Error guardando agentes' });
    } finally {
      setSaving(null);
    }
  }

  function applySuggestion(field, value) {
    setConfig(prev => ({ ...prev, [field]: value }));
  }

  const tonoActual = config.bot_tono || 'amigable';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 rounded-xl bg-bg2 border border-border hover:border-accent/30 transition-all">
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>
          <div>
            <h1 className="font-head text-3xl font-bold text-text">Automatizaciones</h1>
            <p className="text-muted mt-1">Configura la personalidad y agentes de tu bot</p>
          </div>
        </div>
        <button onClick={() => setShowTest(true)}
          className="flex items-center gap-2 bg-bg2 border border-border rounded-xl px-4 py-2.5 font-mono text-sm text-text hover:border-accent/30 transition-all">
          <TestTube size={16} className="text-accent" /> Probar Bot
        </button>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {message && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <FeedbackMessage type={message.type}>{message.text}</FeedbackMessage>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section 1: Personalidad del Bot */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-bg2 border border-border rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-accent" />
            <h2 className="font-head text-xl font-bold text-text">Personalidad del Bot</h2>
          </div>
          <button onClick={saveConfig} disabled={saving === 'config'}
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl font-mono text-sm hover:bg-accent/90 transition-all">
            {saving === 'config' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </button>
        </div>

        <div className="space-y-6">
          {/* Nombre del Bot */}
          <div>
            <label className="font-mono text-xs text-muted uppercase tracking-wider block mb-2">Nombre del Bot</label>
            <input value={config.bot_nombre} onChange={e => setConfig(p => ({ ...p, bot_nombre: e.target.value }))}
              placeholder="Ej: NOMA Bot"
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text font-body placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors" />
            {showSuggestions && config.bot_nombre && (
              <SuggestionBadge text={`Tu bot se llama "${config.bot_nombre}" y saludará así a los clientes`} emoji="🤖" />
            )}
          </div>

          {/* Tono de Voz */}
          <div>
            <label className="font-mono text-xs text-muted uppercase tracking-wider block mb-2">Tono de Voz</label>
            <div className="grid grid-cols-3 gap-3">
              {['formal', 'amigable', 'casual'].map(tono => (
                <button key={tono} onClick={() => setConfig(p => ({ ...p, bot_tono: tono }))}
                  className={`p-3 rounded-2xl border text-center transition-all ${config.bot_tono === tono ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-bg hover:border-border/80 text-text'}`}>
                  <span className="font-mono text-sm capitalize">{tono}</span>
                </button>
              ))}
            </div>
            {showSuggestions && (
              <SuggestionBadge text={AI_SUGGESTIONS.tono[tonoActual]?.text} emoji={AI_SUGGESTIONS.tono[tonoActual]?.emoji} />
            )}
          </div>

          {/* Mensaje de Bienvenida */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-mono text-xs text-muted uppercase tracking-wider">Mensaje de Bienvenida</label>
              <AISuggestionButton label="Sugerir" onClick={() => applySuggestion('bot_bienvenida',
                AI_SUGGESTIONS.bienvenida[tonoActual].replace(/{nombre}/g, config.bot_nombre || 'nuestro equipo')
              )} />
            </div>
            <textarea value={config.bot_bienvenida} onChange={e => setConfig(p => ({ ...p, bot_bienvenida: e.target.value }))}
              placeholder="Mensaje que verán los clientes al escribir por primera vez..."
              rows={3}
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text font-body placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors resize-none" />
            <span className="font-mono text-[10px] text-muted mt-1 block">{(config.bot_bienvenida || '').length}/500 caracteres</span>
          </div>

          {/* Horario */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-xs text-muted uppercase tracking-wider block mb-2">Hora Inicio</label>
              <input type="time" value={config.horario_inicio} onChange={e => setConfig(p => ({ ...p, horario_inicio: e.target.value }))}
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text font-mono focus:outline-none focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="font-mono text-xs text-muted uppercase tracking-wider block mb-2">Hora Fin</label>
              <input type="time" value={config.horario_fin} onChange={e => setConfig(p => ({ ...p, horario_fin: e.target.value }))}
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text font-mono focus:outline-none focus:border-accent transition-colors" />
            </div>
          </div>

          {/* Mensaje de Ausencia */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-mono text-xs text-muted uppercase tracking-wider">Mensaje Fuera de Horario</label>
              <AISuggestionButton label="Sugerir" onClick={() => applySuggestion('mensaje_fuera_horario',
                AI_SUGGESTIONS.ausencia[tonoActual]
                  .replace(/{inicio}/g, config.horario_inicio)
                  .replace(/{fin}/g, config.horario_fin)
              )} />
            </div>
            <textarea value={config.mensaje_fuera_horario} onChange={e => setConfig(p => ({ ...p, mensaje_fuera_horario: e.target.value }))}
              placeholder="Mensaje cuando el bot esté fuera de horario..."
              rows={3}
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text font-body placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors resize-none" />
          </div>
        </div>
      </motion.div>

      {/* Section 2: Agentes IA */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-bg2 border border-border rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-accent" />
            <h2 className="font-head text-xl font-bold text-text">Agentes IA</h2>
            <span className="font-mono text-xs text-muted bg-bg3 px-2 py-1 rounded-lg">
              {Object.values(agentes).filter(Boolean).length}/{AI_SUGGESTIONS.agentes[plan]?.max || 3} activos
            </span>
          </div>
          <button onClick={saveAgentes} disabled={saving === 'agentes'}
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl font-mono text-sm hover:bg-accent/90 transition-all">
            {saving === 'agentes' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {AGENTES_LIST.map(agente => {
            const Icon = agente.icon;
            const isActive = agentes[agente.id] || false;
            const isLocked = AI_SUGGESTIONS.agentes[plan]?.max <= Object.values(agentes).filter(Boolean).length && !isActive;
            const needsUpgrade = ['professional', 'enterprise'].includes(agente.plan) && ['starter'].includes(plan);
            const sugerido = AI_SUGGESTIONS.agentes[plan]?.sugeridos?.includes(agente.id);

            return (
              <div key={agente.id}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isActive ? 'border-accent/30 bg-accent/5' : 'border-border hover:border-border/80'} ${needsUpgrade ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-accent/10' : 'bg-bg3'}`}>
                    <Icon className={`w-5 h-5 ${isActive ? 'text-accent' : 'text-muted'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-text font-medium text-sm">{agente.label}</span>
                      {sugerido && <span className="font-mono text-[10px] bg-warn/10 text-warn-text px-1.5 py-0.5 rounded">Sugerido</span>}
                      {needsUpgrade && <Lock className="w-3 h-3 text-muted" />}
                    </div>
                    <p className="text-muted text-xs">{agente.desc}</p>
                  </div>
                </div>
                <Toggle enabled={isActive}
                  onToggle={() => {
                    if (needsUpgrade || isLocked) return;
                    setAgentes(p => ({ ...p, [agente.id]: !p[agente.id] }));
                  }}
                  disabled={needsUpgrade || isLocked} />
              </div>
            );
          })}
        </div>

        {showSuggestions && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <AISuggestionButton label="Activar sugeridos"
              onClick={() => {
                const sugeridos = AI_SUGGESTIONS.agentes[plan]?.sugeridos || [];
                const newObj = {};
                AGENTES_LIST.forEach(a => { newObj[a.id] = sugeridos.includes(a.id); });
                setAgentes(newObj);
              }} />
            <AISuggestionButton label="Activar todos"
              onClick={() => {
                const newObj = {};
                AGENTES_LIST.forEach(a => { newObj[a.id] = true; });
                setAgentes(newObj);
              }} />
          </div>
        )}
      </motion.div>

      {/* Test Modal */}
      <AnimatePresence>
        {showTest && <TestBotModal onClose={() => setShowTest(false)} />}
      </AnimatePresence>
    </div>
  );
}
