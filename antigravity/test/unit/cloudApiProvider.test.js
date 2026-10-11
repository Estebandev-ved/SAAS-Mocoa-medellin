const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const CloudApi = require('../../instance-manager/providers/CloudApiProvider');

const webhook = (mensaje) => ({
    entry: [{ changes: [{ value: { metadata: { phone_number_id: 'PN1' }, messages: [mensaje] } }] }],
});

test('normalizarWebhook convierte texto a la forma que usa el handler', () => {
    const [r] = CloudApi.normalizarWebhook(webhook({ from: '573001112233', id: 'w1', timestamp: '1700000000', type: 'text', text: { body: 'hola' } }));
    assert.equal(r.phoneNumberId, 'PN1');
    assert.equal(r.msg.key.remoteJid, '573001112233@s.whatsapp.net');
    assert.equal(r.msg.key.fromMe, false);
    assert.equal(r.msg.message.conversation, 'hola');
    assert.equal(r.msg.messageTimestamp, 1700000000);
});

test('normalizarWebhook soporta imagen y respuesta de botón; ignora tipos desconocidos', () => {
    const [img] = CloudApi.normalizarWebhook(webhook({ from: '57300', id: 'w2', timestamp: '1', type: 'image', image: { id: 'M1', caption: 'pago' } }));
    assert.equal(img.msg.message.imageMessage.mediaId, 'M1');
    assert.equal(img.msg.message.imageMessage.caption, 'pago');

    const [btn] = CloudApi.normalizarWebhook(webhook({ from: '57300', id: 'w3', timestamp: '1', type: 'interactive', interactive: { button_reply: { id: 'si' } } }));
    assert.equal(btn.msg.message.buttonsResponseMessage.selectedButtonId, 'si');

    assert.deepEqual(CloudApi.normalizarWebhook(webhook({ from: '57300', id: 'w4', timestamp: '1', type: 'sticker' })), []);
    assert.deepEqual(CloudApi.normalizarWebhook({}), []);
});

test('firmaValida acepta la firma de Meta y rechaza alteraciones', () => {
    const cuerpo = Buffer.from('{"entry":[]}');
    const firma = 'sha256=' + crypto.createHmac('sha256', 'secreto').update(cuerpo).digest('hex');
    assert.equal(CloudApi.firmaValida(cuerpo, firma, 'secreto'), true);
    assert.equal(CloudApi.firmaValida(cuerpo, firma, 'otro'), false);
    assert.equal(CloudApi.firmaValida(Buffer.from('{"entry":[1]}'), firma, 'secreto'), false);
    assert.equal(CloudApi.firmaValida(cuerpo, undefined, 'secreto'), false);
    assert.equal(CloudApi.firmaValida(cuerpo, firma, ''), false);
});

test('despachar enruta el mensaje al negocio dueño del phone_number_id', async () => {
    const recibidos = [];
    const prov = new CloudApi({
        negocioId: 7,
        credenciales: { phoneNumberId: 'PN1', accessToken: 'tok', displayPhone: '573000000000' },
        onMessage: async (sock, msg) => recibidos.push({ sock, msg }),
        onConnected: () => {},
        onDisconnected: () => {},
    });
    await prov.start();
    assert.equal(prov.isReady(), true);
    await CloudApi.despachar(webhook({ from: '57300', id: 'w5', timestamp: '1', type: 'text', text: { body: 'x' } }));
    assert.equal(recibidos.length, 1);
    assert.equal(recibidos[0].sock, prov.sock);

    await prov.stop();
    await CloudApi.despachar(webhook({ from: '57300', id: 'w6', timestamp: '1', type: 'text', text: { body: 'y' } }));
    assert.equal(recibidos.length, 1, 'tras stop() ya no recibe');
});

test('start() sin credenciales falla con mensaje claro', async () => {
    const prov = new CloudApi({ negocioId: 9, credenciales: {}, onMessage() {}, onConnected() {}, onDisconnected() {} });
    await assert.rejects(() => prov.start(), /faltan credenciales/);
});

test('el sock adaptado envía texto por Graph API', async () => {
    const llamadas = [];
    const original = global.fetch;
    global.fetch = async (url, opts) => { llamadas.push({ url, opts }); return { ok: true, json: async () => ({ ok: 1 }) }; };
    try {
        const prov = new CloudApi({ negocioId: 1, credenciales: { phoneNumberId: 'PN9', accessToken: 'T' }, onMessage() {}, onConnected() {}, onDisconnected() {} });
        await prov.sock.sendMessage('573001112233@s.whatsapp.net', { text: 'hola' });
        assert.match(llamadas[0].url, /\/PN9\/messages$/);
        const body = JSON.parse(llamadas[0].opts.body);
        assert.equal(body.to, '573001112233');
        assert.equal(body.text.body, 'hola');
        assert.equal(llamadas[0].opts.headers.Authorization, 'Bearer T');
    } finally {
        global.fetch = original;
    }
});
