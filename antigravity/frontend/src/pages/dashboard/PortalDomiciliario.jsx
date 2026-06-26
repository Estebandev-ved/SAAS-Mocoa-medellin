import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';
import './PortalDomiciliario.css';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3002';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SIMULATION_ROUTES = {
    mocoa: [
        [1.148, -76.647], [1.149, -76.648], [1.150, -76.649], [1.151, -76.650],
        [1.152, -76.651], [1.153, -76.650], [1.154, -76.649], [1.155, -76.648],
        [1.156, -76.647], [1.155, -76.646], [1.154, -76.645], [1.153, -76.644],
        [1.152, -76.643], [1.151, -76.642], [1.150, -76.643], [1.149, -76.644]
    ],
    medellin: [
        [6.247, -75.566], [6.248, -75.567], [6.250, -75.568], [6.252, -75.569],
        [6.254, -75.570], [6.255, -75.569], [6.256, -75.567], [6.257, -75.565],
        [6.256, -75.563], [6.255, -75.561], [6.253, -75.560], [6.251, -75.561],
        [6.249, -75.562], [6.247, -75.563], [6.246, -75.565], [6.247, -75.566]
    ]
};

function AutoCenter({ position }) {
    const map = useMap();
    useEffect(() => { map.setView(position, map.getZoom()); }, [position]);
    return null;
}

const driverIcon = L.divIcon({
    className: 'delivery-driver-marker',
    html: '<div class="driver-pulse-ring"></div><svg viewBox="0 0 24 24" width="32" height="32"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#00FFD1"/></svg>',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
});

