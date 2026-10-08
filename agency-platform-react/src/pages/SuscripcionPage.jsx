import FeedbackMessage from '../components/FeedbackMessage';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Check, Zap, Star, Crown, Loader2, Shield, Calendar,
  ArrowRight, AlertCircle, Plus, Trash2, X, Lock, TrendingUp,
  Users, Clock, AlertTriangle, Sparkles, Target, Rocket,
  HeartHandshake, ArrowLeft, Receipt, History, Gauge, ChevronDown,
  ChevronUp, ExternalLink, Download, Ban, RefreshCw,
} from 'lucide-react';

function formatPrice(price) {
  if (!price && price !== 0) return '$0';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(price);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
}

function UsageBar({ label, used, limit, color = 'accent' }) {
  const pct = limit === -1 ? 0 : Math.min(100, (used / limit) * 100);
  const isUnlimited = limit === -1;
  const isHigh = pct > 80;
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-mono text-xs text-muted uppercase tracking-wider">{label}</span>
        <span className={`font-mono text-sm ${isHigh ? 'text-danger-text' : 'text-text'}`}>
          {isUnlimited ? `${used} (ilimitado)` : `${used} / ${limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 bg-bg3 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={`h-full rounded-full ${isHigh ? 'bg-danger' : `bg-${color}`}`}
          />
        </div>
      )}
    </div>
  );
}

function TrialBanner({ diasRestantes, onUpgrade }) {
  if (diasRestantes <= 0) return null;
  const isUrgent = diasRestantes <= 3;
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl p-4 border ${
        isUrgent ? 'bg-danger/10 border-danger/30' : 'bg-warn/10 border-warn/30'
      }`}
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Clock className={`w-5 h-5 ${isUrgent ? 'text-danger-text' : 'text-warn-text'}`} />
          <div>
            <p className={`font-mono text-sm font-medium ${isUrgent ? 'text-danger-text' : 'text-warn-text'}`}>
              {isUrgent ? '¡Tu trial está por vencer!' : 'Estás en período de prueba'}
            </p>
            <p className="text-muted text-xs mt-0.5">
              Te quedan <span className="font-bold text-text">{diasRestantes} día{diasRestantes > 1 ? 's' : ''}</span> de prueba gratuita
            </p>
          </div>
        </div>
        <button
          onClick={onUpgrade}
          className="font-mono text-xs bg-accent text-white px-4 py-2 rounded-xl hover:bg-accent/90 transition-all flex items-center gap-2"
        >
          Activar ahora <ArrowRight size={14} />
        </button>
      </div>
    </motion.div>
  );
}

function PlanCard({ plan, isCurrent, isUpgrade, onSelect, upgrading, planId }) {
  const Icon = plan.id === 'enterprise' ? Crown : plan.id === 'professional' ? Star : Zap;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative bg-bg2 border rounded-3xl p-6 flex flex-col transition-all ${
        isCurrent
          ? 'border-accent'
          : 'border-border hover:border-border/80'
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-accent text-white text-xs font-mono px-3 py-1 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Más popular
          </span>
        </div>
      )}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-accent-dim flex items-center justify-center">
          <Icon className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h3 className="font-head text-lg font-bold text-text">{plan.nameEs}</h3>
          <span className="font-mono text-xs text-muted">{plan.tagline}</span>
        </div>
      </div>
      <div className="mb-4">
        <span className="text-3xl font-bold text-text">{formatPrice(plan.price)}</span>
        <span className="text-muted text-sm">/mes</span>
      </div>
      <div className="flex-1 space-y-2 mb-6">
        {plan.featuresList.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <Check className="w-4 h-4 text-success flex-shrink-0" />
            <span className="text-muted text-sm">{f}</span>
          </div>
        ))}
      </div>
      <button
        onClick={() => onSelect(plan.id)}
        disabled={isCurrent || upgrading}
        className={`w-full py-3 rounded-2xl font-mono text-sm font-medium transition-all flex items-center justify-center gap-2 ${
          isCurrent
            ? 'bg-bg3 text-muted cursor-not-allowed border border-border'
            : isUpgrade
            ? 'bg-accent text-white hover:bg-accent/90'
            : 'bg-bg3 text-text hover:bg-border/30 border border-border'
        }`}
      >
        {upgrading === plan.id ? <Loader2 size={16} className="animate-spin" />
          : isCurrent ? 'Plan Actual'
          : isUpgrade ? <>Mejorar ahora <ArrowRight size={16} /></>
          : 'Seleccionar'}
      </button>
    </motion.div>
  );
}

