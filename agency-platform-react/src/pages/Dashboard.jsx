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
  UtensilsCrossed,
  Store,
  BookOpen,
  Tag,
  Send,
} from 'lucide-react'
import api, { analyticsService } from '../services/api'
import { usePlan } from '../components/PlanGate'
import { useHitos } from '../context/HitosContext'
import OwnerAvatar from '../components/avatar/OwnerAvatar'
import ActivationChecklist from '../components/ActivationChecklist'
import InstallPrompt from '../components/InstallPrompt'
import Sparkline from '../components/Sparkline'
import { SkeletonCards } from '../components/Skeleton'
import { planLabel } from '../components/shell/navConfig'
import EstadoNegocio from '../components/EstadoNegocio'

const StatCard = ({ title, value, trend, sub, spark, icon: Icon, variants, inverse = false }) => (
  <motion.div
    variants={variants}
    className={`noma-lift rounded-2xl p-5 sm:p-6 border ${
      inverse ? 'bg-inverse border-inverse text-inverse-text' : 'bg-bg border-border'
    }`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className={`text-sm ${inverse ? 'text-[#A0A0A0]' : 'text-muted'}`}>{title}</p>
        <p className={`font-mono text-3xl font-bold mt-1 ${inverse ? 'text-inverse-text' : 'text-text'}`}>{value}</p>
        {sub && <p className={`text-xs mt-1 ${inverse ? 'text-[#A0A0A0]' : 'text-muted'}`}>{sub}</p>}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp size={14} className={inverse ? 'text-[#81C784]' : 'text-success'} />
            <span className={`text-xs font-medium ${inverse ? 'text-[#81C784]' : 'text-success'}`}>{trend}</span>
          </div>
        )}
        {spark && <Sparkline values={spark} width={120} height={28} className={`mt-3 ${inverse ? 'text-[#EF5350]' : 'text-accent'}`} />}
      </div>
      <div>
        <div className={`p-3 rounded-xl ${inverse ? 'bg-[#E53935]/15' : 'bg-accent-dim'}`}>
          <Icon size={24} className={inverse ? 'text-[#E53935]' : 'text-accent'} />
        </div>
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
    ayerVentas: 0,
    ayerPedidos: 0,
  })
  const [serie, setSerie] = useState({ ventas: [], pedidos: [] })
  const [alertas, setAlertas] = useState([])
  const [botConfig, setBotConfig] = useState(null)
  const [autoEstado, setAutoEstado] = useState({})
  const [loading, setLoading] = useState(true)
  const [apiPlan, setApiPlan] = useState(null)
  const [planInfo, setPlanInfo] = useState(null)
  const [activando, setActivando] = useState(false)

  const effectivePlan = apiPlan || plan
  const domiciliosLocked = effectivePlan === 'starter' || effectivePlan === 'emprendedor'

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
          ayerVentas: hoy.ayer_ventas || 0,
          ayerPedidos: hoy.ayer_pedidos || 0,
        })
        const dias = response?.ventas_diarias || []
        setSerie({ ventas: dias.map((d) => d.ventas), pedidos: dias.map((d) => d.pedidos) })
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

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const resumenHoy =
    stats.pedidosHoy > 0
      ? `Hoy llevas ${stats.pedidosHoy} ${stats.pedidosHoy === 1 ? 'pedido' : 'pedidos'} y $${stats.ventasHoy.toLocaleString()} en ventas.`
      : 'Aún no hay pedidos hoy.'

  return (
    <div className="min-h-screen bg-bg2">
      <main>
        <div className="p-4 sm:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-center gap-5"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-accent-dim overflow-hidden shrink-0 flex items-end justify-center">
              <OwnerAvatar config={user?.avatar} variant="busto" height={92} label={`Avatar de ${user?.nombre || 'tu negocio'}`} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-text">
                {saludo}, {user?.nombre}!
              </h1>
              <p className="text-muted mt-1">{resumenHoy}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-muted">{user?.email}</span>
                <button
                  onClick={() => navigate('/suscripcion')}
                  className="flex items-center gap-1 px-2 py-1 bg-accent-dim rounded-lg border-none cursor-pointer"
                >
                  <Crown size={14} className="text-accent" />
                  <span className="text-xs text-accent font-medium">{planLabel(effectivePlan)}</span>
                </button>
              </div>
            </div>
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

          {loading ? (
            <SkeletonCards className="mb-8" />
          ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8"
          >
            <StatCard
              title="Ventas Hoy"
              value={`$${stats.ventasHoy.toLocaleString()}`}
              sub={`Ayer: $${stats.ayerVentas.toLocaleString()}`}
              spark={serie.ventas}
              trend={stats.cambioVentas !== 0 ? `${stats.cambioVentas > 0 ? '+' : ''}${stats.cambioVentas}% vs ayer` : null}
              icon={TrendingUp}
              variants={itemVariants}
              inverse
            />
            <StatCard
              title="Pedidos Hoy"
              value={stats.pedidosHoy}
              sub={`Ayer: ${stats.ayerPedidos}`}
              spark={serie.pedidos}
              trend={null}
              icon={ShoppingCart}
              variants={itemVariants}
            />
            <StatCard
              title="Mensajes Hoy"
              value={stats.mensajesHoy}
              sub="Mensajes que tu bot atendió"
              trend={null}
              icon={MessageSquare}
              variants={itemVariants}
            />
            <StatCard
              title="IA Procesados"
              value={stats.aiProcesados}
              sub="Respuestas generadas con IA"
              trend={stats.tasaIA > 0 ? `${stats.tasaIA}% conversión` : null}
              icon={Zap}
              variants={itemVariants}
            />
          </motion.div>
          )}

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
    </div>
  )
}