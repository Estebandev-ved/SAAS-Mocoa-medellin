const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');

// Instagram webhook verification
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN || 'antigravity_ig_verify') {
        console.log('[Instagram] Webhook verified');
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// Instagram webhook handler
router.post('/webhook', async (req, res) => {
    try {
        const body = req.body;

        if (body.object === 'instagram') {
            for (const entry of body.entry || []) {
                for (const event of entry.messaging || []) {
                    await handleInstagramMessage(event);
                }
            }
        }

        res.status(200).send('EVENT_RECEIVED');

    } catch (error) {
        console.error('[Instagram] Webhook error:', error);
        res.status(200).send('EVENT_RECEIVED');
    }
});

// Connect Instagram account
router.post('/connect', verificarAuth, async (req, res) => {
    try {
        const { page_id, access_token } = req.body;
        const negocioId = req.negocio.id;

        if (!page_id || !access_token) {
            return res.status(400).json({ error: 'Page ID y Access Token requeridos' });
        }

        // Validate with Instagram Graph API
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${page_id}?fields=instagram_business_account{id,name}&access_token=${access_token}`
        );
        const data = await response.json();

        if (data.error) {
            return res.status(400).json({ error: 'Token inválido o sin acceso a Instagram' });
        }

        const igAccount = data.instagram_business_account;

        // Save to database
        await db.execute(
            'UPDATE negocios SET instagram_token = ?, instagram_user_id = ?, instagram_nombre = ? WHERE id = ?',
            [access_token, igAccount?.id || page_id, igAccount?.name || 'Instagram', negocioId]
        );

        res.json({
            success: true,
            account: {
                id: igAccount?.id || page_id,
                nombre: igAccount?.name || 'Instagram'
            }
        });

    } catch (error) {
        console.error('[Instagram] Error connecting:', error);
        res.status(500).json({ error: 'Error conectando Instagram' });
    }
});

// Get Instagram status
router.get('/status', verificarAuth, async (req, res) => {
    try {
        const negocioId = req.negocio.id;
        const [negocios] = await db.execute(
            'SELECT instagram_token, instagram_user_id, instagram_nombre FROM negocios WHERE id = ?',
            [negocioId]
        );

        const negocio = negocios[0];

        res.json({
            connected: !!negocio?.instagram_token,
            user_id: negocio?.instagram_user_id || null,
            nombre: negocio?.instagram_nombre || null,
            has_token: !!negocio?.instagram_token
        });

    } catch (error) {
        console.error('[Instagram] Error status:', error);
        res.status(500).json({ error: 'Error obteniendo estado' });
    }
});

// Disconnect Instagram
router.post('/disconnect', verificarAuth, async (req, res) => {
    try {
        const negocioId = req.negocio.id;

        await db.execute(
            'UPDATE negocios SET instagram_token = NULL, instagram_user_id = NULL, instagram_nombre = NULL WHERE id = ?',
            [negocioId]
        );

        res.json({ success: true });

    } catch (error) {
        console.error('[Instagram] Error disconnecting:', error);
        res.status(500).json({ error: 'Error desconectando' });
    }
});

// Handle incoming Instagram message
async function handleInstagramMessage(event) {
    try {
        const senderId = event.sender?.id;
        const message = event.message;
        const text = message?.text || '';

        if (!senderId || !text) return;

        // Find business by Instagram user ID
        const [negocios] = await db.execute(
            'SELECT id FROM negocios WHERE instagram_user_id = ?',
            [senderId]
        );

        if (negocios.length === 0) return;

        const negocioId = negocios[0].id;

        // Get or create client
        let [clientes] = await db.execute(
            'SELECT id FROM clientes WHERE negocio_id = ? AND whatsapp = ?',
            [negocioId, `instagram_${senderId}`]
        );

        let clienteId;
        if (clientes.length === 0) {
            const [result] = await db.execute(
                'INSERT INTO clientes (negocio_id, nombre, whatsapp) VALUES (?, ?, ?)',
                [negocioId, 'Instagram User', `instagram_${senderId}`]
            );
            clienteId = result.insertId;
        } else {
            clienteId = clientes[0].id;
        }

        // Save incoming message
        await db.execute(
            'INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido) VALUES (?, ?, ?, ?)',
            [negocioId, `instagram_${senderId}`, 'entrada', text]
        );

        // Process with orchestrator
        const orchestrator = require('../../instance-manager/agents/orchestrator');
        const contextoRows = await db.execute(
            'SELECT tipo, contenido FROM mensajes WHERE negocio_id = ? AND numero_cliente = ? ORDER BY created_at DESC LIMIT 10',
            [negocioId, `instagram_${senderId}`]
        );
        const contexto = (contextoRows[0] || []).reverse().map(m => ({
            rol: m.tipo === 'entrada' ? 'cliente' : 'bot',
            contenido: m.contenido
        }));

        const respuesta = await orchestrator.procesarMensaje(text, negocioId, clienteId, contexto);

        // Save response
        await db.execute(
            'INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada) VALUES (?, ?, ?, ?, ?, ?)',
            [negocioId, `instagram_${senderId}`, 'salida', respuesta.respuesta, respuesta.agente_usado, respuesta.intencion || '']
        );

        // Send via Instagram Graph API
        const [negocioData] = await db.execute(
            'SELECT instagram_token FROM negocios WHERE id = ?',
            [negocioId]
        );
        const accessToken = negocioData[0]?.instagram_token;

        if (accessToken) {
            await fetch(
                `https://graph.facebook.com/v18.0/me/messages?access_token=${accessToken}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipient: { id: senderId },
                        message: { text: respuesta.respuesta }
                    })
                }
            );
        }

    } catch (error) {
        console.error('[Instagram] Error handling message:', error);
    }
}

module.exports = router;
