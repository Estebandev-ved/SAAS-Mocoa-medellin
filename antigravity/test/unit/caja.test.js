// Tests de api/routes/caja.js — el token que Antigravity le entrega a la "caja".
// No necesitan base de datos ni servidor: el handler recibe un pool falso.
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { crearTokenHandler, estadoParaCaja } = require('../../api/routes/caja');
const { hasFeature } = require('../../config/planConfig');

const SECRETO = 'secreto-de-prueba-solo-para-tests';
const ENV = { CAJA_JWT_SECRET: SECRETO, CAJA_URL: 'https://caja.example.test' };
const AHORA = new Date('2026-10-01T12:00:00.000Z');
const EN_10_DIAS = new Date('2026-10-11T12:00:00.000Z');
const EN_3_DIAS = new Date('2026-10-04T12:00:00.000Z');

function poolFalso(fila) {
    return { execute: async () => [[fila].filter(Boolean)] };
}

// Ejecuta el handler con un req/res mínimos y devuelve { status, body }.
async function llamar({ plan = 'emprendedor', fila, env = ENV } = {}) {
    const handler = crearTokenHandler({ pool: poolFalso(fila), env, ahora: () => AHORA });
    const req = { negocio: { id: 42, nombre: 'Tienda de Ana', plan } };
    const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(b) { this.body = b; return this; },
    };
    await handler(req, res);
    return { status: res.statusCode, body: res.body };
}

const FILA_ACTIVA = {
    suscripcion_activa: 1, suscripcion_inicio: new Date('2026-09-11T12:00:00Z'),
    suscripcion_fin: EN_10_DIAS, trial_hasta: null,
};
const FILA_TRIAL = {
    suscripcion_activa: 0, suscripcion_inicio: null,
    suscripcion_fin: null, trial_hasta: EN_3_DIAS,
};

test('emprendedor tiene cajaInventario y los demás planes no', () => {
    assert.equal(hasFeature('emprendedor', 'cajaInventario'), true);
    for (const plan of ['starter', 'professional', 'enterprise']) {
        assert.equal(hasFeature(plan, 'cajaInventario'), false, plan);
    }
});

test('el token trae los claims correctos y se firma con CAJA_JWT_SECRET en HS256', async () => {
    const { status, body } = await llamar({ fila: FILA_ACTIVA });
    assert.equal(status, 200);

    const decodificado = jwt.verify(body.token, SECRETO, {
        algorithms: ['HS256'], issuer: 'antigravity', audience: 'caja',
    });
    assert.equal(decodificado.iss, 'antigravity');
    assert.equal(decodificado.aud, 'caja');
    assert.equal(decodificado.negocio_id, 42);
    assert.equal(decodificado.nombre, 'Tienda de Ana');
    assert.equal(decodificado.plan, 'emprendedor');
    assert.equal(decodificado.estado, 'activo');
    assert.equal(decodificado.vigente_hasta, EN_10_DIAS.toISOString());

    const { header } = jwt.decode(body.token, { complete: true });
    assert.equal(header.alg, 'HS256');
});

test('el token no se puede verificar con JWT_SECRET ni con otro secreto', async () => {
    const { body } = await llamar({ fila: FILA_ACTIVA });
    assert.throws(() => jwt.verify(body.token, 'otro-secreto'), { name: 'JsonWebTokenError' });
});

test('la url lleva el token en el fragmento (#token=) y no duplica la barra final', async () => {
    const { body } = await llamar({ fila: FILA_ACTIVA, env: { ...ENV, CAJA_URL: 'https://caja.example.test/' } });
    assert.equal(body.url, `https://caja.example.test/#token=${body.token}`);
});

test('en prueba gratis el estado es trial y vigente_hasta es el fin de la prueba', async () => {
    const { body } = await llamar({ fila: FILA_TRIAL });
    const d = jwt.verify(body.token, SECRETO);
    assert.equal(d.estado, 'trial');
    assert.equal(d.vigente_hasta, EN_3_DIAS.toISOString());
});

test('suscripción terminada => estado vencido y vigente_hasta null', () => {
    const r = estadoParaCaja({
        suscripcion_activa: 0, suscripcion_inicio: new Date('2026-08-01T00:00:00Z'),
        suscripcion_fin: new Date('2026-09-01T00:00:00Z'), trial_hasta: null,
    }, AHORA);
    assert.deepEqual(r, { estado: 'vencido', vigente_hasta: null });
});

test('canceló pero el ciclo pagado sigue vigente => activo hasta el fin del ciclo', () => {
    const r = estadoParaCaja({
        suscripcion_activa: 0, suscripcion_inicio: new Date('2026-09-11T00:00:00Z'),
        suscripcion_fin: EN_10_DIAS, trial_hasta: null,
    }, AHORA);
    assert.equal(r.estado, 'activo');
    assert.equal(r.vigente_hasta, EN_10_DIAS.toISOString());
});

test('el token expira a las 12 horas', async () => {
    const { body } = await llamar({ fila: FILA_ACTIVA });
    const { iat, exp } = jwt.verify(body.token, SECRETO);
    assert.equal(exp - iat, 12 * 60 * 60);

    // Y una vez pasadas las 12 h, la verificación lo rechaza.
    const pasadas12h = Math.floor(Date.now() / 1000) + 12 * 60 * 60 + 5;
    assert.throws(
        () => jwt.verify(body.token, SECRETO, { clockTimestamp: pasadas12h }),
        { name: 'TokenExpiredError' }
    );
});

test('sin la feature cajaInventario responde 403 y no emite token', async () => {
    for (const plan of ['starter', 'professional', 'enterprise']) {
        const { status, body } = await llamar({ plan, fila: FILA_ACTIVA });
        assert.equal(status, 403, plan);
        assert.equal(body.token, undefined, plan);
        assert.equal(body.url, undefined, plan);
        assert.equal(body.codigo, 'PLAN_INSUFICIENTE', plan);
    }
});

test('sin CAJA_JWT_SECRET o CAJA_URL responde 503 y no cae a ningún secreto por defecto', async () => {
    for (const env of [{ CAJA_URL: ENV.CAJA_URL }, { CAJA_JWT_SECRET: SECRETO }, {}]) {
        const { status, body } = await llamar({ fila: FILA_ACTIVA, env });
        assert.equal(status, 503);
        assert.equal(body.token, undefined);
    }
});
