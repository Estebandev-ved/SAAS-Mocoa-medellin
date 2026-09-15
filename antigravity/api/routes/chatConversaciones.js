const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');

// Router canónico para /api/chat. Reemplaza la implementación duplicada que
// vivía en routes/all.js (pool de MySQL propio). El archivo routes/chat.js
// original tampoco cubría esto y nunca se montaba en index.js.
router.use(verificarAuth);

const INSTANCE_MANAGER_URL = process.env.INSTANCE_MANAGER_URL || 'http://localhost:3001';
const MENSAJES_POR_CONVERSACION = 50;

// GET /conversaciones — la vista de Conversaciones del dashboard pide TODO en
// esta sola llamada (no hay un segundo endpoint para pedir los mensajes de
// una conversación puntual), así que cada conversación viene con su historial
// de mensajes ya embebido (hasta los últimos 50).
router.get('/conversaciones', async (req, res) => {
    try {
        const [conversaciones] = await db.execute(
            `SELECT c.*, cl.nombre as cliente_nombre, cl.whatsapp as cliente_whatsapp
             FROM conversaciones c
             LEFT JOIN clientes cl ON c.cliente_id = cl.id
             WHERE c.negocio_id = ?
             ORDER BY c.updated_at DESC
             LIMIT 30`,
            [req.negocioId]
        );

        for (const conv of conversaciones) {
            conv.cliente = { nombre: conv.cliente_nombre, whatsapp: conv.cliente_whatsapp };
            conv.mensajes = [];

            if (conv.cliente_whatsapp) {
                try {
                    const [msgs] = await db.execute(
                        `SELECT tipo, contenido, created_at
                         FROM mensajes
                         WHERE negocio_id = ? AND numero_cliente = ?
                         ORDER BY created_at DESC
                         LIMIT ?`,
                        [req.negocioId, conv.cliente_whatsapp, MENSAJES_POR_CONVERSACION]
                    );
                    conv.mensajes = msgs.reverse().map(m => ({
                        rol: m.tipo === 'entrada' ? 'cliente' : 'negocio',
                        contenido: m.contenido,
                        timestamp: m.created_at
                    }));
                    conv.ultimo_mensaje = conv.mensajes[conv.mensajes.length - 1]?.contenido || null;
                } catch (e) {
                    // Si falla la carga de mensajes, la conversación se sigue mostrando sin historial.
                }
            }
        }

        res.json({ conversaciones });
    } catch (error) {
        console.error('[Chat] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener conversaciones' });
    }
});

// POST /conversaciones/:id/mensaje — responder manualmente desde el dashboard.
// Guarda el mensaje Y lo manda de verdad por WhatsApp a través del
// instance-manager (antes, tanto aquí como en la versión "oficial" de
// conversaciones.js, solo se insertaba en la base de datos sin enviarse).
router.post('/conversaciones/:id/mensaje', async (req, res) => {
    try {
        const { id } = req.params;
        const { mensaje } = req.body;

        if (!mensaje || !mensaje.trim()) {
            return res.status(400).json({ error: 'Mensaje es requerido' });
        }

        const [conversacion] = await db.execute(
            'SELECT id, cliente_id FROM conversaciones WHERE id = ? AND negocio_id = ?',
            [id, req.negocioId]
        );
        if (conversacion.length === 0) {
            return res.status(404).json({ error: 'Conversación no encontrada' });
        }

        const [cliente] = await db.execute('SELECT whatsapp FROM clientes WHERE id = ?', [conversacion[0].cliente_id]);
        const numeroCliente = cliente[0]?.whatsapp || '';

        await db.execute(
            `INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso) VALUES (?, ?, 'salida', ?, 'dueno')`,
            [req.negocioId, numeroCliente, mensaje]
        );

        let enviado = false;
        if (numeroCliente) {
            try {
                await axios.post(`${INSTANCE_MANAGER_URL}/internal/message`, {
                    negocio_id: req.negocioId,
                    numero: numeroCliente.startsWith('+') ? numeroCliente : `+${numeroCliente}`,
                    mensaje
                }, { timeout: 5000 });
                enviado = true;
            } catch (err) {
                console.error('[Chat] Error enviando por WhatsApp (mensaje sí quedó guardado):', err.message);
            }
        }

        res.json({
            success: true,
            enviado_whatsapp: enviado,
            mensaje: enviado ? 'Mensaje enviado' : 'Mensaje guardado, pero no se pudo enviar por WhatsApp'
        });
    } catch (error) {
        console.error('[Chat] Error:', error.message);
        res.status(500).json({ error: 'Error al enviar mensaje' });
    }
});

module.exports = router;
