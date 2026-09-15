const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');

router.use(verificarAuth);

router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const [conversaciones] = await db.execute(
            `SELECT c.id, c.negocio_id, c.cliente_id, c.intencion_detectada, c.pedido_id,
                    c.activa, c.updated_at,
                    cl.nombre as cliente_nombre, cl.whatsapp as cliente_whatsapp
             FROM conversaciones c
             LEFT JOIN clientes cl ON cl.id = c.cliente_id
             WHERE c.negocio_id = ?
             ORDER BY c.updated_at DESC
             LIMIT ? OFFSET ?`,
            [req.negocioId, limit, offset]
        );

        const [countResult] = await db.execute(
            'SELECT COUNT(*) as total FROM conversaciones WHERE negocio_id = ?',
            [req.negocioId]
        );

        res.json({
            conversaciones: conversaciones,
            pagination: {
                page,
                limit,
                total: countResult[0]?.total || 0,
                pages: Math.ceil((countResult[0]?.total || 0) / limit)
            }
        });
    } catch (error) {
        console.error('[Conversaciones] Error:', error);
        res.status(500).json({ error: 'Error al obtener conversaciones' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [conversaciones] = await db.execute(
            `SELECT c.*, cl.nombre as cliente_nombre, cl.whatsapp as cliente_whatsapp,
                    cl.total_pedidos, cl.total_gastado
             FROM conversaciones c
             LEFT JOIN clientes cl ON cl.id = c.cliente_id
             WHERE c.id = ? AND c.negocio_id = ?`,
            [id, req.negocioId]
        );
        if (conversaciones.length === 0) {
            return res.status(404).json({ error: 'Conversación no encontrada' });
        }
        res.json(conversaciones[0]);
    } catch (error) {
        console.error('[Conversaciones] Error get:', error);
        res.status(500).json({ error: 'Error al obtener conversación' });
    }
});

router.get('/:id/mensajes', async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 100;

        const [conversacion] = await db.execute(
            'SELECT id, cliente_id FROM conversaciones WHERE id = ? AND negocio_id = ?',
            [id, req.negocioId]
        );
        if (conversacion.length === 0) {
            return res.status(404).json({ error: 'Conversación no encontrada' });
        }

        const clienteId = conversacion[0].cliente_id;
        const [cliente] = await db.execute(
            'SELECT whatsapp FROM clientes WHERE id = ?',
            [clienteId]
        );
        const numeroCliente = cliente[0]?.whatsapp || '';

        let mensajes = [];
        if (numeroCliente) {
            const [msgs] = await db.execute(
                `SELECT id, tipo, contenido, agente_proceso, intencion_detectada, created_at
                 FROM mensajes
                 WHERE negocio_id = ? AND numero_cliente = ?
                 ORDER BY created_at ASC
                 LIMIT ?`,
                [req.negocioId, numeroCliente, limit]
            );
            mensajes = msgs;
        }

        res.json(mensajes.map(m => ({
            id: m.id,
            tipo: m.tipo,
            contenido: m.contenido,
            agente: m.agente_proceso,
            timestamp: m.created_at
        })));
    } catch (error) {
        console.error('[Conversaciones] Error mensajes:', error);
        res.status(500).json({ error: 'Error al obtener mensajes' });
    }
});

router.post('/:id/mensaje', async (req, res) => {
    try {
        const { id } = req.params;
        const { contenido } = req.body;
        if (!contenido || contenido.trim().length === 0) {
            return res.status(400).json({ error: 'Contenido es requerido' });
        }

        const [conversacion] = await db.execute(
            'SELECT id, cliente_id FROM conversaciones WHERE id = ? AND negocio_id = ?',
            [id, req.negocioId]
        );
        if (conversacion.length === 0) {
            return res.status(404).json({ error: 'Conversación no encontrada' });
        }

        const [cliente] = await db.execute(
            'SELECT whatsapp FROM clientes WHERE id = ?',
            [conversacion[0].cliente_id]
        );
        const numeroCliente = cliente[0]?.whatsapp || '';

        await db.execute(
            `INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso)
             VALUES (?, ?, 'salida', ?, 'dueno')`,
            [req.negocioId, numeroCliente, contenido]
        );

        res.json({ success: true, mensaje: 'Mensaje enviado' });
    } catch (error) {
        console.error('[Conversaciones] Error enviar:', error);
        res.status(500).json({ error: 'Error al enviar mensaje' });
    }
});

module.exports = router;
