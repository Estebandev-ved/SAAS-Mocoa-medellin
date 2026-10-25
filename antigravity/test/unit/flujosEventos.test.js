const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const n = (id, tipo, config = {}) => ({ id, tipo, x: 0, y: 0, config });
const c = (desde, salida, hacia) => ({ desde, salida, hacia });
const def = (...partes) => JSON.stringify({ nodos: partes[0], conexiones: partes[1] });

// Flujo "gracias por tu compra": arranca con el evento y manda un mensaje + los métodos de pago
const flujoGracias = def(
    [n('a', 'disparador', { modo: 'pedido_pagado' }), n('b', 'mensaje', { texto: 'Gracias {nombre} 🙌' }), n('c', 'info_pago', { nota: 'Envía tu comprobante' })],
    [c('a', 'default', 'b'), c('b', 'default', 'c')]
);

function montar({ flujos = [], clientes = [], enviadosHoy = 0, reciente = false, negocio = { numero_nequi: '3001112233', numero_bancolombia: null } } = {}) {
    const log = { ejecuciones: [], mensajes: [], etiquetas: [] };
    const db = {
        async execute(sql, p = []) {
            const q = sql.replace(/\s+/g, ' ').trim();
            if (q.startsWith('SELECT id, definicion FROM flujos WHERE negocio_id = ? AND activo = 1 AND evento = ?')) return [flujos.filter((f) => f.evento === p[1] && f.negocio_id === p[0])];
            if (q.startsWith("SELECT id, negocio_id, definicion, evento_dias FROM flujos WHERE activo = 1 AND evento = 'cliente_inactivo'")) return [flujos.filter((f) => f.evento === 'cliente_inactivo')];
            if (q.startsWith('SELECT id, nombre, whatsapp, acepta_marketing')) return [clientes.filter((x) => x.id === p[0])];
            if (q.startsWith('SELECT c.id, c.nombre, c.whatsapp')) return [clientes];
            if (q.startsWith('SELECT COUNT(*) AS total FROM mensajes')) return [[{ total: enviadosHoy + log.mensajes.length }]];
            if (q.startsWith('SELECT id FROM flujo_ejecuciones WHERE flujo_id = ?')) return [reciente ? [{ id: 1 }] : []];
            if (q.startsWith('SELECT etiqueta FROM etiquetas_cliente')) return [[]];
            if (q.startsWith('SELECT numero_nequi')) return [[negocio]];
            if (q.startsWith('SELECT cliente_id FROM pedidos')) return [[{ cliente_id: clientes[0] && clientes[0].id }]];
            if (q.startsWith('SELECT id, definicion FROM flujos WHERE id = ?')) return [flujos.filter((f) => f.id === p[0] && f.negocio_id === p[1] && f.activo)];
            if (q.startsWith('SELECT id, definicion, palabra_clave')) return [flujos.filter((f) => f.negocio_id === p[0] && f.activo && f.palabra_clave)];
            if (q.includes("FROM flujo_ejecuciones e JOIN flujos f")) return [[]];
            if (q.startsWith('INSERT INTO flujo_ejecuciones')) { log.ejecuciones.push(p); return [{ insertId: log.ejecuciones.length }]; }
            if (q.startsWith('INSERT INTO mensajes')) { log.mensajes.push(p); return [{}]; }
            if (q.startsWith("UPDATE flujo_ejecuciones SET estado = 'terminada'")) return [{ affectedRows: 1 }];
            if (q.startsWith('UPDATE flujo_ejecuciones SET nodo_actual')) return [{ affectedRows: 1 }];
            if (q.startsWith('INSERT IGNORE INTO etiquetas_cliente')) { log.etiquetas.push(p); return [{}]; }
            throw new Error(`Consulta no simulada: ${q.slice(0, 90)}`);
        },
    };
    const dbPath = require.resolve(path.join('..', '..', 'db', 'config'));
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
    delete require.cache[require.resolve('../../api/services/flujosEjecucion')];
    const orig = global.setTimeout; global.setTimeout = (f) => orig(f, 0);   // sin pausas reales entre envíos
    return { mod: require('../../api/services/flujosEjecucion'), log, restaurar: () => { global.setTimeout = orig; } };
}

const ana = { id: 5, nombre: 'Ana Gómez', whatsapp: '+573001112233', acepta_marketing: 1, total_gastado: 0, total_pedidos: 1 };
const flujoEvento = { id: 1, negocio_id: 7, evento: 'pedido_pagado', definicion: flujoGracias };

