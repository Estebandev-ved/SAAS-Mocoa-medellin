const test = require('node:test');
const assert = require('node:assert/strict');
const { validarPassword, huellaPassword } = require('../../api/services/passwordPolicy');

test('rechaza contraseñas cortas, sin números, sin letras o comunes', () => {
    assert.ok(validarPassword('Ab1'));
    assert.ok(validarPassword('sololetrasaqui'));
    assert.ok(validarPassword('1234567890123'));
    assert.ok(validarPassword('password1'));
    assert.ok(validarPassword('a'.repeat(60) + '1'.repeat(20)));
    assert.ok(validarPassword(undefined));
});

test('rechaza una contraseña igual al correo', () => {
    assert.ok(validarPassword('Dueno2024x', { email: 'dueno2024x' }));
});

test('acepta una contraseña razonable', () => {
    assert.equal(validarPassword('MiTienda2026'), null);
});

test('la huella cambia cuando cambia el hash', () => {
    assert.notEqual(huellaPassword('hash-a'), huellaPassword('hash-b'));
    assert.equal(huellaPassword('hash-a'), huellaPassword('hash-a'));
});
