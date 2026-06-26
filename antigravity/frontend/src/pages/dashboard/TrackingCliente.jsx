import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './TrackingCliente.css';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3002';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const moverIcon = L.divIcon({
    className: 'tracking-mover-icon',
    html: '<div class="pulse-ring"></div><svg viewBox="0 0 24 24" width="36" height="36"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#00FFD1"/></svg>',
    iconSize: [44, 44],
    iconAnchor: [22, 22]
});

function MapAutoCenter({ position }) {
    const map = useMap();
    useEffect(() => {
        if (position) map.setView(position, 15);
    }, [position]);
    return null;
}

const STEP_ORDER = ['pendiente', 'aceptado', 'en_ruta', 'entregado'];

export default function TrackingCliente() {
    const { token } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [driverPos, setDriverPos] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);
    const socketRef = useRef(null);

    useEffect(() => {
        fetchTracking();

        const socket = io(SOCKET_URL, {
            transports: ['websocket'],
            query: { trackingToken: token },
            reconnection: true,
            reconnectionAttempts: 5
        });

        socket.on('connect', () => console.log('[Tracking] Conectado'));

        socket.on('domicilio_actualizado', (update) => {
            if (update.estado) {
                const stepIndex = STEP_ORDER.indexOf(update.estado);
                if (stepIndex >= 0) setCurrentStep(stepIndex);
                setData(prev => prev ? { ...prev, estado: update.estado } : prev);
            }
        });

        socket.on('driver_location', (location) => {
            if (location.latitud && location.longitud) {
                setDriverPos([location.latitud, location.longitud]);
            }
        });

        socket.on('connect_error', (err) => {
            console.log('[Tracking] Error socket:', err.message);
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
        };
    }, [token]);

    const fetchTracking = async () => {
        try {
            const res = await fetch(`${API_URL}/api/domicilios/public/track/${token}`);
            const json = await res.json();
            if (json.success) {
                setData(json.data);
                const stepIndex = STEP_ORDER.indexOf(json.data.estado);
                setCurrentStep(stepIndex >= 0 ? stepIndex : 0);
                if (json.data.latitud && json.data.longitud) {
                    setDriverPos([json.data.latitud, json.data.longitud]);
                }
            } else {
                setError('Seguimiento no encontrado');
            }
        } catch (err) {
            setError('Error al cargar seguimiento');
        } finally {
            setLoading(false);
        }
    };

    const formatCOP = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);

    const STEP_LABELS = [
        { label: 'Pedido Recibido', icon: '📋' },
        { label: 'Preparando', icon: '👨‍🍳' },
        { label: 'En Camino', icon: '🛵' },
        { label: 'Entregado', icon: '✅' }
    ];

    if (loading) {
        return (
            <div className="tracking-loading">
                <div className="tracking-spinner"></div>
                <p>Cargando seguimiento...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="tracking-error">
                <div className="error-card">
                    <span className="error-icon">❌</span>
                    <h2>Seguimiento no encontrado</h2>
                    <p>El enlace de seguimiento no es válido o ha expirado.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="tracking-page">
            <div className="tracking-header">
                <div className="tracking-brand">
                    <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
                        <circle cx="24" cy="24" r="24" fill="#00FFD1"/>
                        <path d="M24 12L32 20L24 28L16 20L24 12Z" fill="#0A0F14"/>
                    </svg>
                    <span>ANTIGRAVITY</span>
                </div>
                <div className="tracking-order">Pedido {data?.numero_pedido}</div>
            </div>

            <div className="tracking-stepper">
                {STEP_LABELS.map((step, i) => (
                    <div key={i} className={`step-item ${i <= currentStep ? 'completed' : ''} ${i === currentStep ? 'active' : ''}`}>
                        <div className="step-indicator">
                            <span className="step-icon">{i < currentStep ? '✓' : step.icon}</span>
                        </div>
                        <span className="step-label">{step.label}</span>
                        {i < STEP_LABELS.length - 1 && <div className={`step-line ${i < currentStep ? 'filled' : ''}`} />}
                    </div>
                ))}
            </div>

            {data?.estado === 'entregado' ? (
                <div className="delivered-banner">
                    <span>🎉</span>
                    <div>
                        <h3>¡Pedido Entregado!</h3>
                        <p>Gracias por comprar con nosotros</p>
                    </div>
                </div>
            ) : data?.estado === 'cancelado' ? (
                <div className="cancelled-banner">
                    <span>⚠️</span>
                    <div>
                        <h3>Pedido Cancelado</h3>
                        <p>Este pedido fue cancelado</p>
                    </div>
                </div>
            ) : null}

            <div className="tracking-map-wrapper">
                <MapContainer center={driverPos || [1.148, -76.647]} zoom={15} style={{ height: '280px', width: '100%' }}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                    {driverPos && (
                        <Marker position={driverPos} icon={moverIcon}>
                            <MapAutoCenter position={driverPos} />
                        </Marker>
                    )}
                </MapContainer>
                <div className="map-overlay-text">
                    {data?.estado === 'en_ruta' ? '🛵 Tu domiciliario está en camino' :
                     data?.estado === 'aceptado' ? '📦 Preparando tu pedido' :
                     data?.estado === 'entregado' ? '✅ Entregado' : '⏳ Pendiente'}
                </div>
            </div>

            {data?.domiciliario_nombre && (
                <div className="driver-info-card">
                    <div className="driver-avatar-lg">
                        {data.domiciliario_nombre.charAt(0)}
                    </div>
                    <div className="driver-details">
                        <h3>{data.domiciliario_nombre}</h3>
                        <span>Tu domiciliario</span>
                    </div>
                    {data.domiciliario_telefono && (
                        <a href={`https://wa.me/${data.domiciliario_telefono.replace('+', '')}`} target="_blank" rel="noopener noreferrer" className="driver-contact">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        </a>
                    )}
                </div>
            )}

            <div className="tracking-footer">
                <p>Powered by <strong>Antigravity</strong></p>
            </div>
        </div>
    );
}
