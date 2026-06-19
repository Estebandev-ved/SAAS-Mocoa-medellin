import './PlanBadge.css';

export default function PlanBadge({ plan, size = 'md' }) {
  const planConfig = {
    starter: { label: 'STARTER', color: 'default' },
    professional: { label: 'PROFESSIONAL', color: 'accent' },
    enterprise: { label: 'ENTERPRISE', color: 'warning' },
    trial: { label: 'TRIAL 7 DÍAS', color: 'trial' }
  };

  const config = planConfig[plan] || planConfig.starter;

  return (
    <span className={`plan-badge plan-${config.color} plan-size-${size}`}>
      {config.label}
    </span>
  );
}
