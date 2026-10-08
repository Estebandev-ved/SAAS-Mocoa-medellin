// Tests de api/services/push.js — avisos Web Push (sin base de datos ni red).
const test = require('node:test');
const assert = require('node:assert/strict');
const push = require('../../api/services/push');

const ENV = { PUSH_VAPID_PUBLIC_KEY: 'pub', PUSH_VAPID_PRIVATE_KEY: 'priv', PUSH_VAPID_SUBJECT: 'mailto:a@b.co' };
const SUB_OK = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4', auth: 'tBHItJI5svbpez7KI4CCXg' } };

test('vapidConfigurado: necesita las dos claves', () => {
    assert.equal(push.vapidConfigurado({}), false);
    assert.equal(push.vapidConfigurado({ PUSH_VAPID_PUBLIC_KEY: 'x' }), false);
    assert.equal(push.vapidConfigurado(ENV), true);
});

test('construirPayload: pedido nuevo y pago confirmado', () => {
    const n = push.construirPayload('nuevo_pedido', { cliente_nombre: 'Ana', total: 45000, numero_pedido: 'P-12', pedido_id: 7 });
    assert.match(n.title, /Nuevo pedido/);
    assert.match(n.body, /Ana/);
    assert.match(n.body, /45\.000|45,000/);
    assert.equal(n.url, '/dashboard/pedidos');
    assert.equal(n.tag, 'pedido-7');
    const c = push.construirPayload('pedido_confirmado', { total: 'abc' });
    assert.match(c.title, /Pago confirmado/);
    assert.match(c.body, /Un cliente/);
    assert.ok(!c.body.includes('NaN'));
});

test('sanitizarSuscripcion: acepta válida, rechaza http, claves malas y basura', () => {
    assert.deepEqual(push.sanitizarSuscripcion(SUB_OK), { endpoint: SUB_OK.endpoint, p256dh: SUB_OK.keys.p256dh, auth: SUB_OK.keys.auth });
    assert.ok(push.sanitizarSuscripcion({ subscription: SUB_OK }));
    assert.equal(push.sanitizarSuscripcion({ ...SUB_OK, endpoint: 'http://x.co/a' }), null);
    assert.equal(push.sanitizarSuscripcion({ ...SUB_OK, endpoint: 'no-es-url' }), null);
    assert.equal(push.sanitizarSuscripcion({ ...SUB_OK, keys: { p256dh: 'x', auth: 'y' } }), null);
    assert.equal(push.sanitizarSuscripcion(null), null);
    assert.equal(push.sanitizarSuscripcion('texto'), null);
});

test('esSuscripcionMuerta: solo 404 y 410', () => {
    assert.equal(push.esSuscripcionMuerta({ statusCode: 410 }), true);
    assert.equal(push.esSuscripcionMuerta({ statusCode: 404 }), true);
    assert.equal(push.esSuscripcionMuerta({ statusCode: 500 }), false);
    assert.equal(push.esSuscripcionMuerta(null), false);
});

function fakes(subs, fallos = {}) {
    const llamadas = { envios: [], deletes: [] };
    return {
        llamadas,
        env: ENV,
        db: {
            async execute(sql, params) {
                if (/^SELECT/i.test(sql)) return [subs];
                llamadas.deletes.push({ sql, params });
                return [{}];
            },
        },
        webpush: {
            setVapidDetails() {},
            async sendNotification(sub, payload) {
                llamadas.envios.push({ sub, payload });
                if (fallos[sub.endpoint]) throw Object.assign(new Error('x'), { statusCode: fallos[sub.endpoint] });
            },
        },
    };
}

test('enviarAlNegocio: sin claves VAPID no toca base ni red', async () => {
    const r = await push.enviarAlNegocio(1, 'nuevo_pedido', {}, { env: {}, db: { execute() { throw new Error('no debe llamarse'); } } });
    assert.deepEqual(r, { enviados: 0, eliminados: 0 });
});

test('enviarAlNegocio: ignora eventos desconocidos', async () => {
    const d = fakes([{ id: 1, endpoint: 'https://a', p256dh: 'p', auth: 'a' }]);
    const r = await push.enviarAlNegocio(1, 'otro_evento', {}, d);
    assert.equal(r.enviados, 0);
    assert.equal(d.llamadas.envios.length, 0);
});

test('enviarAlNegocio: envía a todos y borra las suscripciones muertas (410), conserva las que fallan por otra causa', async () => {
    const subs = [
        { id: 1, endpoint: 'https://ok', p256dh: 'p', auth: 'a' },
        { id: 2, endpoint: 'https://muerta', p256dh: 'p', auth: 'a' },
        { id: 3, endpoint: 'https://error500', p256dh: 'p', auth: 'a' },
    ];
    const d = fakes(subs, { 'https://muerta': 410, 'https://error500': 500 });
    const r = await push.enviarAlNegocio(5, 'pedido_confirmado', { total: 1000 }, d);
    assert.deepEqual(r, { enviados: 1, eliminados: 1 });
    assert.equal(d.llamadas.envios.length, 3);
    assert.deepEqual(d.llamadas.deletes[0].params, [2]);
    assert.equal(JSON.parse(d.llamadas.envios[0].payload).title.includes('Pago'), true);
});

test('enviarAlNegocio: nunca lanza aunque la base falle', async () => {
    const r = await push.enviarAlNegocio(1, 'nuevo_pedido', {}, { env: ENV, webpush: { setVapidDetails() {} }, db: { async execute() { throw new Error('db caída'); } } });
    assert.deepEqual(r, { enviados: 0, eliminados: 0 });
});
