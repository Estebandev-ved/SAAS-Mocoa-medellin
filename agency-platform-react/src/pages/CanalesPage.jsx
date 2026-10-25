import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Instagram, Send, Phone, Lock, CheckCircle2, Circle, ChevronRight, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import AyudaRapida from '../components/AyudaRapida';

const ORDEN_PLANES = ['emprendedor', 'starter', 'professional', 'enterprise'];
const NOMBRE_PLAN = { starter: 'Inicial', professional: 'Profesional', enterprise: 'Empresarial' };
const alcanza = (plan, minimo) => ORDEN_PLANES.indexOf(plan) >= ORDEN_PLANES.indexOf(minimo);

// Una tarjeta por canal por el que los clientes pueden escribir. Aquí se ve de un vistazo qué está conectado;
// el día a día de todos los canales vive en "Mensajes" (una sola bandeja).
export default function CanalesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const plan = user?.plan || 'starter';
  const [estado, setEstado] = useState({ whatsapp: null, instagram: null, telegram: null });
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      api.get('/whatsapp/status').then((r) => ({ conectado: !!r.data?.conectado, detalle: r.data?.numero || r.data?.telefono || null })).catch(() => null),
      api.get('/instagram/status').then((r) => ({ conectado: !!r.data?.connected, detalle: r.data?.nombre || null })).catch(() => null),
      api.get('/telegram/status').then((r) => ({ conectado: !!r.data?.connected, detalle: r.data?.bot_nombre || null })).catch(() => null),
    ]).then(([whatsapp, instagram, telegram]) => {
      if (vivo) { setEstado({ whatsapp, instagram, telegram }); setCargando(false); }
    });
    return () => { vivo = false; };
  }, []);

  const canales = [
    {
      id: 'whatsapp', nombre: 'WhatsApp', icono: Smartphone, ruta: '/whatsapp', estado: estado.whatsapp,
      descripcion: 'Tu bot atiende y vende por el WhatsApp de tu negocio. Escanea un código QR para vincularlo.',
      accionConectado: 'Ver conexión', accionDesconectado: 'Conectar WhatsApp',
    },
    {
      id: 'instagram', nombre: 'Instagram', icono: Instagram, ruta: '/multichannel', estado: estado.instagram, minimo: 'professional',
      descripcion: 'Responde los mensajes directos de tu Instagram con el mismo bot. Pronto: responder comentarios.',
      accionConectado: 'Ver conexión', accionDesconectado: 'Conectar Instagram', etiqueta: 'Beta',
    },
    {
      id: 'telegram', nombre: 'Telegram', icono: Send, ruta: '/multichannel', estado: estado.telegram, minimo: 'professional',
      descripcion: 'Un bot de Telegram para quienes prefieren ese canal. Se crea gratis con @BotFather.',
      accionConectado: 'Ver conexión', accionDesconectado: 'Conectar Telegram',
    },
    {
      id: 'llamadas', nombre: 'Llamadas', icono: Phone, ruta: '/voice', estado: null, minimo: 'enterprise',
      descripcion: 'Un asistente de voz que contesta llamadas con una voz natural.',
      accionConectado: 'Configurar', accionDesconectado: 'Configurar llamadas', sinEstado: true,
    },
  ];

  return (
    <div className="min-h-screen bg-bg p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-head text-2xl md:text-3xl font-bold text-text mb-1">Canales</h1>
        <p className="text-muted text-sm mb-5">Por dónde te escriben tus clientes. Conéctalos una vez; las conversaciones de todos llegan a <b>Mensajes</b>.</p>

        <AyudaRapida
          className="mb-5"
          guia="canales"
          pasos={[
            'Empieza por WhatsApp: es el canal principal de tu bot.',
            'Agrega Instagram o Telegram si tus clientes también te escriben ahí; las respuestas llegan a la misma bandeja de Mensajes.',
            'Cada canal usa el mismo bot, el mismo catálogo y tus respuestas automáticas.',
          ]}
        />

        {cargando && <div className="py-10 flex justify-center text-muted"><Loader2 className="w-6 h-6 animate-spin" aria-label="Cargando" /></div>}

        <div className="grid sm:grid-cols-2 gap-4">
          {canales.map((c) => {
            const Icono = c.icono;
            const bloqueado = c.minimo && !alcanza(plan, c.minimo);
            const conectado = c.estado?.conectado;
            return (
              <article key={c.id} className="bg-bg2 border border-border rounded-2xl p-5 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center"><Icono size={22} aria-hidden="true" /></div>
                    <div>
                      <h2 className="font-head text-lg text-text m-0 flex items-center gap-2">
                        {c.nombre}
                        {c.etiqueta && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-warn/15 text-warn-text font-semibold">{c.etiqueta}</span>}
                      </h2>
                      {!c.sinEstado && !bloqueado && (
                        <p className={`text-xs m-0 mt-0.5 inline-flex items-center gap-1 ${conectado ? 'text-success' : 'text-muted'}`}>
                          {conectado ? <CheckCircle2 size={13} aria-hidden="true" /> : <Circle size={13} aria-hidden="true" />}
                          {conectado ? `Conectado${c.estado.detalle ? ` · ${c.estado.detalle}` : ''}` : (c.estado === null && !cargando ? 'No se pudo consultar' : 'Sin conectar')}
                        </p>
                      )}
                      {bloqueado && <p className="text-xs m-0 mt-0.5 text-muted inline-flex items-center gap-1"><Lock size={12} aria-hidden="true" /> Desde el plan {NOMBRE_PLAN[c.minimo]}</p>}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted mt-3 flex-1">{c.descripcion}</p>
                <button
                  type="button"
                  onClick={() => navigate(bloqueado ? '/suscripcion' : c.ruta)}
                  className={`mt-4 min-h-[44px] rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1 cursor-pointer border ${
                    bloqueado ? 'bg-transparent border-border text-text' : conectado ? 'bg-transparent border-border text-text' : 'bg-accent border-accent text-white'
                  }`}
                >
                  {bloqueado ? 'Mejorar mi plan' : (conectado ? c.accionConectado : c.accionDesconectado)}
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
