import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import Toast from '../../components/Toast';
import Illustration, { Character } from '../../components/ui/Illustration';
import './PortalDomiciliario.css';

import { API_ORIGIN as API_URL, SOCKET_URL } from '../../config';

// Aviso sonoro de pedido nuevo: antes el domiciliario solo se enteraba si
// tenía la pantalla abierta en el momento justo (el poll de 10s no siempre
// alcanza). Mismo pitido de dos notas que ya usa el dashboard del negocio
// para "pago confirmado" (Web Audio, sin archivo de audio que mantener).
// Distancia aproximada entre dos puntos en metros (fórmula de Haversine) —
// solo para decidir si vale la pena mandar la ubicación, no para rutas reales.
function distanciaMetros(a, b) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
    return 2 * R * Math.asin(Math.sqrt(h));
}

function reproducirAvisoPedido() {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        [660, 880].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const start = ctx.currentTime + i * 0.14;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
            osc.connect(gain).connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.24);
        });
        setTimeout(() => ctx.close(), 900);
    } catch {
        // El navegador puede bloquear audio sin interacción previa: no rompe nada
    }
}

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function AutoCenter({ position }) {
    const map = useMap();
    useEffect(() => { map.setView(position, map.getZoom()); }, [position]);
    return null;
}

const destinoIcon = L.divIcon({
    className: 'delivery-destino-marker',
    html: '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#ef4444" stroke="#fff" stroke-width="1"/></svg>',
    iconSize: [34, 34],
    iconAnchor: [17, 32]
});

function FitRoute({ ruta }) {
    const map = useMap();
    useEffect(() => {
        if (!ruta || ruta.length < 2) return;
        const t = setTimeout(() => {
            map.invalidateSize();
            map.fitBounds(ruta, { padding: [24, 24] });
        }, 150);
        return () => clearTimeout(t);
    }, [ruta]);
    return null;
}

const driverIcon = L.divIcon({
    className: 'delivery-driver-marker',
    html: '<div class="driver-pulse-ring"></div><svg viewBox="0 0 24 24" width="32" height="32"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#0288D1"/></svg>',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
});

