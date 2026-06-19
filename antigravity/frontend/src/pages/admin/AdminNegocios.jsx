import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import './AdminNegocios.css';

export default function AdminNegocios() {
  const navigate = useNavigate();
  const [negocios, setNegocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const [filtros, setFiltros] = useState({
    search: '',
    plan: '',
    estado: ''
  });
  const [searchTimeout, setSearchTimeout] = useState(null);

  useEffect(() => {
    loadNegocios();
  }, [pagination.page, filtros.plan, filtros.estado]);

  const loadNegocios = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit
      });
      if (filtros.plan) params.append('plan', filtros.plan);
      if (filtros.estado) params.append('estado', filtros.estado);
      if (filtros.search) params.append('search', filtros.search);
      
      const data = await apiService.get(`/api/admin/negocios?${params}`);
      setNegocios(data.negocios || []);
      setPagination(prev => ({
        ...prev,
        total: data.total || 0,
        pages: Math.ceil((data.total || 0) / pagination.limit)
      }));
    } catch (error) {
      console.error('Error loading negocios:', error);
      toast.error('Error al cargar negocios');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback((value) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => {
      setFiltros(prev => ({ ...prev, search: value }));
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 300));
  }, [searchTimeout]);

  const limpiarFiltros = () => {
    setFiltros({ search: '', plan: '', estado: '' });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  const cambiarPlan = async (id, nuevoPlan) => {
    try {
      await apiService.put(`/api/admin/negocios/${id}`, { plan: nuevoPlan });
      toast.success('Plan actualizado');
      loadNegocios();
    } catch (error) {
      toast.error('Error al cambiar plan');
    }
  };

  const toggleActivo = async (id, suspender) => {
    try {
      await apiService.put(`/api/admin/negocios/${id}`, { suspended: suspender });
      toast.success(suspender ? 'Negocio suspendido' : 'Negocio reactivado');
      loadNegocios();
    } catch (error) {
      toast.error('Error al actualizar estado');
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const total = pagination.pages;
    const current = pagination.page;
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      if (current <= 3) {
        pages.push(1, 2, 3, 4, '...', total);
      } else if (current >= total - 2) {
        pages.push(1, '...', total - 3, total - 2, total - 1, total);
      } else {
        pages.push(1, '...', current - 1, current, current + 1, '...', total);
      }
    }
    return pages;
  };

  return (
    <div className="admin-negocios">
      <div className="admin-header">
        <h1>Negocios</h1>
        <p>Gestiona todos los negocios de la plataforma</p>
      </div>

      <div className="filtros-bar">
        <div className="search-input">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input 
            type="text" 
            placeholder="Buscar por nombre o email..."
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        
        <select 
          value={filtros.plan} 
          onChange={(e) => {
            setFiltros(prev => ({ ...prev, plan: e.target.value }));
            setPagination(prev => ({ ...prev, page: 1 }));
          }}
        >
          <option value="">Todos los planes</option>
          <option value="starter">Starter</option>
          <option value="professional">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>

        <select 
          value={filtros.estado} 
          onChange={(e) => {
            setFiltros(prev => ({ ...prev, estado: e.target.value }));
            setPagination(prev => ({ ...prev, page: 1 }));
          }}
        >
          <option value="">Todos los estados</option>
          <option value="activos">Activos</option>
          <option value="trial">Trial</option>
          <option value="suspendidos">Suspendidos</option>
        </select>

        {(filtros.search || filtros.plan || filtros.estado) && (
          <button className="btn-ghost" onClick={limpiarFiltros}>
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="results-info">
        Mostrando {negocios.length} de {pagination.total} negocios
      </div>

      <div className="negocios-table">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Plan</th>
              <th>Estado WA</th>
              <th>Pedidos</th>
              <th>Ventas</th>
              <th>Tipo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" className="loading-cell">
                  <div className="loading-spinner"></div>
                </td>
              </tr>
            ) : negocios.length === 0 ? (
              <tr>
                <td colSpan="9" className="empty-row">No se encontraron negocios</td>
              </tr>
            ) : (
              negocios.map((negocio, index) => (
                <tr key={negocio.id} onClick={() => navigate(`/admin/negocios/${negocio.id}`)} className="clickable-row">
                  <td>{(pagination.page - 1) * pagination.limit + index + 1}</td>
                  <td>
                    <div className="business-name">
                      <span className="business-avatar">{negocio.nombre?.charAt(0) || 'N'}</span>
                      <span className="name">{negocio.nombre}</span>
                    </div>
                  </td>
                  <td className="email-cell">{negocio.email_dueno}</td>
                  <td>
                    <select 
                      className={`plan-badge ${negocio.plan}`}
                      value={negocio.plan}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => cambiarPlan(negocio.id, e.target.value)}
                    >
                      <option value="starter">Starter</option>
                      <option value="professional">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </td>
                  <td>
                    <span className={`status-badge ${negocio.whatsapp_conectado ? 'connected' : 'disconnected'}`}>
                      <span className="status-dot"></span>
                      {negocio.whatsapp_conectado ? 'Conectado' : 'Desconectado'}
                    </span>
                  </td>
                  <td className="number-cell">{negocio.total_pedidos || 0}</td>
                  <td className="number-cell">{formatCurrency(negocio.total_ventas)}</td>
                  <td>
                    <span className={`state-badge ${negocio.suspendido ? 'suspended' : negocio.suscripcion_activa ? 'active' : 'inactive'}`}>
                      {negocio.suspendido ? 'Suspendido' : negocio.es_trial ? 'Trial' : 'Plan'}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="action-buttons">
                      <button 
                        className="btn-action"
                        onClick={() => navigate(`/admin/negocios/${negocio.id}`)}
                      >
                        Ver
                      </button>
                      <button 
                        className={`btn-action ${negocio.suspendido ? 'btn-activate' : 'btn-suspend'}`}
                        onClick={() => toggleActivo(negocio.id, !negocio.suspendido)}
                      >
                        {negocio.suspendido ? 'Activar' : 'Suspender'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.pages > 1 && (
        <div className="pagination">
          <button 
            className="pagination-btn"
            disabled={pagination.page === 1}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
          >
            ← Anterior
          </button>
          
          <div className="pagination-numbers">
            {getPageNumbers().map((num, idx) => (
              num === '...' ? (
                <span key={idx} className="pagination-ellipsis">...</span>
              ) : (
                <button
                  key={idx}
                  className={`pagination-num ${pagination.page === num ? 'active' : ''}`}
                  onClick={() => setPagination(prev => ({ ...prev, page: num }))}
                >
                  {num}
                </button>
              )
            ))}
          </div>
          
          <button 
            className="pagination-btn"
            disabled={pagination.page === pagination.pages}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
