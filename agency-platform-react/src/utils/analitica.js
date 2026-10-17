import { leerConsentimiento } from '../components/CookieBanner';

// Analítica de la web: Plausible (sin cookies, sin perfiles individuales). Solo se carga si
//  1) VITE_ANALITICA_DOMINIO está definida (p. ej. "antigravity.co") y
//  2) la persona pulsó "Aceptar" en el aviso de cookies (ver CookieBanner / LegalPage §9).
// Sin esas dos cosas no se carga nada ni se envía ningún evento.
const DOMINIO = import.meta.env.VITE_ANALITICA_DOMINIO || '';
const SCRIPT = import.meta.env.VITE_ANALITICA_SCRIPT || 'https://plausible.io/js/script.js';

let cargada = false;

export function iniciarAnalitica() {
  if (cargada || !DOMINIO || typeof document === 'undefined') return;
  if (!leerConsentimiento()?.analitica) return;
  cargada = true;
  window.plausible = window.plausible || function (...args) { (window.plausible.q = window.plausible.q || []).push(args); };
  const s = document.createElement('script');
  s.defer = true;
  s.src = SCRIPT;
  s.setAttribute('data-domain', DOMINIO);
  document.head.appendChild(s);
}

// Evento de conversión (p. ej. 'cta_registro'). No hace nada si no hay consentimiento.
export function evento(nombre, props) {
  if (!cargada || typeof window.plausible !== 'function') return;
  try { window.plausible(nombre, props ? { props } : undefined); } catch { /* la analítica nunca rompe la app */ }
}

// Si la persona acepta con la página ya abierta, se activa en el momento.
if (typeof window !== 'undefined') {
  window.addEventListener('noma-consent', iniciarAnalitica);
}
