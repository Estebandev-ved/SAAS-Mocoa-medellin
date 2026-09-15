import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    ShoppingCart,
    Users,
    DollarSign,
    BarChart3,
    PieChart,
    Activity,
    Clock,
    Loader2
} from 'lucide-react';
import { api } from '../services/api';

const AnalyticsPage = () => {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [periodo, setPeriodo] = useState('mes');

    useEffect(() => {
        fetchAnalytics();
    }, [periodo]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const response = await api.get('/analytics/advanced');
            setData(response.data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-bg flex items-center justify-center">
                <Loader2 className="animate-spin text-accent" size={32} />
            </div>
        );
    }

    const resumen = data?.resumen_mes || {};
    const ventasConfirmadas = parseFloat(resumen.ventas_confirmadas) || 0;
    const ticketPromedio = parseFloat(resumen.ticket_promedio) || 0;

    return (
        <div className="min-h-screen bg-bg p-6 lg:p-10">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="p-2 rounded-xl bg-bg2 border border-border hover:border-accent/30 hover:bg-accent/10 transition-all"
                    >
                        <ArrowLeft className="w-5 h-5 text-muted" />
                    </button>
                    <div>
                        <h1 className="font-head text-3xl font-bold mb-2">Analytics Avanzado</h1>
                        <p className="text-muted">Métricas detalladas de tu negocio</p>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass rounded-2xl p-4 border border-border"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-4 h-4 text-green-500" />
                            <span className="text-xs font-mono text-muted">VENTAS MES</span>
                        </div>
                        <p className="text-2xl font-bold text-green-500">{formatCurrency(ventasConfirmadas)}</p>
                        <p className="text-xs text-muted mt-1">{resumen.total_pedidos || 0} pedidos</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass rounded-2xl p-4 border border-border"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <ShoppingCart className="w-4 h-4 text-accent" />
                            <span className="text-xs font-mono text-muted">TICKET PROMEDIO</span>
                        </div>
                        <p className="text-2xl font-bold">{formatCurrency(ticketPromedio)}</p>
                        <p className="text-xs text-muted mt-1">por pedido</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="glass rounded-2xl p-4 border border-border"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <Activity className="w-4 h-4 text-blue-500" />
                            <span className="text-xs font-mono text-muted">CONVERSIÓN</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-500">{data?.tasa_conversion || 0}%</p>
                        <p className="text-xs text-muted mt-1">mensajes → pedidos</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="glass rounded-2xl p-4 border border-border"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-purple-500" />
                            <span className="text-xs font-mono text-muted">CONVERSACIONES</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-500">{data?.conversaciones_activas || 0}</p>
                        <p className="text-xs text-muted mt-1">últimas 24h</p>
                    </motion.div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Ventas por día */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="glass rounded-3xl p-6 border border-border"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 className="w-5 h-5 text-accent" />
                            <h2 className="font-bold">Ventas por Día</h2>
                        </div>
                        <div className="h-48 flex items-end gap-1">
                            {data?.ventas_por_dia?.slice(-14).map((dia, idx) => {
                                const maxVenta = Math.max(...data.ventas_por_dia.map(d => d.ventas || 0));
                                const height = maxVenta > 0 ? ((dia.ventas || 0) / maxVenta) * 100 : 0;
                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                        <div
                                            className="w-full bg-accent/20 rounded-t-lg transition-all hover:bg-accent/40"
                                            style={{ height: `${Math.max(height, 4)}%` }}
                                            title={`${dia.fecha}: ${formatCurrency(dia.ventas)}`}
                                        />
                                        <span className="text-[8px] text-muted">{new Date(dia.fecha).getDate()}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>

                    {/* Top productos */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="glass rounded-3xl p-6 border border-border"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <PieChart className="w-5 h-5 text-accent" />
                            <h2 className="font-bold">Top Productos</h2>
                        </div>
                        <div className="space-y-3">
                            {data?.top_productos?.slice(0, 5).map((prod, idx) => {
                                const maxVendidos = Math.max(...data.top_productos.map(p => p.vendidos || 0));
                                const width = maxVendidos > 0 ? ((prod.vendidos || 0) / maxVendidos) * 100 : 0;
                                return (
                                    <div key={idx}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="truncate">{prod.nombre}</span>
                                            <span className="text-muted">{prod.vendidos} vendidos</span>
                                        </div>
                                        <div className="h-2 bg-bg3 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-accent rounded-full"
                                                style={{ width: `${width}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            {(!data?.top_productos || data.top_productos.length === 0) && (
                                <p className="text-muted text-sm text-center py-4">Sin datos de productos</p>
                            )}
                        </div>
                    </motion.div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Métodos de pago */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="glass rounded-3xl p-6 border border-border"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <DollarSign className="w-5 h-5 text-accent" />
                            <h2 className="font-bold">Métodos de Pago</h2>
                        </div>
                        <div className="space-y-3">
                            {data?.metodos_pago?.map((metodo, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-bg3 rounded-xl">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{metodo.metodo_pago?.toLowerCase().includes('nequi') ? '📱' : '🏦'}</span>
                                        <span className="font-medium">{metodo.metodo_pago}</span>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">{metodo.usados} pagos</p>
                                        <p className="text-xs text-muted">{formatCurrency(metodo.monto)}</p>
                                    </div>
                                </div>
                            ))}
                            {(!data?.metodos_pago || data.metodos_pago.length === 0) && (
                                <p className="text-muted text-sm text-center py-4">Sin pagos registrados</p>
                            )}
                        </div>
                    </motion.div>

                    {/* Top clientes */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="glass rounded-3xl p-6 border border-border"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Users className="w-5 h-5 text-accent" />
                            <h2 className="font-bold">Mejores Clientes</h2>
                        </div>
                        <div className="space-y-3">
                            {data?.top_clientes?.slice(0, 5).map((cliente, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-bg3 rounded-xl">
                                    <div>
                                        <p className="font-medium">{cliente.nombre || 'Sin nombre'}</p>
                                        <p className="text-xs text-muted">{cliente.whatsapp}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">{formatCurrency(cliente.gastado)}</p>
                                        <p className="text-xs text-muted">{cliente.pedidos} pedidos</p>
                                    </div>
                                </div>
                            ))}
                            {(!data?.top_clientes || data.top_clientes.length === 0) && (
                                <p className="text-muted text-sm text-center py-4">Sin clientes registrados</p>
                            )}
                        </div>
                    </motion.div>
                </div>

                {/* Horarios más activos */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="glass rounded-3xl p-6 border border-border"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-5 h-5 text-accent" />
                        <h2 className="font-bold">Horarios Más Activos</h2>
                    </div>
                    <div className="flex items-end gap-1 h-32">
                        {Array.from({ length: 24 }, (_, i) => {
                            const hourData = data?.horarios_activos?.find(h => h.hora === i);
                            const mensajes = hourData?.mensajes || 0;
                            const maxMensajes = Math.max(...(data?.horarios_activos?.map(h => h.mensajes) || [1]));
                            const height = maxMensajes > 0 ? (mensajes / maxMensajes) * 100 : 0;
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                    <div
                                        className="w-full bg-accent/20 rounded-t-lg transition-all hover:bg-accent/40"
                                        style={{ height: `${Math.max(height, 2)}%` }}
                                        title={`${i}:00 - ${mensajes} mensajes`}
                                    />
                                    {i % 3 === 0 && <span className="text-[8px] text-muted">{i}h</span>}
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default AnalyticsPage;
