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
        let qrBase64 = null;
        let instanceConnected = false;
        let instancePhone = null;

        try {
            const response = await fetch(`${INSTANCE_MANAGER_URL}/internal/status/${req.negocioId}`);
            if (response.ok) {
                const imStatus = await response.json();
                instanceConnected = imStatus.connected || false;
                instancePhone = imStatus.phone || null;
                if (imStatus.qr) {
                    qrBase64 = imStatus.qr;
                }
            }
        } catch {
            console.log('[WhatsApp] IM no disponible');
        }

        res.json({
            conectado: instanceConnected,
            numero: instancePhone || negocio.numero_whatsapp || null,
            ultimo_ping: negocio.whatsapp_ultima_conexion,
            qr_disponible: !!qrBase64,
            qr_data: qrBase64
        });
    } catch (error) {
        console.error('[WhatsApp] Error status:', error);
        res.status(500).json({ error: 'Error al obtener estado' });
    }
});

router.post('/connect', async (req, res) => {
    try {
        const [negocios] = await db.execute(
            'SELECT whatsapp_conectado FROM negocios WHERE id = ?',
            [req.negocioId]
        );

        if (negocios[0]?.whatsapp_conectado) {
            const statusRes = await fetch(`${INSTANCE_MANAGER_URL}/internal/status/${req.negocioId}`).catch(() => null);
            if (statusRes?.ok) {
                const st = await statusRes.json();
                if (st.connected) {
                    return res.json({ ya_conectado: true, mensaje: 'Ya está conectado', numero: st.phone });
                }
            }
        }

        try {
            const response = await fetch(`${INSTANCE_MANAGER_URL}/internal/start/${req.negocioId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'IM error');
            }

            res.json({ iniciando: true, mensaje: 'Generando código QR...' });
        } catch (error) {
            console.error('[WhatsApp] Error conectando:', error.message);
            res.status(500).json({ error: 'Error al conectar. Verifica que el IM esté activo.' });
        }
    } catch (error) {
        console.error('[WhatsApp] Error connect:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.post('/disconnect', async (req, res) => {
    try {
        try {
            await fetch(`${INSTANCE_MANAGER_URL}/internal/stop/${req.negocioId}`, { method: 'POST' });
        } catch {}

        await db.execute(
            `UPDATE negocios SET whatsapp_conectado = false WHERE id = ?`,
            [req.negocioId]
        );

        res.json({ desconectado: true, mensaje: 'WhatsApp desconectado' });
    } catch (error) {
        console.error('[WhatsApp] Error disconnect:', error);
        res.status(500).json({ error: 'Error al desconectar' });
    }
});

router.get('/qr', async (req, res) => {
    try {
        try {
            const response = await fetch(`${INSTANCE_MANAGER_URL}/internal/status/${req.negocioId}`);
            if (response.ok) {
                const status = await response.json();
                if (status.qr) {
                    return res.json({ qr_data: status.qr, disponible: true });
                }
            }
        } catch {}

        res.json({ qr_data: null, disponible: false, mensaje: 'QR no disponible. Inicia la conexión.' });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener QR' });
    }
});

module.exports = router;
