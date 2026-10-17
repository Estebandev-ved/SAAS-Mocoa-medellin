const test = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'test-secret';
const t = require('../../api/services/totp');

test('coincide con el vector de prueba del RFC 6238 (SHA-1, secreto "12345678901234567890")', () => {
    const secreto = t.base32Encode(Buffer.from('12345678901234567890'));
    // T=59s -> paso 1 -> 94287082 (8 dígitos); con 6 dígitos son los últimos 6: 287082
    assert.equal(t.codigoEnPaso(secreto, 1), '287082');
    // T=1111111109 -> paso 37037036 -> 07081804 -> 081804
    assert.equal(t.codigoEnPaso(secreto, 37037036), '081804');
});

test('verificarCodigo acepta ±1 paso, rechaza lejos y no deja reusar un código', () => {
    const s = t.generarSecreto();
    const ahora = 1_700_000_000_000;
    const paso = t.pasoActual(ahora);
    assert.equal(t.verificarCodigo(s, t.codigoEnPaso(s, paso), { ahoraMs: ahora }), paso);
    assert.equal(t.verificarCodigo(s, t.codigoEnPaso(s, paso - 1), { ahoraMs: ahora }), paso - 1);
    assert.equal(t.verificarCodigo(s, t.codigoEnPaso(s, paso + 5), { ahoraMs: ahora }), null);
    assert.equal(t.verificarCodigo(s, t.codigoEnPaso(s, paso), { ahoraMs: ahora, ultimoPaso: paso }), null);
    assert.equal(t.verificarCodigo(s, 'abcdef', { ahoraMs: ahora }), null);
    assert.equal(t.verificarCodigo(s, undefined, { ahoraMs: ahora }), null);
});

test('cifra y descifra el secreto; un texto alterado falla', () => {
    const s = t.generarSecreto();
    const c = t.cifrar(s);
    assert.notEqual(c, s);
    assert.equal(t.descifrar(c), s);
    assert.throws(() => t.descifrar(c.slice(0, -2) + '00'));
});

test('códigos de respaldo: sirven una sola vez', () => {
    const { claros, hashes } = t.generarCodigosRespaldo(8);
    assert.equal(claros.length, 8);
    const resto = t.consumirCodigoRespaldo(hashes, claros[3].toLowerCase());
    assert.equal(resto.length, 7);
    assert.equal(t.consumirCodigoRespaldo(resto, claros[3]), null);
    assert.equal(t.consumirCodigoRespaldo(hashes, 'AAAA-AAAA'), null);
});
