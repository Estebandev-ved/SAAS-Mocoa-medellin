import { useState, useEffect } from 'react';
import PlanGuard from '../../components/auth/PlanGuard';
import Button from '../../components/ui/Button';
import { apiService } from '../../services/api';
import './AutomationsPage.css';

const AUTOMATIONS = [
  { id: 'bot_ventas', nombre: 'Bot de ventas principal', descripcion: 'Automátiza la atención y ventas por WhatsApp', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>, defaultOn: true },
  { id: 'notificaciones', nombre: 'Notificaciones al dueño', descripcion: 'Recibe alertas de nuevos pedidos y mensajes', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>, defaultOn: true },
  { id: 'recordatorio_pago', nombre: 'Recordatorio de pago', descripcion: 'Envía recordatorios a clientes con pagos pendientes', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, plans: ['starter', 'professional', 'enterprise'] },
  { id: 'resena', nombre: 'Solicitud de reseña', descripcion: 'Pide reseñas después de cada entrega', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, plans: ['starter', 'professional', 'enterprise'] },
  { id: 'reengagement', nombre: 'Re-engagement', descripcion: 'Recupera clientes inactivos con ofertas', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>, plans: ['professional', 'enterprise'] },
  { id: 'stock_bajo', nombre: 'Alerta de stock bajo', descripcion: 'Notifica cuando un producto está por agotarse', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>, plans: ['professional', 'enterprise'] },
  { id: 'reporte_semanal', nombre: 'Reporte semanal', descripcion: 'Recibe un resumen semanal de ventas', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, plans: ['professional', 'enterprise'] },
  { id: 'campaña_masiva', nombre: 'Campaña masiva', descripcion: 'Envía mensajes promocionales a segmentos', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>, plans: ['professional', 'enterprise'] }
];

function AutomationsContent() {
  const [enabled, setEnabled] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAutomations();
  }, []);

  const fetchAutomations = async () => {
    try {
      const data = await apiService.get('/api/automations');
      const config = data.automations || data || {};
      const enabledMap = {};
      AUTOMATIONS.forEach(auto => {
        enabledMap[auto.id] = config[auto.id]?.activa ?? auto.defaultOn ?? false;
      });
      setEnabled(enabledMap);
    } catch (err) {
      console.error('Error fetching automations:', err);
      const defaults = {};
      AUTOMATIONS.forEach(auto => {
        defaults[auto.id] = auto.defaultOn ?? false;
      });
      setEnabled(defaults);
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (id) => {
    const newValue = !enabled[id];
    setEnabled(prev => ({ ...prev, [id]: newValue }));
    
    setSaving(true);
    try {
      await apiService.put('/api/automations', { 
        tipo: id, 
        activa: newValue 
      });
    } catch (err) {
      console.error('Error saving automation:', err);
      setEnabled(prev => ({ ...prev, [id]: !newValue }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="automations-page">
      <div className="page-header">
        <h2>Automatizaciones</h2>
        {saving && <span className="saving-indicator">Guardando...</span>}
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
            <button 
              className={`toggle-btn ${enabled[auto.id] ? 'on' : ''}`} 
              onClick={() => toggle(auto.id)}
              disabled={loading}
            >
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
