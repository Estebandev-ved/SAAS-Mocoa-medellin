// Tests de config/planConfig.js — la "fuente única de verdad" de planes,
// precios y límites. No necesita base de datos ni servidor corriendo.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    getPlan,
    getPlanFeatures,
    hasFeature,
    checkLimit,
    getNextPlan,
    getPrevPlan,
    PLAN_ORDER,
} = require('../../config/planConfig');

test('getPlan cae a starter si el plan no existe', () => {
    const plan = getPlan('plan_inventado');
    assert.equal(plan.id, 'starter');
});

test('getPlanFeatures no devuelve la misma referencia entre llamadas (no se puede corromper el plan compartido)', () => {
    // Regresión del bug del 16 sept: maxProducts terminaba en null porque
    // algo mutaba el objeto de features compartido. Si esto vuelve a romperse,
    // esta prueba debe fallar.
    const a = getPlanFeatures('starter');
    a.maxProducts = 'MUTADO';
    const b = getPlanFeatures('starter');
    assert.notEqual(b.maxProducts, 'MUTADO');
    assert.equal(b.maxProducts, 20);
});

test('hasFeature refleja lo definido en el plan', () => {
    assert.equal(hasFeature('starter', 'domicilios'), false);
    assert.equal(hasFeature('professional', 'automatizaciones'), true);
});

test('checkLimit permite consumo por debajo del límite y lo bloquea igual o por encima', () => {
    const bajoLimite = checkLimit('starter', 'maxProducts', 5);
    assert.equal(bajoLimite.allowed, true);
    assert.equal(bajoLimite.remaining, 15);

    const enElLimite = checkLimit('starter', 'maxProducts', 20);
    assert.equal(enElLimite.allowed, false);
    assert.equal(enElLimite.remaining, 0);
});

test('checkLimit trata -1 como ilimitado', () => {
    const resultado = checkLimit('enterprise', 'maxMessages', 999999);
    assert.equal(resultado.allowed, true);
    assert.equal(resultado.limit, -1);
});

test('getNextPlan/getPrevPlan respetan el orden de PLAN_ORDER', () => {
    const primero = PLAN_ORDER[0];
    const ultimo = PLAN_ORDER[PLAN_ORDER.length - 1];
    assert.equal(getPrevPlan(primero), null);
    assert.equal(getNextPlan(ultimo), null);
    assert.notEqual(getNextPlan(primero), null);
});
