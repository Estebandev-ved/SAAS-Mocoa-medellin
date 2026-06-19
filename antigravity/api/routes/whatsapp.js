const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');

const INSTANCE_MANAGER_URL = process.env.INSTANCE_MANAGER_URL || 'http://localhost:3001';

router.use(verificarAuth);

router.get('/status', async (req, res) => {
    try {
        const [negocios] = await db.execute(
            `SELECT whatsapp_conectado, numero_whatsapp, whatsapp_ultima_conexion 
             FROM negocios WHERE id = ?`,
            [req.negocioId]
        );

        if (negocios.length === 0) {
            return res.status(404).json({ error: 'Negocio no encontrado' });
        }

        const negocio = negocios[0];

        try {
            const response = await fetch(`${INSTANCE_MANAGER_URL}/internal/status/${req.negocioId}`);
            const imStatus = response.ok ? await response.json() : null;

            res.json({
                conectado: negocio.whatsapp_conectado,
                numero: negocio.numero_whatsapp || null,
                ultimo_ping: imStatus?.ultimo_ping || null,
                qr_disponible: imStatus?.qr_disponible || false,
                qr_data: imStatus?.qr_data || null
            });
        } catch {
            res.json({
                conectado: negocio.whatsapp_conectado,
                numero: negocio.numero_whatsapp || null,
                ultimo_ping: negocio.whatsapp_ultima_conexion,
                qr_disponible: false
            });
        }
    } catch (error) {
        console.error('[WhatsApp] Error status:', error);
        res.status(500).json({ error: 'Error al obtener estado de WhatsApp' });
    }
});

router.post('/connect', async (req, res) => {
    try {
        const [negocios] = await db.execute(
            'SELECT whatsapp_conectado FROM negocios WHERE id = ?',
            [req.negocioId]
        );

        if (negocios[0]?.whatsapp_conectado) {
            return res.json({
                ya_conectado: true,
                mensaje: 'WhatsApp ya está conectado',
                numero: negocios[0].numero_whatsapp
            });
        }

        try {
            const response = await fetch(`${INSTANCE_MANAGER_URL}/internal/start/${req.negocioId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ negocio_id: req.negocioId })
            });

            if (!response.ok) {
                throw new Error('Instance Manager error');
            }

            res.json({
                iniciando: true,
                mensaje: 'Generando código QR. Espera un momento...'
            });
        } catch (error) {
            console.error('[WhatsApp] Error conectando:', error);
            res.status(500).json({
                error: 'Error al iniciar conexión. Verifica que el Instance Manager esté activo.'
            });
        }
    } catch (error) {
        console.error('[WhatsApp] Error connect:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.post('/disconnect', async (req, res) => {
    try {
        try {
            await fetch(`${INSTANCE_MANAGER_URL}/internal/stop/${req.negocioId}`, {
                method: 'POST'
            });
        } catch {
            console.log('[WhatsApp] Instance Manager no disponible para disconnect');
        }

        await db.execute(
            `UPDATE negocios SET whatsapp_conectado = false, numero_whatsapp = NULL 
             WHERE id = ?`,
            [req.negocioId]
        );

        res.json({ desconectado: true, mensaje: 'WhatsApp desconectado exitosamente' });
    } catch (error) {
        console.error('[WhatsApp] Error disconnect:', error);
        res.status(500).json({ error: 'Error al desconectar WhatsApp' });
    }
});

router.get('/qr', async (req, res) => {
    try {
        try {
            const response = await fetch(`${INSTANCE_MANAGER_URL}/internal/status/${req.negocioId}`);
            if (response.ok) {
                const status = await response.json();
                if (status.qr_data) {
                    return res.json({
                        qr_data: status.qr_data,
                        disponible: true
                    });
                }
            }
        } catch {
            console.log('[WhatsApp] Instance Manager no disponible para QR');
        }

        res.json({
            qr_data: null,
            disponible: false,
            mensaje: 'QR no disponible. Inicia la conexión primero.'
        });
    } catch (error) {
        console.error('[WhatsApp] Error qr:', error);
        res.status(500).json({ error: 'Error al obtener QR' });
    }
});

router.post('/test-message', async (req, res) => {
    try {
        const { numero, mensaje } = req.body;

        if (!numero || !mensaje) {
            return res.status(400).json({ error: 'Número y mensaje son requeridos' });
        }

        try {
            const response = await fetch(`${INSTANCE_MANAGER_URL}/internal/send/${req.negocioId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numero, mensaje })
            });

            if (!response.ok) {
                throw new Error('Error enviando mensaje');
            }

            const result = await response.json();
            res.json({ enviado: true, ...result });
        } catch (error) {
            res.status(500).json({
                enviado: false,
                error: 'No se pudo enviar el mensaje de prueba'
            });
        }
    } catch (error) {
        console.error('[WhatsApp] Error test:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

module.exports = router;
