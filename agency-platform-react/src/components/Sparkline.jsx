import React from 'react';

// Mini-gráfico de línea sin dependencias (SVG). values: arreglo de números (p. ej. ventas de 7 días).
export default function Sparkline({ values = [], width = 96, height = 32, className = '', label }) {
  if (!values.length || values.every((v) => !v)) return null;
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const rango = max - min || 1;
  const paso = values.length > 1 ? width / (values.length - 1) : width;
  const puntos = values.map((v, i) => [i * paso, height - 3 - ((v - min) / rango) * (height - 6)]);
  const linea = puntos.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [ux, uy] = puntos[puntos.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label={label || 'Tendencia de los últimos 7 días'}>
      <polyline points={`0,${height} ${linea} ${width},${height}`} fill="currentColor" opacity="0.12" stroke="none" />
      <polyline points={linea} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={ux} cy={uy} r="3" fill="currentColor" />
    </svg>
  );
}
