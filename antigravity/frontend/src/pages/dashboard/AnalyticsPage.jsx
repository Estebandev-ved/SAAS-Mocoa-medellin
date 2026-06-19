import { useState, useEffect } from 'react';
import PlanGuard from '../../components/auth/PlanGuard';
import { analyticsService } from '../../services/api';
import MetricCard from '../../components/dashboard/MetricCard';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import './AnalyticsPage.css';

const ANALYTICS_DATA = {
  semana: [
    { dia: 'Lun', ventas: 120000, pedidos: 5 },
    { dia: 'Mar', ventas: 180000, pedidos: 8 },
    { dia: 'Mié', ventas: 150000, pedidos: 6 },
    { dia: 'Jue', ventas: 220000, pedidos: 10 },
    { dia: 'Vie', ventas: 280000, pedidos: 12 },
    { dia: 'Sáb', ventas: 350000, pedidos: 15 },
    { dia: 'Dom', ventas: 200000, pedidos: 9 }
  ],
  topProductos: [
    { nombre: 'Zapatillas Sport', vendidos: 45, ingresos: 5400000 },
    { nombre: 'Chaqueta de Cuero', vendidos: 20, ingresos: 5000000 },
    { nombre: 'Pantalón Jean', vendidos: 38, ingresos: 3382000 }
  ],
  topClientes: [
    { nombre: 'Juan Pérez', pedidos: 5, total: 450000 },
    { nombre: 'María García', pedidos: 3, total: 280000 },
    { nombre: 'Carlos López', pedidos: 2, total: 150000 }
  ]
};

function AnalyticsContent() {
  const [periodo, setPeriodo] = useState('semana');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000);
  }, []);

  const formatCOP = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  const data = ANALYTICS_DATA[periodo] || ANALYTICS_DATA.semana;

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

      <div className="metrics-grid">
        <MetricCard titulo="Total ventas" valor={2340000} variacion={18} variacionPositiva={true} loading={loading} />
        <MetricCard titulo="Pedidos" valor={65} variacion={12} variacionPositiva={true} loading={loading} />
        <MetricCard titulo="Ticket promedio" valor={36000} variacion={5} variacionPositiva={true} loading={loading} />
        <MetricCard titulo="Tasa conversión" valor="8.5%" variacion={2} variacionPositiva={true} loading={loading} />
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <h3>Ventas diarias</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={ANALYTICS_DATA.semana}>
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
        </div>
        <div className="chart-card">
          <h3>Pedidos por día</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={ANALYTICS_DATA.semana}>
              <XAxis dataKey="dia" stroke="#5A7080" fontSize={12} />
              <YAxis stroke="#5A7080" fontSize={12} />
              <Tooltip contentStyle={{ background: '#0A0F14', border: '1px solid #00FFD1' }} />
              <Bar dataKey="pedidos" fill="#00FFD1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="tables-row">
        <div className="table-card">
          <h3>Top productos</h3>
          <table>
            <thead><tr><th>Producto</th><th>Vendidos</th><th>Ingresos</th></tr></thead>
            <tbody>
              {ANALYTICS_DATA.topProductos.map((p, i) => (
                <tr key={i}><td>{p.nombre}</td><td>{p.vendidos}</td><td>{formatCOP(p.ingresos)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-card">
          <h3>Top clientes</h3>
          <table>
            <thead><tr><th>Cliente</th><th>Pedidos</th><th>Total</th></tr></thead>
            <tbody>
              {ANALYTICS_DATA.topClientes.map((c, i) => (
                <tr key={i}><td>{c.nombre}</td><td>{c.pedidos}</td><td>{formatCOP(c.total)}</td></tr>
              ))}
            </tbody>
          </table>
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
