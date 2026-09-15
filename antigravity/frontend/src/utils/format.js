export const formatCOP = (val) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(val);
};

export const formatNumber = (val) => {
  return new Intl.NumberFormat('es-CO').format(val);
};

export const formatPercent = (val) => {
  return `${val}%`;
};
