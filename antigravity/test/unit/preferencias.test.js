const test = require('node:test');
const assert = require('node:assert');
const { leerPreferencias, sanearPreferencias, parseUiEstado, DEFAULT } = require('../../api/services/preferencias');

test('sin nada guardado devuelve los valores por defecto', () => {
    assert.deepStrictEqual(leerPreferencias(null), DEFAULT);
    assert.deepStrictEqual(leerPreferencias('{no es json'), DEFAULT);
});

test('lee lo guardado e ignora valores fuera del catálogo', () => {
    const raw = JSON.stringify({ vistos: ['a'], preferencias: { moneda: 'USD', formato_fecha: 'raro' } });
    const p = leerPreferencias(raw);
    assert.strictEqual(p.moneda, 'USD');
    assert.strictEqual(p.formato_fecha, DEFAULT.formato_fecha);
});

test('sanear: solo claves conocidas con valores del catálogo', () => {
    assert.deepStrictEqual(sanearPreferencias({ moneda: 'EUR', otra: 'x' }).valores, { moneda: 'EUR' });
    assert.ok(sanearPreferencias({ moneda: 'BTC' }).error);
    assert.ok(sanearPreferencias({ zona_horaria: { a: 1 } }).error);
    assert.ok(sanearPreferencias({}).error);
});

test('parseUiEstado tolera basura', () => {
    assert.deepStrictEqual(parseUiEstado('[1,2]'), {});
    assert.deepStrictEqual(parseUiEstado(undefined), {});
});
