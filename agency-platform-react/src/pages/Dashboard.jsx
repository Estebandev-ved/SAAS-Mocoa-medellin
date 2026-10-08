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
  Menu,
  X,
  PowerOff,
  Smartphone,
  Phone,
  UtensilsCrossed,
  Store,
} from 'lucide-react'
import api, { analyticsService } from '../services/api'
import { usePlan } from '../components/PlanGate'
import { useHitos } from '../context/HitosContext'
import OwnerAvatar from '../components/avatar/OwnerAvatar'
import ActivationChecklist from '../components/ActivationChecklist'
import InstallPrompt from '../components/InstallPrompt'
import EstadoNegocio from '../components/EstadoNegocio'

const NavItem = ({ icon: Icon, label, active, onClick, locked, lockTooltip }) => (
  <button
    onClick={locked ? undefined : onClick}
    className={`relative w-full flex items-center gap-3 px-4 h-11 rounded-xl text-sm font-semibold transition-colors duration-200 border-none ${
      active
        ? 'bg-white/10 text-inverse-text'
        : 'bg-transparent text-[#A0A0A0] hover:bg-white/5 hover:text-inverse-text'
    } ${locked ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'}`}
    title={locked ? lockTooltip : undefined}
  >
    {active && <span className="absolute -left-4 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#E53935] rounded-r" />}
    <Icon size={20} className={active ? 'text-[#E53935]' : ''} />
    <span>{label}</span>
    {locked && <Lock size={14} className="ml-auto text-[#A0A0A0]" />}
  </button>
)

