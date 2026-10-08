// Suscripción a avisos Web Push del dueño (PWA fase 2). Todo autenticado, salvo que
// la clave pública VAPID es pública por diseño pero igual se pide con sesión.
const express = require('express');
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const push = require('../services/push');

const router = express.Router();
router.use(verificarAuth);

// El frontend pregunta si la función está encendida y obtiene la clave pública.
router.get('/config', (req, res) => {
    if (!push.vapidConfigurado()) return res.json({ habilitado: false });
    res.json({ habilitado: true, publicKey: process.env.PUSH_VAPID_PUBLIC_KEY });
});

router.post('/subscribe', async (req, res) => {
    if (!push.vapidConfigurado()) return res.status(503).json({ error: 'Los avisos no están configurados en este servidor' });
    const sub = push.sanitizarSuscripcion(req.body);
    if (!sub) return res.status(400).json({ error: 'Suscripción inválida' });
    try {
        // Si el mismo dispositivo ya estaba suscrito (aunque fuera con otro negocio),
        // pasa a este negocio: un endpoint es un navegador físico y solo tiene un dueño activo.
        await db.execute(
            `INSERT INTO push_subscriptions (negocio_id, endpoint, endpoint_hash, p256dh, auth, user_agent)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE negocio_id = VALUES(negocio_id), p256dh = VALUES(p256dh),
                                     auth = VALUES(auth), user_agent = VALUES(user_agent)`,
            [req.negocio.id, sub.endpoint, push.hashEndpoint(sub.endpoint), sub.p256dh, sub.auth,
             String(req.headers['user-agent'] || '').slice(0, 255)]
        );
        res.status(201).json({ ok: true });
    } catch (err) {
        console.error('[Push] subscribe:', err.message);
        res.status(500).json({ error: 'No se pudo activar los avisos' });
    }
});

router.post('/unsubscribe', async (req, res) => {
    const endpoint = req.body && req.body.endpoint;
    if (typeof endpoint !== 'string' || !endpoint) return res.status(400).json({ error: 'Falta el endpoint' });
    try {
        await db.execute(
            'DELETE FROM push_subscriptions WHERE endpoint_hash = ? AND negocio_id = ?',
            [push.hashEndpoint(endpoint), req.negocio.id]
        );
        res.json({ ok: true });
    } catch (err) {
        console.error('[Push] unsubscribe:', err.message);
        res.status(500).json({ error: 'No se pudo desactivar los avisos' });
    }
});

module.exports = router;
