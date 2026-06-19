import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import './AdminWhatsApps.css';

export default function AdminWhatsApps() {
  const navigate = useNavigate();
  const [whatsapps, setWhatsapps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState({});

  useEffect(() => {
    loadWhatsApps();
    const interval = setInterval(loadWhatsApps, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadWhatsApps = async () => {
    try {
      const data = await apiService.get('/api/admin/whatsapps');
      setWhatsapps(data.whatsapps || []);
    } catch (error) {
      console.error('Error loading WhatsApps:', error);
      toast.error('Error al cargar WhatsApps');
    } finally {
      setLoading(false);
    }
  };

  const reconectar = async (id) => {
    try {
      setRefreshing(prev => ({ ...prev, [id]: true }));
      await apiService.post(`/api/admin/whatsapps/${id}/reconectar`);
      toast.success('Reconexión iniciada');
      setTimeout(loadWhatsApps, 2000);
    } catch (error) {
      toast.error('Error al reconectar');
    } finally {
      setRefreshing(prev => ({ ...prev, [id]: false }));
    }
  };

  const reconectarTodos = async () => {
    const offline = whatsapps.filter(w => !w.conectado);
    if (offline.length === 0) {
      toast.success('Todos los WhatsApps ya están conectados');
      return;
    }
    
    try {
      for (const wa of offline) {
        await apiService.post(`/admin/whatsapps/${wa.id}/reconectar`);
      }
      toast.success(`Reconexión iniciada para ${offline.length} WhatsApps`);
      setTimeout(loadWhatsApps, 3000);
    } catch (error) {
      toast.error('Error al reconectar');
    }
  };

  const getTimeAgo = (date) => {
    if (!date) return 'Nunca';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Hace un momento';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} días`;
  };

  const conectados = whatsapps.filter(w => w.conectado).length;
  const total = whatsapps.length;
  const porcentaje = total > 0 ? Math.round((conectados / total) * 100) : 0;

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="admin-whatsapps">
      <div className="admin-header">
        <h1>WhatsApps</h1>
        <p>Estado de conexiones de WhatsApp</p>
      </div>

      <div className="wa-overview">
        <div className="wa-counter">
          <span className="wa-count">{conectados}</span>
          <span className="wa-divider">de</span>
          <span className="wa-total">{total}</span>
          <span className="wa-label">negocios conectados</span>
        </div>
        <div className="wa-progress-bar">
          <div className="wa-progress-fill" style={{ width: `${porcentaje}%` }}></div>
        </div>
        {conectados < total && (
          <button className="btn-primary" onClick={reconectarTodos}>
            Reconectar todos los caídos
          </button>
        )}
      </div>

      <div className="whatsapp-grid">
        {whatsapps.map(wa => (
          <div 
            key={wa.id} 
            className={`whatsapp-card ${wa.conectado ? 'connected' : wa.ultimo_ping && (Date.now() - new Date(wa.ultimo_ping)) > 5 * 60 * 1000 ? 'offline' : 'reconnecting'}`}
          >
            <div className="wa-card-header">
              <div className="wa-business">
                <span className="wa-avatar">{wa.nombre_negocio?.charAt(0) || 'N'}</span>
                <div className="wa-info">
                  <span className="wa-name">{wa.nombre_negocio}</span>
                  <span className="wa-number">{wa.numero}</span>
                </div>
              </div>
              <div className={`wa-status ${wa.conectado ? 'connected' : 'disconnected'}`}>
                <span className="wa-status-dot"></span>
                <span>{wa.conectado ? 'Conectado' : wa.ultimo_ping && (Date.now() - new Date(wa.ultimo_ping)) > 5 * 60 * 1000 ? 'Desconectado' : 'Reconectando'}</span>
              </div>
            </div>

            <div className="wa-card-body">
              <div className="wa-detail">
                <span className="wa-detail-label">Último ping</span>
                <span className="wa-detail-value">{getTimeAgo(wa.ultimo_ping)}</span>
              </div>
              <div className="wa-detail">
                <span className="wa-detail-label">Plan</span>
                <span className={`plan-badge ${wa.plan}`}>{wa.plan}</span>
              </div>
              <div className="wa-detail">
                <span className="wa-detail-label">Mensajes hoy</span>
                <span className="wa-detail-value">{wa.mensajes_hoy || 0}</span>
              </div>
            </div>

            <div className="wa-card-footer">
              <button 
                className="btn-secondary btn-sm"
                onClick={() => navigate(`/admin/negocios/${wa.negocio_id}`)}
              >
                Ver detalle
              </button>
              {!wa.conectado && (
                <button 
                  className="btn-primary btn-sm"
                  onClick={() => reconectar(wa.id)}
                  disabled={refreshing[wa.id]}
                >
                  {refreshing[wa.id] ? 'Reconectando...' : 'Reconectar'}
                </button>
              )}
            </div>
          </div>
        ))}

        {whatsapps.length === 0 && (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            <p>No hay WhatsApps registrados</p>
          </div>
        )}
      </div>
    </div>
  );
}
