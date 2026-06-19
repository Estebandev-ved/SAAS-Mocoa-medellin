import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import './AdminSuscripciones.css';

export default function AdminSuscripciones() {
  const navigate = useNavigate();
  const [suscripciones, setSuscripciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    plan: '',
    estado: ''
  });
  const [stats, setStats] = useState({
    mrr: 0,
    churn_mes: 0,
    trials_activos: 0
  });

  useEffect(() => {
    loadSuscripciones();
  }, [filtros.plan, filtros.estado]);

  const loadSuscripciones = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtros.plan) params.append('plan', filtros.plan);
      if (filtros.estado) params.append('estado', filtros.estado);
      
      const data = await apiService.get(`/api/admin/suscripciones?${params}`);
      setSuscripciones(data.suscripciones || []);
      setStats(data.stats || { mrr: 0, churn_mes: 0, trials_activos: 0 });
    } catch (error) {
      console.error('Error loading suscripciones:', error);
      toast.error('Error al cargar suscripciones');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getMontoPlan = (plan) => {
    const precios = {
      starter: 450000,
      professional: 850000,
      enterprise: 1800000
    };
    return precios[plan] || 0;
  };

  const cambiarPlan = async (id, nuevoPlan) => {
    try {
      await apiService.put(`/api/admin/suscripciones/${id}`, { plan: nuevoPlan });
      toast.success('Plan actualizado');
      loadSuscripciones();
    } catch (error) {
      toast.error('Error al cambiar plan');
    }
  };

  const cancelarSuscripcion = async (id) => {
    if (!confirm('¿Estás seguro de que quieres cancelar esta suscripción?')) return;
    try {
      await apiService.put(`/api/admin/suscripciones/${id}`, { estado: 'cancelada' });
      toast.success('Suscripción cancelada');
      loadSuscripciones();
    } catch (error) {
      toast.error('Error al cancelar');
    }
  };

  const getEstadoBadge = (estado) => {
    const estados = {
      trial: { label: 'Trial', class: 'trial' },
      activa: { label: 'Activa', class: 'activa' },
      vencida: { label: 'Vencida', class: 'vencida' },
      cancelada: { label: 'Cancelada', class: 'cancelada' }
    };
    return estados[estado] || { label: estado, class: '' };
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
    <div className="admin-suscripciones">
      <div className="admin-header">
        <h1>Suscripciones</h1>
        <p>Gestión de planes y suscripciones</p>
      </div>

      <div className="suscripcion-stats">
        <div className="stat-card">
          <div className="stat-icon green">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-value">{formatCurrency(stats.mrr)}</span>
            <span className="stat-label">MRR Total</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.churn_mes}</span>
            <span className="stat-label">Churn este mes</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.trials_activos}</span>
            <span className="stat-label">Trials activos</span>
          </div>
        </div>
      </div>

      <div className="filtros-bar">
        <select 
          value={filtros.plan} 
          onChange={(e) => setFiltros(prev => ({ ...prev, plan: e.target.value }))}
        >
          <option value="">Todos los planes</option>
          <option value="starter">Starter</option>
          <option value="professional">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>

        <select 
          value={filtros.estado} 
          onChange={(e) => setFiltros(prev => ({ ...prev, estado: e.target.value }))}
        >
          <option value="">Todos los estados</option>
          <option value="trial">Trial</option>
          <option value="activa">Activa</option>
          <option value="vencida">Vencida</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>

      <div className="suscripciones-table">
        <table>
          <thead>
            <tr>
              <th>Negocio</th>
              <th>Plan</th>
              <th>Estado</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Monto/mes</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="loading-cell">
                  <div className="loading-spinner"></div>
                </td>
              </tr>
            ) : suscripciones.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-row">No se encontraron suscripciones</td>
              </tr>
            ) : (
              suscripciones.map(sub => {
                const estadoInfo = getEstadoBadge(sub.estado);
                return (
                  <tr key={sub.id}>
                    <td>
                      <div className="business-name">
                        <span className="business-avatar">{sub.nombre_negocio?.charAt(0) || 'N'}</span>
                        <div>
                          <span className="name">{sub.nombre_negocio}</span>
                          <span className="email">{sub.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select 
                        className={`plan-badge ${sub.plan}`}
                        value={sub.plan}
                        onChange={(e) => cambiarPlan(sub.id, e.target.value)}
                      >
                        <option value="starter">Starter</option>
                        <option value="professional">Pro</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </td>
                    <td>
                      <span className={`estado-badge ${estadoInfo.class}`}>
                        {estadoInfo.label}
                      </span>
                    </td>
                    <td>{formatDate(sub.inicio)}</td>
                    <td>{formatDate(sub.fin)}</td>
                    <td className="number-cell">{formatCurrency(getMontoPlan(sub.plan))}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn-action"
                          onClick={() => navigate(`/admin/negocios/${sub.negocio_id}`)}
                        >
                          Ver
                        </button>
                        {sub.estado !== 'cancelada' && (
                          <button 
                            className="btn-action btn-danger"
                            onClick={() => cancelarSuscripcion(sub.id)}
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
