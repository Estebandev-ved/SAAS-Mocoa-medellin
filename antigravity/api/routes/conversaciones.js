const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');

const INSTANCE_MANAGER_URL = process.env.INSTANCE_MANAGER_URL || 'http://localhost:3001';

router.use(verificarAuth);

router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const buscar = req.query.buscar || '';

        let whereClause = 'c.negocio_id = ?';
        let params = [req.negocioId];

        if (buscar) {
            whereClause += ' AND (c.numero_cliente LIKE ? OR cl.nombre LIKE ?)';
            params.push(`%${buscar}%`, `%${buscar}%`);
        }

        const [conversaciones] = await db.execute(
            `SELECT c.*, cl.nombre as cliente_nombre, cl.whatsapp as cliente_whatsapp
             FROM conversaciones c
             LEFT JOIN clientes cl ON cl.id = c.cliente_id
             WHERE ${whereClause}
             ORDER BY c.ultimo_mensaje_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const [countResult] = await db.execute(
            `SELECT COUNT(*) as total FROM conversaciones c
             LEFT JOIN clientes cl ON cl.id = c.cliente_id
             WHERE ${whereClause}`,
            params
        );

        res.json({
            conversaciones: conversaciones,
            pagination: {
                page: page,
                limit: limit,
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
            'SELECT id FROM conversaciones WHERE id = ? AND negocio_id = ?',
            [id, req.negocioId]
        );

        if (conversacion.length === 0) {
            return res.status(404).json({ error: 'Conversación no encontrada' });
        }

        const [mensajes] = await db.execute(
            `SELECT * FROM mensajes 
             WHERE conversacion_id = ? AND negocio_id = ?
             ORDER BY created_at ASC
             LIMIT ?`,
            [id, req.negocioId, limit]
        );

        const mensajesFormateados = mensajes.map(m => ({
            id: m.id,
            tipo: m.tipo,
            contenido: m.contenido,
            agente: m.agente,
            respuesta_ia: m.respuesta_ia,
            timestamp: m.created_at,
            metadata: m.metadata ? JSON.parse(m.metadata) : null
        }));

        res.json(mensajesFormateados);
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
            'SELECT * FROM conversaciones WHERE id = ? AND negocio_id = ?',
            [id, req.negocioId]
        );

        if (conversacion.length === 0) {
            return res.status(404).json({ error: 'Conversación no encontrada' });
        }

        const conv = conversacion[0];

        await db.execute(
            `INSERT INTO mensajes (conversacion_id, negocio_id, tipo, contenido, agente, respuesta_ia)
             VALUES (?, ?, 'salida', ?, 'dueno', 0)`,
            [id, req.negocioId, contenido]
        );

        await db.execute(
            `UPDATE conversaciones SET ultimo_mensaje = ?, ultimo_mensaje_at = NOW()
             WHERE id = ?`,
            [contenido.slice(0, 255), id]
        );

        try {
            const numeroCliente = conv.numero_cliente || conv.cliente_whatsapp;
            if (numeroCliente) {
                await fetch(`${INSTANCE_MANAGER_URL}/internal/send/${req.negocioId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        numero: numeroCliente.startsWith('+') ? numeroCliente : `+57${numeroCliente}`,
                        mensaje: contenido
                    })
                });
            }
        } catch {
            console.log('[Conversaciones] No se pudo enviar mensaje por WhatsApp');
        }

        res.json({
            success: true,
            mensaje: 'Mensaje enviado'
        });
    } catch (error) {
        console.error('[Conversaciones] Error enviar:', error);
        res.status(500).json({ error: 'Error al enviar mensaje' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { cliente_id, numero_cliente, mensaje_inicial } = req.body;

        if (!numero_cliente) {
            return res.status(400).json({ error: 'Número de cliente es requerido' });
        }

        let clienteDbId = cliente_id;

        if (!clienteDbId) {
            const [clientes] = await db.execute(
                'SELECT id FROM clientes WHERE negocio_id = ? AND whatsapp = ?',
                [req.negocioId, numero_cliente]
            );

            if (clientes.length > 0) {
                clienteDbId = clientes[0].id;
            } else {
                const [result] = await db.execute(
                    `INSERT INTO clientes (negocio_id, nombre, whatsapp) VALUES (?, ?, ?)`,
                    [req.negocioId, numero_cliente.replace('+57', ''), numero_cliente]
                );
                clienteDbId = result.insertId;
            }
        }

        const [result] = await db.execute(
            `INSERT INTO conversaciones (negocio_id, cliente_id, numero_cliente, ultimo_mensaje, ultimo_mensaje_at)
             VALUES (?, ?, ?, ?, NOW())`,
            [req.negocioId, clienteDbId, numero_cliente, mensaje_inicial || 'Conversación iniciada']
        );

        if (mensaje_inicial) {
            await db.execute(
                `INSERT INTO mensajes (conversacion_id, negocio_id, tipo, contenido, respuesta_ia)
                 VALUES (?, ?, 'entrada', ?, 0)`,
                [result.insertId, req.negocioId, mensaje_inicial]
            );
        }

        res.json({
            success: true,
            conversacion_id: result.insertId
        });
    } catch (error) {
        console.error('[Conversaciones] Error crear:', error);
        res.status(500).json({ error: 'Error al crear conversación' });
    }
});

module.exports = router;