test('evento: arranca el flujo, personaliza y manda los métodos de pago del negocio', async () => {
    const { mod, log, restaurar } = montar({ flujos: [flujoEvento], clientes: [ana] });
    const enviados = [];
    const iniciados = await mod.dispararEvento({ negocioId: 7, clienteId: 5, evento: 'pedido_pagado', enviarA: async (neg, num, t) => enviados.push([neg, num, t]) });
    restaurar();
    assert.strictEqual(iniciados, 1);
    assert.strictEqual(enviados[0][2], 'Gracias Ana 🙌');
    assert.match(enviados[1][2], /Métodos de pago.*Nequi: \*3001112233\*.*Envía tu comprobante/s);
    assert.ok(!/Bancolombia/.test(enviados[1][2]));
    assert.ok(log.mensajes.every((m) => m[3] === 'flujo_proactivo'));
    assert.strictEqual(log.ejecuciones.length, 1);
});

test('evento: no escribe a quien no aceptó marketing, ni si ya pasó por el flujo hoy, ni con el tope alcanzado', async () => {
    for (const config of [
        { clientes: [{ ...ana, acepta_marketing: 0 }] },
        { clientes: [ana], reciente: true },
        { clientes: [ana], enviadosHoy: 100 },
    ]) {
        const { mod, restaurar } = montar({ flujos: [flujoEvento], ...config });
        const enviados = [];
        const r = await mod.dispararEvento({ negocioId: 7, clienteId: 5, evento: 'pedido_pagado', enviarA: async (...a) => enviados.push(a) });
        restaurar();
        assert.strictEqual(r, 0);
        assert.strictEqual(enviados.length, 0);
    }
});

test('evento: sin flujos para ese evento no consulta nada más; dispararEventoPedido nunca lanza', async () => {
    const { mod, restaurar } = montar({ flujos: [flujoEvento], clientes: [ana] });
    assert.strictEqual(await mod.dispararEvento({ negocioId: 7, clienteId: 5, evento: 'pedido_entregado', enviarA: async () => {} }), 0);
    // un fallo del envío no se propaga
    const r = await mod.dispararEventoPedido({ negocioId: 7, pedidoId: 1, evento: 'pedido_pagado', enviarA: async () => { throw new Error('WhatsApp caído'); } });
    restaurar();
    assert.strictEqual(r, 0);
});

test('clientes inactivos: arranca el flujo para cada cliente que devuelve la búsqueda', async () => {
    const inactivo = { ...flujoEvento, evento: 'cliente_inactivo', evento_dias: 30 };
    const { mod, log, restaurar } = montar({ flujos: [inactivo], clientes: [ana, { ...ana, id: 6, nombre: 'Luis' }] });
    const enviados = [];
    const r = await mod.revisarInactivos(async (neg, num, t) => enviados.push(t));
    restaurar();
    assert.strictEqual(r, 2);
    assert.strictEqual(enviados.filter((t) => t.startsWith('Gracias')).length, 2);
    assert.strictEqual(log.ejecuciones.length, 2);
});

test('saltar: el primer flujo pasa al segundo, y dos flujos que se llaman en círculo se cortan', async () => {
    const A = { id: 1, negocio_id: 7, activo: 1, palabra_clave: 'hola', evento: null, definicion: def([n('a', 'disparador', { palabra: 'hola' }), n('b', 'mensaje', { texto: 'Desde A' }), n('c', 'saltar', { flujo_id: 2 })], [c('a', 'default', 'b'), c('b', 'default', 'c')]) };
    const B = { id: 2, negocio_id: 7, activo: 1, palabra_clave: null, evento: null, definicion: def([n('a', 'disparador', { palabra: 'zzz' }), n('b', 'mensaje', { texto: 'Desde B' })], [c('a', 'default', 'b')]) };
    let { mod, log, restaurar } = montar({ flujos: [A, B] });
    const dicho = [];
    const r = await mod.manejarMensaje({ negocioId: 7, cliente: ana, texto: 'hola', esNuevo: false, enviar: async (t) => dicho.push(t) });
    restaurar();
    assert.deepStrictEqual(dicho, ['Desde A', 'Desde B']);
    assert.strictEqual(r.manejado, true);
    assert.strictEqual(log.ejecuciones.length, 2);

    // A salta a B y B salta a A: se corta en MAX_SALTOS
    const B2 = { ...B, definicion: def([n('a', 'disparador', { palabra: 'zzz' }), n('b', 'mensaje', { texto: 'Desde B' }), n('c', 'saltar', { flujo_id: 1 })], [c('a', 'default', 'b'), c('b', 'default', 'c')]) };
    ({ mod, log, restaurar } = montar({ flujos: [A, B2] }));
    const dicho2 = [];
    await mod.manejarMensaje({ negocioId: 7, cliente: ana, texto: 'hola', esNuevo: false, enviar: async (t) => dicho2.push(t) });
    restaurar();
    assert.ok(dicho2.length <= mod.MAX_SALTOS + 1 && dicho2.length >= 2, `mensajes: ${dicho2.length}`);
    assert.strictEqual(log.ejecuciones.length, mod.MAX_SALTOS + 1);
});
