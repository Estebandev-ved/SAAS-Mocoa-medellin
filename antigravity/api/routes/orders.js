const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const { isAutomationActive, yaSeNotifico, registrarNotificacion, enviarWhatsApp } = require('../services/automationsService');

// Router canónico para /api/pedidos. Reemplaza la implementación duplicada
// que vivía en routes/all.js (pool de MySQL propio, sin chequeo de cuenta
// deshabilitada/suscripción) y la versión más simple que había en
// routes/orders.js. Usa el pool y el middleware de auth compartidos.
router.use(verificarAuth);

// Si el pedido pasó a "entregado" y el negocio tiene activa la automatización
// "resena", pide una reseña por WhatsApp. No hace nada si ya se envió antes
// para este pedido (evita reenvíos si el estado se vuelve a guardar igual).
// Esto solo cubre pedidos que se marcan "entregado" directamente desde acá
// (dashboard); los que pasan por el flujo de domiciliario/repartidor se
// notifican desde routes/domicilios.js con la misma automatización.
async function pedirResenaSiCorresponde(negocioId, pedidoId) {
    try {
        const { activa } = await isAutomationActive(negocioId, 'resena');
        if (!activa) return;
        if (await yaSeNotifico(negocioId, 'resena', pedidoId)) return;

        const [pedidos] = await db.execute(
            `SELECT c.whatsapp as cliente_whatsapp FROM pedidos p
             JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?`,
            [pedidoId]
        );
        const numeroCliente = pedidos[0]?.cliente_whatsapp;
        if (!numeroCliente) return;

        const mensaje = '🎉 ¡Gracias por tu compra! Si tienes un segundo, nos encantaría que nos dejaras tu opinión sobre el pedido.';
        const enviado = await enviarWhatsApp(negocioId, numeroCliente, mensaje);
        if (enviado) {
            await registrarNotificacion(negocioId, 'resena', 'Solicitud de reseña enviada', mensaje, pedidoId);
        }
    } catch (error) {
        console.error('[Pedidos] Error pidiendo reseña:', error.message);
    }
}

const TRANSICIONES_VALIDAS = {
    'pendiente_pago': ['pago_enviado', 'cancelado'],
    'pago_enviado': ['pago_confirmado', 'cancelado'],
    'pago_confirmado': ['en_preparacion', 'cancelado'],
    'en_preparacion': ['enviado', 'cancelado'],
    'enviado': ['entregado', 'cancelado'],
    'entregado': [],
    'cancelado': []
};

