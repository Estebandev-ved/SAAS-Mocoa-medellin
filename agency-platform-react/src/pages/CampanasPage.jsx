import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, Lock, Sparkles, CheckCheck, Clock } from 'lucide-react';
import api from '../services/api';
import TipNova from '../components/TipNova';
import AyudaRapida from '../components/AyudaRapida';
import EmptyState from '../components/EmptyState';
import FeedbackMessage from '../components/FeedbackMessage';
import { mensajeError } from '../utils/errores';
import { useUndo } from '../context/UndoContext';

// Misma regla que el backend (campaignSender.personalizar): {nombre} → primer nombre del cliente
const personalizar = (texto, nombre) => {
  const primer = String(nombre || '').trim().split(/\s+/)[0] || '';
  const t = String(texto || '').replace(/\{nombre\}/gi, primer);
  return primer ? t : t.replace(/[ \t]+([,.!¡?¿])/g, '$1').replace(/^[,\s]+/, '').replace(/ {2,}/g, ' ');
};

// Burbuja tal como la verá el cliente en WhatsApp
function VistaPrevia({ mensaje, alcance }) {
  const texto = personalizar(mensaje, 'María') || 'Aquí verás tu mensaje tal como lo recibirá el cliente.';
  const minutos = alcance ? Math.max(1, Math.round((alcance * 3.5) / 60)) : null;
  return (
    <aside aria-label="Vista previa del mensaje" className="rounded-2xl border border-border bg-bg2 p-4 lg:sticky lg:top-4 self-start">
      <p className="text-xs font-semibold tracking-[0.04em] uppercase text-muted mb-3 m-0">Así lo verá tu cliente</p>
      <div className="rounded-xl bg-[#E9E4DA] p-3 min-h-[120px] flex flex-col justify-end">
        <div className="self-start max-w-[92%] bg-[#FFFFFF] text-[#1A1A1A] rounded-2xl rounded-bl-md px-3 py-2 text-[13px] leading-5 shadow-sm whitespace-pre-wrap break-words">
          {texto}
          <span className="flex items-center justify-end gap-1 text-[10px] text-[#666] mt-1">
            ahora <CheckCheck size={12} className="text-info" />
          </span>
        </div>
      </div>
      <p className="text-xs text-muted mt-3 m-0 leading-5">
        Ejemplo con el cliente “María”. Escribe <code className="bg-bg3 px-1 rounded">{'{nombre}'}</code> para saludar por su nombre.
      </p>
      {alcance !== null && alcance > 0 && (
        <p className="text-xs text-muted mt-2 m-0 flex items-center gap-1.5">
          <Clock size={12} /> {alcance} destinatario(s) · se envía en unos {minutos} min, con pausas entre mensajes.
        </p>
      )}
    </aside>
  );
}

const LABEL = 'block text-sm font-semibold text-text mb-2';
const CONTROL =
  'w-full h-11 bg-white border border-[#C9C9C9] rounded-xl px-4 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors';

