// Tests de api/services/billing.js > calcularEstado() — la fuente única de
// verdad del estado de suscripción, que usan tanto la pantalla de Suscripción
// como el paywall duro del bot (orchestrator.js > verificarSuscripcion()).
// No necesita base de datos: calcularEstado() es una función pura que solo
// mira los campos que le pasás.
const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularEstado } = require('../../api/services/billing');

const HOY = new Date('2026-01-15T12:00:00Z');
const dias = (n) => new Date(HOY.getTime() + n * 24 * 60 * 60 * 1000);

test('cuenta nueva en prueba: trial_hasta en el futuro, sin pago', () => {
    const r = calcularEstado({
        suscripcion_activa: 1,
        suscripcion_fin: dias(7),
        suscripcion_inicio: null,
        trial_hasta: dias(5),
    }, HOY);
    assert.equal(r.estado, 'trial');
    assert.equal(r.en_trial, true);
});

test('quien pagó deja de estar "en trial" aunque trial_hasta no haya vencido', () => {
    const r = calcularEstado({
        suscripcion_activa: 1,
        suscripcion_fin: dias(30),
        suscripcion_inicio: dias(-1), // ya hubo un pago real
        trial_hasta: dias(5),
    }, HOY);
    assert.equal(r.estado, 'activa');
    assert.equal(r.en_trial, false);
});

test('suscripción activa y vigente', () => {
    const r = calcularEstado({
        suscripcion_activa: 1,
        suscripcion_fin: dias(20),
        suscripcion_inicio: dias(-10),
        trial_hasta: null,
    }, HOY);
    assert.equal(r.estado, 'activa');
});

test('cancelada pero con acceso vigente hasta el fin del ciclo pagado', () => {
    const r = calcularEstado({
        suscripcion_activa: 0,
        suscripcion_fin: dias(10),
        suscripcion_inicio: dias(-20),
        trial_hasta: null,
    }, HOY);
    assert.equal(r.estado, 'cancelada');
});

test('vencida: hubo plan o prueba, pero ya no hay acceso vigente — esto es lo que bloquea el bot', () => {
    const r = calcularEstado({
        suscripcion_activa: 0,
        suscripcion_fin: dias(-5),
        suscripcion_inicio: dias(-40),
        trial_hasta: null,
    }, HOY);
    assert.equal(r.estado, 'vencida');
});

test('inactiva: nunca hubo plan ni prueba', () => {
    const r = calcularEstado({
        suscripcion_activa: 0,
        suscripcion_fin: null,
        suscripcion_inicio: null,
        trial_hasta: null,
    }, HOY);
    assert.equal(r.estado, 'inactiva');
});
