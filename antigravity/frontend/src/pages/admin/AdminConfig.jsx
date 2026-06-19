import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import './AdminConfig.css';

export default function AdminConfig() {
  const [activeTab, setActiveTab] = useState('plataforma');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    plataforma: {
      nombre: 'Antigravity',
      logo_url: '',
      color_primario: '#00FFD1',
      email_soporte: 'soporte@antigravity.co',
      modo_mantenimiento: false,
      mensaje_mantenimiento: ''
    },
    planes: {
      starter: { precio: 450000, mensajes_limite: 1000, clientes_max: 100, agentes_max: 2 },
      professional: { precio: 850000, mensajes_limite: 5000, clientes_max: 500, agentes_max: 4 },
      enterprise: { precio: 1800000, mensajes_limite: 999999, clientes_max: 999999, agentes_max: 6 }
    },
    ia: {
      modelo_default: 'gpt-4o',
      temperatura: 0.7,
      max_tokens: 2000,
      prompt_base: ''
    },
    notificaciones: {
      email_alertas: 'admin@antigravity.co',
      alerta_wa_desconectado: true,
      alerta_error_rate: true,
      alerta_token_usage: true,
      reportes_diarios: false
    }
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/api/admin/config');
      if (data.config) {
        setConfig(prev => ({ ...prev, ...data.config }));
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  const guardarConfig = async (seccion) => {
    try {
      setSaving(true);
      await apiService.put('/api/admin/config', {
        seccion,
        datos: config[seccion]
      });
      toast.success(`${seccion.charAt(0).toUpperCase() + seccion.slice(1)} guardado correctamente`);
    } catch (error) {
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  const updateConfig = (seccion, campo, valor) => {
    setConfig(prev => ({
      ...prev,
      [seccion]: {
        ...prev[seccion],
        [campo]: valor
      }
    }));
  };

  const updatePlan = (plan, campo, valor) => {
    setConfig(prev => ({
      ...prev,
      planes: {
        ...prev.planes,
        [plan]: {
          ...prev.planes[plan],
          [campo]: valor
        }
      }
    }));
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="admin-config">
      <div className="admin-header">
        <h1>Configuración</h1>
        <p>Configuración global de la plataforma</p>
      </div>

      <div className="config-tabs">
        <button 
          className={`config-tab ${activeTab === 'plataforma' ? 'active' : ''}`}
          onClick={() => setActiveTab('plataforma')}
        >
          Plataforma
        </button>
        <button 
          className={`config-tab ${activeTab === 'planes' ? 'active' : ''}`}
          onClick={() => setActiveTab('planes')}
        >
          Planes
        </button>
        <button 
          className={`config-tab ${activeTab === 'ia' ? 'active' : ''}`}
          onClick={() => setActiveTab('ia')}
        >
          IA
        </button>
        <button 
          className={`config-tab ${activeTab === 'notificaciones' ? 'active' : ''}`}
          onClick={() => setActiveTab('notificaciones')}
        >
          Notificaciones
        </button>
      </div>

      <div className="config-content">
        {activeTab === 'plataforma' && (
          <div className="config-section">
            <div className="config-group">
              <label>Nombre de la plataforma</label>
              <input 
                type="text" 
                value={config.plataforma.nombre}
                onChange={(e) => updateConfig('plataforma', 'nombre', e.target.value)}
              />
            </div>

            <div className="config-group">
              <label>Logo URL</label>
              <input 
                type="text" 
                value={config.plataforma.logo_url}
                onChange={(e) => updateConfig('plataforma', 'logo_url', e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="config-group">
              <label>Color primario</label>
              <div className="color-input-group">
                <input 
                  type="color" 
                  value={config.plataforma.color_primario}
                  onChange={(e) => updateConfig('plataforma', 'color_primario', e.target.value)}
                />
                <input 
                  type="text" 
                  value={config.plataforma.color_primario}
                  onChange={(e) => updateConfig('plataforma', 'color_primario', e.target.value)}
                />
                <div 
                  className="color-preview"
                  style={{ background: config.plataforma.color_primario }}
                ></div>
              </div>
            </div>

            <div className="config-group">
              <label>Email de soporte</label>
              <input 
                type="email" 
                value={config.plataforma.email_soporte}
                onChange={(e) => updateConfig('plataforma', 'email_soporte', e.target.value)}
              />
            </div>

            <div className="config-group toggle-group">
              <label>
                <input 
                  type="checkbox"
                  checked={config.plataforma.modo_mantenimiento}
                  onChange={(e) => updateConfig('plataforma', 'modo_mantenimiento', e.target.checked)}
                />
                Modo mantenimiento
              </label>
              {config.plataforma.modo_mantenimiento && (
                <textarea 
                  value={config.plataforma.mensaje_mantenimiento}
                  onChange={(e) => updateConfig('plataforma', 'mensaje_mantenimiento', e.target.value)}
                  placeholder="Mensaje que verán los usuarios..."
                  rows={3}
                />
              )}
            </div>

            <button 
              className="btn-primary"
              onClick={() => guardarConfig('plataforma')}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        )}

        {activeTab === 'planes' && (
          <div className="config-section">
            <div className="config-warning">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span>Cambiar precios no afecta suscripciones activas, solo nuevas</span>
            </div>

            {Object.entries(config.planes).map(([planName, planData]) => (
              <div key={planName} className="plan-config">
                <h3>{planName.charAt(0).toUpperCase() + planName.slice(1)}</h3>
                
                <div className="config-group">
                  <label>Precio /mes (COP)</label>
                  <input 
                    type="number"
                    value={planData.precio}
                    onChange={(e) => updatePlan(planName, 'precio', parseInt(e.target.value))}
                  />
                </div>

                <div className="config-group">
                  <label>Mensajes /mes</label>
                  <input 
                    type="number"
                    value={planData.mensajes_limite}
                    onChange={(e) => updatePlan(planName, 'mensajes_limite', parseInt(e.target.value))}
                  />
                </div>

                <div className="config-group">
                  <label>Clientes máximos</label>
                  <input 
                    type="number"
                    value={planData.clientes_max}
                    onChange={(e) => updatePlan(planName, 'clientes_max', parseInt(e.target.value))}
                  />
                </div>

                <div className="config-group">
                  <label>Agentes máximos</label>
                  <input 
                    type="number"
                    value={planData.agentes_max}
                    onChange={(e) => updatePlan(planName, 'agentes_max', parseInt(e.target.value))}
                  />
                </div>
              </div>
            ))}

            <button 
              className="btn-primary"
              onClick={() => guardarConfig('planes')}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        )}

        {activeTab === 'ia' && (
          <div className="config-section">
            <div className="config-group">
              <label>Modelo default</label>
              <select 
                value={config.ia.modelo_default}
                onChange={(e) => updateConfig('ia', 'modelo_default', e.target.value)}
              >
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
              </select>
            </div>

            <div className="config-group">
              <label>Temperatura: {config.ia.temperatura}</label>
              <input 
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.ia.temperatura}
                onChange={(e) => updateConfig('ia', 'temperatura', parseFloat(e.target.value))}
              />
              <div className="range-labels">
                <span>Preciso (0)</span>
                <span>Creativo (1)</span>
              </div>
            </div>

            <div className="config-group">
              <label>Max tokens por respuesta</label>
              <input 
                type="number"
                value={config.ia.max_tokens}
                onChange={(e) => updateConfig('ia', 'max_tokens', parseInt(e.target.value))}
              />
            </div>

            <div className="config-group">
              <label>Prompt base global</label>
              <textarea 
                value={config.ia.prompt_base}
                onChange={(e) => updateConfig('ia', 'prompt_base', e.target.value)}
                placeholder="Se agregará a TODOS los agentes de TODOS los negocios..."
                rows={5}
              />
              <span className="input-hint">
                Este prompt se añadirá al inicio de cada conversación del agente IA
              </span>
            </div>

            <button 
              className="btn-primary"
              onClick={() => guardarConfig('ia')}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        )}

        {activeTab === 'notificaciones' && (
          <div className="config-section">
            <div className="config-group">
              <label>Email de alertas del sistema</label>
              <input 
                type="email"
                value={config.notificaciones.email_alertas}
                onChange={(e) => updateConfig('notificaciones', 'email_alertas', e.target.value)}
              />
            </div>

            <div className="config-group toggle-group">
              <label>
                <input 
                  type="checkbox"
                  checked={config.notificaciones.alerta_wa_desconectado}
                  onChange={(e) => updateConfig('notificaciones', 'alerta_wa_desconectado', e.target.checked)}
                />
                Alertas de WhatsApp desconectado
              </label>
            </div>

            <div className="config-group toggle-group">
              <label>
                <input 
                  type="checkbox"
                  checked={config.notificaciones.alerta_error_rate}
                  onChange={(e) => updateConfig('notificaciones', 'alerta_error_rate', e.target.checked)}
                />
                Alertas de error rate {'>'} 5%
              </label>
            </div>

            <div className="config-group toggle-group">
              <label>
                <input 
                  type="checkbox"
                  checked={config.notificaciones.alerta_token_usage}
                  onChange={(e) => updateConfig('notificaciones', 'alerta_token_usage', e.target.checked)}
                />
                Alertas de uso de tokens {'>'} 80%
              </label>
            </div>

            <div className="config-group toggle-group">
              <label>
                <input 
                  type="checkbox"
                  checked={config.notificaciones.reportes_diarios}
                  onChange={(e) => updateConfig('notificaciones', 'reportes_diarios', e.target.value)}
                />
                Reportes diarios al admin
              </label>
            </div>

            <button 
              className="btn-primary"
              onClick={() => guardarConfig('notificaciones')}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
