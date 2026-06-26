/**
 * Script de prueba del flujo completo de Domicilios
 * Crea un pedido de prueba, un domicilio con tracking token,
 * y simula todo el ciclo.
 * 
 * Uso: node test-delivery-flow.js
 */
require('dotenv').config();
const db = require('./db/config');
const crypto = require('crypto');

function generarTrackingToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function testFlow() {
    console.log('🧪 INICIANDO PRUEBA DE FLUJO DE DOMICILIOS\n');

    try {
        // 1. Verificar que existe el domiciliario de prueba
        const [drivers] = await db.execute(
            'SELECT id, nombre, telefono FROM domiciliarios WHERE negocio_id = 1 AND activo = 1'
        );
        console.log(`✅ Domiciliarios encontrados: ${drivers.length}`);
        drivers.forEach(d => console.log(`   ID:${d.id} | ${d.nombre} | ${d.telefono}`));

        // 2. Verificar módulo activo
        const [modulos] = await db.execute(
            "SELECT activo, config FROM negocio_modulos WHERE negocio_id = 1 AND modulo_name = 'domicilios'"
        );
        console.log(`\n✅ Módulo domicilios activo: ${modulos.length > 0 && modulos[0].activo}`);
        if (modulos[0]?.config) console.log(`   Config: ${JSON.stringify(modulos[0].config)}`);

        // 3. Obtener un cliente de prueba
        let [clientes] = await db.execute(
            'SELECT id, nombre, whatsapp FROM clientes WHERE negocio_id = 1 LIMIT 1'
        );
        let clienteId;
        if (clientes.length === 0) {
            const [r] = await db.execute(
                "INSERT INTO clientes (negocio_id, nombre, whatsapp) VALUES (1, 'Cliente Prueba', '+573001234567')"
            );
            clienteId = r.insertId;
            console.log(`\n✅ Cliente de prueba creado ID:${clienteId}`);
        } else {
            clienteId = clientes[0].id;
            console.log(`\n✅ Cliente existente: ${clientes[0].nombre} | ${clientes[0].whatsapp}`);
        }

        // 4. Obtener un producto de prueba
        let [productos] = await db.execute(
            'SELECT id, nombre, precio FROM productos WHERE negocio_id = 1 AND activo = 1 LIMIT 1'
        );
        if (productos.length === 0) {
            const [r] = await db.execute(
                "INSERT INTO productos (negocio_id, nombre, precio, stock, activo) VALUES (1, 'Producto Test', 25000, 100, 1)"
            );
            productos = [{ id: r.insertId, nombre: 'Producto Test', precio: 25000 }];
            console.log(`\n✅ Producto de prueba creado ID:${productos[0].id}`);
        }

        // 5. Crear pedido de prueba CON dirección de entrega
        const numeroPedido = `TEST-${Date.now().toString().slice(-6)}`;
        const [pedido] = await db.execute(
            `INSERT INTO pedidos (negocio_id, cliente_id, numero_pedido, estado, subtotal, total, direccion_entrega)
             VALUES (1, ?, ?, 'pago_confirmado', ?, ?, 'Calle 123 #45-67, Mocoa, Putumayo')`,
            [clienteId, numeroPedido, productos[0].precio, productos[0].precio]
        );
        const pedidoId = pedido.insertId;

        await db.execute(
            `INSERT INTO items_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
             VALUES (?, ?, 1, ?, ?)`,
            [pedidoId, productos[0].id, productos[0].precio, productos[0].precio]
        );

        console.log(`\n✅ Pedido creado: ${numeroPedido} | Total: $${productos[0].precio.toLocaleString()}`);
        console.log(`   Dirección: Calle 123 #45-67, Mocoa, Putumayo`);

        // 6. Crear domicilio con tracking token
        const trackingToken = generarTrackingToken();
        await db.execute(
            `INSERT INTO domicilios (negocio_id, pedido_id, estado, tarifa_envio, tracking_token)
             VALUES (1, ?, 'pendiente', 5000, ?)`,
            [pedidoId, trackingToken]
        );

        console.log(`\n✅ Domicilio creado con tracking token:`);
        console.log(`   🔗 http://localhost:5177/delivery/track/${trackingToken}`);

        // 7. Mostrar resumen
        console.log(`\n📋 RESUMEN - FLUJO COMPLETO:`);
        console.log(`   1. Cliente: ID ${clienteId}`);
        console.log(`   2. Pedido: ${numeroPedido} (ID ${pedidoId})`);
        console.log(`   3. Tracking: ${trackingToken}`);
        console.log(`   4. Link cliente: http://localhost:5177/delivery/track/${trackingToken}`);
        console.log(`   5. Domiciliario disponible: ${drivers[0]?.nombre || 'N/A'} (tel: ${drivers[0]?.telefono || 'N/A'})`);
        console.log(``);
        console.log(`👉 Próximos pasos:`);
        console.log(`   a. Abre el link de tracking en tu navegador`);
        console.log(`   b. Ve al dashboard: http://localhost:5177/dashboard/domicilios`);
        console.log(`   c. Desde el Portal Domiciliario (http://localhost:5177/delivery/login), acepta la entrega`);
        console.log(`   d. Presiona "Iniciar Ruta" y luego "Simular Ruta" para ver el marcador moverse en tiempo real`);

    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err.stack);
    } finally {
        await db.end();
    }
}

testFlow();
