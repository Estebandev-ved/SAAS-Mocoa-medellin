// Tests de api/services/uiEstado.js — hitos y consejos de Nova ya vistos.
const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeVistos, parseVistos } = require('../../api/services/uiEstado');

test('dedupe y filtra ids con formato inválido', () => {
    const r = sanitizeVistos(['a', 'a', 'b', 123, null, 'ID CON ESPACIOS', 'tip:ajustes']);
    assert.deepEqual(r, ['a', 'b', 'tip:ajustes']);
});

test('no es un array -> lista vacía', () => {
    assert.deepEqual(sanitizeVistos(null), []);
    assert.deepEqual(sanitizeVistos('no-es-array'), []);
});

test('regresión (23 sept): al llenarse el límite, se conserva el hito nuevo y se bota el más viejo', () => {
    const yaGuardados = Array.from({ length: 100 }, (_, i) => `hito${i}`);
    const nuevos = ['hito_nuevo'];
    const resultado = sanitizeVistos([...yaGuardados, ...nuevos]);

    assert.equal(resultado.length, 100);
    assert.ok(resultado.includes('hito_nuevo'), 'el hito recién marcado no debería descartarse');
    assert.ok(!resultado.includes('hito0'), 'debería botar el más viejo, no el más nuevo');
});

test('parseVistos tolera JSON roto o vacío sin tirar el proceso', () => {
    assert.deepEqual(parseVistos(null), []);
    assert.deepEqual(parseVistos('{esto no es json'), []);
    assert.deepEqual(parseVistos('{"vistos":["a","b"]}'), ['a', 'b']);
});
