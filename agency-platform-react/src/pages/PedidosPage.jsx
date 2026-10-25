import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
    ShoppingCart, 
    Search, 
    Loader2, 
    Eye,
    Clock,
    CheckCircle,
    XCircle,
    Package,
    CreditCard,
    Smartphone,
    Building,
    X,
    Zap,
    List,
    Columns3
} from 'lucide-react';
import { api } from '../services/api';
import Illustration from '../components/Illustration';
import { useHitos } from '../context/HitosContext';
import { usePedidosLive } from '../context/PedidosLiveContext';
import TipNova from '../components/TipNova';
import PedidoSwipeCard from '../components/PedidoSwipeCard';
import AyudaRapida from '../components/AyudaRapida';
import { SkeletonList } from '../components/Skeleton';
import PedidosKanban from '../components/PedidosKanban';
import { ETIQUETA_RAPIDA, useAvanzarPedido } from '../hooks/useAvanzarPedido';
import { useUndo } from '../context/UndoContext';
import { useConfirm } from '../context/ConfirmContext';
import usePreferencias from '../hooks/usePreferencias';
import { formatearFecha, formatearMoneda } from '../utils/preferencias';

// Mismas transiciones válidas que valida el backend (api/routes/orders.js) — la etiqueta es lo único
// que decide esta pantalla; el servidor es quien de verdad permite o no el cambio.
const SIGUIENTE_ESTADO = {
    pendiente_pago: { estado: 'pago_enviado', label: 'Marcar pago enviado' },
    pago_enviado: { estado: 'pago_confirmado', label: 'Confirmar pago' },
    pago_confirmado: { estado: 'en_preparacion', label: 'Marcar en preparación' },
    en_preparacion: { estado: 'enviado', label: 'Marcar enviado' },
    enviado: { estado: 'entregado', label: 'Marcar entregado' },
};
const PUEDE_CANCELAR = ['pendiente_pago', 'pago_enviado', 'pago_confirmado', 'en_preparacion'];
const ESTADOS_PAGADOS = ['pago_confirmado', 'en_preparacion', 'enviado', 'entregado'];

