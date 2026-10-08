import TipNova from '../components/TipNova';
import FeedbackMessage from '../components/FeedbackMessage';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Clock,
  Zap,
  ShoppingCart,
  CreditCard,
  HelpCircle,
  AlertTriangle,
  UserMinus,
  Loader2,
  Save,
  Brain,
  Package,
  Lock,
  ArrowLeft,
  Sparkles,
  X,
  Lightbulb,
  TestTube,
} from 'lucide-react';
import api from '../services/api';

const LABEL = 'block text-sm font-semibold text-text mb-2';
const CONTROL =
  'w-full h-11 bg-white border border-[#C9C9C9] rounded-xl px-4 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors';

const Toggle = ({ enabled, onToggle, disabled }) => (
  <button
    onClick={onToggle}
    disabled={disabled}
    className={`relative w-11 h-6 rounded-full border-none transition-colors duration-200 ${
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    } ${enabled ? 'bg-accent' : 'bg-[#E4E4E4]'}`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
        enabled ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
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
    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-[#FDECEA] border border-accent/20 rounded-xl">
      <Lightbulb className="w-3.5 h-3.5 text-warn-text flex-shrink-0" />
      <span className="text-xs text-muted">
        {emoji} {text}
      </span>
    </div>
  );
}

function AISuggestionButton({ onClick, label }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#FDECEA] border border-accent/20 text-xs font-semibold text-accent hover:bg-accent-dim transition-colors cursor-pointer"
    >
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white border border-border rounded-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TestTube className="w-5 h-5 text-accent" />
            <h3 className="font-head text-lg font-bold text-text">Probar el Bot</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-transparent border-none text-muted hover:bg-bg2 cursor-pointer flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="bg-bg2 rounded-xl p-3 border border-border">
            <span className="text-xs font-semibold text-muted">Tú:</span>
            <input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTest()}
              placeholder="Escribe un mensaje de prueba..."
              className="w-full bg-transparent text-text text-sm mt-1 focus:outline-none placeholder:text-muted"
            />
          </div>

          <button
            onClick={handleTest}
            disabled={loading || !msg.trim()}
            className="w-full h-11 bg-accent hover:bg-accent2 text-white text-sm font-semibold rounded-xl border-none cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:bg-[#F0F0F0] disabled:text-muted disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <><Zap size={14} /> Enviar</>}
          </button>

          {respuesta && (
            <div
              className={`rounded-xl p-3 border ${
                respuesta.error ? 'bg-danger/10 border-danger/30' : 'bg-success/10 border-success/30'
              }`}
            >
              <span className="text-xs font-semibold text-muted">Bot:</span>
              <p className="text-sm text-text mt-1">{respuesta.respuesta || respuesta.error}</p>
              {respuesta.agente_usado && (
                <span className="text-[11px] text-muted mt-2 block">
                  Agente: {respuesta.agente_usado} | Tokens: {respuesta.tokens_usados}
                </span>
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
    bot_nombre: '',
    bot_tono: 'amigable',
    bot_bienvenida: '',
    horario_inicio: '09:00',
    horario_fin: '18:00',
    mensaje_fuera_horario: '',
  });
  const [agentes, setAgentes] = useState({});
  const [saving, setSaving] = useState(null);
  const [message, setMessage] = useState(null);
  const [showTest, setShowTest] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [plan, setPlan] = useState('starter');

  useEffect(() => {
    loadConfig();
  }, []);

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

      // Los agentes activos llegan como arreglo o como objeto según el endpoint que los guardó
      const agentesArr = c.agentes_activos || [];
      const agentesObj = {};
      AGENTES_LIST.forEach((a) => {
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
      const agentesArray = Object.entries(agentes)
        .filter(([, v]) => v)
        .map(([k]) => k);
      await api.put('/bot/config/agentes', { agentes: agentesArray });
      setMessage({ type: 'success', text: 'Agentes actualizados' });
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.error || 'Error guardando agentes' });
    } finally {
      setSaving(null);
    }
  }

  function applySuggestion(field, value) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }

  const tonoActual = config.bot_tono || 'amigable';
  const activos = Object.values(agentes).filter(Boolean).length;
  const maxAgentes = AI_SUGGESTIONS.agentes[plan]?.max || 3;

  return (
    <div className="min-h-screen bg-bg2 p-6 lg:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Encabezado */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              aria-label="Volver al panel"
              className="w-11 h-11 rounded-xl bg-white border border-border flex items-center justify-center cursor-pointer hover:border-[#C9C9C9] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-muted" />
            </button>
            <div>
              <h1 className="font-head text-3xl font-bold text-text tracking-tight">Automatizaciones</h1>
              <p className="text-muted text-sm mt-1">Configura la personalidad y los agentes de tu bot</p>
            </div>
          </div>

          <button
            onClick={() => setShowTest(true)}
            className="h-11 px-4 rounded-xl bg-white border border-[#C9C9C9] text-sm font-semibold text-text hover:bg-bg2 cursor-pointer transition-colors inline-flex items-center gap-2"
          >
            <TestTube size={16} className="text-accent" /> Probar bot
          </button>
        </div>

        <TipNova id="automatizaciones">
          Aquí decides cómo habla tu bot y qué agentes lo ayudan. Usa "Probar Bot" para chatear con él antes de que
          atienda clientes reales.
        </TipNova>

        <AnimatePresence>
          {message && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <FeedbackMessage type={message.type}>{message.text}</FeedbackMessage>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sección 1: Personalidad del bot */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-border rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-accent" />
              <h2 className="font-head text-xl font-bold text-text">Personalidad del bot</h2>
            </div>
            <button
              onClick={saveConfig}
              disabled={saving === 'config'}
              className="h-10 px-4 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold border-none cursor-pointer transition-colors inline-flex items-center gap-2 disabled:bg-[#F0F0F0] disabled:text-muted disabled:cursor-not-allowed"
            >
              {saving === 'config' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar
            </button>
          </div>

          <div className="space-y-6">
            {/* Nombre del bot */}
            <div>
              <label className={LABEL}>Nombre del bot</label>
              <input
                value={config.bot_nombre}
                onChange={(e) => setConfig((p) => ({ ...p, bot_nombre: e.target.value }))}
                placeholder="Ej: NOMA Bot"
                className={CONTROL}
              />
              {showSuggestions && config.bot_nombre && (
                <SuggestionBadge text={`Tu bot se llama "${config.bot_nombre}" y saludará así a los clientes`} emoji="🤖" />
              )}
            </div>

            {/* Tono de voz */}
            <div>
              <label className={LABEL}>Tono de voz</label>
              <div className="grid grid-cols-3 gap-3">
                {['formal', 'amigable', 'casual'].map((tono) => (
                  <button
                    key={tono}
                    onClick={() => setConfig((p) => ({ ...p, bot_tono: tono }))}
                    className={`h-11 rounded-xl border text-sm font-semibold capitalize cursor-pointer transition-colors ${
                      config.bot_tono === tono
                        ? 'border-accent bg-[#FDECEA] text-accent'
                        : 'border-border bg-white text-text hover:border-[#C9C9C9]'
                    }`}
                  >
                    {tono}
                  </button>
                ))}
              </div>
              {showSuggestions && (
                <SuggestionBadge
                  text={AI_SUGGESTIONS.tono[tonoActual]?.text}
                  emoji={AI_SUGGESTIONS.tono[tonoActual]?.emoji}
                />
              )}
            </div>

            {/* Mensaje de bienvenida */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={LABEL + ' mb-0'}>Mensaje de bienvenida</label>
                <AISuggestionButton
                  label="Sugerir"
                  onClick={() =>
                    applySuggestion(
                      'bot_bienvenida',
                      AI_SUGGESTIONS.bienvenida[tonoActual].replace(/{nombre}/g, config.bot_nombre || 'nuestro equipo')
                    )
                  }
                />
              </div>
              <textarea
                value={config.bot_bienvenida}
                onChange={(e) => setConfig((p) => ({ ...p, bot_bienvenida: e.target.value }))}
                placeholder="Mensaje que verán los clientes al escribir por primera vez..."
                rows={3}
                className={`${CONTROL} h-auto py-3 resize-none`}
              />
              <span className="text-xs text-muted mt-1 block">{(config.bot_bienvenida || '').length}/500 caracteres</span>
            </div>

            {/* Horario de atención */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Hora inicio</label>
                <input
                  type="time"
                  value={config.horario_inicio}
                  onChange={(e) => setConfig((p) => ({ ...p, horario_inicio: e.target.value }))}
                  className={CONTROL}
                />
              </div>
              <div>
                <label className={LABEL}>Hora fin</label>
                <input
                  type="time"
                  value={config.horario_fin}
                  onChange={(e) => setConfig((p) => ({ ...p, horario_fin: e.target.value }))}
                  className={CONTROL}
                />
              </div>
            </div>

            {/* Mensaje fuera de horario */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={LABEL + ' mb-0'}>Mensaje fuera de horario</label>
                <AISuggestionButton
                  label="Sugerir"
                  onClick={() =>
                    applySuggestion(
                      'mensaje_fuera_horario',
                      AI_SUGGESTIONS.ausencia[tonoActual]
                        .replace(/{inicio}/g, config.horario_inicio)
                        .replace(/{fin}/g, config.horario_fin)
                    )
                  }
                />
              </div>
              <textarea
                value={config.mensaje_fuera_horario}
                onChange={(e) => setConfig((p) => ({ ...p, mensaje_fuera_horario: e.target.value }))}
                placeholder="Mensaje cuando el bot esté fuera de horario..."
                rows={3}
                className={`${CONTROL} h-auto py-3 resize-none`}
              />
            </div>
          </div>
        </motion.div>

        {/* Sección 2: Agentes IA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-border rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-accent" />
              <h2 className="font-head text-xl font-bold text-text">Agentes IA</h2>
              <span className="text-xs font-semibold text-muted bg-bg2 px-2 py-1 rounded-lg">
                {activos}/{maxAgentes} activos
              </span>
            </div>
            <button
              onClick={saveAgentes}
              disabled={saving === 'agentes'}
              className="h-10 px-4 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold border-none cursor-pointer transition-colors inline-flex items-center gap-2 disabled:bg-[#F0F0F0] disabled:text-muted disabled:cursor-not-allowed"
            >
              {saving === 'agentes' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {AGENTES_LIST.map((agente) => {
              const Icon = agente.icon;
              const isActive = agentes[agente.id] || false;
              const isLocked = maxAgentes <= activos && !isActive;
              const needsUpgrade = ['professional', 'enterprise'].includes(agente.plan) && plan === 'starter';
              const sugerido = AI_SUGGESTIONS.agentes[plan]?.sugeridos?.includes(agente.id);

              return (
                <div
                  key={agente.id}
                  className={`flex items-center justify-between gap-3 p-4 rounded-xl border transition-colors ${
                    isActive ? 'border-accent/30 bg-[#FDECEA]' : 'border-border bg-white hover:border-[#C9C9C9]'
                  } ${needsUpgrade ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-white' : 'bg-bg2'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-accent' : 'text-muted'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-text font-semibold text-sm">{agente.label}</span>
                        {sugerido && (
                          <span className="text-[11px] font-semibold bg-warn/10 text-warn-text px-1.5 py-0.5 rounded">
                            Sugerido
                          </span>
                        )}
                        {needsUpgrade && <Lock className="w-3 h-3 text-muted shrink-0" />}
                      </div>
                      <p className="text-muted text-xs leading-4">{agente.desc}</p>
                    </div>
                  </div>
                  <Toggle
                    enabled={isActive}
                    onToggle={() => {
                      if (needsUpgrade || isLocked) return;
                      setAgentes((p) => ({ ...p, [agente.id]: !p[agente.id] }));
                    }}
                    disabled={needsUpgrade || isLocked}
                  />
                </div>
              );
            })}
          </div>

          {showSuggestions && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <AISuggestionButton
                label="Activar sugeridos"
                onClick={() => {
                  const sugeridos = AI_SUGGESTIONS.agentes[plan]?.sugeridos || [];
                  const newObj = {};
                  AGENTES_LIST.forEach((a) => {
                    newObj[a.id] = sugeridos.includes(a.id);
                  });
                  setAgentes(newObj);
                }}
              />
              <AISuggestionButton
                label="Activar todos"
                onClick={() => {
                  const newObj = {};
                  AGENTES_LIST.forEach((a) => {
                    newObj[a.id] = true;
                  });
                  setAgentes(newObj);
                }}
              />
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>{showTest && <TestBotModal onClose={() => setShowTest(false)} />}</AnimatePresence>
    </div>
  );
}
