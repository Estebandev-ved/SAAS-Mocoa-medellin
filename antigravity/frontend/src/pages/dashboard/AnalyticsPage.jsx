import { useState, useEffect } from 'react';
import PlanGuard from '../../components/auth/PlanGuard';
import { analyticsService } from '../../services/api';
import MetricCard from '../../components/dashboard/MetricCard';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import './AnalyticsPage.css';

const formatCOP = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

function AnalyticsContent() {
  const [periodo, setPeriodo] = useState('semana');
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, [periodo]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyticsService.getResumen();
      setAnalyticsData(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Error al cargar analytics');
    } finally {
      setLoading(false);
    }
  };

  const ventasData = analyticsData?.ventas_diarias || [];
  const topProductos = analyticsData?.top_productos || [];
  const topClientes = analyticsData?.top_clientes || [];
  const resumen = analyticsData?.resumen || {};

  return (
    <div className="analytics-page">
      <div className="page-header">
        <h2>Analytics</h2>
        <div className="period-selector">
          {['semana', 'mes', 'año'].map(p => (
            <button key={p} className={periodo === p ? 'active' : ''} onClick={() => setPeriodo(p)}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="metrics-grid">
        {/* variacionPositiva ahora refleja el signo real de cada variación
            (antes quedaba fijo en `true`, así que una caída en ventas se
            veía igual que una subida — con flecha verde siempre). */}
        <MetricCard titulo="Total ventas" valor={resumen.total_ventas || 0} variacion={Math.abs(resumen.ventas_variacion || 0)} variacionPositiva={(resumen.ventas_variacion || 0) >= 0} loading={loading} />
        <MetricCard titulo="Pedidos" valor={resumen.total_pedidos || 0} variacion={Math.abs(resumen.pedidos_variacion || 0)} variacionPositiva={(resumen.pedidos_variacion || 0) >= 0} loading={loading} />
        <MetricCard titulo="Ticket promedio" valor={resumen.ticket_promedio || 0} variacion={Math.abs(resumen.ticket_variacion || 0)} variacionPositiva={(resumen.ticket_variacion || 0) >= 0} loading={loading} />
        <MetricCard titulo="Tasa conversión" valor={`${resumen.tasa_conversion || 0}%`} variacion={Math.abs(resumen.conversion_variacion || 0)} variacionPositiva={(resumen.conversion_variacion || 0) >= 0} loading={loading} />
        <MetricCard
          titulo="Tiempo de respuesta (IA)"
          valor={resumen.tiempo_respuesta_ms ? `${(resumen.tiempo_respuesta_ms / 1000).toFixed(1)}s` : '—'}
          variacion={Math.abs(resumen.tiempo_respuesta_variacion || 0)}
          variacionPositiva={(resumen.tiempo_respuesta_variacion || 0) <= 0}
          loading={loading}
        />
        <MetricCard
          titulo="Pedidos perdidos"
          valor={resumen.pedidos_perdidos || 0}
          variacion={Math.abs(resumen.pedidos_perdidos_variacion || 0)}
          variacionPositiva={(resumen.pedidos_perdidos_variacion || 0) <= 0}
          loading={loading}
        />
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <h3>Ventas diarias</h3>
          {loading ? (
            <div className="skeleton" style={{ height: 250 }}></div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={ventasData}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00FFD1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00FFD1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="dia" stroke="#5A7080" fontSize={12} />
                <YAxis stroke="#5A7080" fontSize={12} tickFormatter={(v) => `${v/1000}k`} />
                <Tooltip formatter={(v) => formatCOP(v)} contentStyle={{ background: '#0A0F14', border: '1px solid #00FFD1' }} />
                <Area type="monotone" dataKey="ventas" stroke="#00FFD1" fillOpacity={1} fill="url(#colorVentas)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="chart-card">
          <h3>Pedidos por día</h3>
          {loading ? (
            <div className="skeleton" style={{ height: 250 }}></div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ventasData}>
                <XAxis dataKey="dia" stroke="#5A7080" fontSize={12} />
                <YAxis stroke="#5A7080" fontSize={12} />
                <Tooltip contentStyle={{ background: '#0A0F14', border: '1px solid #00FFD1' }} />
                <Bar dataKey="pedidos" fill="#00FFD1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="tables-row">
        <div className="table-card">
          <h3>Top productos</h3>
          {loading ? (
            <div className="skeleton" style={{ height: 150 }}></div>
          ) : (
            <table>
              <thead><tr><th>Producto</th><th>Vendidos</th><th>Ingresos</th></tr></thead>
              <tbody>
                {topProductos.length > 0 ? topProductos.map((p, i) => (
                  <tr key={i}><td>{p.nombre}</td><td>{p.vendidos}</td><td>{formatCOP(p.ingresos)}</td></tr>
                )) : (
                  <tr><td colSpan={3} className="empty-state">Sin datos disponibles</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        <div className="table-card">
          <h3>Top clientes</h3>
          {loading ? (
            <div className="skeleton" style={{ height: 150 }}></div>
          ) : (
            <table>
              <thead><tr><th>Cliente</th><th>Pedidos</th><th>Total</th></tr></thead>
              <tbody>
                {topClientes.length > 0 ? topClientes.map((c, i) => (
                  <tr key={i}><td>{c.nombre}</td><td>{c.pedidos}</td><td>{formatCOP(c.total)}</td></tr>
                )) : (
                  <tr><td colSpan={3} className="empty-state">Sin datos disponibles</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <PlanGuard planesPermitidos={['professional', 'enterprise']}>
      <AnalyticsContent />
    </PlanGuard>
  );
}
