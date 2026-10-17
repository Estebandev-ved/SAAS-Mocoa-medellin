const test = require('node:test');
const assert = require('node:assert');
const { sanearPerfil, COLUMNAS_PERFIL } = require('../../api/services/perfilNegocio');

test('ignora campos no permitidos (password, rol, plan)', () => {
    const { valores } = sanearPerfil({ nombre: 'Mi tienda', password: 'x', rol: 'admin', plan: 'enterprise' });
    assert.deepStrictEqual(valores, { nombre: 'Mi tienda' });
});

test('rechaza objetos y textos demasiado largos', () => {
    assert.ok(sanearPerfil({ nombre: { $ne: 1 } }).error);
    assert.ok(sanearPerfil({ descripcion_negocio: 'a'.repeat(1001) }).error);
});

test('numéricos: acepta enteros, rechaza basura', () => {
    assert.strictEqual(sanearPerfil({ numero_empleados: '10' }).valores.numero_empleados, 10);
    assert.ok(sanearPerfil({ numero_empleados: 'abc' }).error);
    assert.strictEqual(sanearPerfil({ numero_empleados: '' }).valores.numero_empleados, null);
});

test('sitio web exige http(s) y métodos de pago van como JSON', () => {
    assert.ok(sanearPerfil({ sitio_web: 'javascript:alert(1)' }).error);
    assert.ok(sanearPerfil({ sitio_web: 'https://a.co' }).valores);
    assert.strictEqual(sanearPerfil({ metodos_pago_activos: ['nequi'] }).valores.metodos_pago_activos, '["nequi"]');
    assert.ok(sanearPerfil({ metodos_pago_activos: 'nequi' }).error);
});

test('las columnas de respuesta no incluyen secretos', () => {
    assert.ok(!/password|secret|token|totp/i.test(COLUMNAS_PERFIL));
});

test('tipo_negocio es un ENUM: vacío pasa a null y valores desconocidos se rechazan', () => {
    assert.strictEqual(sanearPerfil({ tipo_negocio: '' }).valores.tipo_negocio, null);
    assert.strictEqual(sanearPerfil({ tipo_negocio: '  ' }).valores.tipo_negocio, null);
    assert.strictEqual(sanearPerfil({ tipo_negocio: 'restaurante' }).valores.tipo_negocio, 'restaurante');
    assert.ok(sanearPerfil({ tipo_negocio: 'panaderia' }).error);
});