// Iconos de línea (mismo trazo 2px que el resto del portal, sin librería aparte)
const IconUser = (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
const IconPin = (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>;
const IconMoney = (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
const IconLogout = (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
const IconWhatsapp = (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>;
const IconAlert = (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
const IconStar = (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="#F9A825" stroke="#F9A825" strokeWidth="1" {...p}><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9" /></svg>;
const IconStore = (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M3 9l1-6h16l1 6" /><path d="M3 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" /></svg>;
const IconHistory = (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>;

// Mismas categorías que valida el backend (api/routes/domicilios.js > TIPOS_INCIDENTE).
// Antes esto era un window.prompt() de una sola línea: el motivo nunca se guardaba
// en la base de datos, y el negocio veía TODO reportado como "posible robo" sin
// importar la causa real. Ahora el domiciliario elige una categoría real, y el
// detalle que escriba sí llega al panel de Incidentes del dueño.
const TIPOS_PROBLEMA = [
    { id: 'direccion', label: 'No encuentro la dirección' },
    { id: 'cliente_ausente', label: 'El cliente no contesta o no está' },
    { id: 'robo_sospecha', label: 'Sospecho de robo o fraude' },
    { id: 'accidente', label: 'Tuve un accidente' },
    { id: 'otro', label: 'Otro problema' },
];

function ReportarProblemaModal({ onCancelar, onEnviar }) {
    const [tipo, setTipo] = useState('');
    const [motivo, setMotivo] = useState('');
    const [enviando, setEnviando] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!tipo) return;
        setEnviando(true);
        await onEnviar(tipo, motivo.trim());
        setEnviando(false);
    };

    return (
        <div className="modal-overlay" onClick={onCancelar}>
            <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
                <h2>¿Qué está pasando?</h2>
                <p className="modal-subtitle">Elige la categoría que mejor describa el problema. El negocio verá exactamente lo que reportes.</p>

                <div className="modal-tipos">
                    {TIPOS_PROBLEMA.map((t) => (
                        <button
                            type="button"
                            key={t.id}
                            className={`modal-tipo-btn ${tipo === t.id ? 'active' : ''}`}
                            onClick={() => setTipo(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <label className="modal-label" htmlFor="motivo-detalle">Detalle (opcional)</label>
                <textarea
                    id="motivo-detalle"
                    className="modal-textarea"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Cuenta lo que necesites que el negocio sepa..."
                    maxLength={255}
                    rows={3}
                />

                <div className="modal-actions">
                    <button type="button" className="btn-outline" onClick={onCancelar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn-primary" disabled={!tipo || enviando}>
                        {enviando ? 'Enviando…' : 'Enviar reporte'}
                    </button>
                </div>
            </form>
        </div>
    );
}

// Antes era un window.prompt() pidiendo el código a mano, sin poder mostrar un error
// claro si el domiciliario lo escribía mal (el backend valida el código contra
// domicilios.codigo_confirmacion — ver POST /driver/update-status). Con el modal,
// un código incorrecto se puede corregir sin reabrir el prompt del navegador.
function ConfirmarEntregaModal({ onCancelar, onConfirmar }) {
    const [codigo, setCodigo] = useState('');
    const [error, setError] = useState('');
    const [enviando, setEnviando] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!codigo.trim()) return;
        setEnviando(true);
        setError('');
        const data = await onConfirmar(codigo.trim());
        setEnviando(false);
        if (data && data.success === false) {
            setError(data.error || 'No se pudo confirmar la entrega');
        }
    };

    return (
        <div className="modal-overlay" onClick={onCancelar}>
            <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
                <h2>Confirma la entrega</h2>
                <p className="modal-subtitle">Pídele al cliente el código que le llegó por WhatsApp y escríbelo aquí.</p>

                <label className="modal-label" htmlFor="codigo-entrega">Código de entrega</label>
                <input
                    id="codigo-entrega"
                    className="modal-code-input"
                    value={codigo}
                    onChange={(e) => { setCodigo(e.target.value); setError(''); }}
                    placeholder="0000"
                    inputMode="numeric"
                    autoFocus
                    maxLength={10}
                />
                {error && <p className="modal-error">{error}</p>}

                <div className="modal-actions" style={{ marginTop: 'var(--space-5)' }}>
                    <button type="button" className="btn-outline" onClick={onCancelar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn-primary" disabled={!codigo.trim() || enviando}>
                        {enviando ? 'Confirmando…' : 'Confirmar entrega'}
                    </button>
                </div>
            </form>
        </div>
    );
}

// Sin 'style: currency' a propósito: el ícono de dinero que la acompaña ya
// es un signo "$", y currency de Intl también antepone uno — se veía "$ $6.000".
const formatCOP = (val) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(val || 0);

// Antes /driver/stats solo daba totales agregados — este modal trae el
// detalle pedido por pedido (GET /driver/historial), cargado bajo demanda
// para no pedirlo en cada poll de fetchStats.
function HistorialModal({ onCerrar }) {
    const [items, setItems] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('driver_token');
        fetch(`${API_URL}/api/domicilios/driver/historial`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(data => {
                if (data.success) setItems(data.data);
                else setError(data.error || 'No se pudo cargar el historial');
            })
            .catch(() => setError('Error de conexión'))
            .finally(() => setCargando(false));
    }, []);

    return (
        <div className="modal-overlay" onClick={onCerrar}>
            <div className="modal-card modal-card-historial" onClick={(e) => e.stopPropagation()}>
                <h2>Historial de entregas</h2>
                <p className="modal-subtitle">Tus últimas {items.length > 0 ? items.length : ''} entregas completadas</p>

                <div className="historial-list">
                    {cargando && <p className="historial-hint">Cargando…</p>}
                    {!cargando && error && <p className="historial-hint">{error}</p>}
                    {!cargando && !error && items.length === 0 && (
                        <p className="historial-hint">Aún no tienes entregas completadas</p>
                    )}
                    {items.map((it) => (
                        <div key={it.domicilio_id} className="historial-item">
                            <div className="historial-item-main">
                                <span className="historial-item-order">{it.numero_pedido}</span>
                                <span className="historial-item-date">
                                    {new Date(it.updated_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            {it.restaurante_nombre && (
                                <span className="historial-item-restaurante"><IconStore /> {it.restaurante_nombre}</span>
                            )}
                            <div className="historial-item-footer">
                                <span className="historial-item-pago"><IconMoney /> {formatCOP(it.tarifa_envio)}</span>
                                <span className="historial-item-km">{Number(it.km_recorridos || 0).toFixed(1)}km</span>
                                {it.calificacion_cliente && (
                                    <span className="historial-item-rating"><IconStar width={14} height={14} /> {it.calificacion_cliente}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="modal-actions">
                    <button type="button" className="btn-primary btn-full" onClick={onCerrar}>Cerrar</button>
                </div>
            </div>
        </div>
    );
}

// Instalable como app, solo en estas rutas: el manifest y el service worker
// se enganchan al <head> cuando este componente monta y se sueltan al
// desmontar, para que el resto de la app (admin, dashboard del negocio) no
// quede "contaminado" con el ícono/manifest del portal si el domiciliario
// nunca visita otra parte del sitio con la misma pestaña.
function usarInstalable() {
    useEffect(() => {
        const elementos = [];

        const manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        manifestLink.href = '/delivery-manifest.json';
        document.head.appendChild(manifestLink);
        elementos.push(manifestLink);

        const themeColor = document.createElement('meta');
        themeColor.name = 'theme-color';
        themeColor.content = '#C62828';
        document.head.appendChild(themeColor);
        elementos.push(themeColor);

        // iOS no lee el manifest para "Agregar a inicio" — necesita estas dos.
        const appleCapable = document.createElement('meta');
        appleCapable.name = 'apple-mobile-web-app-capable';
        appleCapable.content = 'yes';
        document.head.appendChild(appleCapable);
        elementos.push(appleCapable);

        const appleIcon = document.createElement('link');
        appleIcon.rel = 'apple-touch-icon';
        appleIcon.href = '/icons/delivery-192.png';
        document.head.appendChild(appleIcon);
        elementos.push(appleIcon);

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/delivery-sw.js', { scope: '/delivery/' }).catch(() => {
                // Sin service worker el portal sigue funcionando igual, solo no
                // será instalable ni abrirá el cascarón sin señal.
            });
        }

        return () => elementos.forEach((el) => el.remove());
    }, []);
}

export default function PortalDomiciliario() {
    usarInstalable();
    const [view, setView] = useState('login');
    const [credentials, setCredentials] = useState({ telefono: '', pin: '' });
    const [driver, setDriver] = useState(null);
    const [toast, setToast] = useState(null);
    const [stats, setStats] = useState({ hoy: { pedidos_hoy: 0, ganancias_hoy: 0, km_hoy: 0 }, total: { total_pedidos: 0, total_ganancias: 0, total_km: 0, total_minutos: 0 }, pendientes: 0, reputacion: { score: 100, strikes: 0, suspendido_hasta: null } });
    const [pendientes, setPendientes] = useState([]);
    const [miEntrega, setMiEntrega] = useState(null);
    const [position, setPosition] = useState([1.148, -76.647]);
    const [isOnline, setIsOnline] = useState(false);
    const [reportando, setReportando] = useState(null); // domicilio_id del problema que se está reportando, o null
    const [confirmandoEntrega, setConfirmandoEntrega] = useState(null); // domicilio_id que espera el código de entrega, o null
    const [showHistorial, setShowHistorial] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const socketRef = useRef(null);
    const locationIntervalRef = useRef(null);
    const lastSentRef = useRef(null); // { lat, lng, at } — última ubicación que sí se mandó

    useEffect(() => {
        const token = localStorage.getItem('driver_token');
        const driverData = localStorage.getItem('driver_data');
        if (token && driverData) {
            setDriver(JSON.parse(driverData));
            setView('portal');
        }
        return () => {
            if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

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
                    setToast({ type: 'error', message: 'Sesión expirada, inicia sesión nuevamente' });
                    return;
                }
            }
            if (statsRes.success) setStats(statsRes.data);
            if (!ordersRes.success || ordersRes.error) {
                if (ordersRes.codigo === 'SIN_TOKEN' || ordersRes.codigo === 'TOKEN_INVALIDO' || ordersRes.codigo === 'TOKEN_EXPIRADO') {
                    handleLogout();
                    setToast({ type: 'error', message: 'Sesión expirada, inicia sesión nuevamente' });
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

    useEffect(() => {
        if (driver && isOnline) {
            const socket = io(SOCKET_URL, {
                auth: { token: localStorage.getItem('driver_token') },
                transports: ['websocket']
            });
            // El token del domiciliario también trae negocio_id, así que la API lo
            // une al mismo room 'negocio_<id>' que el dashboard del dueño — el
            // mismo evento 'domicilio_nuevo' que ya usa DomiciliosPage.jsx sirve
            // acá para avisar sin esperar hasta 10s del próximo poll de fetchStats.
            socket.on('domicilio_nuevo', () => {
                reproducirAvisoPedido();
                setToast({ type: 'success', message: '🛵 Nuevo pedido disponible' });
                fetchStats();
            });
            socketRef.current = socket;
            return () => socket.disconnect();
        }
    }, [driver, isOnline, fetchStats]);

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
                setToast({ type: 'success', message: `Bienvenido ${data.data.nombre}` });
            } else {
                setToast({ type: 'error', message: data.error || 'Credenciales inválidas' });
            }
        } catch (err) {
            setToast({ type: 'error', message: 'Error de conexión' });
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
                setToast({ type: 'success', message: nuevoEstado ? 'Conectado' : 'Desconectado' });

                if (nuevoEstado && navigator.geolocation) {
                    lastSentRef.current = null;
                    // Antes se mandaba la ubicación cada 5s sin importar si el
                    // domiciliario se había movido — un semáforo largo o la espera
                    // en el local ya gastaban batería y datos por nada. Ahora solo
                    // se manda si se movió más de 15m, o como máximo cada 30s (para
                    // que el mapa del negocio/cliente no se vea "congelado").
                    locationIntervalRef.current = setInterval(() => {
                        navigator.geolocation.getCurrentPosition(async (pos) => {
                            const lat = pos.coords.latitude;
                            const lng = pos.coords.longitude;
                            setPosition([lat, lng]);

                            const anterior = lastSentRef.current;
                            const seMovio = !anterior || distanciaMetros(anterior, { lat, lng }) > 15;
                            const pasoTiempo = !anterior || Date.now() - anterior.at > 30000;
                            if (!seMovio && !pasoTiempo) return;

                            lastSentRef.current = { lat, lng, at: Date.now() };
                            await fetch(`${API_URL}/api/domicilios/driver/location`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ latitud: lat, longitud: lng })
                            });
                        }, () => {}, { enableHighAccuracy: true, timeout: 5000 });
                    }, 5000);
                } else {
                    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
                    lastSentRef.current = null;
                }
            }
        } catch (err) {
            setToast({ type: 'error', message: 'Error al cambiar estado' });
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
                setToast({ type: 'success', message: 'Entrega aceptada' });
                fetchStats();
            } else {
                setToast({ type: 'error', message: data.error });
            }
        } catch (err) {
            // Sin señal en la calle es el caso más común acá — reintentar la misma
            // acción sin tener que volver a buscar el pedido en la lista.
            setToast({
                type: 'error',
                message: 'No se pudo conectar. ¿Reintentar?',
                duration: 0,
                action: { label: 'Reintentar', onClick: () => { setToast(null); handleAccept(domicilioId); } },
            });
        }
    };

    const handleUpdateStatus = async (domicilioId, estado, codigoConfirmacion = null) => {
        try {
            const token = localStorage.getItem('driver_token');
            const res = await fetch(`${API_URL}/api/domicilios/driver/update-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ domicilio_id: domicilioId, estado, codigo_confirmacion: codigoConfirmacion })
            });
            const data = await res.json();
            if (data.success) {
                setToast({ type: 'success', message: `Estado actualizado a ${estado.replace('_', ' ')}` });
                if (estado === 'entregado') {
                    setShowMap(false);
                    setMiEntrega(null);
                    setConfirmandoEntrega(null);
                }
                fetchStats();
            } else {
                setToast({ type: 'error', message: data.error });
            }
            return data;
        } catch (err) {
            setToast({
                type: 'error',
                message: 'No se pudo conectar. ¿Reintentar?',
                duration: 0,
                action: { label: 'Reintentar', onClick: () => { setToast(null); handleUpdateStatus(domicilioId, estado, codigoConfirmacion); } },
            });
            return { success: false, error: 'Error al actualizar' };
        }
    };

    const handleMarcarEntregado = (domicilioId) => {
        setConfirmandoEntrega(domicilioId);
    };

    const handleEnviarProblema = async (domicilioId, tipo, motivo) => {
        try {
            const token = localStorage.getItem('driver_token');
            const res = await fetch(`${API_URL}/api/domicilios/driver/reportar-problema`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ domicilio_id: domicilioId, tipo, motivo })
            });
            const data = await res.json();
            if (data.success) {
                setReportando(null);
                setToast({ type: 'success', message: 'Problema reportado, el negocio lo revisará' });
                fetchStats();
            } else {
                setToast({ type: 'error', message: data.error });
            }
        } catch (err) {
            setToast({
                type: 'error',
                message: 'No se pudo conectar. ¿Reintentar?',
                duration: 0,
                action: { label: 'Reintentar', onClick: () => { setToast(null); handleEnviarProblema(domicilioId, tipo, motivo); } },
            });
        }
    };

    const handleLogout = () => {
        if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
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
                {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
                <div className="login-card">
                    <div className="login-character">
                        <Character name="mateo" height={148} alt="Mateo, tu compañero de entregas" />
                    </div>
                    <h1>Portal Domiciliario</h1>
                    <p className="login-subtitle">Ingresa con tu teléfono y PIN para empezar a repartir</p>
                    <form onSubmit={handleLogin} className="login-form">
                        <div className="input-group">
                            <label>Teléfono</label>
                            <input type="text" inputMode="tel" value={credentials.telefono} onChange={e => setCredentials({ ...credentials, telefono: e.target.value })} placeholder="3001234567" required />
                        </div>
                        <div className="input-group">
                            <label>PIN</label>
                            <input type="password" inputMode="numeric" value={credentials.pin} onChange={e => setCredentials({ ...credentials, pin: e.target.value })} placeholder="1234" required />
                        </div>
                        <button type="submit" className="btn-primary">Ingresar</button>
                    </form>
                    <p className="login-legal">
                        Al ingresar aceptas los{' '}
                        <Link to="/delivery/terminos" target="_blank" rel="noopener noreferrer">
                            Términos para domiciliarios
                        </Link>
                        .
                    </p>
                </div>
            </div>
        );
    }

    const estadoLabel = { asignado: 'Asignado', aceptado: 'Aceptado', en_ruta: 'En ruta', entregado: 'Entregado' };

    return (
        <div className="portal-container">
            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

            <div className="portal-header">
                <div className="portal-user">
                    <div className="avatar">{driver?.nombre?.charAt(0)}</div>
                    <div className="portal-user-text">
                        <h2>{driver?.nombre}</h2>
                        <span className="driver-phone">{driver?.telefono}</span>
                    </div>
                </div>
                <div className="portal-header-actions">
                    <button className="btn-logout" onClick={() => setShowHistorial(true)} aria-label="Historial de entregas">
                        <IconHistory />
                    </button>
                    <button className="btn-logout" onClick={handleLogout} aria-label="Cerrar sesión">
                        <IconLogout />
                    </button>
                </div>
            </div>

            <div className="portal-body">
                <button className={`online-toggle ${isOnline ? 'is-online' : ''}`} onClick={toggleOnline}>
                    <span className="online-toggle-mateo">
                        <Character name="mateo" height={56} alt="" />
                    </span>
                    <span className="online-toggle-text">
                        <strong>{isOnline ? 'Estás en línea' : 'Estás desconectado'}</strong>
                        <span>{isOnline ? 'Recibiendo entregas cerca de ti' : 'Toca para empezar a recibir entregas'}</span>
                    </span>
                    <span className={`toggle-switch ${isOnline ? 'active' : ''}`}>
                        <span className="toggle-knob"></span>
                    </span>
                </button>

                {isOnline && (
                    <div className="stats-grid">
                        <div className="stat-bubble"><span className="stat-num">{stats.hoy.pedidos_hoy}</span><span>Hoy</span></div>
                        <div className="stat-bubble"><span className="stat-num">${stats.hoy.ganancias_hoy.toLocaleString()}</span><span>Ganado</span></div>
                        <div className="stat-bubble"><span className="stat-num">{stats.hoy.km_hoy}km</span><span>Recorrido</span></div>
                        <div className="stat-bubble"><span className="stat-num">{stats.reputacion?.score ?? 100}</span><span>Puntaje</span></div>
                    </div>
                )}

                {isOnline && stats.total?.calificaciones_recibidas > 0 && (
                    <div className="rating-summary">
                        <IconStar />
                        <span className="rating-summary-num">{stats.total.calificacion_promedio}</span>
                        <span className="rating-summary-label">
                            {stats.total.calificaciones_recibidas === 1
                                ? '1 calificación de tus clientes'
                                : `${stats.total.calificaciones_recibidas} calificaciones de tus clientes`}
                        </span>
                    </div>
                )}

                {stats.reputacion?.suspendido_hasta && new Date(stats.reputacion.suspendido_hasta) > new Date() && (
                    <div className="suspension-banner">
                        <IconAlert />
                        <span>Estás suspendido hasta {new Date(stats.reputacion.suspendido_hasta).toLocaleString('es-CO')} por incidentes anteriores. No puedes tomar nuevos domicilios hasta entonces.</span>
                    </div>
                )}

                {isOnline && miEntrega && (
                    <div className="active-delivery">
                        <div className="delivery-header">
                            <h3>Entrega activa</h3>
                            <span className={`status-badge status-${miEntrega.estado}`}>{estadoLabel[miEntrega.estado] || miEntrega.estado.replace('_', ' ')}</span>
                        </div>

                        <div className="delivery-info">
                            <span className="delivery-order">{miEntrega.numero_pedido}</span>
                            {miEntrega.restaurante_nombre && (
                                <span className="delivery-row"><IconStore /> Recoger en {miEntrega.restaurante_nombre}{miEntrega.restaurante_direccion ? ` — ${miEntrega.restaurante_direccion}` : ''}</span>
                            )}
                            <span className="delivery-row"><IconUser /> {miEntrega.cliente_nombre}</span>
                            <span className="delivery-row"><IconPin /> {miEntrega.direccion_entrega || 'Sin dirección'}</span>
                        </div>

                        {showMap && (
                            <div className="delivery-map">
                                <MapContainer center={position} zoom={15} style={{ height: '180px', width: '100%' }}>
                                    <TileLayer url={`https://tiles.traveltimeapp.com/positron/{z}/{x}/{y}.png?key=${import.meta.env.VITE_TRAVELTIME_APP_ID}`} />
                                    {miEntrega.ruta && <Polyline positions={miEntrega.ruta} pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.8 }} />}
                                    {miEntrega.destino && <Marker position={[miEntrega.destino.lat, miEntrega.destino.lng]} icon={destinoIcon} />}
                                    {miEntrega.ruta ? <FitRoute ruta={miEntrega.ruta} /> : null}
                                    <Marker position={position} icon={driverIcon}>
                                        {!miEntrega.ruta && <AutoCenter position={position} />}
                                    </Marker>
                                </MapContainer>
                            </div>
                        )}

                        <div className="delivery-secondary-actions">
                            {miEntrega.direccion_entrega && (
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(miEntrega.direccion_entrega)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-outline btn-sm"
                                >
                                    <IconPin /> Cómo llegar
                                </a>
                            )}
                            {miEntrega.cliente_whatsapp && (
                                <a href={`https://wa.me/${miEntrega.cliente_whatsapp.replace('+', '')}`} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm btn-whatsapp">
                                    <IconWhatsapp /> WhatsApp
                                </a>
                            )}
                            <button className="btn-outline btn-sm btn-warn" onClick={() => setReportando(miEntrega.domicilio_id)}>
                                <IconAlert /> Reportar problema
                            </button>
                        </div>

                        {/* Barra fija con la acción principal: siempre visible sin tener que hacer scroll */}
                        <div className="delivery-primary-action">
                            {miEntrega.estado === 'aceptado' && (
                                <button className="btn-primary btn-full" onClick={() => handleUpdateStatus(miEntrega.domicilio_id, 'en_ruta')}>
                                    Iniciar ruta
                                </button>
                            )}
                            {miEntrega.estado === 'en_ruta' && (
                                <button className="btn-primary btn-full" onClick={() => handleMarcarEntregado(miEntrega.domicilio_id)}>
                                    Marcar entregado
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {isOnline && !miEntrega && (
                    <>
                        <div className="section-label">
                            <h3>Pedidos pendientes</h3>
                            {stats.pendientes > 0 && <span className="section-count">{stats.pendientes}</span>}
                        </div>

                        <div className="pending-list">
                            {pendientes.length === 0 ? (
                                <div className="empty-state">
                                    <Character name="mateo" height={120} alt="" />
                                    <p>Aún no hay pedidos por aquí</p>
                                    <span>Espera a que lleguen nuevas entregas, te avisamos apenas caiga una</span>
                                </div>
                            ) : (
                                pendientes.map(p => (
                                    <div key={p.domicilio_id} className="pending-card">
                                        <div className="pending-header">
                                            <span className="pending-order">{p.numero_pedido}</span>
                                            <span className="pending-pay"><IconMoney /> {formatCOP(p.tarifa_envio)}</span>
                                        </div>
                                        <div className="pending-body">
                                            {p.restaurante_nombre && (
                                                <span><IconStore /> Recoger en {p.restaurante_nombre}</span>
                                            )}
                                            <span><IconUser /> {p.cliente_nombre}</span>
                                            <span><IconPin /> {p.direccion_entrega || 'Sin dirección'}</span>
                                        </div>
                                        <button className="btn-primary btn-full" onClick={() => handleAccept(p.domicilio_id)}>
                                            Aceptar entrega
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}

                {!isOnline && (
                    <div className="empty-state offline-hint">
                        <Character name="mateo" height={140} alt="" />
                        <p>Mateo te espera despierto</p>
                        <span>Conéctate arriba para empezar a ver y aceptar entregas</span>
                    </div>
                )}
            </div>

            {reportando && (
                <ReportarProblemaModal
                    onCancelar={() => setReportando(null)}
                    onEnviar={(tipo, motivo) => handleEnviarProblema(reportando, tipo, motivo)}
                />
            )}

            {confirmandoEntrega && (
                <ConfirmarEntregaModal
                    onCancelar={() => setConfirmandoEntrega(null)}
                    onConfirmar={(codigo) => handleUpdateStatus(confirmandoEntrega, 'entregado', codigo)}
                />
            )}

            {showHistorial && <HistorialModal onCerrar={() => setShowHistorial(false)} />}
        </div>
    );
}
