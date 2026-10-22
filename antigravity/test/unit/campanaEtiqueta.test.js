const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

test('segmento por etiqueta: filtra por la etiqueta normalizada y sin etiqueta no devuelve a nadie', async () => {
    const consultas = [];
    const db = { async execute(sql, params) { consultas.push({ sql: sql.replace(/\s+/g, ' '), params }); return [[{ id: 1, whatsapp: '+57300', nombre: 'Ana' }]]; } };
    const dbPath = require.resolve(path.join('..', '..', 'db', 'config'));
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
    const { destinatarios } = require('../../api/services/campaignSender');

    assert.deepStrictEqual(await destinatarios(7, 'etiqueta', {}), []);
    assert.strictEqual(consultas.length, 0);

    const r = await destinatarios(7, 'etiqueta', { etiqueta: ' VIP Gold ' });
    assert.strictEqual(r.length, 1);
    assert.match(consultas[0].sql, /acepta_marketing = 1/);
    assert.match(consultas[0].sql, /etiquetas_cliente WHERE negocio_id = \? AND etiqueta = \?/);
    assert.deepStrictEqual(consultas[0].params, [7, 7, 'vip_gold']);
});
