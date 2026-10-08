// Avisos Web Push al celular del dueño (PWA fase 2). Si las claves VAPID no están
// en el entorno, TODO queda apagado: no se envía nada y nada se rompe.
const crypto = require('crypto');

const EVENTOS = new Set(['nuevo_pedido', 'pedido_confirmado']);

function vapidConfigurado(env = process.env) {
    return Boolean(env.PUSH_VAPID_PUBLIC_KEY && env.PUSH_VAPID_PRIVATE_KEY);
}

function formatoCOP(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return null;
    return '$' + Math.round(v).toLocaleString('es-CO');
}

// Texto del aviso. Sin datos sensibles más allá de lo que el dueño ya ve en su pantalla.
function construirPayload(evento, data = {}) {
    const total = formatoCOP(data.total);
    const num = data.numero_pedido ? `#${data.numero_pedido}` : '';
    const cliente = data.cliente_nombre || 'Un cliente';
    if (evento === 'pedido_confirmado') {
        return {
            title: '💰 Pago confirmado',
            body: [`${cliente} pagó`, total, num].filter(Boolean).join(' · ') + '. A prepararlo.',
            tag: `pedido-${data.pedido_id || data.numero_pedido || 'x'}`,
            url: '/pedidos',
        };
    }
    return {
        title: '🛎️ Nuevo pedido',
        body: [`${cliente}`, total, num].filter(Boolean).join(' · '),
        tag: `pedido-${data.pedido_id || data.numero_pedido || 'x'}`,
        url: '/pedidos',
    };
}

// Valida y normaliza lo que manda PushManager.subscribe().toJSON().
// Solo se aceptan endpoints https (los servicios push reales lo son).
function sanitizarSuscripcion(body) {
    const s = body && body.subscription ? body.subscription : body;
    if (!s || typeof s !== 'object') return null;
    const { endpoint } = s;
    const keys = s.keys || {};
    if (typeof endpoint !== 'string' || endpoint.length > 2000) return null;
    let url;
    try { url = new URL(endpoint); } catch { return null; }
    if (url.protocol !== 'https:') return null;
    const b64url = /^[A-Za-z0-9_\-+/=]{10,255}$/;
    if (typeof keys.p256dh !== 'string' || !b64url.test(keys.p256dh)) return null;
    if (typeof keys.auth !== 'string' || !b64url.test(keys.auth)) return null;
    return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

const hashEndpoint = (endpoint) => crypto.createHash('sha256').update(endpoint).digest('hex');

// 404/410 = el navegador ya no existe o el permiso se revocó: se borra la suscripción.
const esSuscripcionMuerta = (err) => Boolean(err) && (err.statusCode === 404 || err.statusCode === 410);

// Envía un evento a todos los dispositivos de un negocio. Nunca lanza: un fallo de
// push no debe afectar el relay de sockets ni la creación del pedido.
// `deps` permite probarlo sin base de datos ni red.
async function enviarAlNegocio(negocioId, evento, data, deps = {}) {
    try {
        const env = deps.env || process.env;
        if (!EVENTOS.has(evento) || !vapidConfigurado(env)) return { enviados: 0, eliminados: 0 };
        const db = deps.db || require('../../db/config');
        const webpush = deps.webpush || require('web-push');
        webpush.setVapidDetails(
            env.PUSH_VAPID_SUBJECT || 'mailto:soporte@antigravity.co',
            env.PUSH_VAPID_PUBLIC_KEY,
            env.PUSH_VAPID_PRIVATE_KEY
        );
        const [subs] = await db.execute(
            'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE negocio_id = ?',
            [negocioId]
        );
        if (!subs.length) return { enviados: 0, eliminados: 0 };

        const payload = JSON.stringify(construirPayload(evento, data));
        let enviados = 0;
        const muertas = [];
        await Promise.all(subs.map(async (s) => {
            try {
                await webpush.sendNotification(
                    { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                    payload,
                    { TTL: 3600, urgency: 'high' }
                );
                enviados++;
            } catch (err) {
                if (esSuscripcionMuerta(err)) muertas.push(s.id);
                else console.warn('[Push] Error enviando:', err.statusCode || err.message);
            }
        }));
        if (muertas.length) {
            await db.execute(
                `DELETE FROM push_subscriptions WHERE id IN (${muertas.map(() => '?').join(',')})`,
                muertas
            );
        }
        return { enviados, eliminados: muertas.length };
    } catch (err) {
        console.warn('[Push] No se pudo procesar el aviso:', err.message);
        return { enviados: 0, eliminados: 0 };
    }
}

module.exports = {
    vapidConfigurado, construirPayload, sanitizarSuscripcion, hashEndpoint,
    esSuscripcionMuerta, enviarAlNegocio,
};
