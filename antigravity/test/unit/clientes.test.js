const test = require('node:test');
const assert = require('node:assert');
const { normalizarWhatsapp, sanearNuevoCliente } = require('../../api/services/clientes');

test('whatsapp: completa el 57 a celulares colombianos y rechaza lo que no es teléfono', () => {
    assert.strictEqual(normalizarWhatsapp('300 123 4567'), '+573001234567');
    assert.strictEqual(normalizarWhatsapp('+57 (300) 123-4567'), '+573001234567');
    assert.strictEqual(normalizarWhatsapp('573001234567'), '+573001234567');
    assert.strictEqual(normalizarWhatsapp('+1 415 555 2671'), '+14155552671');
    assert.strictEqual(normalizarWhatsapp('12345'), null);
    assert.strictEqual(normalizarWhatsapp(''), null);
    assert.strictEqual(normalizarWhatsapp(3001234567), null);
    assert.strictEqual(normalizarWhatsapp('1'.repeat(16)), null);
});

test('nuevo cliente: exige nombre y whatsapp, el correo es opcional pero válido', () => {
    assert.deepStrictEqual(sanearNuevoCliente({ nombre: '  Ana ', whatsapp: '3001234567' }).valores, { nombre: 'Ana', whatsapp: '+573001234567', email: null });
    assert.strictEqual(sanearNuevoCliente({ nombre: 'Ana', whatsapp: '3001234567', email: 'ANA@Correo.com ' }).valores.email, 'ana@correo.com');
    assert.ok(sanearNuevoCliente({ nombre: 'A', whatsapp: '3001234567' }).error);
    assert.ok(sanearNuevoCliente({ nombre: 'Ana', whatsapp: 'hola' }).error);
    assert.ok(sanearNuevoCliente({ nombre: 'Ana', whatsapp: '3001234567', email: 'no-es-correo' }).error);
    assert.ok(sanearNuevoCliente({ nombre: 'x'.repeat(101), whatsapp: '3001234567' }).error);
    assert.ok(sanearNuevoCliente(null).error);
});
