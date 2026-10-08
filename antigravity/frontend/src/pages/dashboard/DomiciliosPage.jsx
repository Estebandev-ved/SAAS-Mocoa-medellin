import { useState, useEffect, useRef, Fragment } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { initSocket, subscribeToNegocio, disconnectSocket } from '../../services/socket';
import Toast from '../../components/Toast';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Illustration from '../../components/ui/Illustration';
import './DomiciliosPage.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const driverIcon = L.divIcon({
    className: 'driver-marker',
    html: '<div class="driver-pulse"></div><svg viewBox="0 0 24 24" width="24" height="24"><path d="M5 8l6-6 6 6H5zm0 8h12l-6 6-6-6z" fill="#0288D1"/></svg>',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

const activeDriverIcon = L.divIcon({
    className: 'driver-marker active',
    html: '<div class="driver-pulse active"></div><svg viewBox="0 0 24 24" width="28" height="28"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#0288D1"/></svg>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
});

const destinoIcon = L.divIcon({
    className: 'destino-marker',
    html: '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#ef4444" stroke="#fff" stroke-width="1"/></svg>',
    iconSize: [30, 30],
    iconAnchor: [15, 28]
});

// Encuadra el mapa sobre todo lo que hay que ver (domiciliarios activos, puntos
// de entrega y el negocio). Depende de una clave serializada, no del array, para
// no reencuadrar en cada re-render y pelear con el usuario si mueve el mapa.
function MapUpdater({ points }) {
    const map = useMap();
    const clave = JSON.stringify(points);
    useEffect(() => {
        if (points.length === 0) return;
        const t = setTimeout(() => {
            map.invalidateSize();
            const bounds = L.latLngBounds(points);
            if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }, 150);
        return () => clearTimeout(t);
    }, [clave]);
    return null;
}

const ESTADO_LABELS = {
    pendiente: 'Esperando repartidor',
    aceptado: 'Repartidor asignado',
    en_ruta: 'En camino',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
};

