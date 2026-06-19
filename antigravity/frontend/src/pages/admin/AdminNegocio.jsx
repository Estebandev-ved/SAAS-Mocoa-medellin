import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import './AdminNegocio.css';

export default function AdminNegocio() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [negocio, setNegocio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSuspenderModal, setShowSuspenderModal] = useState(false);
  const [suspenderRazon, setSuspenderRazon] = useState('');
  const [suspendiendo, setSuspendiendo] = useState(false);

  useEffect(() => {
    loadNegocio();
  }, [id]);

  const loadNegocio = async () => {
    try {
      setLoading(true);
      const data = await apiService.get(`/api/admin/negocios/${id}`);
      setNegocio(data);
    } catch (error) {
      console.error('Error loading negocio:', error);
      toast.error('Error al cargar negocio');
      navigate('/admin/negocios');
    } finally {
      setLoading(false);
    }
  };

  const toggleSuspender = async () => {
    if (!negocio.suspendido && !suspenderRazon.trim()) {
      toast.error('Ingresa una razón para suspender');
      return;
    }

    try {
      setSuspendiendo(true);
      await apiService.put(`/api/admin/negocios/${id}`, {
        suspended: !negocio.suspendido,
        suspendido_razon: suspenderRazon
      });
      toast.success(negocio.suspendido ? 'Negocio reactivado' : 'Negocio suspendido');
      setShowSuspenderModal(false);
      setSuspenderRazon('');
      loadNegocio();
    } catch (error) {
      toast.error('Error al actualizar negocio');
    } finally {
      setSuspendiendo(false);
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

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>Cargando...</p>
      </div>
    );
  }

  if (!negocio) {
    return (
      <div className="admin-negocio">
        <p>Negocio no encontrado</p>
      </div>
    );
  }

  return (
    <div className="admin-negocio">
      <button className="back-btn" onClick={() => navigate('/admin/negocios')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Volver a negocios
      </button>

      <div className="negocio-header">
        <div className="negocio-avatar">
          {negocio.nombre?.charAt(0) || 'N'}
        </div>
        <div className="negocio-title">
          <h1>{negocio.nombre}</h1>
          <span className={`state-badge ${negocio.suspendido ? 'suspended' : negocio.suscripcion_activa ? 'active' : 'inactive'}`}>
            {negocio.suspendido ? 'Suspendido' : negocio.suscripcion_activa ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>

      {negocio.suspendido && negocio.suspendido_razon && (
        <div className="suspension-alert">
          <strong>Razón de suspensión:</strong> {negocio.suspendido_razon}
        </div>
      )}

      <div className="negocio-grid">
        <div className="info-card">
          <h3>Información del Negocio</h3>
          <div className="info-list">
            <div className="info-item">
              <span className="info-label">Email</span>
              <span className="info-value">{negocio.email_dueno}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Plan</span>
              <span className={`plan-badge ${negocio.plan}`}>{negocio.plan}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Ciudad</span>
              <span className="info-value">{negocio.ciudad || 'No especificada'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Fecha de registro</span>
              <span className="info-value">{formatDate(negocio.created_at)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">WhatsApp</span>
              <span className="info-value">{negocio.numero_whatsapp || 'No conectado'}</span>
            </div>
          </div>
        </div>

        <div className="info-card">
          <h3>Configuración del Bot</h3>
          <div className="info-list">
            <div className="info-item">
              <span className="info-label">Nombre del Bot</span>
              <span className="info-value">{negocio.bot_nombre || 'Asistente'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Tono</span>
              <span className="info-value capitalize">{negocio.bot_tono || 'amigable'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Horario</span>
              <span className="info-value">
                {negocio.horario_activo_inicio?.slice(0, 5) || '08:00'} - {negocio.horario_activo_fin?.slice(0, 5) || '20:00'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">WhatsApp</span>
              <span className={`status-badge ${negocio.whatsapp_conectado ? 'connected' : 'disconnected'}`}>
                <span className="status-dot"></span>
                {negocio.whatsapp_conectado ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-mini">
          <span className="stat-value">{negocio.total_clientes || 0}</span>
          <span className="stat-label">Clientes</span>
        </div>
        <div className="stat-mini">
          <span className="stat-value">{negocio.total_pedidos || 0}</span>
          <span className="stat-label">Pedidos</span>
        </div>
        <div className="stat-mini">
          <span className="stat-value">{formatCurrency(negocio.total_ventas)}</span>
          <span className="stat-label">Ventas Totales</span>
        </div>
        <div className="stat-mini">
          <span className="stat-value">{negocio.total_interacciones_ia || 0}</span>
          <span className="stat-label">Interacciones IA</span>
        </div>
      </div>

      {negocio.conversaciones_recientes?.length > 0 && (
        <div className="info-card">
          <h3>Conversaciones Recientes</h3>
          <div className="conversations-list">
            {negocio.conversaciones_recientes.map(conv => (
              <div key={conv.id} className="conversation-item">
                <div className="conv-info">
                  <span className="conv-numero">{conv.numero_cliente}</span>
                  <span className="conv-nombre">{conv.cliente_nombre || 'Cliente'}</span>
                </div>
                <div className="conv-mensaje">
                  {conv.ultimo_mensaje?.slice(0, 50)}
                  {conv.ultimo_mensaje?.length > 50 ? '...' : ''}
                </div>
                <span className="conv-fecha">{formatDate(conv.ultimo_mensaje_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="negocio-actions">
        <Button variant="secondary" onClick={() => navigate(`/admin/negocios/${id}/conversaciones`)}>
          Ver conversaciones
        </Button>
        <Button variant="secondary" onClick={() => navigate(`/admin/negocios/${id}/pedidos`)}>
          Ver pedidos
        </Button>
        <Button 
          variant={negocio.suspendido ? 'primary' : 'danger'} 
          onClick={() => setShowSuspenderModal(true)}
        >
          {negocio.suspendido ? 'Reactivar negocio' : 'Suspender negocio'}
        </Button>
      </div>

      <Modal 
        isOpen={showSuspenderModal} 
        onClose={() => setShowSuspenderModal(false)}
        title={negocio.suspendido ? 'Reactivar Negocio' : 'Suspender Negocio'}
        size="sm"
      >
        {!negocio.suspendido && (
          <div className="form-group">
            <label>Razón de la suspensión</label>
            <textarea
              value={suspenderRazon}
              onChange={(e) => setSuspenderRazon(e.target.value)}
              placeholder="Ingresa la razón por la cual se suspende este negocio..."
              rows={4}
            />
          </div>
        )}
        {negocio.suspendido && (
          <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
            ¿Estás seguro de que quieres reactivar este negocio?
          </p>
        )}
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setShowSuspenderModal(false)}>
            Cancelar
          </Button>
          <Button 
            variant={negocio.suspendido ? 'primary' : 'danger'} 
            onClick={toggleSuspender}
            loading={suspendiendo}
          >
            {negocio.suspendido ? 'Reactivar' : 'Suspender'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
