const test = require('node:test');
const assert = require('node:assert');
const { distanciaKm, minutosEstimados, calcularEta, estaCerca, textoEta } = require('../../api/services/eta');

const PLAZA_BOLIVAR = { lat: 4.5981, lng: -74.0760 };
const CERCA = { lat: 4.5990, lng: -74.0760 }; // ~100 m al norte
const LEJOS = { lat: 4.6486, lng: -74.0620 }; // ~5-6 km

test('distancia: cero consigo mismo, nula si falta un dato', () => {
    assert.ok(distanciaKm(PLAZA_BOLIVAR, PLAZA_BOLIVAR) < 0.001);
    assert.strictEqual(distanciaKm(PLAZA_BOLIVAR, null), null);
    assert.strictEqual(distanciaKm({ lat: null, lng: 1 }, PLAZA_BOLIVAR), null);
    const d = distanciaKm(PLAZA_BOLIVAR, CERCA);
    assert.ok(d > 0.08 && d < 0.12, `d=${d}`);
});

test('minutos: mínimo 1 y misma regla del seguimiento (x1,3 a 22 km/h)', () => {
    assert.strictEqual(minutosEstimados(0), 1);
    assert.strictEqual(minutosEstimados(5), Math.round((5 * 1.3 / 22) * 60));
    assert.strictEqual(minutosEstimados(null), null);
});

test('ETA: usa al domiciliario, luego al negocio, luego lo guardado', () => {
    assert.strictEqual(calcularEta({ domiciliario: CERCA, negocio: LEJOS, destino: PLAZA_BOLIVAR }), 1);
    const desdeNegocio = calcularEta({ domiciliario: { lat: null, lng: null }, negocio: LEJOS, destino: PLAZA_BOLIVAR });
    assert.ok(desdeNegocio > 10);
    assert.strictEqual(calcularEta({ destino: null, tiempoMinutosGuardado: '25' }), 25);
    assert.strictEqual(calcularEta({ destino: null }), null);
});

test('cerca: dentro de 250 m', () => {
    assert.strictEqual(estaCerca(CERCA, PLAZA_BOLIVAR), true);
    assert.strictEqual(estaCerca(LEJOS, PLAZA_BOLIVAR), false);
    assert.strictEqual(estaCerca(null, PLAZA_BOLIVAR), false);
});

test('texto', () => {
    assert.strictEqual(textoEta(null), '');
    assert.strictEqual(textoEta(12), 'Llega en ~12 min');
    assert.strictEqual(textoEta(75), 'Llega en ~1 h 15 min');
});