export default function DomiciliosPage() {
    const { user } = useAuth();
    const [drivers, setDrivers] = useState([]);
    const [deliveries, setDeliveries] = useState({ pendientes: [], en_curso: [], completados: [] });
    const [incidentes, setIncidentes] = useState([]);
    const [conteo, setConteo] = useState({ pendientes: 0, en_ruta: 0 });
    const [loading, setLoading] = useState(true);
    const [showAddDriver, setShowAddDriver] = useState(false);
    const [newDriver, setNewDriver] = useState({ nombre: '', telefono: '', pin: '' });
    const [activeTab, setActiveTab] = useState('pendientes');
    const [toast, setToast] = useState(null);
    const socketInitialized = useRef(false);

    useEffect(() => {
        fetchData();
        initSocketConnection();
        return () => {
            socketInitialized.current = false;
            disconnectSocket();
        };
    }, [user?.id]);

    const initSocketConnection = () => {
        const token = localStorage.getItem('ag_token');
        if (!token || socketInitialized.current) return;
        socketInitialized.current = true;

        const socket = initSocket(token);
        subscribeToNegocio(user?.id);

        socket.on('driver_location', (data) => {
            setDrivers(prev => prev.map(d =>
                d.id === data.domiciliario_id ? { ...d, latitud: data.latitud, longitud: data.longitud } : d
            ));
        });

        socket.on('driver_status', (data) => {
            setDrivers(prev => prev.map(d =>
                d.id === data.domiciliario_id ? { ...d, estado_activo: data.estado_activo } : d
            ));
            fetchData();
        });

        socket.on('domicilio_asignado', () => fetchData());
        socket.on('domicilio_en_ruta', () => fetchData());
        socket.on('domicilio_entregado', () => fetchData());
        socket.on('domicilio_nuevo', () => {
            setToast({ type: 'success', message: '🛵 Nuevo pedido con domicilio recibido por WhatsApp' });
            fetchData();
        });
        socket.on('domicilio_incidente', () => {
            setToast({ type: 'error', message: '⚠️ Un domiciliario reportó un problema en una entrega' });
            fetchData();
        });
    };

    const fetchData = async () => {
        try {
            const [driversRes, activeRes, incidentesRes] = await Promise.all([
                apiService.get('/api/domicilios/drivers'),
                apiService.get('/api/domicilios/active'),
                apiService.get('/api/domicilios/incidentes')
            ]);
            if (driversRes.success) {
                setDrivers(driversRes.data);
                setConteo(driversRes.conteo);
            }
            if (activeRes.success) setDeliveries(activeRes.data);
            if (incidentesRes.success) setIncidentes(incidentesRes.data);
        } catch (err) {
            console.error('Error fetching delivery data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleResolverIncidente = async (id, resultado) => {
        const confirmMsg = resultado === 'robo_confirmado'
            ? '¿Confirmas que este domicilio se perdió/robó? El domiciliario será penalizado.'
            : '¿Marcar este incidente como resuelto (falsa alarma)?';
        if (!window.confirm(confirmMsg)) return;
        try {
            await apiService.post(`/api/domicilios/incidentes/${id}/resolver`, { resultado });
            setToast({ type: 'success', message: resultado === 'robo_confirmado' ? 'Domiciliario penalizado' : 'Incidente resuelto' });
            fetchData();
        } catch (err) {
            setToast({ type: 'error', message: err.response?.data?.error || 'Error al resolver el incidente' });
        }
    };

    const handleAddDriver = async (e) => {
        e.preventDefault();
        try {
            const res = await apiService.post('/api/domicilios/drivers', newDriver);
            if (res.success) {
                setToast({ type: 'success', message: 'Domiciliario creado' });
                setShowAddDriver(false);
                setNewDriver({ nombre: '', telefono: '', pin: '' });
                fetchData();
            }
        } catch (err) {
            setToast({ type: 'error', message: err.response?.data?.error || 'Error al crear domiciliario' });
        }
    };

    const handleDeleteDriver = async (id) => {
        if (!window.confirm('¿Desactivar este domiciliario?')) return;
        try {
            await apiService.delete(`/api/domicilios/drivers/${id}`);
            setToast({ type: 'success', message: 'Domiciliario desactivado' });
            fetchData();
        } catch (err) {
            setToast({ type: 'error', message: 'Error al desactivar' });
        }
    };

    const handleAssign = async (domicilioId, driverId) => {
        try {
            await apiService.post('/api/domicilios/assign', { domicilio_id: domicilioId, domiciliario_id: driverId });
            setToast({ type: 'success', message: 'Domicilio asignado' });
            fetchData();
        } catch (err) {
            setToast({ type: 'error', message: err.response?.data?.error || 'Error al asignar' });
        }
    };

    const formatCOP = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);

    const activeDriversOnMap = drivers.filter(d => d.estado_activo && d.latitud && d.longitud);
    const entregasEnMapa = [
        ...(deliveries.pendientes || []).map(d => ({ ...d, enCurso: false })),
        ...(deliveries.en_curso || []).map(d => ({ ...d, enCurso: true })),
    ].filter(d => d.destino);
    const negocioUbicacion = deliveries.negocio_ubicacion;
    const puntosMapa = [
        ...activeDriversOnMap.map(d => [Number(d.latitud), Number(d.longitud)]),
        ...entregasEnMapa.map(d => [d.destino.lat, d.destino.lng]),
        ...(negocioUbicacion ? [[negocioUbicacion.lat, negocioUbicacion.lng]] : []),
    ];

    return (
        <div className="domicilios-page">
            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
            <div className="page-header">
                <div>
                    <h2>Centro de Despacho</h2>
                    <p className="header-subtitle">Gestiona tus domiciliarios y entregas en tiempo real</p>
                </div>
                <Button onClick={() => setShowAddDriver(true)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Añadir Domiciliario
                </Button>
            </div>

            <div className="delivery-stats">
                <div className="stat-card">
                    <span className="stat-value">{conteo.pendientes}</span>
                    <span className="stat-label">Pendientes</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{conteo.en_ruta}</span>
                    <span className="stat-label">En Ruta</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{drivers.filter(d => d.estado_activo).length}</span>
                    <span className="stat-label">Activos</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{drivers.length}</span>
                    <span className="stat-label">Total Domiciliarios</span>
                </div>
            </div>

            <div className="delivery-grid">
                <div className="map-section">
                    <div className="section-title">Mapa en Vivo</div>
                    <div className="map-container">
                        <MapContainer center={[1.148, -76.647]} zoom={13} style={{ height: '100%', width: '100%', borderRadius: '12px' }}>
                            <TileLayer
                                url={`https://tiles.traveltimeapp.com/positron/{z}/{x}/{y}.png?key=${import.meta.env.VITE_TRAVELTIME_APP_ID}`}
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> | Map tiles by TravelTime'
                            />
                            <MapUpdater points={puntosMapa} />
                            {negocioUbicacion && (
                                <Marker position={[negocioUbicacion.lat, negocioUbicacion.lng]}>
                                    <Popup><strong>{negocioUbicacion.nombre || 'Tu negocio'}</strong></Popup>
                                </Marker>
                            )}
                            {entregasEnMapa.map(d => (
                                <Fragment key={`entrega-${d.id}`}>
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
                                            <div className="driver-popup">
                                                <strong>{d.numero_pedido}</strong>
                                                <span>{d.cliente_nombre}</span>
                                                <span>{d.direccion_entrega}</span>
                                                <span>{d.enCurso ? 'En curso' : 'Pendiente'}</span>
                                            </div>
                                        </Popup>
                                    </Marker>
                                </Fragment>
                            ))}
                            {activeDriversOnMap.map(driver => (
                                <Marker key={driver.id} position={[driver.latitud, driver.longitud]} icon={activeDriverIcon}>
                                    <Popup>
                                        <div className="driver-popup">
                                            <strong>{driver.nombre}</strong>
                                            <span>{driver.telefono}</span>
                                            <span>{driver.pedidos_completados || 0} hoy</span>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>
                </div>

                <div className="drivers-section">
                    <div className="section-title">Domiciliarios</div>
                    <div className="drivers-list">
                        {drivers.map(driver => (
                            <div key={driver.id} className={`driver-card ${driver.estado_activo ? 'active' : ''}`}>
                                <div className="driver-avatar">
                                    <span className={`status-dot ${driver.estado_activo ? 'online' : 'offline'}`}></span>
                                    <span>{driver.nombre.charAt(0)}</span>
                                </div>
                                <div className="driver-info">
                                    <span className="driver-name">{driver.nombre}</span>
                                    <span className="driver-phone">{driver.telefono}</span>
                                    <div className="driver-metrics">
                                        <span>{driver.pedidos_completados || 0}</span>
                                        <span>{formatCOP(driver.ganancias_totales)}</span>
                                        <span>{driver.km_totales || 0}km</span>
                                        <span title="Puntaje de reputación">⭐ {driver.score ?? 100}</span>
                                    </div>
                                    {driver.suspendido_hasta && new Date(driver.suspendido_hasta) > new Date() && (
                                        <span className="driver-suspendido">Suspendido hasta {new Date(driver.suspendido_hasta).toLocaleDateString('es-CO')}</span>
                                    )}
                                </div>
                                <button className="driver-delete" onClick={() => handleDeleteDriver(driver.id)} title="Desactivar">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                            </div>
                        ))}
                        {drivers.length === 0 && !loading && (
                            <div className="empty-drivers">
                                <Illustration name="vacio-domicilios" size={120} />
                                <p>No hay domiciliarios registrados</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="delivery-queue">
                <div className="section-title">Cola de Entregas</div>
                <div className="queue-tabs">
                    <button className={`queue-tab ${activeTab === 'pendientes' ? 'active' : ''}`} onClick={() => setActiveTab('pendientes')}>
                        Pendientes ({deliveries.pendientes.length})
                    </button>
                    <button className={`queue-tab ${activeTab === 'en_curso' ? 'active' : ''}`} onClick={() => setActiveTab('en_curso')}>
                        En Curso ({deliveries.en_curso.length})
                    </button>
                    <button className={`queue-tab ${activeTab === 'completados' ? 'active' : ''}`} onClick={() => setActiveTab('completados')}>
                        Completados ({deliveries.completados.length})
                    </button>
                    <button className={`queue-tab incidents ${activeTab === 'incidentes' ? 'active' : ''}`} onClick={() => setActiveTab('incidentes')}>
                        ⚠️ Incidentes ({incidentes.length})
                    </button>
                </div>

                <div className="queue-list">
                    {activeTab === 'pendientes' && deliveries.pendientes.map(d => (
                        <div key={d.id} className="queue-item pending">
                            <div className="queue-item-info">
                                <span className="order-ref">{d.numero_pedido}</span>
                                <span className="client-name">{d.cliente_nombre}</span>
                                <span className="client-whatsapp">{d.cliente_whatsapp}</span>
                                <span className="order-total">{formatCOP(d.total)}</span>
                            </div>
                            <div className="queue-item-actions">
                                {(() => {
                                    const disponibles = drivers.filter(drv => drv.estado_activo && (!drv.suspendido_hasta || new Date(drv.suspendido_hasta) <= new Date()));
                                    if (disponibles.length === 0) {
                                        return <span className="assign-hint">Ningún domiciliario conectado. Deben entrar a su portal y activar "Conectado".</span>;
                                    }
                                    return (
                                        <select className="assign-select" onChange={(e) => e.target.value && handleAssign(d.id, e.target.value)} defaultValue="">
                                            <option value="" disabled>Asignar a...</option>
                                            {disponibles.map(drv => (
                                                <option key={drv.id} value={drv.id}>{drv.nombre} (⭐ {drv.score ?? 100})</option>
                                            ))}
                                        </select>
                                    );
                                })()}
                            </div>
                        </div>
                    ))}

                    {activeTab === 'en_curso' && deliveries.en_curso.map(d => (
                        <div key={d.id} className={`queue-item ${d.estado === 'en_ruta' ? 'in-route' : 'accepted'}`}>
                            <div className="queue-item-info">
                                <span className="order-ref">{d.numero_pedido}</span>
                                <span className="client-name">{d.cliente_nombre}</span>
                <span className="driver-name-sm">{d.domiciliario_nombre}</span>
                                <span className={`status-badge-sm ${d.estado}`}>{ESTADO_LABELS[d.estado] || d.estado}</span>
                            </div>
                        </div>
                    ))}

                    {activeTab === 'incidentes' && incidentes.map(inc => (
                        <div key={inc.id} className={`queue-item incident ${inc.estado_incidente}`}>
                            <div className="queue-item-info">
                                <span className="order-ref">{inc.numero_pedido}</span>
                                <span className="client-name">{inc.cliente_nombre}</span>
                                <span className="driver-name-sm">{inc.domiciliario_nombre || 'Sin asignar'} {inc.score != null ? `(⭐ ${inc.score})` : ''}</span>
                                <span className={`status-badge-sm ${inc.estado_incidente}`}>
                                    {inc.estado_incidente === 'retrasado' ? 'Retrasado' : 'Posible pérdida/robo'}
                                </span>
                                <span className="client-whatsapp">{inc.direccion_entrega}</span>
                            </div>
                            <div className="queue-item-actions incident-actions">
                                <button className="btn-resolver" onClick={() => handleResolverIncidente(inc.id, 'resuelto')}>Falsa alarma</button>
                                <button className="btn-robo" onClick={() => handleResolverIncidente(inc.id, 'robo_confirmado')}>Confirmar robo/pérdida</button>
                            </div>
                        </div>
                    ))}

                    {activeTab === 'completados' && deliveries.completados.map(d => (
                        <div key={d.id} className="queue-item completed">
                            <div className="queue-item-info">
                                <span className="order-ref">{d.numero_pedido}</span>
                                <span className="client-name">{d.cliente_nombre}</span>
                                <span className="driver-name-sm">{d.domiciliario_nombre}</span>
                                <span className="completed-meta">{d.km_recorridos}km · {formatCOP(d.tarifa_envio)}</span>
                            </div>
                        </div>
                    ))}

                    {activeTab === 'pendientes' && deliveries.pendientes.length === 0 && !loading && (
                        <div className="empty-queue">
                            <Illustration name="vacio-domicilios" size={120} />
                            <p>No hay entregas pendientes</p>
                        </div>
                    )}
                    {activeTab === 'en_curso' && deliveries.en_curso.length === 0 && !loading && (
                        <div className="empty-queue">No hay entregas en curso</div>
                    )}
                    {activeTab === 'completados' && deliveries.completados.length === 0 && !loading && (
                        <div className="empty-queue">No hay entregas completadas</div>
                    )}
                    {activeTab === 'incidentes' && incidentes.length === 0 && !loading && (
                        <div className="empty-queue">Sin incidentes abiertos 🎉</div>
                    )}
                </div>
            </div>

            <Modal isOpen={showAddDriver} onClose={() => setShowAddDriver(false)} title="Añadir Domiciliario" size="sm">
                <form onSubmit={handleAddDriver} className="add-driver-form">
                    <div className="form-group">
                        <label>Nombre</label>
                        <input type="text" value={newDriver.nombre} onChange={e => setNewDriver({ ...newDriver, nombre: e.target.value })} required placeholder="Nombre completo" />
                    </div>
                    <div className="form-group">
                        <label>Teléfono</label>
                        <input type="text" value={newDriver.telefono} onChange={e => setNewDriver({ ...newDriver, telefono: e.target.value })} required placeholder="3001234567" />
                    </div>
                    <div className="form-group">
                        <label>PIN de acceso</label>
                        <input type="text" value={newDriver.pin} onChange={e => setNewDriver({ ...newDriver, pin: e.target.value })} required placeholder="1234" minLength={4} />
                    </div>
                    <div className="form-actions">
                        <Button variant="ghost" type="button" onClick={() => setShowAddDriver(false)}>Cancelar</Button>
                        <Button type="submit">Guardar</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
