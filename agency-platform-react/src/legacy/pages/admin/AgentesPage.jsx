import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

export default function AgentesPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarStats = async () => {
    try {
      const data = await apiService.get('/agentes/stats');
      setStats(data);
      setError(null);
    } catch (err) {
      console.error('Error cargando stats:', err);
      setError('Error conectando al Brain');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarStats();
    const interval = setInterval(cargarStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando estado del sistema multi-agente...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>Estado de Agentes IA</h1>
          <p className="page-subtitle">Monitor en tiempo real del sistema multi-agente</p>
        </div>
        <button className="btn-refresh" onClick={cargarStats}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Actualizar
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          {error} - El Brain puede estar apagado (puerto 8000)
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
          <div className="kpi-content">
            <span className="kpi-value">{stats?.workers_activos || 0}</span>
            <span className="kpi-label">Workers Activos</span>
          </div>
        </div>
        
        <div className="kpi-card">
          <div className="kpi-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div>
          <div className="kpi-content">
            <span className="kpi-value">{stats?.cola_actual || 0}</span>
            <span className="kpi-label">Mensajes en Cola</span>
          </div>
        </div>
        
        <div className="kpi-card">
          <div className="kpi-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
          <div className="kpi-content">
            <span className="kpi-value">{stats?.supervisores_activos || 0}</span>
            <span className="kpi-label">Supervisores Activos</span>
          </div>
        </div>
        
        <div className="kpi-card">
          <div className="kpi-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
          <div className="kpi-content">
            <span className="kpi-value">{stats?.tiempo_respuesta_promedio_ms || 0}ms</span>
            <span className="kpi-label">Tiempo Promedio</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
          <div className="kpi-content">
            <span className="kpi-value">{stats?.mensajes_procesados || 0}</span>
            <span className="kpi-label">Mensajes Procesados</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <div className="kpi-content">
            <span className="kpi-value">{Math.floor((Date.now() / 1000 - (stats?.inicio || 0)) / 60)}m</span>
            <span className="kpi-label">Uptime</span>
          </div>
        </div>
      </div>

      <div className="section">
        <h2>Supervisores por Negocio</h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Negocio ID</th>
                <th>Workers Activos</th>
                <th>Workers Máx.</th>
                <th>Msgs/Min</th>
                <th>Último Msg</th>
              </tr>
            </thead>
            <tbody>
              {stats?.supervisores_detalle?.length > 0 ? (
                stats.supervisores_detalle.map((sup) => (
                  <tr key={sup.negocio_id}>
                    <td>#{sup.negocio_id}</td>
                    <td>
                      <span className={`badge ${sup.workers_activos > 0 ? 'badge-success' : 'badge-neutral'}`}>
                        {sup.workers_activos}
                      </span>
                    </td>
                    <td>{sup.max_workers}</td>
                    <td>{sup.mensajes_minuto}</td>
                    <td>{sup.ultimo_mensaje ? new Date(sup.ultimo_mensaje * 1000).toLocaleTimeString() : '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center">No hay supervisores activos</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <h2>Presupuesto de Tokens</h2>
        <div className="presupuesto-grid">
          <div className="presupuesto-card">
            <div className="presupuesto-header">
              <span className="plan-badge starter">Starter</span>
              <span className="limit">50,000 tokens/día</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${Math.min(100, ((stats?.tokens_hoy || 0) / 50000) * 100)}%` }}
              />
            </div>
            <div className="presupuesto-footer">
              <span>{stats?.tokens_hoy?.toLocaleString() || 0} / 50,000 tokens</span>
            </div>
          </div>
          
          <div className="presupuesto-card">
            <div className="presupuesto-header">
              <span className="plan-badge professional">Professional</span>
              <span className="limit">200,000 tokens/día</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill professional" 
                style={{ width: `${Math.min(100, ((stats?.tokens_hoy || 0) / 200000) * 100)}%` }}
              />
            </div>
            <div className="presupuesto-footer">
              <span>200k límite</span>
            </div>
          </div>
          
          <div className="presupuesto-card">
            <div className="presupuesto-header">
              <span className="plan-badge enterprise">Enterprise</span>
              <span className="limit">Ilimitado</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill enterprise" style={{ width: '0%' }} />
            </div>
            <div className="presupuesto-footer">
              <span>Sin límite</span>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <h2>Configuración del Sistema</h2>
        <div className="config-grid">
          <div className="config-item">
            <span className="config-label">Umbral Spawn (Cola)</span>
            <span className="config-value">&gt; 10 mensajes</span>
          </div>
          <div className="config-item">
            <span className="config-label">Umbral Kill (Cola)</span>
            <span className="config-value">&lt; 2 mensajes</span>
          </div>
          <div className="config-item">
            <span className="config-label">Umbral Spawn (Tiempo)</span>
            <span className="config-value">&gt; 3 segundos</span>
          </div>
          <div className="config-item">
            <span className="config-label">Max Workers/Negocio</span>
            <span className="config-value">3</span>
          </div>
          <div className="config-item">
            <span className="config-label">Cooldown Escalado</span>
            <span className="config-value">5 segundos</span>
          </div>
        </div>
      </div>
    </div>
  );
}