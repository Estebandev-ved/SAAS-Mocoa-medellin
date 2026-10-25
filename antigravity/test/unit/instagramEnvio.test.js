const test = require('node:test');
const assert = require('node:assert');
const { esClienteInstagram, idDeInstagram, enviarInstagram, explicarErrorInstagram, PREFIJO_CLIENTE } = require('../../api/services/instagramEnvio');
const { cifrarSecreto } = require('../../api/services/secretos');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';

test('reconoce clientes de Instagram y extrae su id', () => {
    assert.strictEqual(esClienteInstagram('ig_17841400000000001'), true);
    assert.strictEqual(esClienteInstagram('instagram_123'), true);      // prefijo viejo
    assert.strictEqual(esClienteInstagram('+573001234567'), false);
    assert.strictEqual(esClienteInstagram(null), false);
    assert.strictEqual(idDeInstagram('ig_17841400000000001'), '17841400000000001');
    assert.strictEqual(idDeInstagram('instagram_55'), '55');
    assert.ok((PREFIJO_CLIENTE + '17841400000000001').length <= 20);    // cabe en clientes.whatsapp VARCHAR(20)
});

const bd = (token) => ({ execute: async () => [[{ instagram_token: token }]] });

test('envía con el token descifrado y devuelve ok', async () => {
    const llamadas = [];
    global.fetch = async (url, op) => { llamadas.push([url, JSON.parse(op.body)]); return { ok: true }; };
    const r = await enviarInstagram(bd(cifrarSecreto('MI-TOKEN')), 7, '999', 'Hola');
    assert.deepStrictEqual(r, { ok: true });
    assert.match(llamadas[0][0], /\/me\/messages\?access_token=MI-TOKEN$/);
    assert.deepStrictEqual(llamadas[0][1], { recipient: { id: '999' }, message: { text: 'Hola' } });
});

test('sin token, sin destinatario o con errores de Meta explica el motivo', async () => {
    assert.strictEqual((await enviarInstagram(bd(null), 7, '999', 'Hola')).motivo, 'no_conectado');
    assert.strictEqual((await enviarInstagram(bd('x'), 7, '', 'Hola')).motivo, 'sin_destinatario');

    global.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'This message is sent outside of allowed window.' } }) });
    const ventana = await enviarInstagram(bd('tok'), 7, '999', 'Hola');
    assert.strictEqual(ventana.motivo, 'ventana_vencida');
    assert.match(explicarErrorInstagram(ventana), /24 horas/);

    global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'Invalid OAuth access token' } }) });
    assert.strictEqual((await enviarInstagram(bd('tok'), 7, '999', 'Hola')).motivo, 'token_invalido');

    global.fetch = async () => { throw new Error('ECONNRESET'); };
    assert.strictEqual((await enviarInstagram(bd('tok'), 7, '999', 'Hola')).motivo, 'sin_conexion');
});

test('recorta mensajes muy largos y usa un token viejo en texto plano', async () => {
    let cuerpo;
    global.fetch = async (url, op) => { cuerpo = JSON.parse(op.body); return { ok: true }; };
    await enviarInstagram(bd('token-plano-viejo'), 7, '1', 'x'.repeat(5000));
    assert.strictEqual(cuerpo.message.text.length, 1000);
});
