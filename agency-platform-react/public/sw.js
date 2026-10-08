// Service worker del dashboard del negocio (PWA fase 1: instalable y abre rápido).
// A propósito NO cachea nada de la API ni del socket: pedidos, pagos y conversaciones
// tienen que ser siempre datos frescos — un pedido viejo mostrado como nuevo es peor
// que un error de conexión. Solo se guarda el cascarón de la app.
//  - Navegaciones: red primero (toma lo recién desplegado), con el index.html cacheado
//    como respaldo si no hay señal, para que la app abra en vez de mostrar el dinosaurio.
//  - /assets/* (nombres con hash, inmutables) e íconos: caché primero.
const VERSION = 'noma-shell-v2';

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(VERSION).then((c) => c.addAll(['/', '/icons/noma-192.png'])).catch(() => {}));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) => Promise.all(names.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(VERSION).then((c) => c.put('/', copy)).catch(() => {});
                    return res;
                })
                .catch(() => caches.match('/'))
        );
        return;
    }

    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
        event.respondWith(
            caches.match(request).then(
                (hit) =>
                    hit ||
                    fetch(request).then((res) => {
                        if (res.ok) {
                            const copy = res.clone();
                            caches.open(VERSION).then((c) => c.put(request, copy)).catch(() => {});
                        }
                        return res;
                    })
            )
        );
    }
});

// ── Web Push (PWA fase 2): avisos de pedido nuevo / pago confirmado ──
// El payload lo arma el servidor (api/services/push.js): { title, body, tag, url }.
self.addEventListener('push', (event) => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
    const title = data.title || 'Antigravity';
    event.waitUntil(
        self.registration.showNotification(title, {
            body: data.body || '',
            tag: data.tag || 'noma',
            icon: '/icons/noma-192.png',
            badge: '/icons/noma-192.png',
            data: { url: data.url || '/pedidos' },
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const destino = new URL((event.notification.data && event.notification.data.url) || '/pedidos', self.location.origin).href;
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
            for (const w of wins) {
                if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
                    return w.focus().then((c) => ('navigate' in c ? c.navigate(destino) : c));
                }
            }
            return self.clients.openWindow(destino);
        })
    );
});
