// Smoke test: el camino más importante de todo el producto — un cliente le
// escribe al bot y termina con un pedido real guardado. Va por
// orchestrator.procesarMensaje() directo (no por HTTP) porque ese es el punto
// de entrada real que usa el bot — no hay una ruta REST para "crear pedido"
// (el POST /pedidos que llama agency-platform-react/services/api.js no
// existe en el backend; nadie en la UI lo usa, ver DAILY_LOG 26 sept).
// Necesita MySQL accesible (mismas variables MYSQL_* que usa la API).
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../../db/config');
const orchestrator = require('../../instance-manager/agents/orchestrator');

const SUFIJO = Date.now();
const TELEFONO = `+57300${String(SUFIJO).slice(-7)}`;

test('un cliente pide un producto del catálogo y el pedido queda guardado', async (t) => {
    let negocioId, clienteId, productoId;

    await t.test('preparar negocio de prueba con catálogo y horario 24h', async () => {
        const [neg] = await db.execute(
            `INSERT INTO negocios (nombre, email_dueno, password, plan, rol, suscripcion_activa, horario_activo_inicio, horario_activo_fin)
             VALUES (?, ?, 'x', 'starter', 'negocio', 1, '00:00', '23:59')`,
            [`Smoke Test ${SUFIJO}`, `smoke-${SUFIJO}@test.local`]
        );
        negocioId = neg.insertId;

        const [prod] = await db.execute(
            `INSERT INTO productos (negocio_id, nombre, precio, activo) VALUES (?, 'Producto de prueba', 15000, 1)`,
            [negocioId]
        );
        productoId = prod.insertId;

        const [cli] = await db.execute(
            `INSERT INTO clientes (negocio_id, whatsapp, nombre) VALUES (?, ?, 'Cliente Smoke')`,
            [negocioId, TELEFONO]
        );
        clienteId = cli.insertId;
    });

    await t.test('el bot responde y crea el pedido', async () => {
        const r = await orchestrator.procesarMensaje('quiero un producto de prueba', negocioId, clienteId, [], null);
        assert.ok(r.respuesta, 'el bot no devolvió respuesta');
        assert.ok(r.pedido_creado?.pedido_id, `no se creó el pedido — respuesta del bot: ${r.respuesta}`);

        const [pedidos] = await db.execute(
            'SELECT id, negocio_id, total FROM pedidos WHERE id = ?',
            [r.pedido_creado.pedido_id]
        );
        assert.equal(pedidos.length, 1, 'el pedido no quedó guardado en la base');
        assert.equal(pedidos[0].negocio_id, negocioId);
        assert.equal(Number(pedidos[0].total), 15000);
    });

    await t.test('limpiar datos de prueba', async () => {
        await db.execute('DELETE FROM items_pedido WHERE pedido_id IN (SELECT id FROM pedidos WHERE negocio_id = ?)', [negocioId]);
        await db.execute('DELETE FROM pedidos WHERE negocio_id = ?', [negocioId]);
        await db.execute('DELETE FROM productos WHERE negocio_id = ?', [negocioId]);
        await db.execute('DELETE FROM clientes WHERE negocio_id = ?', [negocioId]);
        await db.execute('DELETE FROM negocios WHERE id = ?', [negocioId]);
    });
});
