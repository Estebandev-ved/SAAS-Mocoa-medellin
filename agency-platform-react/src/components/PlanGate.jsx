import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPlanFeatures, hasFeature, getLimit, getPlanUpgradeMessage } from '../utils/planFeatures';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, Zap } from 'lucide-react';

export function usePlan() {
  const { user } = useAuth();
  const plan = user?.plan || 'starter';
  const features = getPlanFeatures(plan);

  return {
    plan,
    features,
    hasFeature: (feature) => hasFeature(plan, feature),
    getLimit: (key) => getLimit(plan, key),
    isStarter: plan === 'starter',
    isProfessional: plan === 'professional',
    isEnterprise: plan === 'enterprise',
  };
}

export function PlanGate({ feature, children, fallback }) {
  const { plan } = usePlan();
  const allowed = hasFeature(plan, feature);
  const navigate = useNavigate();

  if (allowed) return children;

  const upgrade = getPlanUpgradeMessage(plan, feature);

  if (fallback) return fallback;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative"
    >
      <div className="absolute inset-0 backdrop-blur-sm bg-bg/80 z-10 rounded-2xl flex items-center justify-center">
        <div className="text-center p-6 max-w-sm">
          <div className="w-12 h-12 bg-accent-dim rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-accent" />
          </div>
          <h3 className="font-head text-lg font-bold text-text mb-2">Función bloqueada</h3>
          <p className="text-muted text-sm mb-4">
            Esta función no está disponible en tu plan{' '}
            <span className="text-text font-semibold capitalize">{plan}</span>
          </p>
          {upgrade && (
            <button
              onClick={() => navigate('/suscripcion')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl font-mono text-sm hover:bg-accent/90 transition-all"
            >
              <Zap size={16} />
              Mejorar a {upgrade.planName}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="opacity-30 pointer-events-none select-none">{children}</div>
    </motion.div>
  );
}

export function PlanLimitBadge({ current, max, label }) {
  const isUnlimited = max === -1 || max === Infinity;
  const isNearLimit = !isUnlimited && current >= max * 0.8;
  const isAtLimit = !isUnlimited && current >= max;

  return (
    <div className="flex items-center gap-2">
      {label && <span className="font-mono text-xs text-muted">{label}</span>}
      <span
        className={`font-mono text-xs px-2 py-0.5 rounded-lg ${
          isAtLimit
            ? 'bg-danger/10 text-danger-text border border-danger/30'
            : isNearLimit
            ? 'bg-warn/10 text-warn-text border border-warn/30'
            : 'bg-accent-dim text-accent border border-border'
        }`}
      >
        {isUnlimited ? '∞' : `${current}/${max}`}
      </span>
    </div>
  );
}

export function UpgradePrompt({ plan: requiredPlan, feature }) {
  const navigate = useNavigate();
  const upgrade = getPlanUpgradeMessage(requiredPlan, feature);

  if (!upgrade) return null;

  return (
    <div className="bg-bg border border-border rounded-2xl p-6 text-center">
      <div className="w-10 h-10 bg-accent-dim rounded-xl flex items-center justify-center mx-auto mb-3">
        <Lock className="w-5 h-5 text-accent" />
      </div>
      <h4 className="font-head text-base font-bold text-text mb-1">Necesitas un plan superior</h4>
      <p className="text-muted text-sm mb-4">
        Disponible en el plan <span className="text-text font-semibold">{upgrade.planName}</span>
      </p>
      <button
        onClick={() => navigate('/suscripcion')}
        className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl font-mono text-sm hover:bg-accent/90 transition-all"
      >
        Ver planes
        <ArrowRight size={14} />
      </button>
    </div>
  );
}