const StatCard = ({ title, value, trend, icon: Icon, variants, inverse = false }) => (
  <motion.div
    variants={variants}
    className={`rounded-2xl p-6 border ${
      inverse ? 'bg-inverse border-inverse text-inverse-text' : 'bg-white border-border'
    }`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className={`text-sm ${inverse ? 'text-[#A0A0A0]' : 'text-muted'}`}>{title}</p>
        <p className={`font-mono text-3xl font-bold mt-1 ${inverse ? 'text-inverse-text' : 'text-text'}`}>{value}</p>
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp size={14} className={inverse ? 'text-[#81C784]' : 'text-success'} />
            <span className={`text-xs font-medium ${inverse ? 'text-[#81C784]' : 'text-success'}`}>{trend}</span>
          </div>
        )}
      </div>
      <div className={`p-3 rounded-xl ${inverse ? 'bg-[#E53935]/15' : 'bg-accent-dim'}`}>
        <Icon size={24} className={inverse ? 'text-[#E53935]' : 'text-accent'} />
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
  const { celebrar } = useHitos()
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
  const [planInfo, setPlanInfo] = useState(null)
  const [activando, setActivando] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)

  useEffect(() => {
    if (!menuAbierto) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setMenuAbierto(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [menuAbierto])

  const effectivePlan = apiPlan || plan
  const domiciliosLocked = effectivePlan === 'starter' || effectivePlan === 'emprendedor'

  const getPlanIcon = () => {
    switch (effectivePlan) {
      case 'enterprise':
        return <Crown size={16} className="text-[#E53935]" />
      case 'professional':
        return <Star size={16} className="text-[#E53935]" />
      case 'starter':
        return <Shield size={16} className="text-[#A0A0A0]" />
      case 'emprendedor':
        return <Store size={16} className="text-[#E53935]" />
      default:
        return <Shield size={16} className="text-[#A0A0A0]" />
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
      case 'emprendedor':
        return 'Emprendedor'
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
        const hoy = response?.hoy || {}
        setStats({
          ventasHoy: hoy.total_ventas || 0,
          pedidosHoy: hoy.total_pedidos || 0,
          mensajesHoy: hoy.mensajes || 0,
          tasaIA: hoy.tasa_conversion || 0,
          aiProcesados: hoy.ai_procesados || 0,
          cambioVentas: hoy.cambio_ventas || 0,
        })
        const mensajesTotales = response?.resumen?.mensajes_totales || 0
        if (mensajesTotales >= 100) celebrar('cien_mensajes')
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
          setPlanInfo(res.data.plan)
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
    {
      icon: UtensilsCrossed,
      label: 'Restaurantes',
      path: '/restaurantes',
      locked: domiciliosLocked,
      lockTooltip: 'Mejora tu plan para acceder a Domicilios'
    },
    {
      icon: Store,
      label: 'Caja',
      path: '/caja',
      locked: effectivePlan !== 'emprendedor',
      lockTooltip: 'La caja es del plan Emprendedor'
    },
    { icon: CreditCard, label: 'Suscripcion', path: '/suscripcion' }
  ]

  const bottomItems = [
    { icon: Settings, label: 'Ajustes', path: '/ajustes' }
  ]

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const resumenHoy =
    stats.pedidosHoy > 0
      ? `Hoy llevas ${stats.pedidosHoy} ${stats.pedidosHoy === 1 ? 'pedido' : 'pedidos'} y $${stats.ventasHoy.toLocaleString()} en ventas.`
      : 'Aún no hay pedidos hoy.'

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={48} className="text-accent animate-spin" />
      </div>
    )
  }

  const sidebarInner = (
    <>
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <circle cx="24" cy="24" r="24" fill="#E53935" />
              <path d="M24 12L32 20L24 28L16 20L24 12Z" fill="#0A0A0A" />
              <path d="M24 20L32 28L24 36L16 28L24 20Z" fill="#0A0A0A" opacity="0.6" />
            </svg>
            <h1 className="font-head text-lg font-extrabold text-inverse-text tracking-[0.08em]">ANTIGRAVITY</h1>
          </div>
        </div>

        <div className="p-4 mx-4 mt-4 rounded-xl bg-white/10 flex items-center gap-3">
          {getPlanIcon()}
          <span className="text-sm text-inverse-text font-medium">{getPlanLabel()}</span>
          <button
            onClick={() => { setMenuAbierto(false); navigate('/suscripcion') }}
            className="ml-auto text-xs font-semibold text-[#E53935] hover:text-inverse-text transition-colors bg-transparent border-none cursor-pointer"
          >
            {getUpgradeLabel()}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1" aria-label="Menú principal">
          {navItems.map((item) => (
            <NavItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              active={location.pathname === item.path}
              onClick={() => { setMenuAbierto(false); navigate(item.path) }}
              locked={item.locked}
              lockTooltip={item.lockTooltip}
            />
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-1">
          {bottomItems.map((item) => (
            <NavItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              active={location.pathname === item.path}
              onClick={() => { setMenuAbierto(false); navigate(item.path) }}
            />
          ))}
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 h-11 rounded-xl text-sm font-semibold text-[#A0A0A0] bg-transparent border-none hover:bg-white/5 hover:text-inverse-text transition-colors duration-200 cursor-pointer"
          >
            <LogOut size={20} />
            <span>Cerrar Sesion</span>
          </button>
        </div>
    </>
  )

  return (
    <div className="min-h-screen bg-bg flex">
      <aside className="w-72 bg-inverse text-inverse-text border-r border-white/10 hidden lg:flex flex-col">
        {sidebarInner}
      </aside>

      {/* Móvil/tablet: cajón con el mismo menú (el lateral fijo solo cabe desde lg) */}
      {menuAbierto && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuAbierto(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-inverse text-inverse-text flex flex-col overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom,0px)]">
            <button
              onClick={() => setMenuAbierto(false)}
              className="tap-44 absolute top-3 right-3 rounded-xl bg-transparent border-none text-[#A0A0A0] hover:text-inverse-text cursor-pointer"
              aria-label="Cerrar menú"
            >
              <X size={22} />
            </button>
            {sidebarInner}
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 overflow-auto bg-bg2">
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-2 h-14 px-2 bg-inverse text-inverse-text border-b border-white/10">
          <button
            onClick={() => setMenuAbierto(true)}
            className="tap-44 rounded-xl bg-transparent border-none text-inverse-text cursor-pointer"
            aria-label="Abrir menú"
            aria-expanded={menuAbierto}
          >
            <Menu size={24} />
          </button>
          <span className="font-head text-base font-extrabold tracking-[0.08em]">ANTIGRAVITY</span>
        </div>
        <div className="p-4 sm:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 sm:mb-8 flex items-center gap-4 sm:gap-5"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#FDECEA] overflow-hidden shrink-0 flex items-end justify-center">
              <OwnerAvatar config={user?.avatar} variant="busto" height={92} label={`Avatar de ${user?.nombre || 'tu negocio'}`} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-text">
                {saludo}, {user?.nombre}!
              </h1>
              <p className="text-muted mt-1">{resumenHoy}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                <span className="text-muted break-all">{user?.email}</span>
                <div className="flex items-center gap-1 px-2 py-1 bg-accent-dim rounded-lg">
                  {getPlanIcon()}
                  <span className="text-xs text-accent font-medium">{getPlanLabel()}</span>
                </div>
              </div>
            </div>
          </motion.div>

          <InstallPrompt />
          <ActivationChecklist user={user} onActivando={setActivando} />
          <EstadoNegocio plan={planInfo} activando={activando} domicilios={!domiciliosLocked} />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-8"
          >
            <StatCard
              title="Ventas Hoy"
              value={`$${stats.ventasHoy.toLocaleString()}`}
              trend={stats.cambioVentas !== 0 ? `${stats.cambioVentas > 0 ? '+' : ''}${stats.cambioVentas}% vs ayer` : null}
              icon={TrendingUp}
              variants={itemVariants}
              inverse
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
                      ? 'bg-danger/10 border-danger/30'
                      : alerta.severidad === 'advertencia'
                      ? 'bg-warn/10 border-warn/30'
                      : 'bg-accent/5 border-accent/20'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    alerta.severidad === 'critica'
                      ? 'bg-danger/20'
                      : alerta.severidad === 'advertencia'
                      ? 'bg-warn/20'
                      : 'bg-accent/10'
                  }`}>
                    {alerta.severidad === 'critica' ? (
                      <Zap className="w-4 h-4 text-danger-text" />
                    ) : alerta.severidad === 'advertencia' ? (
                      <Bell className="w-4 h-4 text-warn-text" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-accent" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${
                      alerta.severidad === 'critica' ? 'text-danger-text' :
                      alerta.severidad === 'advertencia' ? 'text-warn-text' : 'text-accent'
                    }`}>{alerta.titulo}</p>
                    <p className="text-muted text-xs mt-0.5">{alerta.mensaje}</p>
                  </div>
                  {alerta.accion && (
                    <button
                      onClick={() => navigate('/suscripcion')}
                      className={`px-3 py-1.5 rounded-xl font-mono text-xs flex-shrink-0 transition-all ${
                        alerta.severidad === 'critica'
                          ? 'bg-danger text-white hover:bg-danger/90'
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
                <MessageSquare size={20} className="text-success" />
                <div>
                  <p className="text-text font-medium text-sm">Conversaciones</p>
                  <p className="text-muted text-xs">Activo</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-bg rounded-xl border border-border/50">
                <ShoppingCart size={20} className="text-success" />
                <div>
                  <p className="text-text font-medium text-sm">Pedidos</p>
                  <p className="text-muted text-xs">Activo</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-bg rounded-xl border border-border/50">
                <Truck size={20} className={domiciliosLocked ? 'text-muted' : 'text-success'} />
                <div>
                  <p className="text-text font-medium text-sm">Domicilios</p>
                  <p className={`text-xs ${domiciliosLocked ? 'text-danger-text' : 'text-success'}`}>
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
                className="font-mono text-xs text-accent hover:text-accent/80 transition-colors inline-flex items-center min-h-[44px]"
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
                      <Power size={14} className="text-success" />
                    ) : (
                      <PowerOff size={14} className="text-muted" />
                    )}
                    <div>
                      <p className="text-text text-sm font-medium">{agentLabels[agentId]}</p>
                      <p className={`text-xs ${isActive ? 'text-success' : 'text-muted'}`}>
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
                className="font-mono text-xs text-accent hover:text-accent/80 transition-colors inline-flex items-center min-h-[44px]"
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
                      <p className={`text-xs ${isActive ? 'text-success' : 'text-muted'}`}>
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