import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { 
    LayoutDashboard, 
    MessageSquare, 
    ShoppingCart, 
    Users, 
    Zap, 
    Settings, 
    LogOut,
    TrendingUp,
    CreditCard,
    Shield
} from 'lucide-react';
import { analyticsService } from '../services/api';

const Dashboard = () => {
    const { user, logout } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchStats();
        }
    }, [user]);

    const fetchStats = async () => {
        try {
            const data = await analyticsService.getDaily(user.id);
            setStats(data);
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    };

    return (
        <div className="min-h-screen bg-bg flex">
            {/* Sidebar */}
            <aside className="w-72 bg-bg2 border-r border-border flex flex-col p-6 hidden lg:flex">
                <div className="flex items-center gap-3 mb-12">
                    <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center font-bold text-bg text-xl">A</div>
                    <span className="font-head text-xl font-bold">ANTIGRAVITY</span>
                </div>

                <nav className="flex-1 space-y-2">
                    <NavItem icon={<LayoutDashboard size={20}/>} label="Dashboard" active />
                    <NavItem icon={<MessageSquare size={20}/>} label="Conversaciones" />
                    <NavItem icon={<ShoppingCart size={20}/>} label="Pedidos" />
                    <NavItem icon={<Users size={20}/>} label="Clientes" />
                    <NavItem icon={<Zap size={20}/>} label="Automatizaciones" />
                    <NavItem icon={<CreditCard size={20}/>} label="Suscripción" />
                </nav>

                <div className="pt-6 border-t border-border space-y-2">
                    <NavItem icon={<Settings size={20}/>} label="Ajustes" />
                    <button 
                        onClick={logout}
                        className="w-full flex items-center gap-4 px-4 py-3 text-muted hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all duration-300"
                    >
                        <LogOut size={20} />
                        <span className="font-medium">Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-6 lg:p-10">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <h1 className="font-head text-3xl font-bold mb-2">¡Hola, {user?.nombre}! 👋</h1>
                        <p className="text-muted">Aquí está el resumen de tu negocio para hoy.</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="glass px-4 py-2 rounded-xl flex items-center gap-2 border border-border">
                            <Shield className="text-accent" size={18} />
                            <span className="text-sm font-mono uppercase tracking-wider text-accent">{user?.plan} Plan</span>
                        </div>
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold">{user?.email}</p>
                            <p className="text-xs text-muted">ID de Negocio: #{user?.id}</p>
                        </div>
                    </div>
                </header>

                <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
                >
                    <StatCard 
                        variants={itemVariants}
                        title="Ventas Hoy" 
                        value={stats?.total_ventas ? `$${stats.total_ventas.toLocaleString()}` : '$0'}
                        trend="+12%"
                        icon={<TrendingUp className="text-accent" />}
                    />
                    <StatCard 
                        variants={itemVariants}
                        title="Pedidos" 
                        value={stats?.total_pedidos || '0'}
                        trend="+5"
                        icon={<ShoppingCart className="text-accent2" />}
                    />
                    <StatCard 
                        variants={itemVariants}
                        title="Mensajes" 
                        value={stats?.total_mensajes || '0'}
                        trend="+24"
                        icon={<MessageSquare className="text-intel" />}
                    />
                    <StatCard 
                        variants={itemVariants}
                        title="Conversión" 
                        value={stats?.tasa_conversion ? `${stats.tasa_conversion}%` : '0%'}
                        trend="+1.2%"
                        icon={<Zap className="text-int" />}
                    />
                </motion.div>

                {/* Plan-specific section */}
                {user?.plan === 'professional' || user?.plan === 'enterprise' ? (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass p-8 rounded-3xl border border-border"
                    >
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-xl font-bold mb-1 font-head">Automatizaciones Avanzadas</h2>
                                <p className="text-muted text-sm">Tu plan incluye detección de intenciones con GPT-4o.</p>
                            </div>
                            <button className="bg-accent/10 text-accent px-4 py-2 rounded-lg text-sm font-bold border border-accent/20">Configurar</button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FeatureStatus label="Respuesta de Catálogo" active />
                            <FeatureStatus label="Extracción de Pedidos" active />
                            <FeatureStatus label="Validación de Comprobantes" active />
                            <FeatureStatus label="Notificaciones de Seguimiento" active={user?.plan === 'enterprise'} />
                        </div>
                    </motion.div>
                ) : (
                    <div className="glass p-8 rounded-3xl border border-border text-center">
                        <Zap className="mx-auto mb-4 text-muted" size={48} />
                        <h2 className="text-xl font-bold mb-2">Mejora tu Plan</h2>
                        <p className="text-muted mb-6">Desbloquea automatizaciones con IA y reportes avanzados.</p>
                        <button className="bg-accent text-bg px-8 py-3 rounded-xl font-bold">Ver Planes</button>
                    </div>
                )}
            </main>
        </div>
    );
};

const NavItem = ({ icon, label, active = false }) => (
    <div className={`flex items-center gap-4 px-4 py-3 cursor-pointer rounded-xl transition-all duration-300 ${active ? 'bg-accent/10 text-accent border border-accent/20' : 'text-muted hover:text-white hover:bg-white/5'}`}>
        {icon}
        <span className="font-medium">{label}</span>
    </div>
);

const StatCard = ({ title, value, trend, icon, variants }) => (
    <motion.div variants={variants} className="glass p-6 rounded-3xl border border-border">
        <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-bg flex items-center justify-center rounded-2xl border border-border">
                {icon}
            </div>
            <span className="text-xs font-mono text-accent bg-accent-dim px-2 py-1 rounded-md">{trend}</span>
        </div>
        <p className="text-muted text-sm mb-1">{title}</p>
        <h3 className="text-2xl font-bold font-mono">{value}</h3>
    </motion.div>
);

const FeatureStatus = ({ label, active }) => (
    <div className="flex items-center justify-between p-4 bg-bg2/50 rounded-2xl border border-border">
        <span className="font-medium">{label}</span>
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${active ? 'bg-accent pulse-glow' : 'bg-muted'}`}></div>
            <span className={`text-xs font-mono ${active ? 'text-accent' : 'text-muted'}`}>{active ? 'ACTIVO' : 'NO DISPONIBLE'}</span>
        </div>
    </div>
);

export default Dashboard;
