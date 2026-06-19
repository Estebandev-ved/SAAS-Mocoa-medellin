import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import MetricCard from '../../components/dashboard/MetricCard';
import StatusBadge from '../../components/ui/StatusBadge';
import { ordersService, analyticsService } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import './OverviewPage.css';

export default function OverviewPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const formatCOP = (val) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pedidosData, analyticsData] = await Promise.all([
          ordersService.getAll({ limit: 5 }),
          analyticsService.getResumen()
        ]);
        setPedidos(pedidosData.pedidos || []);
        setAnalytics(analyticsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getDateFormatted = (date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
  };

  return (
    <div className="overview-page">
      <div className="overview-header">
        <h2>{getGreeting()}, {user?.nombre?.split(' ')[0]} 👋</h2>
        <p className="overview-date">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {' • '}
          <StatusBadge estado={user?.plan || 'starter'} />
        </p>
      </div>

      {user?.trial_hasta && !user?.suscripcion_activa && (
        <div className="trial-alert">
          <span>⚡ Tienes días de prueba restantes. Activa tu plan para no perder el acceso.</span>
          <button className="trial-cta">Activar ahora</button>
        </div>
      )}

      <div className="metrics-grid">
        <MetricCard
          titulo="Ventas hoy"
          valor={analytics?.ventas_hoy || 0}
          variacion={12}
          variacionPositiva={true}
          loading={loading}
          icono={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
          sparklineData={[30, 45, 25, 50, 40, 60, 80]}
        />
        <MetricCard
          titulo="Pedidos hoy"
          valor={analytics?.pedidos_hoy || 0}
          variacion={5}
          variacionPositiva={true}
          loading={loading}
          icono={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          }
        />
        <MetricCard
          titulo="Mensajes hoy"
          valor={analytics?.mensajes_hoy || 0}
          loading={loading}
          icono={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          }
        />
        <MetricCard
          titulo="Tasa IA"
          valor="87%"
          variacion={3}
          variacionPositiva={true}
          loading={loading}
          icono={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          }
        />
      </div>

      <div className="overview-columns">
        <div className="overview-left">
          <div className="section-card">
            <div className="section-header">
              <h3>Últimos pedidos</h3>
              <a href="/dashboard/pedidos" className="section-link">Ver todos</a>
            </div>
            {loading ? (
              <div className="skeleton-list">
                {[1, 2, 3].map(i => <div key={i} className="skeleton skeleton-row"></div>)}
              </div>
            ) : (
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Hace</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map(pedido => (
                    <tr key={pedido.id}>
                      <td className="order-id">{pedido.numero_pedido}</td>
                      <td>{pedido.cliente?.nombre || 'Cliente'}</td>
                      <td className="order-total">{formatCOP(pedido.total)}</td>
                      <td><StatusBadge estado={pedido.estado} /></td>
                      <td className="order-time">{getDateFormatted(pedido.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="overview-right">
          <div className="section-card">
            <div className="section-header">
              <h3>Conversaciones activas</h3>
              <a href="/dashboard/conversaciones" className="section-link">Ver todas</a>
            </div>
            {loading ? (
              <div className="skeleton-list">
                {[1, 2, 3].map(i => <div key={i} className="skeleton skeleton-row"></div>)}
              </div>
            ) : (
              <div className="conversations-list">
                {[1, 2, 3].map(i => (
                  <div key={i} className="conversation-item">
                    <div className="conv-avatar">J</div>
                    <div className="conv-info">
                      <span className="conv-name">Juan Pérez</span>
                      <span className="conv-preview">¿Tienen disponibilidad para...</span>
                    </div>
                    <div className="conv-meta">
                      <span className="conv-time">2 min</span>
                      <StatusBadge estado="activo" variant="dot" size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
