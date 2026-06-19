import { useState } from 'react';
import PlanGuard from '../../components/auth/PlanGuard';
import Button from '../../components/ui/Button';
import './AutomationsPage.css';

const AUTOMATIONS = [
  { id: 'bot_ventas', nombre: 'Bot de ventas principal', descripcion: 'Automátiza la atención y ventas por WhatsApp', icon: '🤖', defaultOn: true },
  { id: 'notificaciones', nombre: 'Notificaciones al dueño', descripcion: 'Recibe alertas de nuevos pedidos y mensajes', icon: '✉️', defaultOn: true },
  { id: 'recordatorio_pago', nombre: 'Recordatorio de pago', descripcion: 'Envía recordatorios a clientes con pagos pendientes', icon: '⏰', plans: ['starter', 'professional', 'enterprise'] },
  { id: 'resena', nombre: 'Solicitud de reseña', descripcion: 'Pide reseñas después de cada entrega', icon: '⭐', plans: ['starter', 'professional', 'enterprise'] },
  { id: 'reengagement', nombre: 'Re-engagement', descripcion: 'Recupera clientes inactivos con ofertas', icon: '🔄', plans: ['professional', 'enterprise'] },
  { id: 'stock_alert', nombre: 'Alerta de stock bajo', descripcion: 'Notifica cuando un producto está por agotarse', icon: '📦', plans: ['professional', 'enterprise'] },
  { id: 'reporte_semanal', nombre: 'Reporte semanal', descripcion: 'Recibe un resumen semanal de ventas', icon: '📊', plans: ['professional', 'enterprise'] },
  { id: 'campana_masiva', nombre: 'Campaña masiva', descripcion: 'Envía mensajes promocionales a segmentos', icon: '🎯', plans: ['professional', 'enterprise'] }
];

function AutomationsContent() {
  const [enabled, setEnabled] = useState({ bot_ventas: true, notificaciones: true });

  const toggle = (id) => setEnabled(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="automations-page">
      <div className="page-header">
        <h2>Automatizaciones</h2>
      </div>
      <div className="automations-grid">
        {AUTOMATIONS.map(auto => (
          <div key={auto.id} className={`automation-card ${enabled[auto.id] ? 'active' : ''}`}>
            <div className="automation-icon">{auto.icon}</div>
            <div className="automation-info">
              <h3>{auto.nombre}</h3>
              <p>{auto.descripcion}</p>
              {auto.plans && <span className="automation-plan">Plan {auto.plans.join('/')}</span>}
            </div>
            <button className={`toggle-btn ${enabled[auto.id] ? 'on' : ''}`} onClick={() => toggle(auto.id)}>
              <span className="toggle-knob"></span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AutomationsPage() {
  return (
    <PlanGuard planesPermitidos={['professional', 'enterprise']}>
      <AutomationsContent />
    </PlanGuard>
  );
}
