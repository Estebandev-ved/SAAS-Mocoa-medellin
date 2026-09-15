import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import './AdminInteligencia.css';

const formatNumber = (v) => new Intl.NumberFormat('es-CO').format(v || 0);

const formatDateShort = (fecha) => {
  if (!fecha) return '';
  const d = new Date(`${fecha}T00:00:00`);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

const formatMesShort = (mes) => {
  if (!mes) return '';
  const [y, m] = mes.split('-');
  return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
};

const diasDesde = (fecha) => {
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
};

export default function AdminInteligencia() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await apiService.get('/api/admin/inteligencia');
      setData(res);
    } catch (error) {
      console.error('Error loading inteligencia:', error);
      toast.error('Error al cargar la inteligencia de negocio');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>Cargando...</p>
      </div>
    );
  }

  const actividad = (data?.actividad_diaria || []).map(d => ({ ...d, label: formatDateShort(d.fecha) }));
  const altas = (data?.altas_por_mes || []).map(d => ({ ...d, label: formatMesShort(d.mes) }));
  const tokens = (data?.tokens_diarios || []).map(d => ({ ...d, label: formatDateShort(d.fecha), tokens: Number(d.tokens) }));
  const ranking = data?.ranking_actividad || [];
  const masActivos = ranking.slice(0, 5);
  const menosActivos = [...ranking].filter(r => true).slice(-5).reverse();
  const inactivos = data?.negocios_inactivos || [];
  const trials = data?.trials_por_vencer || [];
  const conversion = data?.conversion || {};
  const bot = data?.bot || {};
  const resolucion = data?.resolucion || {};
  const alertas = data?.alertas || [];
  const totalNegocios = (conversion.pagando || 0) + (conversion.en_trial || 0) + (conversion.trial_vencido_sin_convertir || 0) + (conversion.suspendidos || 0);
  const tasaConversion = (Number(conversion.pagando) + Number(conversion.trial_vencido_sin_convertir)) > 0
    ? Math.round((Number(conversion.pagando) / (Number(conversion.pagando) + Number(conversion.trial_vencido_sin_convertir))) * 100)
    : 0;

  return (
    <div className="admin-inteligencia">
      <div className="admin-header">
        <h1>Inteligencia de Negocio</h1>
        <p>Cómo se comportan tus clientes, para decidir qué hacer</p>
      </div>

      {/* KPIs clave */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Interacciones IA (30d)</span>
          <span className="kpi-value">{formatNumber(bot.total_interacciones)}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Tiempo respuesta IA</span>
          <span className="kpi-value">{bot.tiempo_respuesta_promedio_ms ? `${(bot.tiempo_respuesta_promedio_ms / 1000).toFixed(1)}s` : '—'}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Tasa de resolución</span>
          <span className="kpi-value">{resolucion.tasa || 0}%</span>
          <span className="kpi-hint">{resolucion.con_pedido || 0} de {resolucion.total || 0} conversaciones con pedido</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Conversión trial → pago</span>
          <span className="kpi-value">{tasaConversion}%</span>
        </div>
        <div className="kpi-card warning">
          <span className="kpi-label">Negocios inactivos (+7d)</span>
          <span className="kpi-value">{inactivos.length}</span>
        </div>
        <div className="kpi-card warning">
          <span className="kpi-label">Trials por vencer (7d)</span>
          <span className="kpi-value">{trials.length}</span>
        </div>
      </div>

      {/* Uso y engagement */}
      <div className="section-title">Uso y engagement</div>
      <div className="chart-card">
        <h3>Mensajes y pedidos por día (30 días)</h3>
        {actividad.length === 0 ? (
          <div className="empty-chart">Sin actividad registrada en los últimos 30 días</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={actividad}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" stroke="#5A7080" fontSize={12} />
              <YAxis stroke="#5A7080" fontSize={12} />
              <Tooltip contentStyle={{ background: '#0A0F14', border: '1px solid #00FFD1' }} />
              <Legend />
              <Line type="monotone" dataKey="mensajes" name="Mensajes" stroke="#00FFD1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="pedidos" name="Pedidos" stroke="#FFB840" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="two-col">
        <div className="table-card">
          <h3>Negocios más activos (7 días)</h3>
          <table>
            <thead><tr><th>Negocio</th><th>Plan</th><th>Mensajes</th></tr></thead>
            <tbody>
              {masActivos.map(n => (
                <tr key={n.id} className="clickable-row" onClick={() => navigate(`/admin/negocios/${n.id}`)}>
                  <td>{n.nombre}</td>
                  <td><span className={`plan-badge ${n.plan}`}>{n.plan}</span></td>
                  <td className="number-cell">{formatNumber(n.mensajes_7d)}</td>
                </tr>
              ))}
              {masActivos.length === 0 && <tr><td colSpan={3} className="empty-row">Sin datos</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="table-card">
          <h3>Negocios menos activos (7 días)</h3>
          <table>
            <thead><tr><th>Negocio</th><th>Plan</th><th>Mensajes</th></tr></thead>
            <tbody>
              {menosActivos.map(n => (
                <tr key={n.id} className="clickable-row" onClick={() => navigate(`/admin/negocios/${n.id}`)}>
                  <td>{n.nombre}</td>
                  <td><span className={`plan-badge ${n.plan}`}>{n.plan}</span></td>
                  <td className="number-cell">{formatNumber(n.mensajes_7d)}</td>
                </tr>
              ))}
              {menosActivos.length === 0 && <tr><td colSpan={3} className="empty-row">Sin datos</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Riesgo de churn */}
      <div className="section-title">Riesgo de churn y retención</div>
      <div className="two-col">
        <div className="table-card">
          <h3>Negocios activos sin actividad reciente</h3>
          <table>
            <thead><tr><th>Negocio</th><th>Plan</th><th>Última actividad</th><th></th></tr></thead>
            <tbody>
              {inactivos.map(n => {
                const dias = diasDesde(n.ultima_actividad);
                return (
                  <tr key={n.id} className="clickable-row" onClick={() => navigate(`/admin/negocios/${n.id}`)}>
                    <td>{n.nombre}</td>
                    <td><span className={`plan-badge ${n.plan}`}>{n.plan}</span></td>
                    <td>{n.ultima_actividad ? `Hace ${dias} días` : 'Nunca'}</td>
                    <td><span className="risk-badge">Riesgo</span></td>
                  </tr>
                );
              })}
              {inactivos.length === 0 && <tr><td colSpan={4} className="empty-row">Todos los negocios activos tienen actividad reciente</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="table-card">
          <h3>Trials por vencer en los próximos 7 días</h3>
          <table>
            <thead><tr><th>Negocio</th><th>Plan</th><th>Vence</th></tr></thead>
            <tbody>
              {trials.map(n => (
                <tr key={n.id} className="clickable-row" onClick={() => navigate(`/admin/negocios/${n.id}`)}>
                  <td>{n.nombre}</td>
                  <td><span className={`plan-badge ${n.plan}`}>{n.plan}</span></td>
                  <td>{new Date(n.trial_hasta).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</td>
                </tr>
              ))}
              {trials.length === 0 && <tr><td colSpan={3} className="empty-row">Ningún trial vence pronto</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Crecimiento y conversión */}
      <div className="section-title">Crecimiento y conversión</div>
      <div className="two-col">
        <div className="chart-card">
          <h3>Altas de negocios por mes</h3>
          {altas.length === 0 ? (
            <div className="empty-chart">Sin altas registradas</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={altas}>
                <XAxis dataKey="label" stroke="#5A7080" fontSize={12} />
                <YAxis stroke="#5A7080" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0A0F14', border: '1px solid #00FFD1' }} />
                <Bar dataKey="altas" name="Altas" fill="#00FFD1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="stat-card">
          <h3>Estado de la base de clientes</h3>
          <div className="conversion-breakdown">
            <div className="conversion-row">
              <span className="conversion-dot pagando"></span>
              <span className="conversion-label">Pagando</span>
              <span className="conversion-value">{conversion.pagando || 0}</span>
            </div>
            <div className="conversion-row">
              <span className="conversion-dot trial"></span>
              <span className="conversion-label">En trial</span>
              <span className="conversion-value">{conversion.en_trial || 0}</span>
            </div>
            <div className="conversion-row">
              <span className="conversion-dot vencido"></span>
              <span className="conversion-label">Trial vencido sin convertir</span>
              <span className="conversion-value">{conversion.trial_vencido_sin_convertir || 0}</span>
            </div>
            <div className="conversion-row">
              <span className="conversion-dot suspendido"></span>
              <span className="conversion-label">Suspendidos</span>
              <span className="conversion-value">{conversion.suspendidos || 0}</span>
            </div>
            <div className="conversion-total">Total: {totalNegocios} negocios</div>
          </div>
        </div>
      </div>

      {/* Rendimiento del bot / IA */}
      <div className="section-title">Rendimiento del bot / IA</div>
      <div className="two-col">
        <div className="chart-card">
          <h3>Tokens consumidos por día (30 días)</h3>
          {tokens.length === 0 ? (
            <div className="empty-chart">Sin consumo de tokens registrado</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={tokens}>
                <XAxis dataKey="label" stroke="#5A7080" fontSize={12} />
                <YAxis stroke="#5A7080" fontSize={12} />
                <Tooltip contentStyle={{ background: '#0A0F14', border: '1px solid #00FFD1' }} />
                <Bar dataKey="tokens" name="Tokens" fill="#A855F7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="table-card">
          <h3>Intenciones más detectadas (30 días)</h3>
          <table>
            <thead><tr><th>Intención</th><th>Total</th></tr></thead>
            <tbody>
              {(data?.top_intenciones || []).map((i, idx) => (
                <tr key={idx} className={i.intencion_detectada === 'error' ? 'row-warning' : ''}>
                  <td>{i.intencion_detectada}</td>
                  <td className="number-cell">{formatNumber(i.total)}</td>
                </tr>
              ))}
              {(!data?.top_intenciones || data.top_intenciones.length === 0) && (
                <tr><td colSpan={2} className="empty-row">Sin datos</td></tr>
              )}
            </tbody>
          </table>
          {alertas.length > 0 && (
            <div className="alertas-mini">
              {alertas.map((a, idx) => (
                <span key={idx} className="alerta-chip">{a.tipo}: {a.total}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