function InvoiceRow({ inv }) {
  const estadoColors = {
    pagada: 'text-success bg-success/10',
    pendiente: 'text-warn-text bg-warn/10',
    vencida: 'text-danger-text bg-danger/10',
    cancelada: 'text-muted bg-bg3',
  };
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3">
        <Receipt className="w-4 h-4 text-muted" />
        <div>
          <p className="text-text text-sm font-medium">{inv.numero}</p>
          <p className="text-muted text-xs">{formatDate(inv.fecha_emision || inv.created_at)}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-text">{formatPrice(inv.monto)}</span>
        <span className={`font-mono text-xs px-2 py-1 rounded-lg ${estadoColors[inv.estado] || ''}`}>
          {inv.estado}
        </span>
      </div>
    </div>
  );
}

function HistoryRow({ h }) {
  const tipoLabels = {
    upgrade: 'Upgrade de plan',
    downgrade: 'Downgrade de plan',
    renewal: 'Renovación',
    trial_start: 'Inicio de trial',
    trial_end: 'Fin de trial',
    payment_success: 'Pago exitoso',
    payment_failed: 'Pago fallido',
    cancellation: 'Cancelación',
    reactivation: 'Reactivación',
  };
  const tipoColors = {
    upgrade: 'text-success',
    payment_success: 'text-success',
    renewal: 'text-success',
    downgrade: 'text-warn-text',
    payment_failed: 'text-danger-text',
    cancellation: 'text-danger-text',
    trial_start: 'text-accent',
    trial_end: 'text-muted',
    reactivation: 'text-accent',
  };
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3">
        <History className="w-4 h-4 text-muted" />
        <div>
          <p className={`text-sm font-medium ${tipoColors[h.tipo] || 'text-text'}`}>{tipoLabels[h.tipo] || h.tipo}</p>
          <p className="text-muted text-xs">{h.descripcion}</p>
        </div>
      </div>
      <span className="text-muted text-xs">{formatDate(h.created_at)}</span>
    </div>
  );
}

const PLANS_CONFIG = [
  {
    id: 'starter', nameEs: 'Starter', tagline: 'Para empezar', price: 450000, popular: false,
    featuresList: ['1 número WhatsApp', 'Hasta 100 clientes', '20 productos', '1,000 msgs/mes', 'Reportes básicos', 'Soporte email'],
  },
  {
    id: 'professional', nameEs: 'Professional', tagline: 'El más elegido', price: 850000, popular: true,
    featuresList: ['3 números WhatsApp', '500 clientes', 'Productos ilimitados', '5,000 msgs/mes', 'Analytics avanzado', 'Automatizaciones', 'Soporte prioritario', 'Multi-usuario (5)'],
  },
  {
    id: 'enterprise', nameEs: 'Enterprise', tagline: 'Para dominar', price: 1800000, popular: false,
    featuresList: ['WhatsApp ilimitado', 'Clientes ilimitados', 'Todo ilimitado', 'Mensajes ilimitados', 'Multi-sede', 'Integraciones', 'OCR pagos', 'Soporte 24/7', 'Manager dedicado'],
  },
];

