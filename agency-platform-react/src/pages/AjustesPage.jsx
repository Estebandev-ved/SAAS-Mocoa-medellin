import Toast from '../components/Toast';
import TipNova from '../components/TipNova';
import AvatarEditor from '../components/avatar/AvatarEditor';
import OwnerAvatar from '../components/avatar/OwnerAvatar';
import Illustration from '../components/Illustration';
import { sanitizeAvatar } from '../components/avatar/avatarConfig';
import { exportAvatarPng } from '../components/avatar/exportAvatar';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Loader2,
  Store,
  Bot,
  MessageSquare,
  CreditCard,
  Bell,
  Shield,
  Save,
  Eye,
  EyeOff,
  LogOut,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Wifi,
  WifiOff,
  Building2,
  Globe,
  Mail,
  Phone,
  MapPin,
  Hash,
  FileText,
  Users,
  Clock,
  Palette,
  MessageCircle,
  Smartphone,
  CreditCard as CreditCardIcon,
  ExternalLink,
  BellRing,
  BellOff,
  MailIcon,
  AlertTriangle,
  Lock,
  Key,
  Info,
  ArrowLeft,
  Smile,
  Download,
} from 'lucide-react';

const TABS = [
  { id: 'negocio', label: 'Negocio', icon: Store },
  { id: 'avatar', label: 'Avatar', icon: Smile },
  { id: 'bot', label: 'Bot', icon: Bot },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { id: 'pago', label: 'Pago', icon: CreditCard },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell },
  { id: 'seguridad', label: 'Seguridad', icon: Shield },
];

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <Illustration name="carga" size={170} alt="Cargando" />
    </div>
  );
}

