import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { initSocket, subscribeToNegocio, disconnectSocket } from '../../services/socket';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import './DomiciliosPage.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const driverIcon = L.divIcon({
    className: 'driver-marker',
    html: '<div class="driver-pulse"></div><svg viewBox="0 0 24 24" width="24" height="24"><path d="M5 8l6-6 6 6H5zm0 8h12l-6 6-6-6z" fill="#00FFD1"/></svg>',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

const activeDriverIcon = L.divIcon({
    className: 'driver-marker active',
    html: '<div class="driver-pulse active"></div><svg viewBox="0 0 24 24" width="28" height="28"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#00FFD1"/></svg>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
});

function MapUpdater({ drivers }) {
    const map = useMap();
    useEffect(() => {
        if (drivers.length > 0) {
            const bounds = L.latLngBounds(drivers.filter(d => d.latitud && d.longitud).map(d => [d.latitud, d.longitud]));
            if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [drivers]);
    return null;
}

export default function DomiciliosPage() {
    const { user } = useAuth();
    const [drivers, setDrivers] = useState([]);
    const [deliveries, setDeliveries] = useState({ pendientes: [], en_curso: [], completados: [] });
    const [conteo, setConteo] = useState({ pendientes: 0, en_ruta: 0 });
    const [loading, setLoading] = useState(true);
    const [showAddDriver, setShowAddDriver] = useState(false);
    const [newDriver, setNewDriver] = useState({ nombre: '', telefono: '', pin: '' });
    const [activeTab, setActiveTab] = useState('pendientes');
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
    };

    const fetchData = async () => {
        try {
            const [driversRes, activeRes] = await Promise.all([
                apiService.get('/api/domicilios/drivers'),
                apiService.get('/api/domicilios/active')
            ]);
            if (driversRes.success) {
                setDrivers(driversRes.data);
                setConteo(driversRes.conteo);
            }
            if (activeRes.success) setDeliveries(activeRes.data);
        } catch (err) {
            console.error('Error fetching delivery data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddDriver = async (e) => {
        e.preventDefault();
        try {
            const res = await apiService.post('/api/domicilios/drivers', newDriver);
            if (res.success) {
                toast.success('Domiciliario creado');
                setShowAddDriver(false);
                setNewDriver({ nombre: '', telefono: '', pin: '' });
                fetchData();
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error al crear domiciliario');
        }
    };

    const handleDeleteDriver = async (id) => {
        if (!window.confirm('¿Desactivar este domiciliario?')) return;
        try {
            await apiService.delete(`/api/domicilios/drivers/${id}`);
            toast.success('Domiciliario desactivado');
            fetchData();
        } catch (err) {
            toast.error('Error al desactivar');
        }
    };

    const handleAssign = async (domicilioId, driverId) => {
        try {
            await apiService.post('/api/domicilios/assign', { domicilio_id: domicilioId, domiciliario_id: driverId });
            toast.success('Domicilio asignado');
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error al asignar');
        }
    };

    const formatCOP = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);

    const activeDriversOnMap = drivers.filter(d => d.estado_activo && d.latitud && d.longitud);

    return (
        <div className="domicilios-page">
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
                                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                            />
                            <MapUpdater drivers={activeDriversOnMap} />
                            {activeDriversOnMap.map(driver => (
                                <Marker key={driver.id} position={[driver.latitud, driver.longitud]} icon={activeDriverIcon}>
                                    <Popup>
                                        <div className="driver-popup">
                                            <strong>{driver.nombre}</strong>
                                            <span>{driver.telefono}</span>
                                            <span>📦 {driver.pedidos_completados || 0} hoy</span>
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
                                        <span>📦 {driver.pedidos_completados || 0}</span>
                                        <span>💰 {formatCOP(driver.ganancias_totales)}</span>
                                        <span>📍 {driver.km_totales || 0}km</span>
                                    </div>
                                </div>
                                <button className="driver-delete" onClick={() => handleDeleteDriver(driver.id)} title="Desactivar">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                            </div>
                        ))}
                        {drivers.length === 0 && !loading && (
                            <div className="empty-drivers">No hay domiciliarios registrados</div>
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
                                <select className="assign-select" onChange={(e) => e.target.value && handleAssign(d.id, e.target.value)} defaultValue="">
                                    <option value="" disabled>Asignar a...</option>
                                    {drivers.filter(drv => drv.estado_activo).map(drv => (
                                        <option key={drv.id} value={drv.id}>{drv.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ))}

                    {activeTab === 'en_curso' && deliveries.en_curso.map(d => (
                        <div key={d.id} className={`queue-item ${d.estado === 'en_ruta' ? 'in-route' : 'accepted'}`}>
                            <div className="queue-item-info">
                                <span className="order-ref">{d.numero_pedido}</span>
                                <span className="client-name">{d.cliente_nombre}</span>
                                <span className="driver-name-sm">🛵 {d.domiciliario_nombre}</span>
                                <span className={`status-badge-sm ${d.estado}`}>{d.estado.replace('_', ' ')}</span>
                            </div>
                        </div>
                    ))}

                    {activeTab === 'completados' && deliveries.completados.map(d => (
                        <div key={d.id} className="queue-item completed">
                            <div className="queue-item-info">
                                <span className="order-ref">{d.numero_pedido}</span>
                                <span className="client-name">{d.cliente_nombre}</span>
                                <span className="driver-name-sm">🛵 {d.domiciliario_nombre}</span>
                                <span className="completed-meta">{d.km_recorridos}km · {formatCOP(d.tarifa_envio)}</span>
                            </div>
                        </div>
                    ))}

                    {activeTab === 'pendientes' && deliveries.pendientes.length === 0 && !loading && (
                        <div className="empty-queue">No hay entregas pendientes</div>
                    )}
                    {activeTab === 'en_curso' && deliveries.en_curso.length === 0 && !loading && (
                        <div className="empty-queue">No hay entregas en curso</div>
                    )}
                    {activeTab === 'completados' && deliveries.completados.length === 0 && !loading && (
                        <div className="empty-queue">No hay entregas completadas</div>
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
