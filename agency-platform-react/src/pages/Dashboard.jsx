import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
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
  UtensilsCrossed,
  Store,
  BookOpen,
  Tag,
  Send,
  Search,
  PlayCircle,
} from 'lucide-react'
import api, { analyticsService } from '../services/api'
import { usePlan } from '../components/PlanGate'
import { useHitos } from '../context/HitosContext'
import OwnerAvatar from '../components/avatar/OwnerAvatar'
import ActivationChecklist from '../components/ActivationChecklist'
import InstallPrompt from '../components/InstallPrompt'
import Logo from '../components/Logo'
import EstadoNegocio from '../components/EstadoNegocio'
import AccionesSugeridas from '../components/AccionesSugeridas'
import ProductTour, { tourVisto } from '../components/ProductTour'
import { SkeletonCards, Skeleton } from '../components/Skeleton'

const PASOS_TOUR = [
  { selector: '[data-tour="saludo"]', titulo: 'Tu resumen del día', texto: 'Aquí ves cuántos pedidos y cuánto has vendido hoy. Se actualiza solo.' },
  { selector: '[data-tour="acciones"]', titulo: 'Qué hacer ahora', texto: 'Tus tareas pendientes: comprobantes por revisar, pedidos por preparar y clientes que esperan una persona. Cada una te lleva directo a resolverla.' },
  { selector: '[data-tour="stats"]', titulo: 'Tus números', texto: 'Ventas, pedidos, mensajes y cuánto trabajo hizo la IA por ti.' },
  { selector: '[data-tour="menu"]', titulo: 'Tu menú', texto: 'Desde aquí vas a pedidos, conversaciones, productos, automatizaciones y más.' },
  { selector: '[data-tour="menu-movil"]', titulo: 'Tu menú', texto: 'Abajo tienes lo principal. En “Más” están el resto de pantallas, el tema oscuro y el sonido.' },
  { selector: '[data-tour="buscar"]', titulo: 'Búsqueda rápida', texto: 'Busca cualquier pantalla, pedido, cliente o producto. En computador también con Ctrl + K.' },
]

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
  const [params, setParams] = useSearchParams()
  const [tourActivo, setTourActivo] = useState(false)
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
  const [autoEstado, setAutoEstado] = useState({})
  const [loading, setLoading] = useState(true)
  const [apiPlan, setApiPlan] = useState(null)
  const [planInfo, setPlanInfo] = useState(null)
  const [activando, setActivando] = useState(false)

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

    api.get('/automations')
      .then((res) => setAutoEstado(res.data?.automations || {}))
      .catch(() => {})

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
    { icon: Send, label: 'Campañas', path: '/campanas' },
    { icon: Tag, label: 'Cupones', path: '/cupones' },
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
    { icon: CreditCard, label: 'Suscripcion', path: '/suscripcion' },
    ...(user?.rol === 'admin' || user?.rol === 'superadmin'
      ? [{ icon: Users, label: 'Panel Admin', path: '/admin' }]
      : [])
  ]

  const bottomItems = [
    { icon: BookOpen, label: 'Guía de uso', path: '/guia' },
    { icon: Settings, label: 'Ajustes', path: '/ajustes' }
  ]

  // El tour arranca solo la primera vez (cuando ya cargó la pantalla) o al pedirlo desde la Guía.
  useEffect(() => {
    if (loading) return undefined
    const pedido = params.get('tour') === '1'
    if (!pedido && tourVisto()) return undefined
    const t = setTimeout(() => setTourActivo(true), 600)
    return () => clearTimeout(t)
  }, [loading, params])

  const terminarTour = () => {
    setTourActivo(false)
    if (params.get('tour')) {
      params.delete('tour')
      setParams(params, { replace: true })
    }
  }

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const resumenHoy =
    stats.pedidosHoy > 0
      ? `Hoy llevas ${stats.pedidosHoy} ${stats.pedidosHoy === 1 ? 'pedido' : 'pedidos'} y $${stats.ventasHoy.toLocaleString()} en ventas.`
      : 'Aún no hay pedidos hoy.'

  if (loading) {
    return (
      <div className="min-h-screen bg-bg2 p-6 lg:p-8" role="status" aria-label="Cargando">
        <div className="flex items-center gap-5 mb-8">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div>
            <Skeleton className="h-7 w-64 mb-3" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <SkeletonCards n={4} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex">
      <aside data-tour="menu" className="w-72 bg-inverse text-inverse-text border-r border-white/10 hidden lg:flex flex-col">
        <div className="p-6 border-b border-white/10">
          <h1 className="m-0">
            <Logo size={40} tone="light" />
          </h1>
        </div>

        <div className="p-4 mx-4 mt-4 rounded-xl bg-white/10 flex items-center gap-3">
          {getPlanIcon()}
          <span className="text-sm text-inverse-text font-medium">{getPlanLabel()}</span>
          <button
            onClick={() => navigate('/suscripcion')}
            className="ml-auto text-xs font-semibold text-[#E53935] hover:text-inverse-text transition-colors bg-transparent border-none cursor-pointer"
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

        <div className="p-4 border-t border-white/10 space-y-1">
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
            className="w-full flex items-center gap-3 px-4 h-11 rounded-xl text-sm font-semibold text-[#A0A0A0] bg-transparent border-none hover:bg-white/5 hover:text-inverse-text transition-colors duration-200 cursor-pointer"
          >
            <LogOut size={20} />
            <span>Cerrar Sesion</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-bg2">
        <div className="p-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            data-tour="saludo"
            className="mb-8 flex items-center gap-5"
          >
            <div className="w-20 h-20 rounded-full bg-[#FDECEA] overflow-hidden shrink-0 flex items-end justify-center">
              <OwnerAvatar config={user?.avatar} variant="busto" height={92} label={`Avatar de ${user?.nombre || 'tu negocio'}`} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text">
                {saludo}, {user?.nombre}!
              </h1>
              <p className="text-muted mt-1">{resumenHoy}</p>
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                <span className="text-muted">{user?.email}</span>
                <div className="flex items-center gap-1 px-2 py-1 bg-accent-dim rounded-lg">
                  {getPlanIcon()}
                  <span className="text-xs text-accent font-medium">{getPlanLabel()}</span>
                </div>
              </div>
            </div>
            <button
              data-tour="buscar"
              onClick={() => window.dispatchEvent(new CustomEvent('abrir-paleta'))}
              aria-label="Buscar (Ctrl K)"
              className="ml-auto h-11 px-4 rounded-xl bg-white border border-border text-muted text-sm cursor-pointer inline-flex items-center gap-2 hover:border-accent/40 shrink-0"
            >
              <Search size={16} />
              <span className="hidden sm:inline">Buscar</span>
              <kbd className="hidden lg:inline text-[11px] border border-border rounded px-1.5 py-0.5">Ctrl K</kbd>
            </button>
          </motion.div>

          <InstallPrompt />
          <ActivationChecklist user={user} onActivando={setActivando} />
          <EstadoNegocio plan={planInfo} activando={activando} domicilios={!domiciliosLocked} />

          {(() => {
            // Plan de pago por vencer (la prueba gratis ya la avisa EstadoNegocio).
            if (!planInfo?.activo || planInfo.en_trial || !planInfo.fin) return null
            const diasRestantes = Math.ceil((new Date(planInfo.fin).getTime() - Date.now()) / 86400000)
            if (diasRestantes > 5) return null
            return (
              <div role="alert" className="mb-6 flex items-center justify-between gap-3 flex-wrap rounded-2xl border border-warn/40 bg-warn/10 px-5 py-4">
                <p className="text-sm text-text">
                  {diasRestantes <= 0
                    ? 'Tu plan venció. Renuévalo para que tu bot siga atendiendo.'
                    : `Tu plan vence en ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}. Renuévalo para que tu bot no se detenga.`}
                </p>
                <button
                  onClick={() => navigate('/suscripcion')}
                  className="h-10 px-4 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold border-none cursor-pointer"
                >
                  Renovar ahora
                </button>
              </div>
            )
          })()}

          <AccionesSugeridas />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            data-tour="stats"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8"
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
                className="font-mono text-xs text-accent hover:text-accent/80 transition-colors"
              >
                Ver todos →
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {['ventas', 'pagos', 'pedidos', 'faq', 'reclamos', 'retencion'].map((agentId) => {
                const isActive = (botConfig?.agentes_activos || []).includes(agentId)
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
                className="font-mono text-xs text-accent hover:text-accent/80 transition-colors"
              >
                Configurar →
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { id: 'recordatorio_pago', label: 'Recordatorio de pago', icon: Bell },
                { id: 'resena', label: 'Pedir reseña', icon: Star },
                { id: 'stock_bajo', label: 'Alerta de stock', icon: Package },
                { id: 'reengagement', label: 'Reenganche', icon: Users },
                { id: 'reporte_semanal', label: 'Reporte semanal', icon: TrendingUp },
              ].map((auto) => {
                const isActive = !!autoEstado[auto.id]?.activa
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
      <ProductTour pasos={PASOS_TOUR} activo={tourActivo} onTerminar={terminarTour} />
    </div>
  )
}