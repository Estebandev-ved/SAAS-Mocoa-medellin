import './MetricCard.css';

export default function MetricCard({
  titulo,
  valor,
  variacion,
  variacionPositiva = true,
  sparklineData = [],
  icono,
  loading = false
}) {
  if (loading) {
    return (
      <div className="metric-card">
        <div className="skeleton skeleton-metric"></div>
      </div>
    );
  }

  const formatCOP = (val) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  };

  const isCurrency = titulo.toLowerCase().includes('venta') || titulo.toLowerCase().includes('total');
  const displayValue = isCurrency && typeof valor === 'number' ? formatCOP(valor) : valor;

  return (
    <div className="metric-card">
      <div className="metric-header">
        {icono && <div className="metric-icon">{icono}</div>}
        <span className="metric-title">{titulo}</span>
      </div>
      <div className="metric-value">{displayValue}</div>
      {variacion !== undefined && (
        <div className={`metric-variation ${variacionPositiva ? 'positive' : 'negative'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {variacionPositiva ? (
              <polyline points="18 15 12 9 6 15" />
            ) : (
              <polyline points="6 9 12 15 18 9" />
            )}
          </svg>
          {variacion}%
        </div>
      )}
      {sparklineData.length > 0 && (
        <div className="metric-sparkline">
          {sparklineData.map((val, i) => (
            <div
              key={i}
              className="sparkline-bar"
              style={{ height: `${(val / Math.max(...sparklineData)) * 100}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
