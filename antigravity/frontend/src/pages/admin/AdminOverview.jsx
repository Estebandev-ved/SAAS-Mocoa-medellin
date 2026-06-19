import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import './AdminOverview.css';

export default function AdminOverview() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [negocios, setNegocios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, negociosRes] = await Promise.all([
        apiService.get('/api/admin/estadisticas'),
        apiService.get('/api/admin/negocios?limit=5')
      ]);
      
      setStats(statsRes);
      setNegocios(negociosRes.negocios || []);
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const crearDemo = async () => {
    try {
      const result = await apiService.post('/api/admin/demo', {
        nombre: `Demo ${Date.now()}`,
        email: `demo_${Date.now()}@test.com`
      });
      toast.success('Negocio demo creado');
      loadData();
    } catch (error) {
      toast.error('Error al crear demo');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
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
    <div className="admin-overview">
      <div className="admin-header">
        <h1>Panel de Administración</h1>
        <p>Resumen global del sistema Antigravity</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/>
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-value">{stats?.negocios_activos || 0}</span>
            <span className="kpi-label">Negocios Activos</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon green">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-value">{formatCurrency(stats?.ventas_mes || 0)}</span>
            <span className="kpi-label">Ventas del Mes</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-value">{stats?.pedidos_mes || 0}</span>
            <span className="kpi-label">Pedidos del Mes</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-value">{formatCurrency(stats?.tokens_hoy || 0)}</span>
            <span className="kpi-label">Tokens IA Hoy</span>
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <h3>Negocios por Plan</h3>
          <div className="plan-stats">
            <div className="plan-stat">
              <span className="plan-badge starter">Starter</span>
              <span className="plan-count">{stats?.negocios_por_plan?.starter || 0}</span>
            </div>
            <div className="plan-stat">
              <span className="plan-badge professional">Pro</span>
              <span className="plan-count">{stats?.negocios_por_plan?.professional || 0}</span>
            </div>
            <div className="plan-stat">
              <span className="plan-badge enterprise">Enterprise</span>
              <span className="plan-count">{stats?.negocios_por_plan?.enterprise || 0}</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <h3>WhatsApps Conectados</h3>
          <div className="wa-status">
            <div className={`wa-indicator ${(stats?.whatsapp_conectados || 0) > 0 ? 'active' : ''}`}>
              <span className="wa-dot"></span>
              <span className="wa-count">{stats?.whatsapp_conectados || 0}</span>
              <span className="wa-label">conectados</span>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-section">
        <div className="section-header">
          <h2>Negocios Recientes</h2>
          <button className="btn-link" onClick={() => navigate('/admin/negocios')}>
            Ver todos
          </button>
        </div>

        <div className="businesses-table">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>WhatsApp</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {negocios.map(negocio => (
                <tr key={negocio.id}>
                  <td>
                    <div className="business-name">
                      <span className="business-avatar">{negocio.nombre.charAt(0)}</span>
                      <div>
                        <span className="name">{negocio.nombre}</span>
                        <span className="email">{negocio.email_dueno}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${negocio.whatsapp_conectado ? 'connected' : 'disconnected'}`}>
                      <span className="status-dot"></span>
                      {negocio.whatsapp_conectado ? 'Conectado' : 'Sin conectar'}
                    </span>
                  </td>
                  <td>
                    <span className={`plan-badge ${negocio.plan}`}>
                      {negocio.plan === 'professional' ? 'Pro' : negocio.plan}
                    </span>
                  </td>
                  <td>
                    <span className={`state-badge ${negocio.suspendido ? 'suspended' : negocio.suscripcion_activa ? 'active' : 'inactive'}`}>
                      {negocio.suspendido ? 'Suspendido' : negocio.suscripcion_activa ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <button className="btn-action" onClick={() => navigate(`/admin/negocios/${negocio.id}`)}>
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
              {negocios.length === 0 && (
                <tr>
                  <td colSpan="5" className="empty-row">No hay negocios registrados</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-actions">
        <button className="btn-primary" onClick={crearDemo}>
          + Crear Demo
        </button>
        <button className="btn-secondary" onClick={() => navigate('/admin/negocios')}>
          Ver todos los negocios
        </button>
      </div>
    </div>
  );
}
