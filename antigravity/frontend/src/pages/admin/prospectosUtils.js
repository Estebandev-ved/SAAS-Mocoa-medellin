// Misma lógica que antigravity/api/services/prospectos.js (armarMensaje / enlaceWhatsapp /
// normalizarWhatsapp). El servidor guarda el número ya normalizado; acá solo se usa para armar
// el enlace de WhatsApp con el mensaje.

export const ESTADOS = [
  { id: 'nuevo', label: 'Nuevo' },
  { id: 'contactado', label: 'Contactado' },
  { id: 'video_enviado', label: 'Video enviado' },
  { id: 'respondio', label: 'Respondió' },
  { id: 'demo', label: 'Demo' },
  { id: 'cliente', label: 'Cliente' },
  { id: 'descartado', label: 'Descartado' },
];

export const FUENTES = ['instagram', 'tiktok', 'facebook', 'referido', 'calle', 'otro'];

export const PLANTILLA_POR_DEFECTO =
  'Hola {nombre} 👋 Soy de Antigravity. Preparé este video pensando en {negocio}: {video}\n\n' +
  'Te muestra cómo un asistente de WhatsApp con IA puede tomar tus pedidos solo. ¿Lo ves y me cuentas qué opinas?';

export function armarMensaje(plantilla, p) {
  const valores = {
    nombre: (p.contacto || '').trim().split(/\s+/)[0] || '',
    negocio: (p.nombre_negocio || '').trim(),
    video: (p.video_url || '').trim(),
  };
  return String(plantilla || '')
    .replace(/\{(nombre|negocio|video)\}/g, (_, k) => valores[k])
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.!?])/g, '$1')
    .trim();
}

export function enlaceWhatsapp(whatsapp, mensaje) {
  if (!whatsapp) return null;
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje || '')}`;
}

export function fechaCorta(yyyyMMdd) {
  if (!yyyyMMdd) return '';
  const [y, m, d] = String(yyyyMMdd).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export const hoyISO = () => {
  const d = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};
