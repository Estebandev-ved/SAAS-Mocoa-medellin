// Avisos Web Push del dueño (PWA fase 2). El servidor decide si la función existe
// (GET /push/config); si no hay claves VAPID configuradas, la UI no ofrece nada.
import api from '../services/api';

export function pushSoportado() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// iOS solo permite push en la app instalada en la pantalla de inicio (iOS 16.4+).
export function esIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
export function estaInstalada() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registroSW() {
  // Solo existe en producción (main.jsx no lo registra en desarrollo).
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error('SW_NO_DISPONIBLE');
  return navigator.serviceWorker.ready;
}

export async function configPush() {
  const { data } = await api.get('/push/config');
  return data;
}

export async function suscripcionActual() {
  if (!pushSoportado()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function activarAvisos(publicKey) {
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('PERMISO_DENEGADO');
  const reg = await registroSW();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await api.post('/push/subscribe', { subscription: sub.toJSON() });
  return sub;
}

export async function desactivarAvisos() {
  const sub = await suscripcionActual();
  if (!sub) return;
  await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}
