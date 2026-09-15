const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');

// Store Telegram bot tokens per business
const telegramBots = new Map();

// Initialize Telegram bot for a business
router.post('/connect', verificarAuth, async (req, res) => {
    try {
        const { bot_token } = req.body;
        const negocioId = req.negocio.id;

        if (!bot_token) {
            return res.status(400).json({ error: 'Token del bot de Telegram requerido' });
        }

        // Validate token with Telegram API
        const response = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`);
        const data = await response.json();

        if (!data.ok) {
            return res.status(400).json({ error: 'Token inválido de Telegram' });
        }

        // Save to database
        await db.execute(
            'UPDATE negocios SET telegram_bot_token = ?, telegram_bot_nombre = ? WHERE id = ?',
            [bot_token, data.result.first_name, negocioId]
        );

        // Start polling
        startTelegramPolling(negocioId, bot_token);

        res.json({
            success: true,
            bot: {
                nombre: data.result.first_name,
                username: data.result.username,
                id: data.result.id
            }
        });

    } catch (error) {
        console.error('[Telegram] Error connecting:', error);
        res.status(500).json({ error: 'Error conectando Telegram' });
    }
});

// Get Telegram status
router.get('/status', verificarAuth, async (req, res) => {
    try {
        const negocioId = req.negocio.id;
        const [negocios] = await db.execute(
            'SELECT telegram_bot_token, telegram_bot_nombre FROM negocios WHERE id = ?',
            [negocioId]
        );

        const negocio = negocios[0];
        const connected = telegramBots.has(negocioId);

        res.json({
            connected,
            bot_nombre: negocio?.telegram_bot_nombre || null,
            has_token: !!negocio?.telegram_bot_token
        });

    } catch (error) {
        console.error('[Telegram] Error status:', error);
        res.status(500).json({ error: 'Error obteniendo estado' });
    }
});

// Disconnect Telegram
router.post('/disconnect', verificarAuth, async (req, res) => {
    try {
        const negocioId = req.negocio.id;

        // Stop polling
        if (telegramBots.has(negocioId)) {
            const bot = telegramBots.get(negocioId);
            if (bot.polling) clearInterval(bot.polling);
            telegramBots.delete(negocioId);
        }

        // Clear from database
        await db.execute(
            'UPDATE negocios SET telegram_bot_token = NULL, telegram_bot_nombre = NULL WHERE id = ?',
            [negocioId]
        );

        res.json({ success: true });

    } catch (error) {
        console.error('[Telegram] Error disconnecting:', error);
        res.status(500).json({ error: 'Error desconectando' });
    }
});

// Telegram webhook endpoint
router.post('/webhook/:negocioId', async (req, res) => {
    try {
        const { negocioId } = req.params;
        const update = req.body;

        if (update.message) {
            await handleTelegramMessage(negocioId, update.message);
        }

        res.json({ ok: true });

    } catch (error) {
        console.error('[Telegram] Webhook error:', error);
        res.json({ ok: true });
    }
});

// Start polling for a business
function startTelegramPolling(negocioId, botToken) {
    if (telegramBots.has(negocioId)) {
        const existing = telegramBots.get(negocioId);
        if (existing.polling) clearInterval(existing.polling);
    }

    let offset = 0;

    const poll = async () => {
        try {
            const response = await fetch(
                `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=10`
            );
            const data = await response.json();

            if (data.ok && data.result) {
                for (const update of data.result) {
                    offset = update.update_id + 1;
                    if (update.message) {
                        await handleTelegramMessage(negocioId, update.message);
                    }
                }
            }
        } catch (error) {
            console.error(`[Telegram] Polling error for negocio ${negocioId}:`, error.message);
        }
    };

    const polling = setInterval(poll, 1000);
    telegramBots.set(negocioId, { botToken, polling });
    console.log(`[Telegram] Polling started for negocio ${negocioId}`);
}

// Handle incoming Telegram message
async function handleTelegramMessage(negocioId, message) {
    try {
        const chatId = message.chat.id;
        const text = message.text || '';
        const from = message.from;

        // Get or create client
        let [clientes] = await db.execute(
            'SELECT id FROM clientes WHERE negocio_id = ? AND whatsapp = ?',
            [negocioId, `telegram_${chatId}`]
        );

        let clienteId;
        if (clientes.length === 0) {
            const [result] = await db.execute(
                'INSERT INTO clientes (negocio_id, nombre, whatsapp) VALUES (?, ?, ?)',
                [negocioId, from.first_name || 'Telegram User', `telegram_${chatId}`]
            );
            clienteId = result.insertId;
        } else {
            clienteId = clientes[0].id;
        }

        // Save incoming message
        await db.execute(
            'INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido) VALUES (?, ?, ?, ?)',
            [negocioId, `telegram_${chatId}`, 'entrada', text]
        );

        // Process with orchestrator
        const orchestrator = require('../../instance-manager/agents/orchestrator');
        const contextoRows = await db.execute(
            'SELECT tipo, contenido FROM mensajes WHERE negocio_id = ? AND numero_cliente = ? ORDER BY created_at DESC LIMIT 10',
            [negocioId, `telegram_${chatId}`]
        );
        const contexto = (contextoRows[0] || []).reverse().map(m => ({
            rol: m.tipo === 'entrada' ? 'cliente' : 'bot',
            contenido: m.contenido
        }));

        const respuesta = await orchestrator.procesarMensaje(text, negocioId, clienteId, contexto);

        // Save and send response
        await db.execute(
            'INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada) VALUES (?, ?, ?, ?, ?, ?)',
            [negocioId, `telegram_${chatId}`, 'salida', respuesta.respuesta, respuesta.agente_usado, respuesta.intencion || '']
        );

        // Send to Telegram
        const [negocios] = await db.execute(
            'SELECT telegram_bot_token FROM negocios WHERE id = ?',
            [negocioId]
        );
        const botToken = negocios[0]?.telegram_bot_token;
        if (botToken) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: respuesta.respuesta,
                    parse_mode: 'Markdown'
                })
            });
        }

    } catch (error) {
        console.error('[Telegram] Error handling message:', error);
    }
}

module.exports = router;