export default function PortalDomiciliario() {
    const [view, setView] = useState('login');
    const [credentials, setCredentials] = useState({ telefono: '', pin: '' });
    const [driver, setDriver] = useState(null);
    const [stats, setStats] = useState({ hoy: { pedidos_hoy: 0, ganancias_hoy: 0, km_hoy: 0 }, total: { total_pedidos: 0, total_ganancias: 0, total_km: 0, total_minutos: 0 }, pendientes: 0 });
    const [pendientes, setPendientes] = useState([]);
    const [miEntrega, setMiEntrega] = useState(null);
    const [position, setPosition] = useState([1.148, -76.647]);
    const [isOnline, setIsOnline] = useState(false);
    const [simulating, setSimulating] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const socketRef = useRef(null);
    const simIntervalRef = useRef(null);
    const simStepRef = useRef(0);
    const simRouteRef = useRef('mocoa');
    const locationIntervalRef = useRef(null);

    useEffect(() => {
        const token = localStorage.getItem('driver_token');
        const driverData = localStorage.getItem('driver_data');
        if (token && driverData) {
            setDriver(JSON.parse(driverData));
            setView('portal');
        }
        return () => {
            if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
            if (simIntervalRef.current) clearInterval(simIntervalRef.current);
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    useEffect(() => {
        if (driver && isOnline) {
            const socket = io(SOCKET_URL, {
                auth: { token: localStorage.getItem('driver_token') },
                transports: ['websocket']
            });
            socketRef.current = socket;
            return () => socket.disconnect();
        }
    }, [driver, isOnline]);

    const fetchStats = useCallback(async () => {
        if (!driver) return;
        try {
            const token = localStorage.getItem('driver_token');
            if (!token) {
                handleLogout();
                return;
            }
            const headers = { Authorization: `Bearer ${token}` };
            const [statsRes, ordersRes] = await Promise.all([
                fetch(`${API_URL}/api/domicilios/driver/stats`, { headers }).then(r => r.json()),
                fetch(`${API_URL}/api/domicilios/driver/orders`, { headers }).then(r => r.json())
            ]);
            if (!statsRes.success || statsRes.error) {
                if (statsRes.codigo === 'SIN_TOKEN' || statsRes.codigo === 'TOKEN_INVALIDO' || statsRes.codigo === 'TOKEN_EXPIRADO') {
                    handleLogout();
                    toast.error('Sesión expirada, inicia sesión nuevamente');
                    return;
                }
            }
            if (statsRes.success) setStats(statsRes.data);
            if (!ordersRes.success || ordersRes.error) {
                if (ordersRes.codigo === 'SIN_TOKEN' || ordersRes.codigo === 'TOKEN_INVALIDO' || ordersRes.codigo === 'TOKEN_EXPIRADO') {
                    handleLogout();
                    toast.error('Sesión expirada, inicia sesión nuevamente');
                    return;
                }
            }
            if (ordersRes.success) {
                setPendientes(ordersRes.data.pendientes);
                setMiEntrega(ordersRes.data.mi_entrega);
                if (ordersRes.data.mi_entrega) setShowMap(true);
            }
        } catch (err) {
            console.error('Error fetching driver data:', err);
        }
    }, [driver]);

    useEffect(() => {
        if (view === 'portal' && driver) {
            fetchStats();
            const interval = setInterval(fetchStats, 10000);
            return () => clearInterval(interval);
        }
    }, [view, driver, fetchStats]);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/api/domicilios/driver/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials)
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('driver_token', data.token);
                localStorage.setItem('driver_data', JSON.stringify(data.data));
                setDriver(data.data);
                setView('portal');
                toast.success(`Bienvenido ${data.data.nombre}`);
            } else {
                toast.error(data.error || 'Credenciales inválidas');
            }
        } catch (err) {
            toast.error('Error de conexión');
        }
    };

    const toggleOnline = async () => {
        if (!driver) return;
        const nuevoEstado = !isOnline;
        try {
            const token = localStorage.getItem('driver_token');
            const res = await fetch(`${API_URL}/api/domicilios/driver/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ activo: nuevoEstado })
            });
            const data = await res.json();
            if (data.success) {
                setIsOnline(nuevoEstado);
                toast.success(nuevoEstado ? 'Conectado' : 'Desconectado');

                if (nuevoEstado && navigator.geolocation) {
                    locationIntervalRef.current = setInterval(() => {
                        navigator.geolocation.getCurrentPosition(async (pos) => {
                            const lat = pos.coords.latitude;
                            const lng = pos.coords.longitude;
                            setPosition([lat, lng]);
                            await fetch(`${API_URL}/api/domicilios/driver/location`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ latitud: lat, longitud: lng })
                            });
                        }, () => {}, { enableHighAccuracy: true, timeout: 5000 });
                    }, 5000);
                } else {
                    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
                }
            }
        } catch (err) {
            toast.error('Error al cambiar estado');
        }
    };

    const handleAccept = async (domicilioId) => {
        try {
            const token = localStorage.getItem('driver_token');
            const res = await fetch(`${API_URL}/api/domicilios/driver/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ domicilio_id: domicilioId })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Entrega aceptada');
                fetchStats();
            } else {
                toast.error(data.error);
            }
        } catch (err) {
            toast.error('Error al aceptar');
        }
    };

    const handleUpdateStatus = async (domicilioId, estado) => {
        try {
            const token = localStorage.getItem('driver_token');
            const res = await fetch(`${API_URL}/api/domicilios/driver/update-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ domicilio_id: domicilioId, estado })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Estado actualizado a ${estado.replace('_', ' ')}`);
                if (estado === 'entregado') {
                    setShowMap(false);
                    setMiEntrega(null);
                }
                fetchStats();
            } else {
                toast.error(data.error);
            }
        } catch (err) {
            toast.error('Error al actualizar');
        }
    };

    const startSimulation = () => {
        if (simulating) return;
        setSimulating(true);
        const route = SIMULATION_ROUTES[simRouteRef.current] || SIMULATION_ROUTES.mocoa;
        simStepRef.current = 0;

        simIntervalRef.current = setInterval(async () => {
            const step = simStepRef.current;
            if (step >= route.length) {
                clearInterval(simIntervalRef.current);
                setSimulating(false);
                return;
            }
            const [lat, lng] = route[step];
            setPosition([lat, lng]);
            simStepRef.current++;

            const token = localStorage.getItem('driver_token');
            try {
                await fetch(`${API_URL}/api/domicilios/driver/location`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ latitud: lat, longitud: lng })
                });
            } catch (e) {}
        }, 3000);
    };

    const handleLogout = () => {
        if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
        if (simIntervalRef.current) clearInterval(simIntervalRef.current);
        localStorage.removeItem('driver_token');
        localStorage.removeItem('driver_data');
        setDriver(null);
        setView('login');
        setIsOnline(false);
        setMiEntrega(null);
    };

    if (view === 'login') {
        return (
            <div className="portal-login">
                <div className="login-card">
                    <div className="login-icon">
                        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#00FFD1" strokeWidth="1.5">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                        </svg>
                    </div>
                    <h1>Portal Domiciliario</h1>
                    <p className="login-subtitle">Ingresa con tu teléfono y PIN</p>
                    <form onSubmit={handleLogin} className="login-form">
                        <div className="input-group">
                            <label>Teléfono</label>
                            <input type="text" value={credentials.telefono} onChange={e => setCredentials({ ...credentials, telefono: e.target.value })} placeholder="3001234567" required />
                        </div>
                        <div className="input-group">
                            <label>PIN</label>
                            <input type="password" value={credentials.pin} onChange={e => setCredentials({ ...credentials, pin: e.target.value })} placeholder="1234" required />
                        </div>
                        <button type="submit" className="btn-primary">Ingresar</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="portal-container">
            <div className="portal-header">
                <div className="portal-user">
                    <div className="avatar">{driver?.nombre?.charAt(0)}</div>
                    <div>
                        <h2>{driver?.nombre}</h2>
                        <span className="driver-phone">{driver?.telefono}</span>
                    </div>
                </div>
                <button className="btn-logout" onClick={handleLogout}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                </button>
            </div>

            <div className="online-toggle">
                <div className={`toggle-switch ${isOnline ? 'active' : ''}`} onClick={toggleOnline}>
                    <div className="toggle-knob"></div>
                </div>
                <span className={`toggle-label ${isOnline ? 'online' : ''}`}>{isOnline ? 'Conectado' : 'Desconectado'}</span>
            </div>

            {isOnline && (
                <div className="stats-row">
                    <div className="stat-bubble"><span className="stat-num">{stats.hoy.pedidos_hoy}</span><span>Hoy</span></div>
                    <div className="stat-bubble"><span className="stat-num">${stats.hoy.ganancias_hoy.toLocaleString()}</span><span>Ganado</span></div>
                    <div className="stat-bubble"><span className="stat-num">{stats.hoy.km_hoy}km</span><span>Recorrido</span></div>
                    <div className="stat-bubble"><span className="stat-num">{stats.total.total_pedidos}</span><span>Total</span></div>
                </div>
            )}

            {isOnline && miEntrega && (
                <div className="active-delivery">
                    <div className="delivery-header">
                        <h3>Entrega Activa</h3>
                        <span className={`status-badge ${miEntrega.estado}`}>{miEntrega.estado.replace('_', ' ')}</span>
                    </div>
                    <div className="delivery-body">
                        <div className="delivery-info">
                            <span className="delivery-order">{miEntrega.numero_pedido}</span>
                            <span className="delivery-client">👤 {miEntrega.cliente_nombre}</span>
                            <span className="delivery-address">📍 {miEntrega.direccion_entrega || 'Sin dirección'}</span>
                        </div>
                        <div className="delivery-actions">
                            {miEntrega.cliente_whatsapp && (
                                <a href={`https://wa.me/${miEntrega.cliente_whatsapp.replace('+', '')}`} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                    WhatsApp
                                </a>
                            )}
                            {miEntrega.estado === 'aceptado' && (
                                <button className="btn-route" onClick={() => handleUpdateStatus(miEntrega.domicilio_id, 'en_ruta')}>
                                    Iniciar Ruta
                                </button>
                            )}
                            {miEntrega.estado === 'en_ruta' && !simulating && (
                                <button className="btn-route simulate" onClick={startSimulation}>
                                    Simular Ruta
                                </button>
                            )}
                            {miEntrega.estado === 'en_ruta' && (
                                <button className="btn-delivered" onClick={() => handleUpdateStatus(miEntrega.domicilio_id, 'entregado')}>
                                    Marcar Entregado
                                </button>
                            )}
                        </div>
                    </div>

                    {showMap && (
                        <div className="delivery-map">
                            <MapContainer center={position} zoom={15} style={{ height: '200px', width: '100%', borderRadius: '0 0 12px 12px' }}>
                                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                                <Marker position={position} icon={driverIcon}>
                                    <AutoCenter position={position} />
                                </Marker>
                            </MapContainer>
                        </div>
                    )}

                    {simulating && (
                        <div className="simulation-bar">
                            <div className="sim-spinner"></div>
                            <span>Simulando ruta GPS...</span>
                            <button className="btn-stop-sim" onClick={() => { clearInterval(simIntervalRef.current); setSimulating(false); }}>Detener</button>
                        </div>
                    )}
                </div>
            )}

            {isOnline && !miEntrega && (
                <>
                    <div className="section-label">
                        <h3>Pedidos Pendientes ({stats.pendientes})</h3>
                    </div>
                    <div className="pending-list">
                        {pendientes.length === 0 ? (
                            <div className="empty-state">
                                <p>No hay pedidos pendientes</p>
                                <span>Espera a que lleguen nuevas entregas</span>
                            </div>
                        ) : (
                            pendientes.map(p => (
                                <div key={p.domicilio_id} className="pending-card">
                                    <div className="pending-header">
                                        <span className="pending-order">{p.numero_pedido}</span>
                                        <span className="pending-pay">💰 {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(p.tarifa_envio)}</span>
                                    </div>
                                    <div className="pending-body">
                                        <span>👤 {p.cliente_nombre}</span>
                                        <span>📍 {p.direccion_entrega || 'Sin dirección'}</span>
                                    </div>
                                    <button className="btn-accept" onClick={() => handleAccept(p.domicilio_id)}>
                                        Aceptar Entrega
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
