import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { businessService } from '../../services/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import PlanBadge from '../../components/dashboard/PlanBadge';
import './SettingsPage.css';

const formatCOP = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor || 0);

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('cuenta');
  const [loading, setLoading] = useState(false);
  const [passwords, setPasswords] = useState({ actual: '', nueva: '', confirmar: '' });
  const [planData, setPlanData] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [planError, setPlanError] = useState(null);

  useEffect(() => {
    let vivo = true;
    setLoadingPlan(true);
    businessService.getPlan()
      .then((data) => { if (vivo) { setPlanData(data); setPlanError(null); } })
      .catch((err) => { if (vivo) setPlanError(err.response?.data?.error || 'No se pudo cargar el uso del plan'); })
      .finally(() => { if (vivo) setLoadingPlan(false); });
    return () => { vivo = false; };
  }, []);

  const handleUpgrade = async (nuevoPlanId, nombrePlan) => {
    if (!window.confirm(`¿Actualizar a ${nombrePlan}? El cobro se ajusta desde tu próximo ciclo de facturación.`)) {
      return;
    }
    setUpgrading(true);
    try {
      await businessService.upgradePlan(nuevoPlanId);
      const data = await businessService.getPlan();
      setPlanData(data);
      alert(`Listo, tu plan ahora es ${nombrePlan}`);
    } catch (error) {
      alert(error.response?.data?.error || 'No se pudo actualizar el plan');
    } finally {
      setUpgrading(false);
    }
  };

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
          <div className="settings-section settings-section-plan">
            {loadingPlan && <p>Cargando tu plan...</p>}

            {!loadingPlan && planError && (
              <div className="error-banner">{planError}</div>
            )}

            {!loadingPlan && planData && (
              <>
                <div className="plan-current">
                  <h3>Plan actual</h3>
                  <div className="plan-card-active">
                    <div className="plan-header">
                      <PlanBadge plan={planData.plan.tipo} />
                      <span className="plan-price">{formatCOP(planData.plan.precio)}/mes</span>
                    </div>
                    {planData.plan.en_trial && (
                      <p className="plan-trial-note">
                        Estás en período de prueba — {planData.plan.dias_trial_restantes} día(s) restantes.
                      </p>
                    )}
                    <p>Tu plan incluye:</p>
                    <ul>
                      {planData.plan.features_incluidas.map((f) => (
                        <li key={f}>✓ {f}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="plan-usage">
                  <h3>Uso de este mes</h3>
                  <div className="usage-grid">
                    {Object.entries({
                      mensajes: 'Mensajes de IA (WhatsApp + llamadas)',
                      clientes: 'Clientes nuevos',
                      productos: 'Productos en catálogo',
                    }).map(([key, label]) => {
                      const u = planData.plan.uso[key];
                      if (!u) return null;
                      const ilimitado = u.limit === -1;
                      const pct = ilimitado ? 0 : Math.min(100, u.percentage || 0);
                      const nivel = pct >= 100 ? 'critico' : pct >= 80 ? 'alto' : 'normal';
                      return (
                        <div className="usage-item" key={key}>
                          <div className="usage-item-header">
                            <span>{label}</span>
                            <span>{u.usage ?? 0}{ilimitado ? '' : ` / ${u.limit}`}</span>
                          </div>
                          {!ilimitado && (
                            <div className="usage-bar">
                              <div className={`usage-bar-fill usage-${nivel}`} style={{ width: `${pct}%` }} />
                            </div>
                          )}
                          {ilimitado && <span className="usage-unlimited">Ilimitado en tu plan</span>}
                        </div>
                      );
                    })}
                  </div>

                  {planData.upgrade_disponible?.perdida_potencial?.length > 0 && (
                    <div className={`plan-loss-note ${planData.upgrade_disponible.perdida_potencial.some(m => m.includes('100%')) ? 'plan-loss-critico' : ''}`}>
                      <ul>
                        {planData.upgrade_disponible.perdida_potencial.map((m) => (
                          <li key={m}>⚠ {m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {planData.upgrade_disponible && (
                  <div className="plan-upgrade">
                    <h3>Mejora a {planData.upgrade_disponible.nombre}</h3>
                    <div className="plan-upgrade-card">
                      <p className="plan-price">{formatCOP(planData.upgrade_disponible.precio)}/mes</p>
                      {planData.upgrade_disponible.nuevas_features.length > 0 && (
                        <>
                          <p>Con {planData.upgrade_disponible.nombre} además obtienes:</p>
                          <ul>
                            {planData.upgrade_disponible.nuevas_features.map((f) => (
                              <li key={f}>✓ {f}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      {planData.upgrade_disponible.limites_mejorados.length > 0 && (
                        <ul className="plan-upgrade-limits">
                          {planData.upgrade_disponible.limites_mejorados.map((l) => (
                            <li key={l.key}>
                              {l.label}: {l.actual === -1 ? 'ilimitado' : l.actual} → {l.nuevo === -1 ? 'ilimitado' : l.nuevo}
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button
                        onClick={() => handleUpgrade(planData.upgrade_disponible.plan_id, planData.upgrade_disponible.nombre)}
                        loading={upgrading}
                      >
                        Actualizar a {planData.upgrade_disponible.nombre}
                      </Button>
                    </div>
                  </div>
                )}

                {!planData.upgrade_disponible && (
                  <p className="plan-top-note">Ya tienes el plan más alto disponible.</p>
                )}

                {planData.planes?.length > 0 && (
                  <div className="plan-comparison">
                    <h3>Todos los planes</h3>
                    <div className="plan-comparison-grid">
                      {planData.planes.map((p) => {
                        const esActual = p.id === planData.plan.tipo;
                        const ordenPlanes = { starter: 1, professional: 2, enterprise: 3 };
                        const esSuperior = ordenPlanes[p.id] > ordenPlanes[planData.plan.tipo];
                        return (
                          <div
                            key={p.id}
                            className={`plan-compare-card ${p.popular ? 'popular' : ''} ${esActual ? 'is-current' : ''}`}
                          >
                            {p.popular && <span className="plan-compare-badge">Más elegido</span>}
                            <div className="plan-compare-name">{p.nombre}</div>
                            <div className="plan-compare-price">
                              {formatCOP(p.precio)} <span>/mes</span>
                            </div>
                            <ul>
                              {p.features_incluidas.map((f) => (
                                <li key={f}>✓ {f}</li>
                              ))}
                            </ul>
                            {esActual && <div className="plan-compare-current-label">Tu plan actual</div>}
                            {esSuperior && (
                              <Button
                                variant={p.popular ? 'primary' : 'outline'}
                                onClick={() => handleUpgrade(p.id, p.nombre)}
                                loading={upgrading}
                              >
                                Actualizar a {p.nombre}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