// Tarjeta (design.md): blanca, radio lg, borde 1px, relleno 32px
function GlassCard({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-border p-8 ${className}`}>
      {children}
    </div>
  );
}

// Etiqueta arriba en label-lg con 8px de separación
function FormField({ label, icon: Icon, children }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-semibold text-text">
        {Icon && <Icon className="w-4 h-4 text-muted" />}
        {label}
      </label>
      {children}
    </div>
  );
}

const CONTROL =
  'w-full h-11 bg-white border border-[#C9C9C9] rounded-xl px-4 text-text text-sm placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors';

function InputField({ icon: Icon, ...props }) {
  return (
    <div className="relative">
      {Icon && (
        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
      )}
      <input className={`${CONTROL} ${Icon ? 'pl-11' : ''}`} {...props} />
    </div>
  );
}

function SelectField({ icon: Icon, options, ...props }) {
  return (
    <div className="relative">
      {Icon && (
        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
      )}
      <select className={`${CONTROL} appearance-none ${Icon ? 'pl-11' : ''}`} {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm text-text">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full border-none cursor-pointer transition-colors ${
          checked ? 'bg-accent' : 'bg-[#C9C9C9]'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}

function NegocioTab() {
  const [form, setForm] = useState({
    nombre: '',
    email_dueno: '',
    whatsapp: '',
    nit: '',
    razon_social: '',
    tipo_negocio: '',
    ciudad: '',
    departamento: '',
    direccion: '',
    telefono: '',
    sitio_web: '',
    descripcion_negocio: '',
    numero_empleados: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  // La dirección del local solo sirve para el punto de recogida de los domicilios,
  // así que solo se pide en planes que los incluyen (mismo criterio que DomiciliosPage).
  const [conDomicilios, setConDomicilios] = useState(false);

  useEffect(() => {
    api
      .get('/business/plan')
      .then((res) => setConDomicilios((res.data?.plan?.tipo || 'starter') !== 'starter'))
      .catch(() => {});
    api
      .get('/business/perfil')
      .then((res) => {
        const n = res.data.negocio || res.data;
        setForm((prev) => ({ ...prev, ...n }));
      })
      .catch(() => setToast({ type: 'error', message: 'Error al cargar perfil' }))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/business/perfil', form);
      setToast({ type: 'success', message: 'Perfil actualizado correctamente' });
    } catch {
      setToast({ type: 'error', message: 'Error al guardar cambios' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
      <TipNova id="ajustes">Configura acá los datos de tu negocio, tu avatar, cómo responde el bot y a qué números. Los cambios se guardan por sección — no olvides el botón "Guardar" de cada pestaña.</TipNova>
      <GlassCard>
        <h3 className="font-head text-xl text-text mb-6 flex items-center gap-3">
          <Building2 className="w-5 h-5 text-accent" />
          Información del Negocio
        </h3>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Nombre del Negocio" icon={Store}>
              <InputField
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Mi negocio"
              />
            </FormField>
            <FormField label="Email del Dueño" icon={Mail}>
              <InputField
                name="email_dueno"
                type="email"
                value={form.email_dueno}
                onChange={handleChange}
                placeholder="dueño@negocio.com"
              />
            </FormField>
            <FormField label="WhatsApp" icon={Smartphone}>
              <InputField
                name="whatsapp"
                value={form.whatsapp}
                onChange={handleChange}
                placeholder="+57 300 123 4567"
              />
            </FormField>
            <FormField label="Tipo de Negocio" icon={Info}>
              <InputField
                name="tipo_negocio"
                value={form.tipo_negocio}
                onChange={handleChange}
                placeholder="Restaurante, Tienda, etc."
              />
            </FormField>
            <FormField label="Ciudad" icon={MapPin}>
              <InputField
                name="ciudad"
                value={form.ciudad}
                onChange={handleChange}
                placeholder="Bogotá"
              />
            </FormField>
            <FormField label="Departamento" icon={MapPin}>
              <InputField
                name="departamento"
                value={form.departamento}
                onChange={handleChange}
                placeholder="Cundinamarca"
              />
            </FormField>
            {conDomicilios && (
              <FormField label="Dirección del local (punto de recogida de domicilios)" icon={MapPin}>
                <InputField
                  name="direccion"
                  value={form.direccion}
                  onChange={handleChange}
                  placeholder="Calle 123 #45-67"
                />
              </FormField>
            )}
            <FormField label="Teléfono" icon={Phone}>
              <InputField
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                placeholder="+57 601 123 4567"
              />
            </FormField>
            <FormField label="Sitio Web" icon={Globe}>
              <InputField
                name="sitio_web"
                value={form.sitio_web}
                onChange={handleChange}
                placeholder="https://minegocio.com"
              />
            </FormField>
            <FormField label="Número de Empleados" icon={Users}>
              <InputField
                name="numero_empleados"
                type="number"
                value={form.numero_empleados}
                onChange={handleChange}
                placeholder="10"
              />
            </FormField>
          </div>
          <FormField label="Descripción del Negocio" icon={Info}>
            <textarea
              name="descripcion_negocio"
              value={form.descripcion_negocio}
              onChange={handleChange}
              rows={3}
              placeholder="Describe tu negocio..."
              className="w-full bg-white border border-[#C9C9C9] rounded-xl px-4 py-3 text-text text-sm font-body placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none"
            />
          </FormField>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent/90 disabled:opacity-50 text-text font-head font-semibold rounded-xl transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Guardar Cambios
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

function AvatarTab() {
  const { user, updateUser } = useAuth();
  const [avatar, setAvatar] = useState(() => sanitizeAvatar(user?.avatar));
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState(null);
  const exportRef = useRef(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put('/business/avatar', { avatar });
      updateUser({ avatar: res.data.avatar });
      setToast({ type: 'success', message: 'Avatar actualizado' });
    } catch {
      setToast({ type: 'error', message: 'Error al guardar el avatar' });
    } finally {
      setSaving(false);
    }
  };

  // Descarga el avatar como PNG (foto de perfil de WhatsApp, firmas de correo, etc.)
  // — el SVG por sí solo no sirve para eso. Se exporta desde un nodo aparte, oculto,
  // en vez del que ve el usuario en la vista previa, para no depender de qué tan
  // grande esté renderizado ese SVG en pantalla.
  const handleDownload = async () => {
    const svgEl = exportRef.current?.querySelector('svg');
    if (!svgEl) return;
    setDownloading(true);
    try {
      await exportAvatarPng(svgEl, 'mi-avatar-noma.png');
    } catch {
      setToast({ type: 'error', message: 'No se pudo generar la imagen' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-8">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      <GlassCard>
        <h3 className="font-head text-xl text-text mb-2 flex items-center gap-3">
          <Smile className="w-5 h-5 text-accent" />
          Tu personaje
        </h3>
        <p className="text-muted text-sm mb-8 max-w-xl">
          Es la cara que te saluda en el panel. Hazlo parecido a ti: cuerpo, piel, pelo, barba, gafas, aretes, pecas, gorra, tatuajes y ropa.
        </p>
        <AvatarEditor value={avatar} onChange={setAvatar} />
        <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }} aria-hidden="true">
          <div ref={exportRef}>
            <OwnerAvatar config={avatar} variant="busto" height={480} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-8">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="h-11 px-6 rounded-xl bg-white hover:bg-bg2 text-text text-sm font-semibold inline-flex items-center gap-2 border border-[#C9C9C9] cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Descargar imagen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-11 px-6 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold inline-flex items-center gap-2 border-none cursor-pointer transition-colors disabled:bg-[#F0F0F0] disabled:text-muted disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar avatar
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

function BotTab() {
  const [form, setForm] = useState({
    bot_nombre: '',
    bot_tono: 'amigable',
    bot_bienvenida: '',
    mensaje_fuera_horario: '',
    horario_inicio: '09:00',
    horario_fin: '18:00',
    descripcion_negocio: '',
    productos_servicios: '',
    info_pagos: '',
    politicas: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [whitelistMode, setWhitelistMode] = useState('todos');
  const [whitelistNumbers, setWhitelistNumbers] = useState([]);
  const [newNumber, setNewNumber] = useState('');
  const [savingWhitelist, setSavingWhitelist] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/bot/config').then((res) => {
        const b = res.data.bot || res.data;
        setForm((prev) => ({ ...prev, ...b }));
      }),
      api.get('/bot/whitelist').then((res) => {
        setWhitelistMode(res.data.modo);
        setWhitelistNumbers(res.data.numeros);
      }),
    ]).catch(() =>
      setToast({ type: 'error', message: 'Error al cargar configuración' })
    ).finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/bot/config', form);
      setToast({ type: 'success', message: 'Bot actualizado correctamente' });
    } catch {
      setToast({ type: 'error', message: 'Error al guardar configuración' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
      <GlassCard>
        <h3 className="font-head text-xl text-text mb-6 flex items-center gap-3">
          <Bot className="w-5 h-5 text-accent" />
          Configuración del Bot
        </h3>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Nombre del Bot" icon={Bot}>
              <InputField
                name="bot_nombre"
                value={form.bot_nombre}
                onChange={handleChange}
                placeholder="Asistente Virtual"
              />
            </FormField>
            <FormField label="Tono del Bot" icon={Palette}>
              <SelectField
                name="bot_tono"
                value={form.bot_tono}
                onChange={handleChange}
                options={[
                  { value: 'formal', label: 'Formal' },
                  { value: 'amigable', label: 'Amigable' },
                  { value: 'casual', label: 'Casual' },
                ]}
              />
            </FormField>
          </div>
          <FormField label="Mensaje de Bienvenida" icon={MessageCircle}>
            <textarea
              name="bot_bienvenida"
              value={form.bot_bienvenida}
              onChange={handleChange}
              rows={3}
              placeholder="¡Hola! Bienvenido a nuestro negocio. ¿En qué puedo ayudarte?"
              className="w-full bg-white border border-[#C9C9C9] rounded-xl px-4 py-3 text-text text-sm font-body placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none"
            />
          </FormField>
          <FormField label="Mensaje Fuera de Horario" icon={Clock}>
            <textarea
              name="mensaje_fuera_horario"
              value={form.mensaje_fuera_horario}
              onChange={handleChange}
              rows={3}
              placeholder="Gracias por escribirnos. Nuestro horario de atención es de 9am a 6pm..."
              className="w-full bg-white border border-[#C9C9C9] rounded-xl px-4 py-3 text-text text-sm font-body placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none"
            />
          </FormField>

          <div className="border-t border-border pt-6 mt-6">
            <h4 className="font-head text-lg text-text mb-4 flex items-center gap-2">
              <Store className="w-4 h-4 text-accent" />
              Información del Negocio (para el bot)
            </h4>
            <p className="text-xs text-muted mb-4 font-body">
              El bot usa esta información para responder a tus clientes.
            </p>
          </div>

          <FormField label="Descripción del Negocio" icon={Store}>
            <textarea
              name="descripcion_negocio"
              value={form.descripcion_negocio}
              onChange={handleChange}
              rows={2}
              placeholder="Ej: Empresa de contabilidad y asesoría tributaria..."
              className="w-full bg-white border border-[#C9C9C9] rounded-xl px-4 py-3 text-text text-sm font-body placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none"
            />
          </FormField>
          <FormField label="Productos y Servicios" icon={FileText}>
            <textarea
              name="productos_servicios"
              value={form.productos_servicios}
              onChange={handleChange}
              rows={3}
              placeholder="Ej: Servicios contables, Declaración de renta, Asesoría tributaria..."
              className="w-full bg-white border border-[#C9C9C9] rounded-xl px-4 py-3 text-text text-sm font-body placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none"
            />
            <p className="text-xs text-muted font-body">
              Solo se usa si tu pestaña "Productos" está vacía — si ya cargaste tu catálogo ahí, el bot usa esos productos y este texto se ignora.
            </p>
          </FormField>
          <FormField label="Información de Pagos" icon={CreditCard}>
            <textarea
              name="info_pagos"
              value={form.info_pagos}
              onChange={handleChange}
              rows={2}
              placeholder="Ej: Nequi: 3001234567, Bancolombia: 1234567890..."
              className="w-full bg-white border border-[#C9C9C9] rounded-xl px-4 py-3 text-text text-sm font-body placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none"
            />
          </FormField>
          <FormField label="Políticas" icon={Shield}>
            <textarea
              name="politicas"
              value={form.politicas}
              onChange={handleChange}
              rows={2}
              placeholder="Ej: Delivery en 30 min, Garantía 7 días, Factura electrónica..."
              className="w-full bg-white border border-[#C9C9C9] rounded-xl px-4 py-3 text-text text-sm font-body placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none"
            />
          </FormField>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Horario de Inicio" icon={Clock} mono>
              <InputField
                name="horario_inicio"
                type="time"
                value={form.horario_inicio}
                onChange={handleChange}
              />
            </FormField>
            <FormField label="Horario de Fin" icon={Clock} mono>
              <InputField
                name="horario_fin"
                type="time"
                value={form.horario_fin}
                onChange={handleChange}
              />
            </FormField>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent/90 disabled:opacity-50 text-text font-head font-semibold rounded-xl transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Guardar Configuración
            </button>
          </div>
        </form>
      </GlassCard>

      <GlassCard>
        <h3 className="font-head text-xl text-text mb-2 flex items-center gap-3">
          <Shield className="w-5 h-5 text-warn-text" />
          Control de Chats
        </h3>
        <p className="text-sm text-muted mb-6 font-body">
          Decide a qué chats les responde el bot. Útil para pruebas o restricciones.
        </p>

        <div className="space-y-5">
          <FormField label="Modo del Bot" icon={Shield}>
            <SelectField
              value={whitelistMode}
              onChange={(e) => setWhitelistMode(e.target.value)}
              options={[
                { value: 'todos', label: 'Responder a todos' },
                { value: 'whitelist', label: 'Solo números permitidos (Whitelist)' },
              ]}
            />
          </FormField>

          {whitelistMode === 'whitelist' && (
            <>
              <FormField label="Números Permitidos" icon={Phone}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newNumber}
                    onChange={(e) => setNewNumber(e.target.value)}
                    placeholder="Ej: 573208303600 (sin + ni espacios)"
                    className="flex-1 bg-white border border-[#C9C9C9] rounded-xl px-4 py-3 text-text text-sm font-body placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newNumber && /^\d+$/.test(newNumber) && !whitelistNumbers.includes(newNumber)) {
                          setWhitelistNumbers([...whitelistNumbers, newNumber]);
                          setNewNumber('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newNumber && /^\d+$/.test(newNumber) && !whitelistNumbers.includes(newNumber)) {
                        setWhitelistNumbers([...whitelistNumbers, newNumber]);
                        setNewNumber('');
                      }
                    }}
                    className="px-4 py-3 bg-bg3 hover:bg-bg3/80 text-text text-sm font-body rounded-xl border border-border transition-colors"
                  >
                    Agregar
                  </button>
                </div>
              </FormField>

              {whitelistNumbers.length > 0 ? (
                <div className="space-y-2">
                  {whitelistNumbers.map((num, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-white border border-[#C9C9C9] rounded-xl px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-muted" />
                        <span className="text-text text-sm font-body">+{num}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWhitelistNumbers(whitelistNumbers.filter((_, i) => i !== idx))}
                        className="text-danger-text hover:text-danger-text text-xs font-body transition-colors"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-[#C9C9C9] rounded-xl px-4 py-3 text-center">
                  <p className="text-muted text-sm font-body">Sin números. El bot no responderá a nadie.</p>
                </div>
              )}

              <p className="text-xs text-muted font-body">
                Solo los números en esta lista recibirán respuestas del bot. Los demás mensajes serán ignorados.
              </p>
            </>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={savingWhitelist}
              onClick={async () => {
                setSavingWhitelist(true);
                try {
                  await api.put('/bot/whitelist', { modo: whitelistMode, numeros: whitelistNumbers });
                  setToast({ type: 'success', message: 'Control de chats actualizado' });
                } catch {
                  setToast({ type: 'error', message: 'Error al guardar control de chats' });
                } finally {
                  setSavingWhitelist(false);
                }
              }}
              className="flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent/90 disabled:opacity-50 text-text font-head font-semibold rounded-xl transition-colors"
            >
              {savingWhitelist ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Guardar Control de Chats
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function WhatsAppTab() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/business/whatsapp/status');
      setStatus(res.data);
    } catch {
      setToast({ type: 'error', message: 'Error al obtener estado de WhatsApp' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = async () => {
    setActionLoading(true);
    try {
      await api.post('/business/whatsapp/connect');
      setToast({ type: 'success', message: 'Conectando WhatsApp...' });
      fetchStatus();
    } catch {
      setToast({ type: 'error', message: 'Error al conectar WhatsApp' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading(true);
    try {
      await api.post('/business/whatsapp/disconnect');
      setToast({ type: 'success', message: 'WhatsApp desconectado' });
      fetchStatus();
    } catch {
      setToast({ type: 'error', message: 'Error al desconectar WhatsApp' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const isConnected = status?.connected || false;

  return (
    <div className="space-y-8">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
      <GlassCard>
        <h3 className="font-head text-xl text-text mb-6 flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-accent" />
          Estado de WhatsApp
        </h3>
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-5 rounded-xl bg-white border border-[#C9C9C9]">
            {isConnected ? (
              <Wifi className="w-8 h-8 text-success" />
            ) : (
              <WifiOff className="w-8 h-8 text-danger-text" />
            )}
            <div>
              <p className="font-head text-text">
                {isConnected ? 'Conectado' : 'Desconectado'}
              </p>
              <p className="text-sm font-body text-muted">
                {isConnected
                  ? 'Tu bot está activo en WhatsApp'
                  : 'Conecta tu número para activar el bot'}
              </p>
            </div>
            <div className="ml-auto">
              <span
                className={`inline-block w-3 h-3 rounded-full ${
                  isConnected ? 'bg-success animate-pulse' : 'bg-danger'
                }`}
              />
            </div>
          </div>

          {!isConnected && status?.qr && (
            <div className="flex flex-col items-center gap-4 p-8 rounded-xl bg-white border border-[#C9C9C9]">
              <QrCode className="w-6 h-6 text-muted" />
              <p className="font-head text-sm text-text/70">
                Escanea el código QR con tu WhatsApp
              </p>
              <div className="w-56 h-56 bg-white rounded-2xl p-4 flex items-center justify-center">
                <img
                  src={status.qr}
                  srcSet={status.qr}
                  alt="QR Code"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}

          <div className="flex gap-4">
            {!isConnected ? (
              <button
                onClick={handleConnect}
                disabled={actionLoading}
                className="flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent/90 disabled:opacity-50 text-text font-head font-semibold rounded-xl transition-colors"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
                Conectar WhatsApp
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                disabled={actionLoading}
                className="flex items-center gap-2 px-6 py-3 bg-bg3 hover:bg-bg disabled:opacity-50 text-danger-text border border-danger/30 font-head font-semibold rounded-xl transition-colors"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <WifiOff className="w-4 h-4" />
                )}
                Desconectar
              </button>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function PagoTab() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [facturacion, setFacturacion] = useState({ nit: '', razon_social: '' });
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/business/plan').then((res) => setPlan(res.data.plan || res.data)).catch(() => {}),
      api
        .get('/business/perfil')
        .then((res) => {
          const n = res.data.negocio || res.data;
          setFacturacion({ nit: n.nit || '', razon_social: n.razon_social || '' });
        })
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const guardarFacturacion = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await api.put('/business/perfil', facturacion);
      setToast({ type: 'success', message: 'Datos de facturación guardados' });
    } catch {
      setToast({ type: 'error', message: 'No se pudieron guardar los datos de facturación' });
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      <GlassCard>
        <h3 className="font-head text-xl text-text mb-6 flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-accent" />
          Plan Actual
        </h3>
        {plan ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-5 rounded-xl bg-[#FDECEA] border border-accent/20">
              <div>
                <p className="font-head text-2xl text-text">
                  {plan.nombre || 'Plan actual'}
                </p>
                {plan.en_trial && (
                  <p className="text-sm font-body text-muted mt-1">
                    Prueba gratis: te quedan {plan.dias_trial_restantes} día{plan.dias_trial_restantes === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              {plan.precio > 0 && (
                <div className="text-right">
                  <p className="font-mono text-3xl text-accent font-bold">
                    ${Number(plan.precio).toLocaleString('es-CO')}
                  </p>
                  <p className="text-sm font-body text-muted">/mes</p>
                </div>
              )}
            </div>
            {plan.limite_mensajes && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white border border-[#C9C9C9]">
                  <p className="text-sm font-body text-muted">Mensajes usados</p>
                  <p className="font-mono text-text text-lg mt-1">
                    {plan.mensajes_usados || 0} / {plan.limite_mensajes}
                  </p>
                </div>
                {plan.fin && (
                  <div className="p-4 rounded-xl bg-white border border-[#C9C9C9]">
                    <p className="text-sm font-body text-muted">Plan vigente hasta</p>
                    <p className="font-mono text-text text-lg mt-1">
                      {new Date(plan.fin).toLocaleDateString('es-CO')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="font-body text-muted">No se encontró información del plan.</p>
        )}
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-head text-xl text-text flex items-center gap-3">
            <CreditCardIcon className="w-5 h-5 text-accent" />
            Suscripción y pagos
          </h3>
          <button
            onClick={() => navigate('/suscripcion')}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-bg2 text-text border border-[#C9C9C9] text-sm font-semibold rounded-xl transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Gestionar Suscripción
          </button>
        </div>
        <p className="text-sm text-muted">
          Para cambiar de plan, pagar o cancelar, entra a Gestionar Suscripción.
        </p>
      </GlassCard>

      <GlassCard>
        <h3 className="font-head text-xl text-text mb-2 flex items-center gap-3">
          <FileText className="w-5 h-5 text-accent" />
          Datos de facturación
        </h3>
        <p className="text-sm text-muted mb-6 max-w-xl">
          Opcionales hasta que pagues: son los que irán en tus facturas.
        </p>
        <form onSubmit={guardarFacturacion} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="NIT" icon={Hash} mono>
              <InputField
                name="nit"
                value={facturacion.nit}
                onChange={(e) => setFacturacion((p) => ({ ...p, nit: e.target.value }))}
                placeholder="900123456-7"
              />
            </FormField>
            <FormField label="Razón Social" icon={FileText}>
              <InputField
                name="razon_social"
                value={facturacion.razon_social}
                onChange={(e) => setFacturacion((p) => ({ ...p, razon_social: e.target.value }))}
                placeholder="Razón social S.A.S"
              />
            </FormField>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={guardando}
              className="h-11 px-6 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold inline-flex items-center gap-2 border-none cursor-pointer transition-colors disabled:bg-[#F0F0F0] disabled:text-muted disabled:cursor-not-allowed"
            >
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar datos
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

function NotificacionesTab() {
  const [prefs, setPrefs] = useState({
    email_nuevos_mensajes: true,
    email_resumen_diario: true,
    email_suscripcion: true,
    push_nuevos_mensajes: true,
    push_error_bot: true,
    whatsapp_alertas: false,
    reportes_semanales: true,
    actualizaciones: true,
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const toggle = (key) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/business/notificaciones', prefs);
      setToast({ type: 'success', message: 'Preferencias guardadas' });
    } catch {
      setToast({ type: 'error', message: 'Error al guardar preferencias' });
    } finally {
      setSaving(false);
    }
  };

  const groups = [
    {
      title: 'Email',
      icon: MailIcon,
      items: [
        { key: 'email_nuevos_mensajes', label: 'Nuevos mensajes recibidos' },
        { key: 'email_resumen_diario', label: 'Resumen diario de actividad' },
        { key: 'email_suscripcion', label: 'Alertas de suscripción y pagos' },
      ],
    },
    {
      title: 'Push',
      icon: BellRing,
      items: [
        { key: 'push_nuevos_mensajes', label: 'Nuevos mensajes en tiempo real' },
        { key: 'push_error_bot', label: 'Errores del bot' },
      ],
    },
    {
      title: 'Otros',
      icon: Bell,
      items: [
        { key: 'whatsapp_alertas', label: 'Alertas por WhatsApp' },
        { key: 'reportes_semanales', label: 'Reportes semanales' },
        { key: 'actualizaciones', label: 'Actualizaciones de la plataforma' },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
      <GlassCard>
        <h3 className="font-head text-xl text-text mb-6 flex items-center gap-3">
          <Bell className="w-5 h-5 text-accent" />
          Preferencias de Notificación
        </h3>
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.title}>
              <div className="flex items-center gap-2 mb-3">
                <group.icon className="w-4 h-4 text-accent" />
                <h4 className="text-xs font-semibold tracking-[0.04em] text-muted uppercase">
                  {group.title}
                </h4>
              </div>
              <div className="divide-y divide-white/5">
                {group.items.map((item) => (
                  <ToggleSwitch
                    key={item.key}
                    checked={prefs[item.key]}
                    onChange={() => toggle(item.key)}
                    label={item.label}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent disabled:bg-[#F0F0F0] disabled:text-muted disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Guardar Preferencias
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

function SeguridadTab() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    passwordActual: '',
    passwordNueva: '',
    passwordConfirmar: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    actual: false,
    nueva: false,
    confirmar: false,
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const toggleShow = (key) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.passwordNueva !== form.passwordConfirmar) {
      setToast({ type: 'error', message: 'Las contraseñas no coinciden' });
      return;
    }
    if (form.passwordNueva.length < 6) {
      setToast({ type: 'error', message: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }
    setSaving(true);
    try {
      await api.put('/business/password', {
        passwordActual: form.passwordActual,
        passwordNueva: form.passwordNueva,
      });
      setToast({ type: 'success', message: 'Contraseña actualizada correctamente' });
      setForm({ passwordActual: '', passwordNueva: '', passwordConfirmar: '' });
    } catch {
      setToast({ type: 'error', message: 'Error al actualizar contraseña' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="space-y-8">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
      <GlassCard>
        <h3 className="font-head text-xl text-text mb-6 flex items-center gap-3">
          <Lock className="w-5 h-5 text-accent" />
          Cambiar Contraseña
        </h3>
        <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
          <FormField label="Contraseña Actual" icon={Key} mono>
            <div className="relative">
              <InputField
                name="passwordActual"
                type={showPasswords.actual ? 'text' : 'password'}
                value={form.passwordActual}
                onChange={handleChange}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => toggleShow('actual')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-text/70"
              >
                {showPasswords.actual ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </FormField>
          <FormField label="Nueva Contraseña" icon={Key} mono>
            <div className="relative">
              <InputField
                name="passwordNueva"
                type={showPasswords.nueva ? 'text' : 'password'}
                value={form.passwordNueva}
                onChange={handleChange}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => toggleShow('nueva')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-text/70"
              >
                {showPasswords.nueva ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </FormField>
          <FormField label="Confirmar Contraseña" icon={Key} mono>
            <div className="relative">
              <InputField
                name="passwordConfirmar"
                type={showPasswords.confirmar ? 'text' : 'password'}
                value={form.passwordConfirmar}
                onChange={handleChange}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => toggleShow('confirmar')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-text/70"
              >
                {showPasswords.confirmar ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </FormField>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent/90 disabled:opacity-50 text-text font-head font-semibold rounded-xl transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Actualizar Contraseña
            </button>
          </div>
        </form>
      </GlassCard>

      <GlassCard className="border-danger/20">
        <h3 className="font-head text-xl text-text mb-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-danger-text" />
          Zona de Peligro
        </h3>
        <p className="text-sm font-body text-muted mb-6">
          Cerrar sesión en todos los dispositivos activos.
        </p>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-6 py-3 bg-danger/20 hover:bg-danger/30 text-danger-text border border-danger/30 font-head font-semibold rounded-xl transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar Sesión
        </button>
      </GlassCard>
    </div>
  );
}

const TAB_COMPONENTS = {
  negocio: NegocioTab,
  avatar: AvatarTab,
  bot: BotTab,
  whatsapp: WhatsAppTab,
  pago: PagoTab,
  notificaciones: NotificacionesTab,
  seguridad: SeguridadTab,
};

export default function AjustesPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(TABS.some((t) => t.id === tabParam) ? tabParam : 'negocio');
  const navigate = useNavigate();
  const ActiveComponent = TAB_COMPONENTS[activeTab];

  const selectTab = (id) => {
    setActiveTab(id);
    setSearchParams({ tab: id }, { replace: true });
  };

  return (
    <div className="min-h-screen bg-bg2 p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              aria-label="Volver al panel"
              className="w-11 h-11 rounded-xl bg-white border border-border flex items-center justify-center cursor-pointer hover:border-[#C9C9C9] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-muted" />
            </button>
            <div>
              <h1 className="font-head text-3xl font-bold text-text tracking-tight">Ajustes</h1>
              <p className="text-muted text-sm mt-1">Configura tu negocio, bot y preferencias</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white border border-border rounded-2xl pl-2 pr-5 py-2">
            <div className="w-12 h-12 rounded-full bg-[#FDECEA] overflow-hidden flex items-end justify-center shrink-0">
              <OwnerAvatar config={user?.avatar} variant="busto" height={56} label="Tu avatar" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text leading-5 truncate max-w-[200px]">{user?.nombre || 'Tu negocio'}</p>
              <p className="text-xs text-muted truncate max-w-[200px]">{user?.email}</p>
            </div>
          </div>
        </header>

        <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
          <nav
            aria-label="Secciones de ajustes"
            className="bg-white border border-border rounded-2xl p-3 flex lg:flex-col gap-1 overflow-x-auto lg:sticky lg:top-6"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => selectTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-3 h-11 px-4 rounded-xl text-sm font-semibold whitespace-nowrap border-none cursor-pointer transition-colors ${
                    isActive ? 'bg-[#FDECEA] text-accent' : 'bg-transparent text-muted hover:bg-bg2 hover:text-text'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <main className="min-w-0">
            <ActiveComponent />
            <p className="text-xs text-muted text-center mt-8">
              <a href="/terminos" target="_blank" rel="noopener noreferrer" className="hover:text-text underline">
                Términos y condiciones
              </a>
              {' · '}
              <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="hover:text-text underline">
                Tratamiento de datos
              </a>
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}
