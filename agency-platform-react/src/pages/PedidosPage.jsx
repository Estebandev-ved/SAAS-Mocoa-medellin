import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
    ShoppingCart, 
    Search, 
    Loader2, 
    Eye,
    Clock,
    CheckCircle,
    XCircle,
    Package,
    ArrowLeft,
    CreditCard,
    Smartphone,
    Building,
    X
} from 'lucide-react';
import { api } from '../services/api';
import Illustration from '../components/Illustration';

const PedidosPage = () => {
    const navigate = useNavigate();
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [buscar, setBuscar] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('todos');
    const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
    const [imagenPago, setImagenPago] = useState(null);
    const [cargandoImagen, setCargandoImagen] = useState(false);

    useEffect(() => {
        fetchPedidos();
    }, []);

    const fetchPedidos = async () => {
        try {
            setLoading(true);
            const response = await api.get('/pedidos');
            setPedidos(response.data.pedidos || []);
        } catch (error) {
            console.error('Error:', error);
            setPedidos([]);
        } finally {
            setLoading(false);
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
            'enviado': { bg: 'bg-purple-500/10', text: 'text-purple-500', icon: Package, label: 'ENVIADO' },
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
        return new Date(dateStr).toLocaleDateString('es-CO', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
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
        totalVentas: pedidos.filter(p => ['pago_confirmado', 'confirmado', 'enviado', 'entregado'].includes(p.estado)).reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0)
    };

    return (
        <div className="min-h-screen bg-bg p-6 lg:p-10">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 rounded-xl bg-bg2 border border-border hover:border-accent/30 hover:bg-accent/10 transition-all"
                        >
                            <ArrowLeft className="w-5 h-5 text-muted" />
                        </button>
                        <div>
                            <h1 className="font-head text-3xl font-bold mb-2">Pedidos</h1>
                            <p className="text-muted">Gestiona los pedidos y pagos de tu negocio</p>
                        </div>
                    </div>
                </div>

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
                                value={buscar}
                                onChange={(e) => setBuscar(e.target.value)}
                                placeholder="Buscar por número, cliente o teléfono..."
                                className="w-full bg-white border border-[#C9C9C9] rounded-xl h-11 pl-10 pr-4 text-sm focus:outline-none focus:border-accent"
                            />
                        </div>
                    </form>
                    <div className="flex gap-2 flex-wrap">
                        {['todos', 'pendiente_pago', 'pago_enviado', 'pago_confirmado', 'entregado', 'cancelado'].map(estado => (
                            <button
                                key={estado}
                                onClick={() => setFiltroEstado(estado)}
                                className={`h-7 px-3 rounded-full text-xs font-semibold tracking-[0.04em] border-none cursor-pointer transition-colors ${
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
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="animate-spin text-accent" size={24} />
                    </div>
                ) : pedidosFiltrados.length === 0 ? (
                    <div className="text-center py-12 bg-white border border-border rounded-3xl flex flex-col items-center">
                        <Illustration name="vacio-pedidos" size={160} alt="Lucía sostiene una caja vacía: aún no hay pedidos" style={{ marginBottom: 24 }} />
                        <h3 className="text-xl font-bold mb-2">No hay pedidos</h3>
                        <p className="text-muted">Los pedidos aparecerán aquí cuando los clientes compren</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-border overflow-hidden">
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
                                        <th className="text-left p-4 text-xs font-semibold tracking-[0.04em] text-muted bg-bg2">DETALLE</th>
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
                                                <button className="text-accent hover:text-text transition-colors">
                                                    <Eye size={18} />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de detalle */}
            <AnimatePresence>
                {pedidoSeleccionado && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                        onClick={() => { setPedidoSeleccionado(null); setImagenPago(null); }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-[0_16px_48px_rgba(10,10,10,0.2)] max-h-[80vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold">Detalle del Pedido</h2>
                                <button onClick={() => { setPedidoSeleccionado(null); setImagenPago(null); }} className="p-2 rounded-xl hover:bg-bg3">
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

                                <div className="text-xs text-muted">
                                    <p>Fecha: {formatFecha(pedidoSeleccionado.created_at)}</p>
                                    {pedidoSeleccionado.direccion_entrega && <p>Entrega: {pedidoSeleccionado.direccion_entrega}</p>}
                                </div>

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
