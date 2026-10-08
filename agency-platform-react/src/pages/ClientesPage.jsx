import TipNova from '../components/TipNova';
import EmptyState from '../components/EmptyState';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
    Users, 
    Search, 
    Loader2, 
    Phone,
    Mail,
    ShoppingBag,
    DollarSign,
    UserPlus,
    ArrowLeft
} from 'lucide-react';
import { api } from '../services/api';

const ClientesPage = () => {
    const navigate = useNavigate();
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [buscar, setBuscar] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [nuevoCliente, setNuevoCliente] = useState({ nombre: '', whatsapp: '', email: '' });

    useEffect(() => {
        fetchClientes();
    }, []);

    const fetchClientes = async () => {
        try {
            setLoading(true);
            const response = await api.get('/pedidos');
            const pedidos = response.data.pedidos || [];
            
            const clientesMap = new Map();
            pedidos.forEach(p => {
                const key = p.cliente?.whatsapp || p.cliente_whatsapp || p.cliente_nombre;
                if (key && !clientesMap.has(key)) {
                    clientesMap.set(key, {
                        id: p.cliente_id || p.id,
                        nombre: p.cliente?.nombre || p.cliente_nombre || 'Sin nombre',
                        whatsapp: p.cliente?.whatsapp || p.cliente_whatsapp || '',
                        total_pedidos: 1,
                        total_gastado: p.total || 0
                    });
                } else if (key) {
                    const existing = clientesMap.get(key);
                    existing.total_pedidos++;
                    existing.total_gastado += p.total || 0;
                }
            });
            
            setClientes(Array.from(clientesMap.values()));
        } catch (error) {
            console.error('Error:', error);
            setClientes([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCrearCliente = async (e) => {
        e.preventDefault();
        try {
            setClientes([...clientes, { 
                id: Date.now(), 
                ...nuevoCliente, 
                total_pedidos: 0, 
                total_gastado: 0 
            }]);
            setShowModal(false);
            setNuevoCliente({ nombre: '', whatsapp: '', email: '' });
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);
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
                            <h1 className="font-head text-3xl font-bold mb-2">Clientes</h1>
                            <p className="text-muted">Administra tu base de clientes</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 bg-accent text-bg px-6 py-3 rounded-xl font-bold"
                    >
                        <UserPlus size={18} />
                        Nuevo Cliente
                    </button>
                </div>

                <TipNova id="clientes" className="mb-6">Cada persona que le escribe a tu bot queda registrada aquí con su historial. Tus clientes se crean solos.</TipNova>

                {/* Búsqueda */}
                <div className="flex gap-4 mb-6">
                    <form onSubmit={(e) => { e.preventDefault(); fetchClientes(); }} className="flex-1 flex gap-2">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                            <input
                                type="text"
                                value={buscar}
                                onChange={(e) => setBuscar(e.target.value)}
                                placeholder="Buscar por nombre, teléfono o email..."
                                className="w-full bg-white border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-accent"
                            />
                        </div>
                        <button type="submit" className="bg-accent text-bg px-6 py-2 rounded-xl text-sm font-bold">
                            Buscar
                        </button>
                    </form>
                </div>

                {/* Estadísticas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="glass p-4 rounded-2xl border border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
                                <Users className="text-accent" size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-muted">Total Clientes</p>
                                <p className="text-xl font-bold">{clientes.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="glass p-4 rounded-2xl border border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-success/20 rounded-xl flex items-center justify-center">
                                <ShoppingBag className="text-success" size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-muted">Con Compras</p>
                                <p className="text-xl font-bold">{clientes.filter(c => c.total_pedidos > 0).length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="glass p-4 rounded-2xl border border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-info/20 rounded-xl flex items-center justify-center">
                                <DollarSign className="text-info" size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-muted">Ingreso Total</p>
                                <p className="text-xl font-bold">{formatCurrency(clientes.reduce((acc, c) => acc + (c.total_gastado || 0), 0))}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lista de clientes */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="animate-spin text-accent" size={24} />
                    </div>
                ) : clientes.length === 0 ? (
                    <EmptyState
                        character="lucia"
                        title="No hay clientes"
                        description="Los clientes aparecerán cuando interactúen con tu bot"
                        className="bg-white border border-border rounded-3xl"
                    />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {clientes.map((cliente) => (
                            <motion.div 
                                key={cliente.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                whileHover={{ y: -4 }}
                                className="glass p-6 rounded-2xl border border-border cursor-pointer"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center">
                                        <span className="text-accent font-bold text-lg">
                                            {cliente.nombre?.charAt(0) || '?'}
                                        </span>
                                    </div>
                                    {cliente.total_pedidos > 0 && (
                                        <span className="bg-success/10 text-success text-xs px-2 py-1 rounded-lg font-mono">
                                            ACTIVO
                                        </span>
                                    )}
                                </div>
                                
                                <h3 className="font-bold text-lg mb-1">{cliente.nombre || 'Sin nombre'}</h3>
                                
                                <div className="space-y-2 mb-4">
                                    {cliente.whatsapp && (
                                        <div className="flex items-center gap-2 text-sm text-muted">
                                            <Phone size={14} />
                                            {cliente.whatsapp}
                                        </div>
                                    )}
                                    {cliente.email && (
                                        <div className="flex items-center gap-2 text-sm text-muted">
                                            <Mail size={14} />
                                            {cliente.email}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex items-center justify-between pt-4 border-t border-border">
                                    <div>
                                        <p className="text-xs text-muted">Pedidos</p>
                                        <p className="font-bold">{cliente.total_pedidos || 0}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-muted">Total Gastado</p>
                                        <p className="font-bold text-accent">{formatCurrency(cliente.total_gastado)}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal nuevo cliente */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-bg2 rounded-3xl p-6 w-full max-w-md border border-border"
                    >
                        <h2 className="font-head text-xl font-bold mb-6">Nuevo Cliente</h2>
                        <form onSubmit={handleCrearCliente} className="space-y-4">
                            <div>
                                <label className="text-xs font-mono text-muted mb-2 block">Nombre</label>
                                <input
                                    type="text"
                                    value={nuevoCliente.nombre}
                                    onChange={(e) => setNuevoCliente({...nuevoCliente, nombre: e.target.value})}
                                    className="w-full bg-bg/50 border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-accent"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-mono text-muted mb-2 block">WhatsApp</label>
                                <input
                                    type="tel"
                                    value={nuevoCliente.whatsapp}
                                    onChange={(e) => setNuevoCliente({...nuevoCliente, whatsapp: e.target.value})}
                                    className="w-full bg-bg/50 border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-accent"
                                    placeholder="3001234567"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-mono text-muted mb-2 block">Email (opcional)</label>
                                <input
                                    type="email"
                                    value={nuevoCliente.email}
                                    onChange={(e) => setNuevoCliente({...nuevoCliente, email: e.target.value})}
                                    className="w-full bg-bg/50 border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-accent"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 bg-bg border border-border text-muted py-3 rounded-xl font-bold"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 bg-accent text-bg py-3 rounded-xl font-bold"
                                >
                                    Crear Cliente
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default ClientesPage;