const PedidosPage = () => {
    const prefs = usePreferencias();
    const navigate = useNavigate();
    const { celebrar } = useHitos();
    const { conectado, suscribir } = usePedidosLive();
    const { avisarError, avisarOk } = useUndo();
    const confirmar = useConfirm();
    const [params] = useSearchParams();
    const buscarRef = useRef(null);
    // El dueño elige cómo ver sus pedidos (lista o tablero); se recuerda en este dispositivo.
    const [vista, setVistaState] = useState(() => {
        try { return localStorage.getItem('noma_pedidos_vista') === 'tablero' ? 'tablero' : 'lista'; } catch { return 'lista'; }
    });
    const setVista = (v) => {
        setVistaState(v);
        try { localStorage.setItem('noma_pedidos_vista', v); } catch { /* sin almacenamiento */ }
    };
    const [avanzando, setAvanzando] = useState(false);
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [buscar, setBuscar] = useState(params.get('q') || '');
    const [filtroEstado, setFiltroEstado] = useState(params.get('estado') || 'todos');
    const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
    const [imagenPago, setImagenPago] = useState(null);
    const [cargandoImagen, setCargandoImagen] = useState(false);

    useEffect(() => {
        fetchPedidos();
    }, []);

    // Pedido nuevo o pago confirmado: la lista se actualiza sola, sin parpadeo de carga.
    useEffect(() => suscribir('pedidos', () => fetchPedidos(true)), [suscribir]);

    // Atajos de teclado (solo en escritorio y fuera de campos de texto): "/" busca, "r" recarga.
    useEffect(() => {
        const onKey = (e) => {
            const t = e.target;
            if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key === '/') { e.preventDefault(); buscarRef.current?.focus(); }
            else if (e.key === 'r') fetchPedidos(true);
            else if (e.key === 'Escape') { setPedidoSeleccionado(null); setImagenPago(null); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const fetchPedidos = async (silencioso = false) => {
        try {
            if (!silencioso) setLoading(true);
            const response = await api.get('/pedidos');
            const lista = response.data.pedidos || [];
            setPedidos(lista);
            if (lista.length > 0) celebrar('pedido');
            if (lista.some((p) => ESTADOS_PAGADOS.includes(p.estado))) celebrar('venta_cobrada');
        } catch (error) {
            console.error('Error:', error);
            if (!silencioso) setPedidos([]);
        } finally {
            setLoading(false);
        }
    };

    // Avance con un toque (con "Deshacer"): ver hooks/useAvanzarPedido.js
    const poner = useCallback((id, estado) => {
        setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, estado } : p)));
        setPedidoSeleccionado((prev) => (prev && prev.id === id ? { ...prev, estado } : prev));
    }, []);
    const avanzarRapido = useAvanzarPedido(poner);

    const avanzarEstado = async (nuevoEstado) => {
        if (!pedidoSeleccionado) return;
        setAvanzando(true);
        try {
            const { data } = await api.patch(`/pedidos/${pedidoSeleccionado.id}/estado`, { estado: nuevoEstado });
            if (data?.stock_devuelto > 0) avisarOk('Pedido cancelado: el stock reservado volvió a tu inventario.');
            await fetchPedidos();
            setPedidoSeleccionado((prev) => (prev ? { ...prev, estado: nuevoEstado } : prev));
        } catch (error) {
            avisarError(error.response?.data?.error || 'No se pudo actualizar el pedido');
        } finally {
            setAvanzando(false);
        }
    };

    const fetchImagenPago = async (pedidoId) => {
        try {
            setCargandoImagen(true);
            const response = await api.get(`/pedidos/${pedidoId}/imagen`);
            setImagenPago(response.data.imagen);
        } catch (error) {
            setImagenPago(null);
        } finally {
            setCargandoImagen(false);
        }
    };

    const getEstadoBadge = (estado) => {
        const badges = {
            'pendiente_pago': { bg: 'bg-warn/10', text: 'text-warn-text', icon: Clock, label: 'PENDIENTE PAGO' },
            'pago_enviado': { bg: 'bg-info/10', text: 'text-info-text', icon: CreditCard, label: 'PAGO ENVIADO' },
            'pago_confirmado': { bg: 'bg-success/10', text: 'text-success', icon: CheckCircle, label: 'PAGO CONFIRMADO' },
            'confirmado': { bg: 'bg-info/10', text: 'text-info-text', icon: CheckCircle, label: 'CONFIRMADO' },
            'en_preparacion': { bg: 'bg-warn/10', text: 'text-warn-text', icon: Package, label: 'EN PREPARACIÓN' },
            'enviado': { bg: 'bg-info/10', text: 'text-info-text', icon: Package, label: 'ENVIADO' },
            'entregado': { bg: 'bg-success/10', text: 'text-success', icon: CheckCircle, label: 'ENTREGADO' },
            'cancelado': { bg: 'bg-danger/10', text: 'text-danger-text', icon: XCircle, label: 'CANCELADO' }
        };
        const badge = badges[estado] || badges['pendiente_pago'];
        const Icon = badge.icon;
        return (
            <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono ${badge.bg} ${badge.text}`}>
                <Icon size={12} />
                {badge.label}
            </span>
        );
    };

    const formatFecha = (dateStr) => {
        if (!dateStr) return '';
        return formatearFecha(dateStr, { hora: true }, prefs);
    };

    const formatCurrency = (amount) => {
        return formatearMoneda(amount, prefs);
    };

    const pedidosFiltrados = pedidos.filter(p => {
        const matchBuscar = !buscar || 
            p.numero_pedido?.toLowerCase().includes(buscar.toLowerCase()) ||
            p.cliente_nombre?.toLowerCase().includes(buscar.toLowerCase()) ||
            p.cliente_whatsapp?.includes(buscar);
        const matchEstado = filtroEstado === 'todos' || p.estado === filtroEstado;
        return matchBuscar && matchEstado;
    });

    const stats = {
        total: pedidos.length,
        pendientes: pedidos.filter(p => p.estado === 'pendiente_pago').length,
        pagosConfirmados: pedidos.filter(p => p.estado === 'pago_confirmado').length,
        totalVentas: pedidos.filter(p => ['pago_confirmado', 'confirmado', 'en_preparacion', 'enviado', 'entregado'].includes(p.estado)).reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0)
    };

    return (
        <div className="min-h-screen bg-bg p-6 lg:p-10">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="font-head text-3xl font-bold mb-2 flex items-center gap-3">
                                Pedidos
                                <span
                                    className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold tracking-[0.04em] uppercase ${
                                        conectado ? 'bg-success/10 text-success' : 'bg-bg3 text-muted'
                                    }`}
                                    title={conectado ? 'Recibiendo pedidos nuevos en tiempo real' : 'Sin conexión en vivo, actualiza para ver lo último'}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${conectado ? 'bg-success animate-pulse' : 'bg-muted'}`} />
                                    {conectado ? 'En vivo' : 'Sin conexión'}
                                </span>
                            </h1>
                            <p className="text-muted">Gestiona los pedidos y pagos de tu negocio</p>
                        </div>
                    </div>
                </div>

                <AyudaRapida
                    className="mb-4"
                    guia="pedidos"
                    pasos={[
                        'El cliente pide por WhatsApp y el bot crea el pedido (“pendiente de pago”).',
                        'Cuando envía el comprobante, el bot lo revisa y confirma el pago solo; si no está seguro, queda “pago enviado” para que tú lo revises.',
                        'Avanza el pedido: en preparación → enviado → entregado. Al entregarlo se activan las reseñas y encuestas, si las tienes encendidas.',
                    ]}
                />
                <TipNova id="pedidos" className="mb-6">Cuando un cliente envía su comprobante, el pedido pasa a “pago enviado”. Ábrelo, revisa la imagen y confirma el pago.</TipNova>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-2xl p-4 border border-border">
                        <p className="text-xs font-semibold tracking-[0.04em] text-muted mb-1">TOTAL PEDIDOS</p>
                        <p className="text-2xl font-bold">{stats.total}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 border border-border">
                        <p className="text-xs font-semibold tracking-[0.04em] text-muted mb-1">PENDIENTES</p>
                        <p className="text-2xl font-bold text-warn-text">{stats.pendientes}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 border border-border">
                        <p className="text-xs font-semibold tracking-[0.04em] text-muted mb-1">PAGOS CONFIRMADOS</p>
                        <p className="text-2xl font-bold text-success">{stats.pagosConfirmados}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 border border-border">
                        <p className="text-xs font-semibold tracking-[0.04em] text-muted mb-1">TOTAL VENTAS</p>
                        <p className="text-2xl font-bold text-accent">{formatCurrency(stats.totalVentas)}</p>
                    </div>
                </div>

                {/* Filtros */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <form onSubmit={(e) => { e.preventDefault(); fetchPedidos(); }} className="flex-1 flex gap-2">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                            <input
                                type="text"
                                ref={buscarRef}
                                value={buscar}
                                onChange={(e) => setBuscar(e.target.value)}
                                placeholder="Buscar por número, cliente o teléfono…  ( / )"
                                className="w-full bg-white border border-[#C9C9C9] rounded-xl h-12 md:h-11 pl-10 pr-4 text-sm focus:outline-none focus:border-accent"
                            />
                        </div>
                    </form>
                    <div role="group" aria-label="Forma de ver los pedidos" className="flex shrink-0 rounded-xl border border-border overflow-hidden h-12 md:h-11 self-start">
                        {[{ id: 'lista', label: 'Lista', icon: List }, { id: 'tablero', label: 'Tablero', icon: Columns3 }].map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => setVista(id)}
                                aria-pressed={vista === id}
                                className={`px-4 inline-flex items-center gap-2 text-sm font-semibold border-none cursor-pointer ${vista === id ? 'bg-accent text-white' : 'bg-white text-muted hover:text-text'}`}
                            >
                                <Icon size={16} /> {label}
                            </button>
                        ))}
                    </div>
                    <div className={`${vista === 'tablero' ? 'hidden ' : ''}flex gap-2 md:flex-wrap overflow-x-auto md:overflow-visible -mx-6 px-6 md:mx-0 md:px-0 pb-1`}>
                        {['todos', 'pendiente_pago', 'pago_enviado', 'pago_confirmado', 'en_preparacion', 'enviado', 'entregado', 'cancelado'].map(estado => (
                            <button
                                key={estado}
                                onClick={() => setFiltroEstado(estado)}
                                className={`h-9 md:h-7 px-3.5 md:px-3 shrink-0 rounded-full text-xs font-semibold tracking-[0.04em] border-none cursor-pointer transition-colors ${
                                    filtroEstado === estado 
                                        ? 'bg-accent-dim text-accent' 
                                        : 'bg-bg3 text-muted hover:text-text'
                                }`}
                            >
                                {estado === 'todos' ? 'TODOS' : estado.toUpperCase().replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Lista de pedidos */}
                {loading ? (
                    <SkeletonList filas={6} />
                ) : pedidosFiltrados.length === 0 ? (
                    <div className="text-center py-12 bg-white border border-border rounded-3xl flex flex-col items-center">
                        <Illustration name="vacio-pedidos" size={160} alt="Lucía sostiene una caja vacía: aún no hay pedidos" style={{ marginBottom: 24 }} />
                        <h3 className="text-xl font-bold mb-2">No hay pedidos</h3>
                        <p className="text-muted max-w-md">Los pedidos aparecen aquí cuando un cliente le compra a tu bot por WhatsApp. Para ver cómo funciona, haz una compra de prueba escribiéndole al bot desde otro número.</p>
                        <div className="mt-5 flex gap-2 flex-wrap justify-center">
                            <button onClick={() => navigate('/whatsapp')} className="h-10 px-4 rounded-xl bg-accent text-white text-sm font-semibold border-none cursor-pointer">Revisar mi WhatsApp</button>
                            <button onClick={() => navigate('/productos')} className="h-10 px-4 rounded-xl bg-white border border-[#C9C9C9] text-text text-sm font-semibold cursor-pointer">Revisar mis productos</button>
                        </div>
                    </div>
                ) : vista === 'tablero' ? (
                    <PedidosKanban
                        pedidos={pedidosFiltrados}
                        formatCurrency={formatCurrency}
                        onAbrir={setPedidoSeleccionado}
                        onAvanzar={(p, estado) => avanzarRapido(p, estado)}
                        onNoPermitido={(p) => avisarError(SIGUIENTE_ESTADO[p.estado] ? `Un pedido solo avanza al paso siguiente: ${SIGUIENTE_ESTADO[p.estado].label.toLowerCase()}.` : 'Este pedido ya no se puede mover.')}
                    />
                ) : (
                    <>
                    <div className="md:hidden space-y-3">
                        {pedidosFiltrados.map((pedido) => (
                            <PedidoSwipeCard
                                key={pedido.id}
                                pedido={pedido}
                                siguiente={SIGUIENTE_ESTADO[pedido.estado]}
                                badge={getEstadoBadge(pedido.estado)}
                                total={formatCurrency(pedido.total)}
                                fecha={formatFecha(pedido.created_at)}
                                onAbrir={setPedidoSeleccionado}
                                onAvanzar={(p, estado) => avanzarRapido(p, estado)}
                            />
                        ))}
                    </div>
                    <div className="hidden md:block bg-white rounded-2xl border border-border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="text-left p-4 text-xs font-semibold tracking-[0.04em] text-muted bg-bg2">PEDIDO</th>
                                        <th className="text-left p-4 text-xs font-semibold tracking-[0.04em] text-muted bg-bg2">CLIENTE</th>
                                        <th className="text-left p-4 text-xs font-semibold tracking-[0.04em] text-muted bg-bg2">PRODUCTOS</th>
                                        <th className="text-left p-4 text-xs font-semibold tracking-[0.04em] text-muted bg-bg2">TOTAL</th>
                                        <th className="text-left p-4 text-xs font-semibold tracking-[0.04em] text-muted bg-bg2">PAGO</th>
                                        <th className="text-left p-4 text-xs font-semibold tracking-[0.04em] text-muted bg-bg2">ESTADO</th>
                                        <th className="text-left p-4 text-xs font-semibold tracking-[0.04em] text-muted bg-bg2">FECHA</th>
                                        <th className="text-left p-4 text-xs font-semibold tracking-[0.04em] text-muted bg-bg2">ACCIÓN</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pedidosFiltrados.map((pedido) => (
                                        <motion.tr 
                                            key={pedido.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="border-b border-border hover:bg-bg2 transition-colors cursor-pointer"
                                            onClick={() => setPedidoSeleccionado(pedido)}
                                        >
                                            <td className="p-4">
                                                <span className="font-mono text-sm">#{pedido.numero_pedido || pedido.id}</span>
                                            </td>
                                            <td className="p-4">
                                                <div>
                                                    <p className="font-medium text-sm">{pedido.cliente_nombre || 'Sin nombre'}</p>
                                                    <p className="text-xs text-muted">{pedido.cliente_whatsapp || ''}</p>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-sm">{pedido.items?.length || pedido.total_productos || 1} items</span>
                                            </td>
                                            <td className="p-4">
                                                <span className="font-mono font-bold">{formatCurrency(pedido.total)}</span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    {pedido.metodo_pago ? (
                                                        <span className="flex items-center gap-1 text-xs text-success">
                                                            {pedido.metodo_pago?.toLowerCase().includes('nequi') ? <Smartphone size={12} /> : <Building size={12} />}
                                                            {pedido.metodo_pago}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted">Sin pago                                                        </span>
                                                    )}
                                                    {pedido.tiene_imagen_pago && (
                                                        <span className="text-xs bg-info/10 text-info-text px-1.5 py-0.5 rounded">📸</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {getEstadoBadge(pedido.estado)}
                                            </td>
                                            <td className="p-4">
                                                <span className="text-xs text-muted">{formatFecha(pedido.created_at)}</span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    {SIGUIENTE_ESTADO[pedido.estado] && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); avanzarRapido(pedido, SIGUIENTE_ESTADO[pedido.estado].estado); }}
                                                            title={SIGUIENTE_ESTADO[pedido.estado].label}
                                                            className="h-9 px-3 rounded-lg bg-accent hover:bg-accent2 text-white text-xs font-semibold border-none cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                                                        >
                                                            <Zap size={14} />
                                                            {ETIQUETA_RAPIDA[pedido.estado]}
                                                        </button>
                                                    )}
                                                    <button aria-label="Ver detalle" className="w-9 h-9 flex items-center justify-center bg-transparent border-none cursor-pointer text-accent hover:text-text transition-colors">
                                                        <Eye size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    </>
                )}
            </div>

            {/* Modal de detalle */}
            <AnimatePresence>
                {pedidoSeleccionado && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-[70] flex items-end sm:items-center justify-center sm:p-4"
                        onClick={() => { setPedidoSeleccionado(null); setImagenPago(null); }}
                    >
                        <motion.div
                            initial={{ y: 60, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 60, opacity: 0 }}
                            className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-8 w-full max-w-lg shadow-[0_16px_48px_rgba(10,10,10,0.2)] max-h-[88vh] sm:max-h-[80vh] overflow-y-auto"
                            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold">Detalle del Pedido</h2>
                                <button aria-label="Cerrar" onClick={() => { setPedidoSeleccionado(null); setImagenPago(null); }} className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-bg3 bg-transparent border-none cursor-pointer">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted">Pedido:</span>
                                    <span className="font-mono font-bold">#{pedidoSeleccionado.numero_pedido}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted">Cliente:</span>
                                    <span>{pedidoSeleccionado.cliente_nombre || 'Sin nombre'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted">Teléfono:</span>
                                    <span>{pedidoSeleccionado.cliente_whatsapp || 'Sin teléfono'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted">Estado:</span>
                                    {getEstadoBadge(pedidoSeleccionado.estado)}
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted">Método de pago:</span>
                                    <span className="font-mono">{pedidoSeleccionado.metodo_pago || 'No especificado'}</span>
                                </div>

                                <div className="border-t border-border pt-4">
                                    <p className="text-xs font-mono text-muted mb-2">PRODUCTOS</p>
                                    {pedidoSeleccionado.items?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between py-2">
                                            <span>{item.producto?.nombre || item.nombre} x{item.cantidad}</span>
                                            <span className="font-mono">{formatCurrency(item.subtotal)}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="border-t border-border pt-4">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold">TOTAL:</span>
                                        <span className="text-xl font-bold text-accent">{formatCurrency(pedidoSeleccionado.total)}</span>
                                    </div>
                                </div>

                                {pedidoSeleccionado.stock_reservado && (
                                    <p className="text-xs rounded-xl bg-success/10 text-success px-3 py-2" role="note">
                                        📦 Stock reservado: los productos con inventario ya se descontaron. Si cancelas el pedido, vuelven a tu stock.
                                    </p>
                                )}

                                <div className="text-xs text-muted">
                                    <p>Fecha: {formatFecha(pedidoSeleccionado.created_at)}</p>
                                    {pedidoSeleccionado.direccion_entrega && <p>Entrega: {pedidoSeleccionado.direccion_entrega}</p>}
                                </div>

                                {/* Avanzar el pedido: mismas transiciones que valida el backend */}
                                {(SIGUIENTE_ESTADO[pedidoSeleccionado.estado] || PUEDE_CANCELAR.includes(pedidoSeleccionado.estado)) && (
                                    <div className="border-t border-border pt-4">
                                        <p className="text-xs font-semibold tracking-[0.04em] uppercase text-muted mb-3">Avanzar pedido</p>
                                        <div className="flex flex-wrap gap-2">
                                            {SIGUIENTE_ESTADO[pedidoSeleccionado.estado] && (
                                                <button
                                                    onClick={() => { avanzarRapido(pedidoSeleccionado, SIGUIENTE_ESTADO[pedidoSeleccionado.estado].estado, `${SIGUIENTE_ESTADO[pedidoSeleccionado.estado].label} · #${pedidoSeleccionado.numero_pedido}`); setPedidoSeleccionado(null); setImagenPago(null); }}
                                                    disabled={avanzando}
                                                    className="h-11 px-5 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold border-none cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                                                >
                                                    {avanzando && <Loader2 size={16} className="animate-spin" />}
                                                    {SIGUIENTE_ESTADO[pedidoSeleccionado.estado].label}
                                                </button>
                                            )}
                                            {PUEDE_CANCELAR.includes(pedidoSeleccionado.estado) && (
                                                <button
                                                    onClick={async () => { if (await confirmar({ titulo: 'Cancelar pedido', mensaje: `El pedido #${pedidoSeleccionado.numero_pedido} pasará a cancelado y no se puede reactivar.`, boton: 'Cancelar pedido', cancelar: 'Volver' })) avanzarEstado('cancelado'); }}
                                                    disabled={avanzando}
                                                    className="h-11 px-5 rounded-xl bg-white hover:bg-bg2 text-danger-text text-sm font-semibold border border-danger/40 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                >
                                                    Cancelar pedido
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Imagen de pago */}
                                {pedidoSeleccionado.tiene_imagen_pago && (
                                    <div className="border-t border-border pt-4">
                                        <p className="text-xs font-mono text-muted mb-2">CAPTURA DE PAGO</p>
                                        {imagenPago ? (
                                            <img 
                                                src={`data:image/jpeg;base64,${imagenPago}`} 
                                                alt="Captura de pago"
                                                className="w-full rounded-xl border border-border"
                                            />
                                        ) : cargandoImagen ? (
                                            <div className="flex items-center justify-center py-4">
                                                <Loader2 className="animate-spin text-accent" size={20} />
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => fetchImagenPago(pedidoSeleccionado.id)}
                                                className="w-full py-2 bg-bg3 rounded-xl text-sm text-accent hover:bg-accent/10 transition-all"
                                            >
                                                Ver captura de pago
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PedidosPage;
