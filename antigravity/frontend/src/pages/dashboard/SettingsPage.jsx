import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { businessService } from '../../services/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import PlanBadge from '../../components/dashboard/PlanBadge';
import './SettingsPage.css';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('cuenta');
  const [loading, setLoading] = useState(false);
  const [passwords, setPasswords] = useState({ actual: '', nueva: '', confirmar: '' });

  const handlePasswordChange = async () => {
    if (passwords.nueva !== passwords.confirmar) {
      alert('Las contraseñas no coinciden');
      return;
    }
    try {
      setLoading(true);
      await businessService.updatePassword(passwords.actual, passwords.nueva);
      alert('Password actualizado');
      setPasswords({ actual: '', nueva: '', confirmar: '' });
    } catch (error) {
      alert(error.response?.data?.error || 'Error al cambiar password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h2>Ajustes</h2>
      </div>

      <div className="settings-tabs">
        {['cuenta', 'seguridad', 'plan'].map(tab => (
          <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="settings-content">
        {activeTab === 'cuenta' && (
          <div className="settings-section">
            <h3>Información de la cuenta</h3>
            <div className="settings-form">
              <Input label="Nombre del negocio" defaultValue={user?.nombre} />
              <Input label="Email" type="email" defaultValue={user?.email} disabled />
              <Input label="WhatsApp" defaultValue="+573001234567" />
              <Input label="Ciudad" defaultValue="Bogotá" />
              <Button>Guardar cambios</Button>
            </div>
          </div>
        )}

        {activeTab === 'seguridad' && (
          <div className="settings-section">
            <h3>Cambiar contraseña</h3>
            <div className="settings-form">
              <Input label="Password actual" type="password" value={passwords.actual} onChange={(e) => setPasswords({ ...passwords, actual: e.target.value })} />
              <Input label="Nueva password" type="password" value={passwords.nueva} onChange={(e) => setPasswords({ ...passwords, nueva: e.target.value })} />
              <Input label="Confirmar password" type="password" value={passwords.confirmar} onChange={(e) => setPasswords({ ...passwords, confirmar: e.target.value })} />
              <Button onClick={handlePasswordChange} loading={loading}>Cambiar password</Button>
            </div>
            <div className="sessions-section">
              <h4>Sesiones activas</h4>
              <div className="session-item">
                <div className="session-info">
                  <span className="session-device">Chrome - Windows</span>
                  <span className="session-location">Bogotá, Colombia • Actual</span>
                </div>
                <Button size="sm" variant="ghost">Cerrar</Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="settings-section">
            <div className="plan-current">
              <h3>Plan actual</h3>
              <div className="plan-card-active">
                <div className="plan-header">
                  <PlanBadge plan={user?.plan} />
                  <span className="plan-price">$850.000/mes</span>
                </div>
                <p>Tu plan incluye:</p>
                <ul>
                  <li>✓ Clientes ilimitados</li>
                  <li>✓ Analytics avanzado</li>
                  <li>✓ Automatizaciones</li>
                  <li>✓ Personalización completa</li>
                </ul>
              </div>
            </div>
            <Button variant="outline">Cambiar plan</Button>
          </div>
        )}
      </div>
    </div>
  );
}
