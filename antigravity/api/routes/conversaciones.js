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

        const consultar = (col) => db.execute(
            `SELECT c.id, c.negocio_id, c.cliente_id, c.intencion_detectada, c.pedido_id,
                    c.activa, c.updated_at,
                    cl.nombre as cliente_nombre, cl.whatsapp as cliente_whatsapp
                    ${col}
             FROM conversaciones c
             LEFT JOIN clientes cl ON cl.id = c.cliente_id
             WHERE c.negocio_id = ?
             ORDER BY c.updated_at DESC
             LIMIT ? OFFSET ?`,
            [req.negocioId, limit, offset]
        );
        // Si la migración v3 aún no corrió, la columna no existe: se lista igual sin el indicador.
        let conversaciones;
        try {
            [conversaciones] = await consultar(', COALESCE(cl.atencion_humana, 0) as atencion_humana');
        } catch (e) {
            if (e.code !== 'ER_BAD_FIELD_ERROR') throw e;
            [conversaciones] = await consultar('');
        }

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

        // Antes solo se guardaba en la base y NUNCA llegaba al cliente por WhatsApp.
        const { enviarWhatsAppDetalle } = require('../services/automationsService');
        const envio = await enviarWhatsAppDetalle(req.negocioId, numeroCliente, contenido.trim());
        if (!envio.ok) {
            const explicaciones = {
                sin_numero: 'Este cliente no tiene un número de WhatsApp guardado, así que no se le puede escribir.',
                no_conectado: 'Tu WhatsApp aparece desconectado en el servidor. Ve a Ajustes y vuelve a vincularlo.',
                gestor_inaccesible: 'El servicio de WhatsApp no responde (el gestor de instancias está caído o inaccesible).',
                timeout: 'WhatsApp tardó demasiado en responder. Intenta de nuevo en unos segundos.'
            };
            const detalle = envio.detalle ? ` (${envio.detalle})` : '';
            return res.status(502).json({
                error: explicaciones[envio.motivo] || `No se pudo enviar por WhatsApp${detalle}.`,
                motivo: envio.motivo
            });
        }

        await db.execute(
            `INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso)
             VALUES (?, ?, 'salida', ?, 'dueno')`,
            [req.negocioId, numeroCliente, contenido.trim()]
        );

        // Si el dueño escribe, el bot se hace a un lado para no pisarlo.
        try {
            await db.execute('UPDATE clientes SET atencion_humana = 1, humano_desde = NOW() WHERE id = ? AND negocio_id = ?', [conversacion[0].cliente_id, req.negocioId]);
        } catch (e) { /* migración v3 pendiente */ }

        res.json({ success: true, mensaje: 'Mensaje enviado', atencion_humana: true });
    } catch (error) {
        console.error('[Conversaciones] Error enviar:', error);
        res.status(500).json({ error: 'Error al enviar mensaje' });
    }
});

// Devuelve el chat al bot / lo pone en manos de una persona.
async function cambiarAtencion(req, res, valor) {
    try {
        const [conv] = await db.execute('SELECT cliente_id FROM conversaciones WHERE id = ? AND negocio_id = ?', [req.params.id, req.negocioId]);
        if (conv.length === 0) return res.status(404).json({ error: 'Conversación no encontrada' });
        await db.execute(
            `UPDATE clientes SET atencion_humana = ?, humano_desde = ${valor ? 'NOW()' : 'NULL'} WHERE id = ? AND negocio_id = ?`,
            [valor, conv[0].cliente_id, req.negocioId]
        );
        res.json({ success: true, atencion_humana: !!valor });
    } catch (error) {
        console.error('[Conversaciones] Error cambiando atención:', error.message);
        res.status(500).json({ error: 'No se pudo cambiar el modo de atención' });
    }
}
router.post('/:id/retomar-bot', (req, res) => cambiarAtencion(req, res, 0));
router.post('/:id/tomar', (req, res) => cambiarAtencion(req, res, 1));

module.exports = router;