router.get('/', async (req, res) => {
    try {
        const { estado, busqueda, fecha_inicio, fecha_fin, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let whereClause = 'WHERE p.negocio_id = ?';
        const params = [req.negocioId];

        if (estado && estado !== 'todos') {
            whereClause += ' AND p.estado = ?';
            params.push(estado);
        }
        if (busqueda) {
            whereClause += ' AND (c.nombre LIKE ? OR p.numero_pedido LIKE ?)';
            params.push(`%${busqueda}%`, `%${busqueda}%`);
        }
        if (fecha_inicio) {
            whereClause += ' AND DATE(p.created_at) >= ?';
            params.push(fecha_inicio);
        }
        if (fecha_fin) {
            whereClause += ' AND DATE(p.created_at) <= ?';
            params.push(fecha_fin);
        }

        const [countResult] = await db.execute(
            `SELECT COUNT(*) as total FROM pedidos p LEFT JOIN clientes c ON p.cliente_id = c.id ${whereClause}`,
            params
        );

        const [pedidos] = await db.execute(
            `SELECT p.*, c.nombre as cliente_nombre, c.whatsapp as cliente_whatsapp
             FROM pedidos p
             LEFT JOIN clientes c ON p.cliente_id = c.id
             ${whereClause}
             ORDER BY p.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), parseInt(offset)]
        );

        for (const pedido of pedidos) {
            try {
                const [items] = await db.execute(
                    `SELECT ip.*, pr.nombre as producto_nombre, pr.precio as producto_precio
                     FROM items_pedido ip
                     LEFT JOIN productos pr ON ip.producto_id = pr.id
                     WHERE ip.pedido_id = ?`,
                    [pedido.id]
                );
                pedido.items = items.map(item => ({
                    id: item.id,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio_unitario,
                    subtotal: item.subtotal,
                    producto: { nombre: item.producto_nombre, precio: item.producto_precio }
                }));
            } catch (e) {
                pedido.items = [];
            }

            pedido.cliente = { nombre: pedido.cliente_nombre, whatsapp: pedido.cliente_whatsapp };

            pedido.tiene_imagen_pago = !!pedido.imagen_pago;
            if (pedido.imagen_pago) {
                pedido.imagen_pago = pedido.imagen_pago.substring(0, 50) + '...';
            }
        }

        res.json({
            pedidos,
            total: countResult[0]?.total || 0,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0]?.total || 0
            }
        });
    } catch (error) {
        console.error('[Pedidos] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
});

router.get('/:id/imagen', async (req, res) => {
    try {
        const { id } = req.params;
        const [pedidos] = await db.execute(
            'SELECT imagen_pago FROM pedidos WHERE id = ? AND negocio_id = ?',
            [id, req.negocioId]
        );

        if (pedidos.length === 0 || !pedidos[0].imagen_pago) {
            return res.status(404).json({ error: 'No hay imagen de pago' });
        }

        res.json({ imagen: pedidos[0].imagen_pago });
    } catch (error) {
        console.error('[Pedidos] Error obteniendo imagen:', error.message);
        res.status(500).json({ error: 'Error obteniendo imagen' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [pedidos] = await db.execute(
            `SELECT p.*, c.nombre as cliente_nombre, c.whatsapp as cliente_whatsapp
             FROM pedidos p
             LEFT JOIN clientes c ON p.cliente_id = c.id
             WHERE p.id = ? AND p.negocio_id = ?`,
            [id, req.negocioId]
        );

        if (pedidos.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }

        const pedido = pedidos[0];
        pedido.cliente = { nombre: pedido.cliente_nombre, whatsapp: pedido.cliente_whatsapp };

        try {
            const [items] = await db.execute(
                `SELECT ip.*, pr.nombre as producto_nombre, pr.precio as producto_precio
                 FROM items_pedido ip
                 LEFT JOIN productos pr ON ip.producto_id = pr.id
                 WHERE ip.pedido_id = ?`,
                [id]
            );
            pedido.items = items.map(item => ({
                id: item.id,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario,
                subtotal: item.subtotal,
                producto: { nombre: item.producto_nombre, precio: item.producto_precio }
            }));
        } catch (e) {
            pedido.items = [];
        }

        res.json(pedido);
    } catch (error) {
        console.error('[Pedidos] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener pedido' });
    }
});

// PATCH /:id/estado — única ruta para cambiar el estado de un pedido, valida
// la transición contra TRANSICIONES_VALIDAS. Antes existía también un PUT
// /:id sin validar (el comentario decía que el dashboard lo usaba vía
// ordersService.updateEstado, pero esa función ya no existe en el frontend
// desde la reescritura de Pedidos en tiempo real del 22 sept) — se retiró
// para no dejar una puerta sin validar expuesta.
router.patch('/:id/estado', async (req, res) => {
    try {
        const { id } = req.params;
        const { estado: nuevoEstado } = req.body;

        if (!nuevoEstado) {
            return res.status(400).json({ error: 'El estado es requerido' });
        }

        const [pedidos] = await db.execute(
            'SELECT estado FROM pedidos WHERE id = ? AND negocio_id = ?',
            [id, req.negocioId]
        );

        if (pedidos.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }

        const estadoActual = pedidos[0].estado;
        const permitidas = TRANSICIONES_VALIDAS[estadoActual] || [];
        if (estadoActual !== nuevoEstado && !permitidas.includes(nuevoEstado)) {
            return res.status(400).json({
                error: `No se puede pasar de "${estadoActual}" a "${nuevoEstado}"`,
                transiciones_validas: permitidas
            });
        }

        await db.execute(
            'UPDATE pedidos SET estado = ?, updated_at = NOW() WHERE id = ? AND negocio_id = ?',
            [nuevoEstado, id, req.negocioId]
        );

        if (nuevoEstado === 'entregado') {
            pedirResenaSiCorresponde(req.negocioId, id);
        }

        res.json({ success: true, message: `Estado actualizado a ${nuevoEstado}` });
    } catch (error) {
        console.error('[Pedidos] Error:', error.message);
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
});

module.exports = router;
