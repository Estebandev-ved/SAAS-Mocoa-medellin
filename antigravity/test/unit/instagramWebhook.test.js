const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

// Pruebas del handler GET /webhook: se saca la función del router sin levantar el servidor.
function montar(env) {
    for (const k of ['INSTAGRAM_VERIFY_TOKEN', 'META_VERIFY_TOKEN']) delete process.env[k];
    Object.assign(process.env, env);
    const dbPath = require.resolve(path.join('..', '..', 'db', 'config'));
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { execute: async () => [[]] } };
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'x';
    delete require.cache[require.resolve('../../api/routes/instagram')];
    const router = require('../../api/routes/instagram');
    return router.stack.find((l) => l.route && l.route.path === '/webhook' && l.route.methods.get).route.stack[0].handle;
}

function llamar(handler, query) {
    const res = { estado: null, cuerpo: null, status(c) { this.estado = c; return this; }, send(b) { this.cuerpo = b; return this; }, sendStatus(c) { this.estado = c; return this; } };
    handler({ query }, res);
    return res;
}

test('verificación del webhook: acepta solo el token correcto', () => {
    const h = montar({ INSTAGRAM_VERIFY_TOKEN: 'secreto-real' });
    const ok = llamar(h, { 'hub.mode': 'subscribe', 'hub.verify_token': 'secreto-real', 'hub.challenge': 'abc123' });
    assert.deepStrictEqual([ok.estado, ok.cuerpo], [200, 'abc123']);
    assert.strictEqual(llamar(h, { 'hub.mode': 'subscribe', 'hub.verify_token': 'cualquier-cosa', 'hub.challenge': 'x' }).estado, 403);
    assert.strictEqual(llamar(h, { 'hub.mode': 'subscribe', 'hub.challenge': 'x' }).estado, 403);
    assert.strictEqual(llamar(h, { 'hub.mode': 'otro', 'hub.verify_token': 'secreto-real', 'hub.challenge': 'x' }).estado, 403);
});

test('sin variable de entorno rige el token heredado, no cualquiera', () => {
    const h = montar({});
    assert.strictEqual(llamar(h, { 'hub.mode': 'subscribe', 'hub.verify_token': 'antigravity_ig_verify', 'hub.challenge': 'c' }).estado, 200);
    assert.strictEqual(llamar(h, { 'hub.mode': 'subscribe', 'hub.verify_token': 'adivinando', 'hub.challenge': 'c' }).estado, 403);
});
