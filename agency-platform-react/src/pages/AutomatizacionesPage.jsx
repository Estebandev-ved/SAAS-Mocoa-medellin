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
  Sparkles,
  X,
  Lightbulb,
  TestTube,
  Bell,
  Star,
  Send,
} from 'lucide-react';
import api from '../services/api';
import AyudaRapida from '../components/AyudaRapida';
import { mensajeError } from '../utils/errores';

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

// Automatizaciones que de verdad ejecuta el scheduler/handlers del backend.
// campaña_masiva y ocr_pagos no van aquí: las campañas tienen su propio
// módulo y la lectura de comprobantes del bot no depende de un switch.
const AUTO_UI = {
  recordatorio_pago: {
    icon: Bell,
    campos: [
      { k: 'minutos', label: 'Avisar después de (minutos)', type: 'number', min: 5, max: 1440 },
      { k: 'mensaje', label: 'Mensaje al cliente', type: 'text', ejemplo: 'Hola 👋 Vimos que tu pedido quedó pendiente de pago. Si necesitas ayuda para pagar, escríbenos y te ayudamos.' },
    ],
  },
  resena: { icon: Star, campos: [] },
  encuesta: {
    icon: Star,
    campos: [],
    nota: 'El cliente responde con un número de 1 a 5. Si califica 1 a 3, el bot se pausa y te avisa para que lo contactes.',
  },
  recuperacion_pedido: {
    icon: ShoppingCart,
    campos: [
      { k: 'horas', label: 'Escribir si sigue sin pagar después de (horas)', type: 'number', min: 2, max: 168 },
      { k: 'mensaje', label: 'Mensaje', type: 'text', ejemplo: 'Vimos que tu pedido quedó pendiente. ¿Quieres que te ayudemos a completarlo? Aún lo tenemos reservado para ti.' },
      { k: 'cupon', label: 'Código de cupón a ofrecer (opcional, créalo en Cupones)', type: 'text' },
    ],
  },
  stock_bajo: {
    icon: Package,
    campos: [{ k: 'umbral', label: 'Avisar cuando queden (unidades o menos)', type: 'number', min: 1, max: 100 }],
  },
  reengagement: {
    icon: UserMinus,
    campos: [
      { k: 'dias', label: 'Días sin comprar', type: 'number', min: 7, max: 90 },
      { k: 'mensaje', label: 'Mensaje', type: 'text', ejemplo: '¡Hola! Hace tiempo no sabemos de ti y te extrañamos 💛. Vuelve a pedir esta semana.' },
      { k: 'oferta', label: 'Oferta (opcional)', type: 'text', ejemplo: 'Usa el código VUELVE10 y obtén 10% de descuento.' },
    ],
    nota: 'Solo se escribe a clientes que aceptaron recibir marketing.',
  },
  reporte_semanal: {
    icon: Clock,
    campos: [
      {
        k: 'dia',
        label: 'Día del reporte',
        type: 'select',
        options: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
      },
    ],
    nota: 'Llega por WhatsApp al número del negocio.',
  },
};

// Qué pasa justo después de encenderla: así el dueño sabe qué esperar sin leer nada más.
const AVISO_ACTIVADA = {
  recordatorio_pago: 'Activada. Cuando un cliente deje un pedido sin pagar, el bot le recordará pasados los minutos que configures.',
  resena: 'Activada. Cuando marques un pedido como entregado, el bot le pedirá una reseña al cliente.',
  encuesta: 'Activada. Al entregar un pedido el bot pedirá una nota de 1 a 5. Si es baja, te avisamos por WhatsApp para que lo contactes.',
  stock_bajo: 'Activada. Te avisaremos por WhatsApp cuando un producto baje del número que elijas. Asegúrate de tener tu stock al día en Productos.',
  reengagement: 'Activada. El bot escribirá a clientes que no compran hace días (solo a quienes aceptaron marketing). Revisa el mensaje antes de que salga.',
  reporte_semanal: 'Activada. Recibirás un resumen de ventas y pedidos por WhatsApp el día que elijas.',
  recuperacion_pedido: 'Activada. Si un pedido sigue sin pagarse pasadas las horas configuradas, el bot escribirá al cliente. Puedes ofrecer un cupón (créalo en Cupones).',
};

