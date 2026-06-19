import './StatusBadge.css';

const ESTADOS = {
  pendiente_pago: { label: 'Pendiente Pago', color: 'warning' },
  pago_enviado: { label: 'Pago Enviado', color: 'info' },
  pago_confirmado: { label: 'Pago Confirmado', color: 'accent' },
  en_preparacion: { label: 'En Preparación', color: 'purple' },
  enviado: { label: 'Enviado', color: 'info' },
  entregado: { label: 'Entregado', color: 'success' },
  cancelado: { label: 'Cancelado', color: 'error' },
  activo: { label: 'Activo', color: 'success' },
  inactivo: { label: 'Inactivo', color: 'error' },
  trial: { label: 'Trial', color: 'purple' }
};

export default function StatusBadge({ estado, variant = 'pill', size = 'md' }) {
  const config = ESTADOS[estado] || { label: estado, color: 'default' };

  return (
    <span className={`status-badge status-${config.color} variant-${variant} size-${size}`}>
      {variant === 'dot' && <span className="status-dot"></span>}
      {config.label}
    </span>
  );
}
