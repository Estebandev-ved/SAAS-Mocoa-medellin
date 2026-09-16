import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  MessageSquare,
  ShoppingCart,
  Package,
  Activity,
  Users,
  Zap,
  Settings,
  LogOut,
  TrendingUp,
  CreditCard,
  Shield,
  Loader2,
  Truck,
  Lock,
  Crown,
  Star,
  Bot,
  Brain,
  Bell,
  FileText,
  Power,
  PowerOff,
  Smartphone,
  Phone,
} from 'lucide-react'
import api, { analyticsService } from '../services/api'
import { usePlan } from '../components/PlanGate'

const NavItem = ({ icon: Icon, label, active, onClick, locked, lockTooltip }) => (
  <button
    onClick={locked ? undefined : onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
      active
        ? 'bg-accent/10 text-accent border border-accent/20'
        : 'text-muted hover:bg-bg hover:text-text border border-transparent'
    } ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    title={locked ? lockTooltip : undefined}
  >
    <Icon size={20} />
    <span>{label}</span>
    {locked && <Lock size={14} className="ml-auto text-muted" />}
  </button>
)

const StatCard = ({ title, value, trend, icon: Icon, variants }) => (
  <motion.div
    variants={variants}
    className="glass rounded-2xl p-6 border border-border/50"
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-muted text-sm">{title}</p>
        <p className="text-3xl font-bold text-text mt-1">{value}</p>
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp size={14} className="text-green-400" />
            <span className="text-green-400 text-xs">{trend}</span>
          </div>
        )}
      </div>
      <div className="p-3 bg-accent-dim rounded-xl">
        <Icon size={24} className="text-accent" />
      </div>
    </div>
  </motion.div>
)

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { plan, hasFeature } = usePlan()
  const [stats, setStats] = useState({
    ventasHoy: 0,
    pedidosHoy: 0,
    mensajesHoy: 0,
    tasaIA: 0,
    aiProcesados: 0,
    cambioVentas: 0,
  })
  const [alertas, setAlertas] = useState([])
  const [botConfig, setBotConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [apiPlan, setApiPlan] = useState(null)

  const effectivePlan = apiPlan || plan
  const domiciliosLocked = effectivePlan === 'starter'

  const getPlanIcon = () => {
    switch (effectivePlan) {
      case 'enterprise':
        return <Crown size={16} className="text-yellow-400" />
      case 'professional':
        return <Star size={16} className="text-blue-400" />
      case 'starter':
        return <Shield size={16} className="text-green-400" />
      default:
        return <Shield size={16} className="text-green-400" />
    }
  }

  const getPlanLabel = () => {
    switch (effectivePlan) {
      case 'enterprise':
        return 'Empresarial'
      case 'professional':
        return 'Profesional'
      case 'starter':
        return 'Inicial'
      default:
        return 'Inicial'
    }
  }

  const getUpgradeLabel = () => {
    if (effectivePlan === 'starter') return 'MEJORAR'
    if (effectivePlan === 'professional') return 'MEJORAR'
    return 'CAMBIAR'
  }

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        const response = await analyticsService.getDaily()
        const hoy = response?.data?.hoy || {}
        setStats({
          ventasHoy: hoy.total_ventas || 0,
          pedidosHoy: hoy.total_pedidos || 0,
          mensajesHoy: hoy.mensajes || 0,
          tasaIA: hoy.tasa_conversion || 0,
          aiProcesados: hoy.ai_procesados || 0,
          cambioVentas: hoy.cambio_ventas || 0,
        })
      } catch (error) {
        console.error('Error fetching analytics:', error)
      } finally {
        setLoading(false)
      }
    }
    const fetchAlertas = async () => {
      try {
        const res = await api.get('/analytics/alertas')
        setAlertas(res.data.alertas || [])
      } catch (error) {
        console.error('Error fetching alerts:', error)
      }
    }
    fetchAnalytics()
    fetchAlertas()

    const fetchBotConfig = async () => {
      try {
        const res = await api.get('/bot/config')
        setBotConfig(res.data)
      } catch (error) {
        console.error('Error fetching bot config:', error)
      }
    }
    fetchBotConfig()

    const fetchPlan = async () => {
      try {
        const res = await api.get('/business/plan')
        if (res.data?.plan?.tipo) {
          setApiPlan(res.data.plan.tipo)
        }
      } catch (e) {}
    }
    fetchPlan()
  }, [])

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Smartphone, label: 'WhatsApp', path: '/whatsapp' },
    { icon: MessageSquare, label: 'Conversaciones', path: '/conversaciones' },
    { icon: ShoppingCart, label: 'Pedidos', path: '/pedidos' },
    { icon: Package, label: 'Productos', path: '/productos' },
    { icon: Activity, label: 'Monitoreo', path: '/monitoreo' },
    { icon: TrendingUp, label: 'Analytics', path: '/analytics' },
    { icon: MessageSquare, label: 'Multi-Canal', path: '/multichannel' },
    { icon: Phone, label: 'Bot Llamadas', path: '/voice' },
    { icon: Users, label: 'Clientes', path: '/clientes' },
    { icon: Zap, label: 'Automatizaciones', path: '/automatizaciones' },
    {
      icon: Truck,
      label: 'Domicilios',
      path: '/domicilios',
      locked: domiciliosLocked,
      lockTooltip: 'Mejora tu plan para acceder a Domicilios'
    },
    { icon: CreditCard, label: 'Suscripcion', path: '/suscripcion' }
  ]

  const bottomItems = [
    { icon: Settings, label: 'Ajustes', path: '/ajustes' }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={48} className="text-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex">
      <aside className="w-72 bg-bg2 border-r border-border hidden lg:flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-text tracking-tight">ANTIGRAVITY</h1>
          </div>
        </div>

        <div className="p-4 mx-4 mt-4 rounded-xl bg-accent-dim border border-accent/20 flex items-center gap-3">
          {getPlanIcon()}
          <span className="text-sm text-text font-medium">{getPlanLabel()}</span>
          <button
            onClick={() => navigate('/suscripcion')}
            className="ml-auto text-xs font-bold text-accent hover:text-accent/80 transition-colors"
          >
            {getUpgradeLabel()}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              active={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              locked={item.locked}
              lockTooltip={item.lockTooltip}
            />
          ))}
        </nav>

        <div className="p-4 border-t border-border space-y-1">
          {bottomItems.map((item) => (
            <NavItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              active={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            />
          ))}
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 cursor-pointer"
          >
            <LogOut size={20} />
            <span>Cerrar Sesion</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold text-text">
              Hola, {user?.nombre}!
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-muted">{user?.email}</span>
              <div className="flex items-center gap-1 px-2 py-1 bg-accent-dim rounded-lg">
                {getPlanIcon()}
                <span className="text-xs text-accent font-medium">{getPlanLabel()}</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8"
          >
            <StatCard
              title="Ventas Hoy"
              value={`$${stats.ventasHoy.toLocaleString()}`}
              trend={stats.cambioVentas !== 0 ? `${stats.cambioVentas > 0 ? '+' : ''}${stats.cambioVentas}% vs ayer` : null}
              icon={TrendingUp}
              variants={itemVariants}
            />
            <StatCard
              title="Pedidos Hoy"
              value={stats.pedidosHoy}
              trend={null}
              icon={ShoppingCart}
              variants={itemVariants}
            />
            <StatCard
              title="Mensajes Hoy"
              value={stats.mensajesHoy}
              trend={null}
              icon={MessageSquare}
              variants={itemVariants}
            />
            <StatCard
              title="IA Procesados"
              value={stats.aiProcesados}
              trend={stats.tasaIA > 0 ? `${stats.tasaIA}% conversión` : null}
              icon={Zap}
              variants={itemVariants}
            />
          </motion.div>

          {/* Alertas y Advertencias */}
          {alertas.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-3 mb-6"
            >
              {alertas.map((alerta, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                    alerta.severidad === 'critica'
                      ? 'bg-[#FF4D6A]/10 border-[#FF4D6A]/30'
                      : alerta.severidad === 'advertencia'
                      ? 'bg-[#FFB840]/10 border-[#FFB840]/30'
                      : 'bg-accent/5 border-accent/20'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    alerta.severidad === 'critica'
                      ? 'bg-[#FF4D6A]/20'
                      : alerta.severidad === 'advertencia'
                      ? 'bg-[#FFB840]/20'
                      : 'bg-accent/10'
                  }`}>
                    {alerta.severidad === 'critica' ? (
                      <Zap className="w-4 h-4 text-[#FF4D6A]" />
                    ) : alerta.severidad === 'advertencia' ? (
                      <Bell className="w-4 h-4 text-[#FFB840]" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-accent" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${
                      alerta.severidad === 'critica' ? 'text-[#FF4D6A]' :
                      alerta.severidad === 'advertencia' ? 'text-[#FFB840]' : 'text-accent'
                    }`}>{alerta.titulo}</p>
                    <p className="text-muted text-xs mt-0.5">{alerta.mensaje}</p>
                  </div>
                  {alerta.accion && (
                    <button
                      onClick={() => navigate('/dashboard/suscripcion')}
                      className={`px-3 py-1.5 rounded-xl font-mono text-xs flex-shrink-0 transition-all ${
                        alerta.severidad === 'critica'
                          ? 'bg-[#FF4D6A] text-white hover:bg-[#FF4D6A]/90'
                          : 'bg-bg3 text-text border border-border hover:border-accent/30'
                      }`}
                    >
                      {alerta.accion_texto}
                    </button>
                  )}
                </div>
              ))}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass rounded-2xl p-6 border border-border/50 mb-6"
          >
            <h2 className="text-lg font-bold text-text mb-4">Estado de Funciones</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 bg-bg rounded-xl border border-border/50">
                <MessageSquare size={20} className="text-[#4CAF50]" />
                <div>
                  <p className="text-text font-medium text-sm">Conversaciones</p>
                  <p className="text-muted text-xs">Activo</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-bg rounded-xl border border-border/50">
                <ShoppingCart size={20} className="text-[#4CAF50]" />
                <div>
                  <p className="text-text font-medium text-sm">Pedidos</p>
                  <p className="text-muted text-xs">Activo</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-bg rounded-xl border border-border/50">
                <Truck size={20} className={domiciliosLocked ? 'text-muted' : 'text-[#4CAF50]'} />
                <div>
                  <p className="text-text font-medium text-sm">Domicilios</p>
                  <p className={`text-xs ${domiciliosLocked ? 'text-[#FF4D6A]' : 'text-[#4CAF50]'}`}>
                    {domiciliosLocked ? 'Bloqueado' : 'Activo'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Agentes IA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass rounded-2xl p-6 border border-border/50 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain size={20} className="text-accent" />
                <h2 className="text-lg font-bold text-text">Agentes IA</h2>
              </div>
              <button
                onClick={() => navigate('/automatizaciones')}
                className="font-mono text-xs text-accent hover:text-accent/80 transition-colors"
              >
                Ver todos →
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {['ventas', 'pagos', 'pedidos', 'faq', 'reclamos', 'retencion'].map((agentId) => {
                const agentes = botConfig?.agentes || {}
                const isActive = agentes[agentId] || false
                const agentLabels = {
                  ventas: 'Ventas',
                  pagos: 'Pagos',
                  pedidos: 'Pedidos',
                  faq: 'FAQ',
                  reclamos: 'Reclamos',
                  retencion: 'Retención',
                }
                return (
                  <div
                    key={agentId}
                    className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-accent/10 border-accent/30'
                        : 'bg-bg border-border/50 opacity-60'
                    }`}
                  >
                    {isActive ? (
                      <Power size={14} className="text-[#4CAF50]" />
                    ) : (
                      <PowerOff size={14} className="text-muted" />
                    )}
                    <div>
                      <p className="text-text text-sm font-medium">{agentLabels[agentId]}</p>
                      <p className={`text-xs ${isActive ? 'text-[#4CAF50]' : 'text-muted'}`}>
                        {isActive ? 'Activo' : 'Inactivo'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* Automatizaciones Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="glass rounded-2xl p-6 border border-border/50"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap size={20} className="text-accent" />
                <h2 className="text-lg font-bold text-text">Automatizaciones</h2>
              </div>
              <button
                onClick={() => navigate('/automatizaciones')}
                className="font-mono text-xs text-accent hover:text-accent/80 transition-colors"
              >
                Configurar →
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { id: 'catalogo_respuestas', label: 'Catálogo de respuestas', icon: FileText },
                { id: 'extraccion_pedidos', label: 'Extracción de pedidos', icon: ShoppingCart },
                { id: 'notificaciones_seguimiento', label: 'Notif. seguimiento', icon: Bell },
                { id: 'agente_ia_gpt', label: 'Agente IA GPT', icon: Bot },
              ].map((auto) => {
                const automations = botConfig?.automations || {}
                const isActive = automations[auto.id] || false
                const Icon = auto.icon
                return (
                  <div
                    key={auto.id}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-accent/10 border-accent/30'
                        : 'bg-bg border-border/50 opacity-60'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-accent' : 'text-muted'} />
                    <div>
                      <p className="text-text text-sm font-medium">{auto.label}</p>
                      <p className={`text-xs ${isActive ? 'text-[#4CAF50]' : 'text-muted'}`}>
                        {isActive ? 'Activo' : 'Inactivo'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}