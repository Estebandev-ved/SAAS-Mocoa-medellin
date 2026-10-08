export function formatPrice(price) {
  if (price == null) return '$0';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(price);
}

// Acepta "2026-10-21" o un timestamp ISO. Las fechas "solo día" se leen como
// locales (con `new Date('2026-10-21')` quedarían un día antes en Colombia).
export function formatDate(value) {
  if (!value) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function pluralDias(n) {
  return `${n} ${n === 1 ? 'día' : 'días'}`;
}

// Los límites del plan usan -1 para "sin tope".
export function formatLimite(valor) {
  if (valor === 0) return 'No incluido';
  return valor === -1 ? 'Ilimitado' : new Intl.NumberFormat('es-CO').format(valor);
}

export function mensajeDeError(err, porDefecto) {
  return err?.response?.data?.error || porDefecto;
}
