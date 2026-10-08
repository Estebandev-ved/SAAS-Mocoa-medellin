const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.EFIPAY_WEBHOOK_TOKEN = 'token-de-prueba';
const { firmaValida, clasificarEstado } = require('../../api/services/efipay');

const firmar = (cuerpo, secreto = 'token-de-prueba') =>
    crypto.createHmac('sha256', secreto).update(cuerpo).digest('hex');

test('firmaValida acepta la firma HMAC-SHA256 correcta del cuerpo', () => {
    const cuerpo = Buffer.from('{"transaction":{"status":"Aprobada"}}');
    assert.equal(firmaValida(firmar(cuerpo), cuerpo), true);
});

test('firmaValida rechaza firma de otro secreto, cuerpo alterado, largo distinto y vacío', () => {
    const cuerpo = Buffer.from('{"a":1}');
    assert.equal(firmaValida(firmar(cuerpo, 'otro-secreto'), cuerpo), false);
    assert.equal(firmaValida(firmar(cuerpo), Buffer.from('{"a":2}')), false);
    assert.equal(firmaValida('abc', cuerpo), false);
    assert.equal(firmaValida(undefined, cuerpo), false);
});

test('firmaValida rechaza todo si no hay EFIPAY_WEBHOOK_TOKEN configurado', () => {
    const guardado = process.env.EFIPAY_WEBHOOK_TOKEN;
    delete process.env.EFIPAY_WEBHOOK_TOKEN;
    const cuerpo = Buffer.from('{}');
    assert.equal(firmaValida(firmar(cuerpo, ''), cuerpo), false);
    process.env.EFIPAY_WEBHOOK_TOKEN = guardado;
});

test('clasificarEstado normaliza los estados de Efipay', () => {
    for (const s of ['Aprobada', 'aprobado', 'PAGADO', 'success']) assert.equal(clasificarEstado(s), 'aprobado');
    for (const s of ['Rechazada', 'fallida', 'rejected', 'FAILED']) assert.equal(clasificarEstado(s), 'rechazado');
    for (const s of ['Pendiente', 'en proceso', '', undefined, null]) assert.equal(clasificarEstado(s), 'pendiente');
});