export default function SuscripcionPage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(null);
  const [message, setMessage] = useState(null);
  const [facturas, setFacturas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [uso, setUso] = useState(null);
  const [showFacturas, setShowFacturas] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [stripeStatus, setStripeStatus] = useState(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const [subRes, usoRes, stripeRes] = await Promise.all([
        api.get('/suscripcion/actual'),
        api.get('/suscripcion/uso'),
        api.get('/stripe/status').catch(() => ({ data: {} })),
      ]);
      setSub(subRes.data);
      setUso(usoRes.data);
      setStripeStatus(stripeRes.data);
    } catch (err) {
      console.error('Error loading subscription:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadFacturas() {
    try {
      const res = await api.get('/suscripcion/facturas');
      setFacturas(res.data);
    } catch (err) { console.error(err); }
  }

  async function loadHistorial() {
    try {
      const res = await api.get('/suscripcion/historial');
      setHistorial(res.data);
    } catch (err) { console.error(err); }
  }

  async function handleUpgrade(planId) {
    try {
      setUpgrading(planId);
      setMessage(null);

      // If Stripe is configured, use Stripe checkout
      if (stripeStatus?.stripe_configurado) {
        const res = await api.post('/stripe/checkout', { plan: planId });
        if (res.data.url) {
          window.location.href = res.data.url;
          return;
        }
      }

      // Emulated mode: use /stripe/confirm for simulated payment
      const res = await api.post('/stripe/confirm', { plan: planId });
      if (res.data.emulado) {
        setMessage({ type: 'success', text: res.data.mensaje || `¡Plan ${planId} activado! (pago emulado)` });
      } else {
        setMessage({ type: 'success', text: '¡Plan actualizado correctamente!' });
      }
      updateUser({ plan: planId });
      await loadAll();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Error al actualizar el plan' });
    } finally {
      setUpgrading(null);
    }
  }

  async function handleDowngrade(planId) {
    try {
      setUpgrading(planId);
      setMessage(null);
      await api.post('/suscripcion/downgrade', { plan: planId });
      setMessage({ type: 'success', text: 'Plan cambiado. Efectivo en el próximo ciclo de facturación.' });
      await loadAll();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Error al cambiar plan' });
    } finally {
      setUpgrading(null);
    }
  }

  async function handleCancel() {
    try {
      await api.post('/suscripcion/cancelar', { motivo: cancelMotivo });
      setShowCancelModal(false);
      setCancelMotivo('');
      setMessage({ type: 'success', text: 'Suscripción cancelada. Mantienes acceso hasta el fin del período.' });
      await loadAll();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Error cancelando' });
    }
  }

  async function handleReactivate() {
    try {
      await api.post('/suscripcion/reactivar');
      setMessage({ type: 'success', text: '¡Suscripción reactivada!' });
      await loadAll();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Error reactivando' });
    }
  }

  async function handleOpenBillingPortal() {
    try {
      const res = await api.post('/stripe/portal');
      if (res.data.url) window.location.href = res.data.url;
    } catch (err) {
      setMessage({ type: 'error', text: 'Error abriendo portal de facturación' });
    }
  }

  function toggleFacturas() {
    if (!showFacturas && facturas.length === 0) loadFacturas();
    setShowFacturas(!showFacturas);
  }

  function toggleHistorial() {
    if (!showHistorial && historial.length === 0) loadHistorial();
    setShowHistorial(!showHistorial);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  const planOrder = ['starter', 'professional', 'enterprise'];
  const currentIdx = planOrder.indexOf(sub?.plan || 'starter');
  const currentPlan = PLANS_CONFIG[currentIdx];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 rounded-xl bg-bg2 border border-border hover:border-accent/30 transition-all">
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>
          <div>
            <h1 className="font-head text-3xl font-bold text-text">Suscripción</h1>
            <p className="text-muted mt-1">Gestiona tu plan y facturación</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {message && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <FeedbackMessage type={message.type}>{message.text}</FeedbackMessage>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trial Banner */}
      {sub?.en_trial && sub?.dias_trial_restantes > 0 && (
        <TrialBanner diasRestantes={sub.dias_trial_restantes} onUpgrade={() => handleUpgrade('professional')} />
      )}

      {/* Current Plan Status */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-bg2 border border-border rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            <h2 className="font-head text-xl font-bold text-text">Tu Plan Actual</h2>
          </div>
          {sub?.suscripcion_activa && (
            <button onClick={() => setShowCancelModal(true)} className="font-mono text-xs text-danger-text hover:text-danger-text/80 transition-colors flex items-center gap-1">
              <Ban size={12} /> Cancelar suscripción
            </button>
          )}
          {!sub?.suscripcion_activa && sub?.plan === 'starter' && (
            <button onClick={handleReactivate} className="font-mono text-xs text-accent hover:text-accent/80 transition-colors flex items-center gap-1">
              <RefreshCw size={12} /> Reactivar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-1">
            <span className="font-mono text-xs text-muted uppercase tracking-wider">Plan</span>
            <p className="text-text font-semibold text-lg">{currentPlan?.nameEs}</p>
          </div>
          <div className="space-y-1">
            <span className="font-mono text-xs text-muted uppercase tracking-wider">Precio</span>
            <p className="text-text font-semibold text-lg">{formatPrice(sub?.plan_precio)}/mes</p>
          </div>
          <div className="space-y-1">
            <span className="font-mono text-xs text-muted uppercase tracking-wider">Estado</span>
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${sub?.suscripcion_activa ? 'bg-success' : sub?.en_trial ? 'bg-warn' : 'bg-danger'}`} />
              <span className={`font-mono text-sm ${sub?.suscripcion_activa ? 'text-success' : sub?.en_trial ? 'text-warn-text' : 'text-danger-text'}`}>
                {sub?.suscripcion_activa ? 'Activa' : sub?.en_trial ? 'Trial' : 'Inactiva'}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <span className="font-mono text-xs text-muted uppercase tracking-wider">Próximo cobro</span>
            <p className="text-text text-sm">{sub?.proximo_pago ? formatDate(sub.proximo_pago) : 'Sin fecha'}</p>
          </div>
        </div>

        {/* Usage Meters */}
        {uso && (
          <div className="mt-6 p-4 bg-bg3 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-4 h-4 text-accent" />
              <span className="font-mono text-xs text-muted uppercase tracking-wider">Uso este mes ({uso.periodo})</span>
            </div>
            <UsageBar label="Mensajes" used={uso.uso.mensajes_usados} limit={uso.limites.mensajes.limit} />
            <UsageBar label="Clientes nuevos" used={uso.uso.clientes_nuevos} limit={uso.limites.clientes.limit} />
            <UsageBar label="Productos" used={uso.uso.productos_creados} limit={uso.limites.productos.limit} />
          </div>
        )}

        {/* Stripe / Emulated billing portal */}
        <div className="mt-4">
          {stripeStatus?.modo === 'emulado' ? (
            <div className="flex items-center gap-2 text-muted">
              <span className="font-mono text-xs bg-bg3 px-3 py-1 rounded-lg border border-border">
                Modo emulado - Pagos simulados sin Stripe real
              </span>
            </div>
          ) : sub?.stripe_customer_id ? (
            <button onClick={handleOpenBillingPortal} className="font-mono text-xs text-accent hover:text-accent/80 transition-colors flex items-center gap-1">
              <ExternalLink size={12} /> Gestionar facturación en Stripe
            </button>
          ) : null}
        </div>
      </motion.div>

      {/* Available Plans */}
      <div>
        <h2 className="font-head text-xl font-bold text-text mb-4">Planes Disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS_CONFIG.map((plan, idx) => {
            const isCurrent = currentPlan?.id === plan.id;
            const isUpgrade = idx > currentIdx;
            const isDowngrade = idx < currentIdx;
            return (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={isCurrent}
                isUpgrade={isUpgrade}
                onSelect={isDowngrade ? handleDowngrade : handleUpgrade}
                upgrading={upgrading}
                planId={plan.id}
              />
            );
          })}
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-bg2 border border-border rounded-3xl overflow-hidden">
        <button onClick={toggleFacturas} className="w-full flex items-center justify-between p-6 hover:bg-bg3/50 transition-colors">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-accent" />
            <h2 className="font-head text-lg font-bold text-text">Historial de Facturas</h2>
            {facturas.length > 0 && <span className="font-mono text-xs text-muted bg-bg3 px-2 py-1 rounded-lg">{facturas.length}</span>}
          </div>
          {showFacturas ? <ChevronUp className="w-5 h-5 text-muted" /> : <ChevronDown className="w-5 h-5 text-muted" />}
        </button>
        <AnimatePresence>
          {showFacturas && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-6 pb-6">
                {facturas.length === 0 ? (
                  <p className="text-muted text-sm text-center py-4">No hay facturas registradas</p>
                ) : (
                  facturas.map(f => <InvoiceRow key={f.id} inv={f} />)
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Billing History */}
      <div className="bg-bg2 border border-border rounded-3xl overflow-hidden">
        <button onClick={toggleHistorial} className="w-full flex items-center justify-between p-6 hover:bg-bg3/50 transition-colors">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-accent" />
            <h2 className="font-head text-lg font-bold text-text">Historial de Cambios</h2>
          </div>
          {showHistorial ? <ChevronUp className="w-5 h-5 text-muted" /> : <ChevronDown className="w-5 h-5 text-muted" />}
        </button>
        <AnimatePresence>
          {showHistorial && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-6 pb-6">
                {historial.length === 0 ? (
                  <p className="text-muted text-sm text-center py-4">No hay cambios registrados</p>
                ) : (
                  historial.map(h => <HistoryRow key={h.id} h={h} />)
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Guarantee */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-r from-bg2 to-bg3 border border-border rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <HeartHandshake className="w-6 h-6 text-accent" />
          <h3 className="font-head text-lg font-bold text-text">Garantía de satisfacción</h3>
        </div>
        <p className="text-muted text-sm mb-4">Si no estás satisfecho en los primeros 15 días, te devolvemos el dinero. Sin preguntas.</p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-success" /><span className="text-text text-sm">Pago seguro</span></div>
          <div className="flex items-center gap-2"><Rocket className="w-4 h-4 text-accent" /><span className="text-text text-sm">Cancela cuando quieras</span></div>
        </div>
      </motion.div>

      {/* Cancel Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowCancelModal(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-bg2 border border-border rounded-3xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-head text-xl font-bold text-text">Cancelar Suscripción</h3>
                <button onClick={() => setShowCancelModal(false)} className="text-muted hover:text-text"><X size={20} /></button>
              </div>
              <p className="text-muted text-sm mb-4">¿Por qué quieres cancelar? Tu acceso se mantendrá hasta el fin del período facturado.</p>
              <textarea value={cancelMotivo} onChange={e => setCancelMotivo(e.target.value)}
                placeholder="Cuéntanos tu motivo (opcional)..."
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text placeholder:text-muted/50 focus:outline-none focus:border-accent h-24 resize-none" />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowCancelModal(false)} className="flex-1 py-3 rounded-xl bg-bg3 text-text font-mono text-sm border border-border hover:bg-border/30">No cancelar</button>
                <button onClick={handleCancel} className="flex-1 py-3 rounded-xl bg-danger text-white font-mono text-sm hover:bg-danger/90">Confirmar cancelación</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