function AutomatizacionReal({ auto, onChange, onError, onAviso }) {
  const ui = AUTO_UI[auto.tipo];
  const Icon = ui.icon;
  const defaults = Object.fromEntries(
    Object.entries(auto.config_schema || {}).map(([k, d]) => [k, d.default])
  );
  const [cfg, setCfg] = useState({ ...defaults, ...auto.config });
  const [busy, setBusy] = useState(false);
  const [guardado, setGuardado] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await api.patch(`/automatizaciones/${auto.tipo}/toggle`, {});
      onChange(auto.tipo, { activa: res.data.activa });
      if (res.data.activa && AVISO_ACTIVADA[auto.tipo]) onAviso(AVISO_ACTIVADA[auto.tipo]);
    } catch (e) {
      onError(mensajeError(e, 'cambiar el estado'));
    } finally {
      setBusy(false);
    }
  }

  async function guardar() {
    setBusy(true);
    try {
      await api.put(`/automatizaciones/${auto.tipo}/config`, cfg);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
    } catch (e) {
      onError(mensajeError(e, 'guardar los ajustes'));
    } finally {
      setBusy(false);
    }
  }

  const bloqueada = !auto.disponible;
  return (
    <div
      className={`p-4 rounded-xl border transition-colors ${
        auto.activa ? 'border-accent/30 bg-[#FDECEA]' : 'border-border bg-white'
      } ${bloqueada ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${auto.activa ? 'bg-white' : 'bg-bg2'}`}>
            <Icon className={`w-5 h-5 ${auto.activa ? 'text-accent' : 'text-muted'}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-text font-semibold text-sm">{auto.nombre}</span>
              {bloqueada && (
                <span className="text-[11px] font-semibold text-muted inline-flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Plan {auto.plan_requerido}
                </span>
              )}
            </div>
            <p className="text-muted text-xs leading-4">{auto.descripcion}</p>
          </div>
        </div>
        <Toggle enabled={auto.activa} onToggle={toggle} disabled={bloqueada || busy} />
      </div>

      {auto.activa && ui.campos.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          {ui.campos.map((c) => (
            <div key={c.k}>
              <label className={LABEL}>{c.label}</label>
              {c.type === 'select' ? (
                <select
                  value={cfg[c.k] ?? ''}
                  onChange={(e) => setCfg((p) => ({ ...p, [c.k]: e.target.value }))}
                  className={CONTROL}
                >
                  {c.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    type={c.type === 'number' ? 'number' : 'text'}
                    min={c.min}
                    max={c.max}
                    value={cfg[c.k] ?? ''}
                    onChange={(e) => setCfg((p) => ({ ...p, [c.k]: e.target.value }))}
                    className={CONTROL}
                  />
                  {c.ejemplo && (
                    <button
                      type="button"
                      onClick={() => setCfg((p) => ({ ...p, [c.k]: c.ejemplo }))}
                      className="mt-1.5 text-xs font-semibold text-accent bg-transparent border-none p-0 cursor-pointer hover:underline"
                    >
                      Usar ejemplo
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
          {ui.nota && <p className="text-xs text-muted">{ui.nota}</p>}
          <button
            onClick={guardar}
            disabled={busy}
            className="h-10 px-4 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold border-none cursor-pointer transition-colors inline-flex items-center gap-2 disabled:bg-[#F0F0F0] disabled:text-muted disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {guardado ? 'Guardado ✓' : 'Guardar ajustes'}
          </button>
        </div>
      )}
    </div>
  );
}

const TITULO_TIPO = {
  recordatorio_pago: 'Recordatorio de pago',
  resena: 'Reseña',
  encuesta: 'Encuesta',
  stock_bajo: 'Stock bajo',
  reengagement: 'Reenganche',
  reporte_semanal: 'Reporte semanal',
  recuperacion_pedido: 'Recuperación',
  renovacion_plan: 'Renovación',
  atencion_humana: 'Atención humana',
};

function HistorialYSatisfaccion() {
  const [historial, setHistorial] = useState([]);
  const [enc, setEnc] = useState(null);

  useEffect(() => {
    api.get('/automations/historial').then((r) => setHistorial(r.data.historial || [])).catch(() => {});
    api.get('/automations/encuestas').then((r) => setEnc(r.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      {enc && enc.total > 0 && (
        <div className="p-4 rounded-xl border border-border bg-white">
          <p className="text-text font-semibold text-sm mb-1">Satisfacción de tus clientes (últimos 90 días)</p>
          <p className="text-3xl font-bold text-text">
            {enc.promedio} <span className="text-base font-normal text-muted">/ 5 · {enc.total} respuesta{enc.total === 1 ? '' : 's'}</span>
          </p>
          <div className="mt-3 space-y-1">
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="flex items-center gap-2 text-xs text-muted">
                <span className="w-4">{n}★</span>
                <div className="flex-1 h-2 bg-bg2 rounded-full overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${(enc.distribucion[n] / enc.total) * 100}%` }} />
                </div>
                <span className="w-6 text-right">{enc.distribucion[n]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="p-4 rounded-xl border border-border bg-white">
        <p className="text-text font-semibold text-sm mb-3">Historial: lo último que hicieron tus automatizaciones</p>
        {historial.length === 0 ? (
          <p className="text-muted text-xs">Aún no hay actividad. Cuando una automatización envíe algo, lo verás aquí.</p>
        ) : (
          <ul className="space-y-2 list-none p-0 m-0 max-h-80 overflow-y-auto">
            {historial.map((h) => (
              <li key={h.id} className="text-xs flex gap-3">
                <span className="shrink-0 text-muted w-28">
                  {new Date(h.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                <span className="shrink-0 font-semibold text-text w-32">{TITULO_TIPO[h.tipo] || h.tipo}</span>
                <span className="text-muted min-w-0">{h.mensaje}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
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
  const [autos, setAutos] = useState([]);

  useEffect(() => {
    loadConfig();
    api
      .get('/automatizaciones')
      .then((r) => setAutos((r.data.automatizaciones || []).filter((a) => AUTO_UI[a.tipo])))
      .catch(() => {});
  }, []);

  function actualizarAuto(tipo, cambios) {
    setAutos((prev) => prev.map((a) => (a.tipo === tipo ? { ...a, ...cambios } : a)));
  }

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
      setMessage({ type: 'error', text: mensajeError(e, 'guardar la configuración') });
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
      setMessage({ type: 'error', text: mensajeError(e, 'guardar los agentes') });
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

        <AyudaRapida
          guia="automatizaciones"
          pasos={[
            'Arriba personalizas cómo habla tu bot (nombre, tono, bienvenida y horario) y pulsas Guardar.',
            'En “Agentes IA” enciendes las áreas que el bot debe atender; lo demás lo deriva a ti.',
            'Abajo enciendes tareas automáticas (recordatorios, reseñas, encuestas…). Todas empiezan apagadas; pulsa “Usar ejemplo” para llenar el mensaje.',
          ]}
        />

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

        {/* Sección 3: Automatizaciones que se ejecutan solas */}
        {autos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white border border-border rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-accent" />
              <h2 className="font-head text-xl font-bold text-text">Automatizaciones</h2>
            </div>
            <p className="text-muted text-sm mb-6">
              Tareas que tu bot hace solo por WhatsApp. Todas arrancan apagadas: nada le llega a un cliente hasta que
              tú la actives.
            </p>
            <div className="space-y-3">
              {autos.map((a) => (
                <AutomatizacionReal
                  key={a.tipo}
                  auto={a}
                  onChange={actualizarAuto}
                  onError={(text) => setMessage({ type: 'error', text })}
                  onAviso={(text) => setMessage({ type: 'success', text })}
                />
              ))}
              <div className="p-4 rounded-xl border border-border bg-white flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-bg2 flex items-center justify-center shrink-0">
                    <Send className="w-5 h-5 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-text font-semibold text-sm">Campañas de marketing</p>
                    <p className="text-muted text-xs">Mensajes masivos a tus clientes: ahora tienen su propia página.</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/campanas')}
                  className="h-10 px-4 rounded-xl bg-white border border-[#C9C9C9] text-sm font-semibold text-text cursor-pointer hover:bg-bg2"
                >
                  Ir a Campañas →
                </button>
              </div>
              <HistorialYSatisfaccion />
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>{showTest &&<TestBotModal onClose={() => setShowTest(false)} />}</AnimatePresence>
    </div>
  );
}
