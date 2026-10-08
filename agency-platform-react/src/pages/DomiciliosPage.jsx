import TipNova from '../components/TipNova';
import EmptyState from '../components/EmptyState';
import PageLoader from '../components/PageLoader';
import Toast from '../components/Toast';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Truck,
  CheckCircle,
  Users,
  Plus,
  MapPin,
  Clock,
  Phone,
  User,
  Loader2,
  RefreshCw,
  X,
  Lock,
  Zap,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Star,
  CheckCircle2,
  Settings,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../components/PlanGate';
import { useHitos } from '../context/HitosContext';
import Illustration from '../components/Illustration';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3002';

// Mismas categorías que el domiciliario elige al reportar un problema
// (antigravity/frontend/PortalDomiciliario.jsx > TIPOS_PROBLEMA).
const TIPO_INCIDENTE_LABEL = {
  direccion: 'No encuentra la dirección',
  cliente_ausente: 'Cliente no contesta',
  robo_sospecha: 'Posible robo o fraude',
  accidente: 'Accidente del domiciliario',
  otro: 'Otro problema',
};

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const driverIcon = L.divIcon({
  className: 'domicilio-driver-marker',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#00FFD1;border:3px solid #0A0F14;box-shadow:0 0 0 4px rgba(0,255,209,0.25)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const ESTADO_LABELS = {
  pendiente: 'Esperando repartidor',
  aceptado: 'Repartidor asignado',
  en_ruta: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

const destinoIcon = L.divIcon({
  className: 'domicilio-destino-marker',
  html: '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#ef4444" stroke="#fff" stroke-width="1"/></svg>',
  iconSize: [30, 30],
  iconAnchor: [15, 28],
});

// Encuadra domiciliarios activos, puntos de entrega y el negocio. Depende de
// una clave serializada (no del array) para no reencuadrar en cada render, y
// difiere el ajuste porque al montar el contenedor puede medir 0px.
function MapAutoFit({ points }) {
  const map = useMap();
  const clave = JSON.stringify(points);
  useEffect(() => {
    if (points.length === 0) return;
    const t = setTimeout(() => {
      map.invalidateSize();
      const bounds = L.latLngBounds(points);
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    }, 150);
    return () => clearTimeout(t);
  }, [clave]);
  return null;
}

export default function DomiciliosPage() {
  const { hasFeature } = usePlan();
  const { user } = useAuth();
  const { celebrar } = useHitos();
  const navigate = useNavigate();
  const [apiPlan, setApiPlan] = useState(null);

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const res = await api.get('/business/plan');
        if (res.data?.plan?.tipo) {
          setApiPlan(res.data.plan.tipo);
        }
      } catch (e) {}
    };
    fetchPlan();
  }, []);

  const effectivePlan = apiPlan || 'starter';
  const domiciliosAllowed = effectivePlan !== 'starter' && effectivePlan !== 'emprendedor';

  const [activeTab, setActiveTab] = useState('pendientes');
  const [pendientes, setPendientes] = useState([]);
  const [enCurso, setEnCurso] = useState([]);
  const [completados, setCompletados] = useState([]);
  const [negocioUbicacion, setNegocioUbicacion] = useState(null);
  const [incidentes, setIncidentes] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [showTarifaForm, setShowTarifaForm] = useState(false);
  const [tarifaForm, setTarifaForm] = useState({ tarifa_por_km: '', tarifa_minima: '', tarifa_maxima: '', valor_fijo: '' });
  const [tarifaSaving, setTarifaSaving] = useState(false);
  const [driverForm, setDriverForm] = useState({ nombre: '', telefono: '', pin: '' });
  const [assignLoading, setAssignLoading] = useState(false);
  const [selectedDomicilioId, setSelectedDomicilioId] = useState(null);
  const [toast, setToast] = useState(null);
  const socketRef = useRef(null);

  const showToast = (type, message) => setToast({ type, message });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [activeRes, driversRes, incidentesRes] = await Promise.all([
        api.get('/domicilios/active'),
        api.get('/domicilios/drivers'),
        api.get('/domicilios/incidentes'),
      ]);
      setPendientes(activeRes.data?.data?.pendientes || []);
      setEnCurso(activeRes.data?.data?.en_curso || []);
      const completadosData = activeRes.data?.data?.completados || [];
      setCompletados(completadosData);
      if (completadosData.length > 0) celebrar('domicilio');
      setNegocioUbicacion(activeRes.data?.data?.negocio_ubicacion || null);
      setDrivers(driversRes.data?.data || []);
      setIncidentes(incidentesRes.data?.data || []);
    } catch (error) {
      console.error('Error fetching domicilios data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (domiciliosAllowed) {
      fetchData();
    }
  }, [domiciliosAllowed]);

  useEffect(() => {
    if (!domiciliosAllowed || !user?.id) return;

    const socket = io(SOCKET_URL, {
      auth: { token: localStorage.getItem('antigravity_token') },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('suscribirse_negocio', user.id));

    socket.on('domicilio_nuevo', () => {
      showToast('success', '🛵 Nuevo pedido con domicilio recibido por WhatsApp');
      fetchData();
    });
    socket.on('domicilio_asignado', fetchData);
    socket.on('domicilio_en_ruta', fetchData);
    socket.on('domicilio_entregado', fetchData);
    socket.on('domicilio_incidente', () => {
      showToast('error', '⚠️ Un domiciliario reportó un problema en una entrega');
      fetchData();
    });
    socket.on('driver_location', (data) => {
      setDrivers((prev) => prev.map((d) => (d.id === data.domiciliario_id ? { ...d, latitud: data.latitud, longitud: data.longitud } : d)));
    });
    socket.on('driver_status', () => fetchData());

    return () => socket.disconnect();
  }, [domiciliosAllowed, user?.id]);

  const handleAssign = async (domicilioId, driverId) => {
    try {
      setAssignLoading(true);
      await api.post('/domicilios/assign', { domicilio_id: domicilioId, domiciliario_id: driverId });
      setShowAssignModal(false);
      setSelectedDomicilioId(null);
      showToast('success', 'Domicilio asignado');
      fetchData();
    } catch (error) {
      showToast('error', error.response?.data?.error || 'Error al asignar');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAddDriver = async (e) => {
    e.preventDefault();
    try {
      setAssignLoading(true);
      await api.post('/domicilios/drivers', driverForm);
      setShowDriverForm(false);
      setDriverForm({ nombre: '', telefono: '', pin: '' });
      showToast('success', 'Domiciliario creado');
      fetchData();
    } catch (error) {
      showToast('error', error.response?.data?.error || 'Error al crear domiciliario');
    } finally {
      setAssignLoading(false);
    }
  };

  const abrirTarifas = async () => {
    setShowTarifaForm(true);
    try {
      const res = await api.get('/domicilios/modulos/check');
      const config = res.data?.config ? JSON.parse(res.data.config) : {};
      setTarifaForm({
        tarifa_por_km: config.tarifa_por_km ?? '',
        tarifa_minima: config.tarifa_minima ?? '',
        tarifa_maxima: config.tarifa_maxima ?? '',
        valor_fijo: config.valor_fijo ?? '',
      });
    } catch {
      showToast('error', 'No se pudo cargar la configuración actual');
    }
  };

  const handleGuardarTarifas = async (e) => {
    e.preventDefault();
    try {
      setTarifaSaving(true);
      await api.put('/domicilios/modulos/config', tarifaForm);
      setShowTarifaForm(false);
      showToast('success', 'Tarifas actualizadas');
    } catch (error) {
      showToast('error', error.response?.data?.error || 'Error al guardar las tarifas');
    } finally {
      setTarifaSaving(false);
    }
  };

  const handleResolverIncidente = async (id, resultado) => {
    const confirmMsg = resultado === 'robo_confirmado'
      ? '¿Confirmas que este domicilio se perdió/robó? El domiciliario será penalizado.'
      : '¿Marcar este incidente como resuelto (falsa alarma)?';
    if (!window.confirm(confirmMsg)) return;
    try {
      await api.post(`/domicilios/incidentes/${id}/resolver`, { resultado });
      showToast('success', resultado === 'robo_confirmado' ? 'Domiciliario penalizado' : 'Incidente resuelto');
      fetchData();
    } catch (error) {
      showToast('error', error.response?.data?.error || 'Error al resolver el incidente');
    }
  };

  const formatCOP = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);
  const noSuspendido = (d) => !d.suspendido_hasta || new Date(d.suspendido_hasta) <= new Date();
  const driversDisponibles = drivers.filter((d) => d.estado_activo && noSuspendido(d));
  const driversEnMapa = drivers.filter((d) => d.estado_activo && d.latitud && d.longitud);
  const entregasEnMapa = [
    ...pendientes.map((d) => ({ ...d, enCurso: false })),
    ...enCurso.map((d) => ({ ...d, enCurso: true })),
  ].filter((d) => d.destino);
  const puntosMapa = [
    ...driversEnMapa.map((d) => [Number(d.latitud), Number(d.longitud)]),
    ...entregasEnMapa.map((d) => [d.destino.lat, d.destino.lng]),
    ...(negocioUbicacion ? [[negocioUbicacion.lat, negocioUbicacion.lng]] : []),
  ];

  const tabs = [
    { id: 'pendientes', label: 'Pendientes', count: pendientes.length },
    { id: 'en_curso', label: 'En Curso', count: enCurso.length },
    { id: 'completados', label: 'Completados', count: completados.length },
    { id: 'incidentes', label: '⚠️ Incidentes', count: incidentes.length },
    { id: 'domiciliarios', label: 'Domiciliarios', count: drivers.length },
  ];

  if (!domiciliosAllowed) {
    return (
      <div className="min-h-screen bg-bg p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto"
        >
          <div className="bg-bg2 border border-border rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-bg3 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8 text-muted" />
            </div>
            <h2 className="text-2xl font-bold text-text mb-3">
              Gestión de Domicilios
            </h2>
            <p className="text-muted mb-8">
              Gestiona domicilios, asigna domiciliarios y rastrea entregas en tiempo real.
            </p>

            <div className="bg-bg3 rounded-lg p-6 mb-8 text-left">
              <h3 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-accent" />
                Incluido en Professional
              </h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-text">
                  <Truck className="w-5 h-5 text-accent" />
                  Gestión ilimitada de domicilios
                </li>
                <li className="flex items-center gap-3 text-text">
                  <Users className="w-5 h-5 text-accent" />
                  Múltiples domiciliarios
                </li>
                <li className="flex items-center gap-3 text-text">
                  <MapPin className="w-5 h-5 text-accent" />
                  Seguimiento en tiempo real
                </li>
                <li className="flex items-center gap-3 text-text">
                  <Clock className="w-5 h-5 text-accent" />
                  Historial de entregas
                </li>
              </ul>
            </div>

            <button
              onClick={() => navigate('/suscripcion')}
              className="inline-flex items-center gap-2 bg-accent text-bg px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Mejorar a Professional
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button aria-label="Volver al dashboard"
              onClick={() => navigate('/dashboard')}
              className="tap-44 shrink-0 rounded-xl bg-bg2 border border-border hover:border-accent/30 hover:bg-accent/10 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-muted" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-text">Domicilios</h1>
              <p className="text-muted">Gestiona domicilios y domiciliarios</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={abrirTarifas}
              className="flex items-center gap-2 bg-bg2 border border-border rounded-lg px-4 py-2 text-text hover:bg-bg3 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Tarifas
            </button>
            <button
              onClick={() => setShowDriverForm(true)}
              className="flex items-center gap-2 bg-accent text-bg px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Agregar Domiciliario
            </button>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 bg-bg2 border border-border rounded-lg px-4 py-2 text-text hover:bg-bg3 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>
          </div>
        </div>

        <TipNova id="domicilios" className="mb-6">Registra a tus domiciliarios y asígnales los pedidos. Tus clientes pueden seguir su entrega con un enlace de rastreo.</TipNova>

        <div className="bg-bg2 border border-border rounded-xl overflow-hidden mb-6 isolate">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <MapPin className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-text">Mapa en vivo</span>
            <span className="text-xs text-muted ml-auto">{driversEnMapa.length} domiciliario(s) activo(s) en el mapa</span>
          </div>
          <div style={{ height: '280px' }}>
            <MapContainer center={[4.711, -74.0721]} zoom={12} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url={`https://tiles.traveltimeapp.com/positron/{z}/{x}/{y}.png?key=${import.meta.env.VITE_TRAVELTIME_APP_ID}`}
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Map tiles by TravelTime'
              />
              <MapAutoFit points={puntosMapa} />
              {negocioUbicacion && (
                <Marker position={[negocioUbicacion.lat, negocioUbicacion.lng]}>
                  <Popup><strong>{negocioUbicacion.nombre || 'Tu negocio'}</strong></Popup>
                </Marker>
              )}
              {entregasEnMapa.map((d) => (
                <React.Fragment key={`entrega-${d.id}`}>
                  {d.ruta && (
                    <Polyline
                      positions={d.ruta}
                      pathOptions={d.enCurso
                        ? { color: '#2563eb', weight: 5, opacity: 0.85 }
                        : { color: '#94a3b8', weight: 4, opacity: 0.8, dashArray: '8 8' }}
                    />
                  )}
                  <Marker position={[d.destino.lat, d.destino.lng]} icon={destinoIcon}>
                    <Popup>
                      <strong>{d.numero_pedido}</strong><br />
                      {d.cliente_nombre}<br />
                      {d.direccion_entrega}<br />
                      {d.enCurso ? 'En curso' : 'Pendiente'}
                    </Popup>
                  </Marker>
                </React.Fragment>
              ))}
              {driversEnMapa.map((driver) => (
                <Marker key={driver.id} position={[driver.latitud, driver.longitud]} icon={driverIcon}>
                  <Popup>
                    <strong>{driver.nombre}</strong><br />
                    {driver.telefono}<br />
                    ⭐ {driver.score ?? 100}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          {driversEnMapa.length === 0 && entregasEnMapa.length === 0 && (
            <div className="px-4 py-3 text-xs text-muted border-t border-border">
              Ningún domiciliario conectado está compartiendo ubicación todavía.
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? tab.id === 'incidentes' ? 'bg-danger text-white' : 'bg-accent text-bg'
                  : 'bg-bg2 text-muted hover:text-text'
              }`}
            >
              {tab.label}
              <span className="bg-bg3 text-text text-xs px-2 py-0.5 rounded-full">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <PageLoader />
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'pendientes' && (
              <motion.div
                key="pendientes"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-bg2 border border-border rounded-xl overflow-hidden"
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-4 text-muted font-medium">Pedido</th>
                        <th className="text-left p-4 text-muted font-medium">Cliente</th>
                        <th className="text-left p-4 text-muted font-medium">Dirección</th>
                        <th className="text-left p-4 text-muted font-medium">Valor</th>
                        <th className="text-left p-4 text-muted font-medium">Hora</th>
                        <th className="text-left p-4 text-muted font-medium">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendientes.map((d) => (
                        <tr key={d.id} className="border-b border-border last:border-0 hover:bg-bg3 transition-colors">
                          <td className="p-4 text-text font-mono text-sm">{d.numero_pedido}</td>
                          <td className="p-4 text-text">{d.cliente_nombre}</td>
                          <td className="p-4 text-text">
                            {d.direccion_entrega}
                            {d.restaurante_nombre && <span className="block text-xs text-muted">Recoger en {d.restaurante_nombre}</span>}
                          </td>
                          <td className="p-4 text-accent font-semibold">{formatCOP(d.total)}</td>
                          <td className="p-4 text-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(d.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-4">
                            <select
                              defaultValue=""
                              onChange={(e) => e.target.value && handleAssign(d.id, e.target.value)}
                              className="bg-bg3 border border-border rounded-lg px-3 py-1.5 text-sm text-text"
                            >
                              <option value="" disabled>Asignar a...</option>
                              {driversDisponibles.map((drv) => (
                                <option key={drv.id} value={drv.id}>{drv.nombre} (⭐ {drv.score ?? 100})</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                      {pendientes.length === 0 && (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-muted">
                            <div className="flex flex-col items-center gap-4">
                              <Illustration name="vacio-domicilios" size={120} />
                              <span>No hay domicilios pendientes</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'en_curso' && (
              <motion.div
                key="en_curso"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-bg2 border border-border rounded-xl overflow-hidden"
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-4 text-muted font-medium">Pedido</th>
                        <th className="text-left p-4 text-muted font-medium">Cliente</th>
                        <th className="text-left p-4 text-muted font-medium">Domiciliario</th>
                        <th className="text-left p-4 text-muted font-medium">Estado</th>
                        <th className="text-left p-4 text-muted font-medium">Hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enCurso.map((d) => (
                        <tr key={d.id} className="border-b border-border last:border-0 hover:bg-bg3 transition-colors">
                          <td className="p-4 text-text font-mono text-sm">{d.numero_pedido}</td>
                          <td className="p-4 text-text">{d.cliente_nombre}</td>
                          <td className="p-4 text-text flex items-center gap-2">
                            <User className="w-4 h-4 text-muted" />
                            {d.domiciliario_nombre || 'Sin asignar'}
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1 bg-bg3 text-text px-2 py-1 rounded-full text-xs font-medium">
                              <Truck className="w-3 h-3" />
                              {ESTADO_LABELS[d.estado] || d.estado}
                            </span>
                          </td>
                          <td className="p-4 text-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(d.updated_at || d.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                      {enCurso.length === 0 && (
                        <tr>
                          <td colSpan="5" className="p-8 text-center text-muted">
                            <div className="flex flex-col items-center gap-4">
                              <Illustration name="vacio-domicilios" size={120} />
                              <span>No hay domicilios en curso</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'completados' && (
              <motion.div
                key="completados"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-bg2 border border-border rounded-xl overflow-hidden"
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-4 text-muted font-medium">Pedido</th>
                        <th className="text-left p-4 text-muted font-medium">Cliente</th>
                        <th className="text-left p-4 text-muted font-medium">Domiciliario</th>
                        <th className="text-left p-4 text-muted font-medium">Valor envío</th>
                        <th className="text-left p-4 text-muted font-medium">Km</th>
                        <th className="text-left p-4 text-muted font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completados.map((d) => (
                        <tr key={d.id} className="border-b border-border last:border-0 hover:bg-bg3 transition-colors">
                          <td className="p-4 text-text font-mono text-sm">{d.numero_pedido}</td>
                          <td className="p-4 text-text">{d.cliente_nombre}</td>
                          <td className="p-4 text-text flex items-center gap-2">
                            <User className="w-4 h-4 text-muted" />
                            {d.domiciliario_nombre}
                          </td>
                          <td className="p-4 text-accent font-semibold">{formatCOP(d.tarifa_envio)}</td>
                          <td className="p-4 text-muted">{d.km_recorridos || 0}km</td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1 bg-accent/20 text-accent px-2 py-1 rounded-full text-xs font-medium">
                              <CheckCircle className="w-3 h-3" />
                              Entregado
                            </span>
                          </td>
                        </tr>
                      ))}
                      {completados.length === 0 && (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-muted">
                            <div className="flex flex-col items-center gap-4">
                              <Illustration name="vacio-domicilios" size={120} />
                              <span>No hay domicilios completados</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'incidentes' && (
              <motion.div
                key="incidentes"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-bg2 border border-border rounded-xl overflow-hidden"
              >
                <div className="divide-y divide-border">
                  {incidentes.map((inc) => {
                    // La etiqueta viene de lo que el domiciliario reportó (tipo_incidente), no de
                    // estado_incidente — antes todo caía en "en_disputa" y se mostraba como
                    // "posible robo" sin importar la causa real (dirección, cliente ausente, etc.)
                    const esRetraso = inc.estado_incidente === 'retrasado';
                    const esSospechaRobo = inc.tipo_incidente === 'robo_sospecha';
                    return (
                    <div key={inc.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="w-4 h-4 text-danger-text" />
                          <span className="font-mono text-sm text-text">{inc.numero_pedido}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${esSospechaRobo ? 'bg-danger/10 text-danger-text' : 'bg-warn/10 text-warn-text'}`}>
                            {esRetraso ? 'Retrasado' : TIPO_INCIDENTE_LABEL[inc.tipo_incidente] || 'Problema reportado'}
                          </span>
                        </div>
                        <p className="text-sm text-text">{inc.cliente_nombre} · {inc.direccion_entrega}</p>
                        {inc.motivo_incidente && (
                          <p className="text-sm text-muted italic mt-1">"{inc.motivo_incidente}"</p>
                        )}
                        <p className="text-xs text-muted mt-1">
                          Domiciliario: {inc.domiciliario_nombre || 'Sin asignar'} {inc.score != null && `(⭐ ${inc.score}, ${inc.strikes} strikes)`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResolverIncidente(inc.id, 'resuelto')}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-success/10 text-success border border-success/30 hover:bg-success/20 transition-colors"
                        >
                          Falsa alarma
                        </button>
                        <button
                          onClick={() => handleResolverIncidente(inc.id, 'robo_confirmado')}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-danger/10 text-danger-text border border-danger/30 hover:bg-danger/20 transition-colors"
                        >
                          {esSospechaRobo ? 'Confirmar robo/pérdida' : 'Marcar como grave'}
                        </button>
                      </div>
                    </div>
                    );
                  })}
                  {incidentes.length === 0 && (
                    <EmptyState name="exito" size={130} title="Sin incidentes abiertos" description="Todas las entregas van en orden." />
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'domiciliarios' && (
              <motion.div
                key="domiciliarios"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setShowDriverForm(true)}
                    className="flex items-center gap-2 bg-accent text-bg px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {drivers.map((driver) => {
                    const suspendido = driver.suspendido_hasta && new Date(driver.suspendido_hasta) > new Date();
                    return (
                      <motion.div
                        key={driver.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-bg2 border border-border rounded-xl p-5"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-bg3 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-muted" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-text font-semibold">{driver.nombre}</h3>
                            <p className="text-muted text-sm flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {driver.telefono}
                            </p>
                            {driver.calificaciones_recibidas > 0 && (
                              <p className="text-muted text-xs flex items-center gap-1 mt-0.5">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                {driver.calificacion_promedio} de sus clientes ({driver.calificaciones_recibidas})
                              </p>
                            )}
                          </div>
                          <span
                            className="flex items-center gap-1 text-sm font-semibold text-warn-text"
                            title="Puntaje interno de cumplimiento (entregas a tiempo, incidentes)"
                          >
                            <Star className="w-4 h-4 fill-yellow-400" />
                            {driver.score ?? 100}
                          </span>
                        </div>

                        {suspendido && (
                          <div className="mb-3 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger-text">
                            Suspendido hasta {new Date(driver.suspendido_hasta).toLocaleDateString('es-CO')}
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-bg3 rounded-lg p-3 text-center">
                            <p className="text-lg font-bold text-text">{driver.pedidos_completados || 0}</p>
                            <p className="text-muted text-xs">Pedidos</p>
                          </div>
                          <div className="bg-bg3 rounded-lg p-3 text-center">
                            <p className="text-lg font-bold text-text">{driver.km_totales || 0}</p>
                            <p className="text-muted text-xs">Km</p>
                          </div>
                          <div className="bg-bg3 rounded-lg p-3 text-center">
                            <p className="text-lg font-bold text-accent">{formatCOP(driver.ganancias_totales)}</p>
                            <p className="text-muted text-xs">Ganancias</p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  {drivers.length === 0 && (
                    <div className="col-span-full bg-bg2 border border-border rounded-xl p-8 text-center text-muted flex flex-col items-center gap-4">
                      <Illustration name="vacio-domicilios" size={140} />
                      <span>No hay domiciliarios registrados</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <AnimatePresence>
        {showAssignModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4"
            onClick={() => setShowAssignModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg2 border border-border rounded-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-lg font-semibold text-text">Asignar Domiciliario</h3>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-muted hover:text-text transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 max-h-80 overflow-y-auto">
                {driversDisponibles.length === 0 ? (
                  <EmptyState name="vacio-domicilios" size={110} title="No hay domiciliarios disponibles" className="py-6" />
                ) : (
                  <div className="space-y-2">
                    {driversDisponibles.map((driver) => (
                      <button
                        key={driver.id}
                        onClick={() => handleAssign(selectedDomicilioId, driver.id)}
                        disabled={assignLoading}
                        className="w-full flex items-center gap-3 p-3 bg-bg3 rounded-lg hover:bg-bg border border-transparent hover:border-border transition-colors text-left disabled:opacity-50"
                      >
                        <div className="w-10 h-10 bg-bg2 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-muted" />
                        </div>
                        <div className="flex-1">
                          <p className="text-text font-medium">{driver.nombre}</p>
                          <p className="text-muted text-sm">{driver.telefono}</p>
                        </div>
                        {assignLoading && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {showDriverForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4"
            onClick={() => setShowDriverForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg2 border border-border rounded-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-lg font-semibold text-text">Agregar Domiciliario</h3>
                <button
                  onClick={() => setShowDriverForm(false)}
                  className="text-muted hover:text-text transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddDriver} className="p-4 space-y-4">
                <div>
                  <label className="block text-muted text-sm mb-1">Nombre</label>
                  <input
                    type="text"
                    value={driverForm.nombre}
                    onChange={(e) => setDriverForm({ ...driverForm, nombre: e.target.value })}
                    className="w-full bg-bg3 border border-border rounded-lg px-4 py-2 text-text focus:outline-none focus:border-accent transition-colors"
                    placeholder="Nombre completo"
                    required
                  />
                </div>

                <div>
                  <label className="block text-muted text-sm mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={driverForm.telefono}
                    onChange={(e) => setDriverForm({ ...driverForm, telefono: e.target.value })}
                    className="w-full bg-bg3 border border-border rounded-lg px-4 py-2 text-text focus:outline-none focus:border-accent transition-colors"
                    placeholder="Número de teléfono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-muted text-sm mb-1">PIN</label>
                  <input
                    type="password"
                    value={driverForm.pin}
                    onChange={(e) => setDriverForm({ ...driverForm, pin: e.target.value })}
                    className="w-full bg-bg3 border border-border rounded-lg px-4 py-2 text-text focus:outline-none focus:border-accent transition-colors"
                    placeholder="PIN de acceso (mín. 4 dígitos)"
                    minLength={4}
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDriverForm(false)}
                    className="flex-1 bg-bg3 text-text py-2 rounded-lg font-medium hover:bg-border transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={assignLoading}
                    className="flex-1 bg-accent text-bg py-2 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    {assignLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Agregar
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {showTarifaForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4"
            onClick={() => setShowTarifaForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg2 border border-border rounded-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-lg font-semibold text-text">Tarifas de domicilio</h3>
                <button
                  onClick={() => setShowTarifaForm(false)}
                  className="text-muted hover:text-text transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleGuardarTarifas} className="p-4 space-y-4">
                <p className="text-muted text-sm">
                  Si defines un valor por km, la tarifa de cada domicilio se calcula con la distancia real de la ruta.
                  Déjalo vacío para seguir cobrando el valor fijo.
                </p>

                <div>
                  <label className="block text-muted text-sm mb-1">Tarifa por km (COP)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={tarifaForm.tarifa_por_km}
                    onChange={(e) => setTarifaForm({ ...tarifaForm, tarifa_por_km: e.target.value })}
                    className="w-full bg-bg3 border border-border rounded-lg px-4 py-2 text-text focus:outline-none focus:border-accent transition-colors"
                    placeholder="Ej: 1600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-muted text-sm mb-1">Tarifa mínima</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={tarifaForm.tarifa_minima}
                      onChange={(e) => setTarifaForm({ ...tarifaForm, tarifa_minima: e.target.value })}
                      className="w-full bg-bg3 border border-border rounded-lg px-4 py-2 text-text focus:outline-none focus:border-accent transition-colors"
                      placeholder="Opcional"
                    />
                  </div>
                  <div>
                    <label className="block text-muted text-sm mb-1">Tarifa máxima</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={tarifaForm.tarifa_maxima}
                      onChange={(e) => setTarifaForm({ ...tarifaForm, tarifa_maxima: e.target.value })}
                      className="w-full bg-bg3 border border-border rounded-lg px-4 py-2 text-text focus:outline-none focus:border-accent transition-colors"
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-muted text-sm mb-1">Valor fijo de respaldo (COP)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={tarifaForm.valor_fijo}
                    onChange={(e) => setTarifaForm({ ...tarifaForm, valor_fijo: e.target.value })}
                    className="w-full bg-bg3 border border-border rounded-lg px-4 py-2 text-text focus:outline-none focus:border-accent transition-colors"
                    placeholder="Ej: 5000"
                  />
                  <p className="text-muted text-xs mt-1">Se usa si no hay tarifa por km, o si no se pudo calcular la ruta.</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTarifaForm(false)}
                    className="flex-1 bg-bg3 text-text py-2 rounded-lg font-medium hover:bg-border transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={tarifaSaving}
                    className="flex-1 bg-accent text-bg py-2 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    {tarifaSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
