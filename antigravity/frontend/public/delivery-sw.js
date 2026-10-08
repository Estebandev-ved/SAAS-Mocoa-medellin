// Service worker del portal del domiciliario. Solo se registra desde rutas
// /delivery/* (ver PortalDomiciliario.jsx) — el resto de la app (admin,
// dashboard del negocio) no lo usa ni lo necesita.
//
// A propósito NO cachea nada de la API: los pedidos pendientes, el estado de
// una entrega o la ubicación del domiciliario tienen que ser siempre datos
// frescos — servir una respuesta vieja de /driver/orders podría hacer que
// alguien no vea un pedido nuevo o intente aceptar uno que ya tomó otro
// domiciliario. Solo cachea el cascarón estático (la app en sí) para que abra
// rápido y, si la señal falla un instante, no se quede en blanco.
const CACHE = 'delivery-shell-v1';
const SHELL = ['/delivery/login', '/icons/delivery-192.png', '/icons/delivery-512.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Nunca cachear llamadas a la API ni al socket — siempre red directa.
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
        return;
    }

    // Cascarón de la app: red primero (para tomar cambios nuevos al desplegar),
    // con el caché como respaldo si no hay señal.
    event.respondWith(
        fetch(event.request)
            .then((res) => {
                const copy = res.clone();
                caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
                return res;
            })
            .catch(() => caches.match(event.request))
    );
});
