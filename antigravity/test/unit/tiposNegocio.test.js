const test = require('node:test');
const assert = require('node:assert');
const { TIPOS_NEGOCIO, esTipoValido, familiaDe } = require('../../api/services/tiposNegocio');

test('los 7 tipos originales siguen siendo válidos y son su propia familia', () => {
    for (const t of ['restaurante', 'retail', 'servicios', 'salud', 'inmobiliaria', 'educacion', 'otro']) {
        assert.ok(esTipoValido(t));
        assert.strictEqual(familiaDe(t), t);
    }
});

test('granizados hereda la familia restaurante (cocina y domicilios)', () => {
    assert.strictEqual(familiaDe('granizados'), 'restaurante');
    assert.strictEqual(familiaDe('ropa'), 'retail');
    assert.strictEqual(familiaDe('barberia'), 'servicios');
});

test('rechaza valores que no son del catálogo (incluye claves heredadas de Object)', () => {
    assert.ok(!esTipoValido('')); assert.ok(!esTipoValido(null)); assert.ok(!esTipoValido('toString'));
    assert.strictEqual(familiaDe('nada'), null);
});

test('todos los valores caben en VARCHAR(40) y no se repiten', () => {
    assert.ok(TIPOS_NEGOCIO.every((t) => t.length <= 40));
    assert.strictEqual(new Set(TIPOS_NEGOCIO).size, TIPOS_NEGOCIO.length);
});