const ESTADO = {
  borrador: 'Borrador',
  programada: 'Programada',
  enviando: 'Enviando…',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

// Mensajes de ejemplo listos para usar (el dueño los edita antes de enviar).
const EJEMPLOS = {
  todos: {
    nombre: 'Promoción de la semana',
    mensaje: '¡Hola! 👋 Esta semana tenemos una promoción especial para nuestros clientes. Escríbenos y te contamos los detalles. ¡Te esperamos!',
  },
  inactivos: {
    nombre: 'Te extrañamos',
    mensaje: '¡Hola! Hace tiempo no sabemos de ti y te extrañamos 💛. Vuelve esta semana y te tenemos una sorpresa. Escríbenos y pide lo que quieras.',
  },
  nuevos: {
    nombre: 'Bienvenida a clientes nuevos',
    mensaje: '¡Hola! Gracias por escribirnos por primera vez 🙌. Si repites tu pedido esta semana, te tenemos un detalle. ¡Escríbenos!',
  },
};

export default function CampanasPage() {
  const navigate = useNavigate();
  const { diferir } = useUndo();
  const [plan, setPlan] = useState(null);
  const [lista, setLista] = useState(null);
  const [form, setForm] = useState({ nombre: '', mensaje: '', segmento: 'todos', dias: 30, fecha: '' });
  const [alcance, setAlcance] = useState(null);
  const [maximo, setMaximo] = useState(200);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const disponible = ['professional', 'enterprise'].includes(plan);

  useEffect(() => {
    api
      .get('/suscripcion/actual')
      .then((r) => setPlan(r.data.plan || 'starter'))
      .catch(() => setPlan('starter'));
  }, []);

  async function cargar() {
    try {
      const r = await api.get('/campañas');
      setLista(r.data.campañas || []);
    } catch (e) {
      setLista([]);
    }
  }

  useEffect(() => {
    if (disponible) cargar();
  }, [disponible]);

  // Hay campañas en curso: refresca el avance cada 10 s.
  useEffect(() => {
    if (!lista?.some((c) => ['programada', 'enviando'].includes(c.estado))) return undefined;
    const t = setInterval(cargar, 10000);
    return () => clearInterval(t);
  }, [lista]);

  useEffect(() => {
    if (!disponible) return;
    api
      .get('/campañas-destinatarios', { params: { segmento: form.segmento, dias: form.dias } })
      .then((r) => {
        setAlcance(r.data.total);
        if (r.data.maximo) setMaximo(r.data.maximo);
      })
      .catch(() => setAlcance(null));
  }, [disponible, form.segmento, form.dias]);

  function usarEjemplo() {
    const e = EJEMPLOS[form.segmento];
    setForm((p) => ({ ...p, nombre: e.nombre, mensaje: e.mensaje }));
  }

  async function crear(ev) {
    ev.preventDefault();
    if (!form.nombre.trim() || !form.mensaje.trim()) {
      return setMsg({ type: 'error', text: 'Escribe un nombre y un mensaje. Si no sabes qué poner, pulsa “Usar ejemplo”.' });
    }
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/campañas', {
        nombre: form.nombre,
        mensaje: form.mensaje,
        segmento: form.segmento,
        segmento_config: ['inactivos', 'nuevos'].includes(form.segmento) ? { dias: Number(form.dias) } : {},
        fecha_envio: form.fecha ? new Date(form.fecha).toISOString().slice(0, 19).replace('T', ' ') : null,
      });
      setForm({ nombre: '', mensaje: '', segmento: 'todos', dias: 30, fecha: '' });
      setMsg({
        type: 'success',
        text: form.fecha
          ? 'Campaña programada. Saldrá en la fecha elegida; mientras tanto puedes cancelarla desde la lista.'
          : 'Campaña creada. Empieza a enviarse en menos de un minuto, con pausas entre mensajes para cuidar tu número. Mira el avance abajo.',
      });
      cargar();
    } catch (e) {
      setMsg({ type: 'error', text: mensajeError(e, 'crear la campaña') });
    } finally {
      setBusy(false);
    }
  }

  // Cancelar con margen para arrepentirse: la campaña se ve cancelada de inmediato, pero el
  // servidor recibe la orden pasados unos segundos (y mientras tanto puede seguir saliendo).
  function cancelar(id) {
    const antes = (lista || []).find((c) => c.id === id)?.estado;
    const poner = (estado) => setLista((l) => (l || []).map((c) => (c.id === id ? { ...c, estado } : c)));
    poner('cancelada');
    diferir({
      mensaje: 'Campaña cancelada',
      onDeshacer: () => poner(antes),
      onConfirmar: async () => {
        await api.post(`/campañas/${id}/cancelar`);
        cargar();
      },
    });
  }

  return (
    <div className="min-h-screen bg-bg2 p-6 lg:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            aria-label="Volver al panel"
            className="w-11 h-11 rounded-xl bg-white border border-border flex items-center justify-center cursor-pointer hover:border-[#C9C9C9] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>
          <div>
            <h1 className="font-head text-3xl font-bold text-text tracking-tight">Campañas</h1>
            <p className="text-muted text-sm mt-1">Mensajes de marketing a tus clientes por WhatsApp</p>
          </div>
        </div>

        <AyudaRapida
          guia="campanas"
          pasos={[
            'Pulsa “Usar ejemplo” (o escribe tu mensaje) y elige a quién enviarlo.',
            'Mira cuántos clientes lo recibirán. Solo reciben quienes aceptaron marketing; el máximo es 200 por campaña.',
            'Pulsa Enviar (sale en menos de un minuto) o elige una fecha para programarla. Puedes cancelarla mientras no termine.',
          ]}
        />

        <TipNova id="campanas">
          Una buena campaña es corta, amable y tiene una razón para responder: una oferta, un cupón o una novedad.
        </TipNova>

        {msg && <FeedbackMessage type={msg.type}>{msg.text}</FeedbackMessage>}

        {plan && !disponible ? (
          <EmptyState
            character="nova"
            title="Las campañas son del plan Professional"
            description="Con Professional puedes enviar mensajes masivos a tus clientes. Mientras tanto, usa las automatizaciones (recordatorios, reseñas, encuestas)."
            className="bg-white border border-border rounded-2xl"
            action={
              <div className="flex gap-2 justify-center flex-wrap">
                <button
                  onClick={() => navigate('/suscripcion')}
                  className="h-11 px-5 rounded-xl bg-accent text-white text-sm font-semibold border-none cursor-pointer inline-flex items-center gap-2"
                >
                  <Lock size={14} /> Ver planes
                </button>
                <button
                  onClick={() => navigate('/automatizaciones')}
                  className="h-11 px-5 rounded-xl bg-white border border-[#C9C9C9] text-text text-sm font-semibold cursor-pointer"
                >
                  Ir a Automatizaciones
                </button>
              </div>
            }
          />
        ) : (
          <>
            <div className="grid lg:grid-cols-[1fr_300px] gap-4">
            <form onSubmit={crear} className="bg-white border border-border rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-accent" />
                  <h2 className="font-head text-xl font-bold text-text">Nueva campaña</h2>
                </div>
                <button
                  type="button"
                  onClick={usarEjemplo}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#FDECEA] border border-accent/20 text-xs font-semibold text-accent cursor-pointer hover:bg-accent-dim"
                >
                  <Sparkles className="w-3 h-3" /> Usar ejemplo
                </button>
              </div>

              <div>
                <label className={LABEL}>¿A quién se la envías?</label>
                <select value={form.segmento} onChange={(e) => setForm((p) => ({ ...p, segmento: e.target.value }))} className={CONTROL}>
                  <option value="todos">Todos mis clientes</option>
                  <option value="inactivos">Clientes que no compran hace tiempo</option>
                  <option value="nuevos">Clientes nuevos</option>
                </select>
              </div>
              {['inactivos', 'nuevos'].includes(form.segmento) && (
                <div>
                  <label className={LABEL}>{form.segmento === 'inactivos' ? 'Sin comprar hace más de (días)' : 'Que llegaron en los últimos (días)'}</label>
                  <input type="number" min={1} max={365} value={form.dias} onChange={(e) => setForm((p) => ({ ...p, dias: e.target.value }))} className={CONTROL} />
                </div>
              )}
              <div>
                <label className={LABEL}>Nombre (solo para ti)</label>
                <input value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Promo de fin de semana" className={CONTROL} />
              </div>
              <div>
                <label className={LABEL}>Mensaje que recibirán</label>
                <textarea
                  value={form.mensaje}
                  onChange={(e) => setForm((p) => ({ ...p, mensaje: e.target.value }))}
                  placeholder="Escribe el mensaje, o pulsa “Usar ejemplo”"
                  rows={4}
                  maxLength={1000}
                  className={`${CONTROL} h-auto py-3 resize-none`}
                />
                <div className="flex items-center justify-between mt-1">
                  <button type="button" onClick={() => setForm((p) => ({ ...p, mensaje: `${p.mensaje}{nombre}` }))} className="h-8 px-2.5 rounded-lg bg-bg2 border border-border text-xs font-semibold text-muted cursor-pointer">
                    + Nombre del cliente
                  </button>
                  <span className="text-xs text-muted">{form.mensaje.length}/1000</span>
                </div>
              </div>
              <div>
                <label className={LABEL}>Cuándo enviarla (déjalo vacío para enviarla ya)</label>
                <input type="datetime-local" value={form.fecha} onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))} className={CONTROL} />
              </div>

              {alcance !== null && (
                <p className="text-sm text-muted">
                  Llegará a <strong className="text-text">{alcance}</strong> cliente(s) que aceptaron marketing.
                </p>
              )}
              {alcance === 0 && (
                <p className="text-xs text-danger">
                  Nadie en este grupo aceptó recibir marketing todavía. Los clientes lo aceptan cuando le escriben por primera vez al bot.
                </p>
              )}
              {alcance !== null && alcance > maximo && (
                <p className="text-xs text-danger">
                  El máximo por campaña es {maximo} clientes (protege tu número de WhatsApp). Reduce los días o el grupo.
                </p>
              )}

              <button
                type="submit"
                disabled={busy || (alcance !== null && (alcance > maximo || alcance === 0))}
                className="h-11 px-5 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold border-none cursor-pointer transition-colors inline-flex items-center gap-2 disabled:bg-[#F0F0F0] disabled:text-muted disabled:cursor-not-allowed"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {form.fecha ? 'Programar campaña' : 'Enviar campaña'}
              </button>
              {busy || !(alcance !== null && (alcance > maximo || alcance === 0)) ? null : (
                <p className="text-xs text-muted m-0">El botón está desactivado porque {alcance === 0 ? 'nadie en este grupo aceptó marketing' : `el grupo supera el máximo de ${maximo} clientes`}.</p>
              )}
            </form>
            <VistaPrevia mensaje={form.mensaje} alcance={alcance} />
            </div>

            <div className="bg-white border border-border rounded-2xl p-6">
              <h2 className="font-head text-xl font-bold text-text mb-4">Tus campañas</h2>
              {lista === null ? (
                <Loader2 className="animate-spin text-accent" />
              ) : lista.length === 0 ? (
                <EmptyState
                  character="sofia"
                  size={110}
                  className="py-6"
                  title="Aún no has enviado campañas"
                  description="Tu primera campaña puede ser tan simple como avisar de una promoción. Pulsa “Usar ejemplo” arriba para empezar."
                  action={
                    <button
                      onClick={usarEjemplo}
                      className="h-10 px-4 rounded-xl bg-accent text-white text-sm font-semibold border-none cursor-pointer"
                    >
                      Llenar con un ejemplo
                    </button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {lista.slice(0, 20).map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="text-text font-semibold truncate">{c.nombre}</p>
                        <p className="text-xs text-muted">
                          {ESTADO[c.estado] || c.estado} · {c.total_enviados}/{c.total_destinatarios} enviados
                          {c.total_fallidos > 0 ? ` · ${c.total_fallidos} fallidos` : ''}
                        </p>
                      </div>
                      {['programada', 'enviando'].includes(c.estado) && (
                        <button
                          onClick={() => cancelar(c.id)}
                          className="h-9 px-3 rounded-lg border border-border bg-white text-xs font-semibold text-text cursor-pointer hover:bg-bg2"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
