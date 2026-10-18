import api from '../services/api';

// Preferencias de visualización de la cuenta (zona horaria, moneda, formato de fecha).
// La fuente de verdad es el servidor (GET/PUT /business/preferencias); localStorage es una
// copia para poder formatear de forma síncrona y sin parpadeo al abrir el panel.
const PREFS_KEY = 'noma_preferencias';
export const PREFS_DEFAULT = { zona_horaria: 'America/Bogota', moneda: 'COP', formato_fecha: 'dd/mm/yyyy' };

export function leerPreferencias() {
  try {
    return { ...PREFS_DEFAULT, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return { ...PREFS_DEFAULT };
  }
}

function guardarCopiaLocal(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch { /* sin almacenamiento: se usan las del servidor en cada carga */ }
  window.dispatchEvent(new Event('preferencias-actualizadas'));
}

/** Trae las preferencias del servidor y actualiza la copia local. Silencioso si falla. */
export async function sincronizarPreferencias() {
  try {
    const { data } = await api.get('/business/preferencias');
    if (data && data.preferencias) {
      guardarCopiaLocal({ ...PREFS_DEFAULT, ...data.preferencias });
      return data.preferencias;
    }
  } catch { /* sin conexión o sesión vencida: quedan las locales */ }
  return leerPreferencias();
}

/** Guarda en el servidor; si falla lanza el error (la copia local no se toca). */
export async function guardarPreferencias(prefs) {
  const { data } = await api.put('/business/preferencias', prefs);
  const final = { ...PREFS_DEFAULT, ...data.preferencias };
  guardarCopiaLocal(final);
  return final;
}

const LOCALE_MONEDA = { COP: 'es-CO', MXN: 'es-MX', USD: 'en-US', EUR: 'es-ES' };

/** Solo cambia el formato y el símbolo: los montos se guardan en COP y NO se convierten. */
export function formatearMoneda(monto, prefs = leerPreferencias()) {
  const n = Number(monto);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat(LOCALE_MONEDA[prefs.moneda] || 'es-CO', {
    style: 'currency', currency: prefs.moneda || 'COP', minimumFractionDigits: 0, maximumFractionDigits: prefs.moneda === 'COP' ? 0 : 2,
  }).format(n);
}

/** Fecha (y hora opcional) en la zona horaria y el orden elegidos. */
export function formatearFecha(valor, { hora = false } = {}, prefs = leerPreferencias()) {
  if (!valor) return '';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  let partes;
  try {
    partes = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: prefs.zona_horaria, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(d).map((p) => [p.type, p.value])
    );
  } catch {
    return d.toLocaleString('es-CO');
  }
  const { day, month, year } = partes;
  const fecha = prefs.formato_fecha === 'mm/dd/yyyy' ? `${month}/${day}/${year}`
    : prefs.formato_fecha === 'yyyy-mm-dd' ? `${year}-${month}-${day}`
    : `${day}/${month}/${year}`;
  return hora ? `${fecha} ${partes.hour === '24' ? '00' : partes.hour}:${partes.minute}` : fecha;
}
