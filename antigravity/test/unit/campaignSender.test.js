const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Se simulan la base de datos y el envío de WhatsApp: estas pruebas no
// necesitan MySQL ni el instance-manager.
const raiz = path.join(__dirname, '..', '..');
const dbPath = require.resolve(path.join(raiz, 'db', 'config'));
const svcPath = require.resolve(path.join(raiz, 'api', 'services', 'automationsService'));
const senderPath = require.resolve(path.join(raiz, 'api', 'services', 'campaignSender'));

let consultas;
let respuestas;
let enviados;

function cargar() {
    consultas = [];
    enviados = [];
    require.cache[dbPath] = {
        id: dbPath, filename: dbPath, loaded: true,
        exports: {
            execute: async (sql, params) => {
                consultas.push({ sql, params });
                const r = respuestas.shift();
                return typeof r === 'function' ? r(sql, params) : r;
            },
        },
    };
    require.cache[svcPath] = {
        id: svcPath, filename: svcPath, loaded: true,
        exports: { enviarWhatsApp: async (neg, num, msg) => { enviados.push({ neg, num, msg }); return true; } },
    };
    delete require.cache[senderPath];
    return require(senderPath);
}

test('el tope por campaña es 200 por defecto', () => {
    respuestas = [];
    assert.equal(cargar().MAX_DESTINATARIOS, 200);
});

test('todos los segmentos filtran por acepta_marketing', async () => {
    for (const segmento of ['todos', 'inactivos', 'nuevos']) {
        respuestas = [[[]]];
        const s = cargar();
        await s.destinatarios(7, segmento, { dias: 15 });
        assert.match(consultas[0].sql, /acepta_marketing = 1/, segmento);
        assert.equal(consultas[0].params[0], 7);
    }
});

test('inactivos calcula la última compra desde pedidos con los días configurados', async () => {
    respuestas = [[[]]];
    const s = cargar();
    await s.destinatarios(3, 'inactivos', JSON.stringify({ dias: 45 }));
    assert.match(consultas[0].sql, /FROM pedidos/);
    assert.deepEqual(consultas[0].params, [3, 3, 45]);
});

test('compraron_x sin producto no envía a nadie y no consulta la base', async () => {
    respuestas = [];
    const s = cargar();
    assert.deepEqual(await s.destinatarios(1, 'compraron_x', {}), []);
    assert.equal(consultas.length, 0);
});

test('un JSON de configuración dañado no rompe el segmento', async () => {
    respuestas = [[[]]];
    const s = cargar();
    await s.destinatarios(1, 'nuevos', '{no-es-json');
    assert.deepEqual(consultas[0].params, [1, 30]);
});

test('procesarCampanasPendientes envía como máximo 200 y la cierra', async () => {
    process.env.CAMPANA_PAUSA_MIN_MS = '0';
    process.env.CAMPANA_PAUSA_MAX_MS = '0';
    const clientes = Array.from({ length: 250 }, (_, i) => ({ id: i, whatsapp: `+57300${i}` }));
    const camp = { id: 9, negocio_id: 4, mensaje: 'Hola', segmento: 'todos', segmento_config: '{}' };
    // Intercala: por cada cliente hay un SELECT estado y luego un UPDATE.
    const ordenadas = [
        [[camp]],              // campañas pendientes
        [{ affectedRows: 1 }], // reclamo atómico
        [clientes],            // destinatarios
        [{}],                  // total_destinatarios
    ];
    for (let i = 0; i < 200; i++) ordenadas.push([[{ estado: 'enviando' }]], [{}]);
    ordenadas.push([{}]);
    respuestas = ordenadas;

    const s = cargar();
    await s.procesarCampanasPendientes();
    assert.equal(enviados.length, 200);
    assert.equal(enviados[0].num, '+573000');
    assert.equal(enviados.at(-1).num, '+57300199');
    assert.match(consultas.at(-1).sql, /estado = 'completada'/);
});

test('si la campaña se cancela mientras se envía, se detiene', async () => {
    process.env.CAMPANA_PAUSA_MIN_MS = '0';
    process.env.CAMPANA_PAUSA_MAX_MS = '0';
    const clientes = Array.from({ length: 5 }, (_, i) => ({ id: i, whatsapp: `+5730${i}` }));
    const camp = { id: 2, negocio_id: 1, mensaje: 'x', segmento: 'todos', segmento_config: '{}' };
    respuestas = [
        [[camp]], [{ affectedRows: 1 }], [clientes], [{}],
        [[{ estado: 'enviando' }]], [{}],   // 1.er cliente: se envía
        [[{ estado: 'cancelada' }]],        // 2.º: ya cancelada
        [{}],                               // cierre
    ];
    const s = cargar();
    await s.procesarCampanasPendientes();
    assert.equal(enviados.length, 1);
});

test('si otra instancia ya reclamó la campaña, no se envía', async () => {
    const camp = { id: 3, negocio_id: 1, mensaje: 'x', segmento: 'todos', segmento_config: '{}' };
    respuestas = [[[camp]], [{ affectedRows: 0 }]];
    const s = cargar();
    await s.procesarCampanasPendientes();
    assert.equal(enviados.length, 0);
});
