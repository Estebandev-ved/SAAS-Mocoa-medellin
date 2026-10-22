const test = require('node:test');
const assert = require('node:assert');
const { RedisRateLimitStore, crearStore } = require('../../api/services/rateLimitStore');

// Redis simulado en memoria con solo los comandos que usa el store.
function redisFalso() {
    const datos = new Map();
    const vence = new Map();
    const ttl = (k) => (vence.has(k) ? Math.max(vence.get(k) - Date.now(), 0) : -1);
    const api = {
        multi() {
            const cola = [];
            const m = {
                incr(k) { cola.push(() => { datos.set(k, (datos.get(k) || 0) + 1); return datos.get(k); }); return m; },
                pttl(k) { cola.push(() => ttl(k)); return m; },
                async exec() { return cola.map((f) => [null, f()]); },
            };
            return m;
        },
        async pexpire(k, ms) { vence.set(k, Date.now() + ms); },
        async get(k) { return datos.has(k) ? String(datos.get(k)) : null; },
        async pttl(k) { return ttl(k); },
        async decr(k) { datos.set(k, (datos.get(k) || 0) - 1); },
        async del(k) { datos.delete(k); vence.delete(k); },
    };
    return api;
}

test('cuenta aciertos por clave y fija la ventana la primera vez', async () => {
    const s = new RedisRateLimitStore(redisFalso(), 'login');
    s.init({ windowMs: 1000 });
    assert.strictEqual((await s.increment('1.1.1.1')).totalHits, 1);
    const r = await s.increment('1.1.1.1');
    assert.strictEqual(r.totalHits, 2);
    assert.ok(r.resetTime.getTime() > Date.now());
    assert.strictEqual((await s.increment('2.2.2.2')).totalHits, 1);
});

test('decrement y resetKey', async () => {
    const s = new RedisRateLimitStore(redisFalso(), 'api');
    s.init({ windowMs: 1000 });
    await s.increment('k'); await s.increment('k');
    await s.decrement('k');
    assert.strictEqual((await s.get('k')).totalHits, 1);
    await s.resetKey('k');
    assert.strictEqual(await s.get('k'), undefined);
});

test('si Redis falla se deja pasar en vez de tumbar la API', async () => {
    const roto = { multi() { throw new Error('caído'); } };
    const s = new RedisRateLimitStore(roto, 'x');
    s.init({ windowMs: 1000 });
    const orig = console.error; console.error = () => {};
    try { assert.strictEqual((await s.increment('k')).totalHits, 1); } finally { console.error = orig; }
});

test('sin REDIS_URL no hay store (se usa memoria)', () => {
    delete process.env.REDIS_URL;
    assert.strictEqual(crearStore('z'), undefined);
});
