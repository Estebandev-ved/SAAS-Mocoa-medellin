const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');

router.use(verificarAuth);

// GET /api/campanas - Listar campañas
router.get('/', async (req, res) => {
    try {
        const [campanas] = await db.execute(
            'SELECT * FROM campañas WHERE negocio_id = ? ORDER BY created_at DESC',
            [req.negocioId]
        );
        res.json(campanas);
    } catch (error) {
        res.status(500).json({ error: 'Error listando campañas' });
    }
});

// POST /api/campanas - Crear campaña
router.post('/', async (req, res) => {
    try {
        const { nombre, mensaje, tipo, programada_para } = req.body;

        if (!nombre || !mensaje) {
            return res.status(400).json({ error: 'Nombre y mensaje son requeridos' });
        }

        const estado = programada_para ? 'programada' : 'borrador';

        const [result] = await db.execute(
            `INSERT INTO campañas (negocio_id, nombre, mensaje, tipo, estado, programada_para)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.negocioId, nombre, mensaje, tipo || 'masivo', estado, programada_para || null]
        );

        res.status(201).json({
            id: result.insertId,
            nombre,
            mensaje,
            tipo: tipo || 'masivo',
            estado
        });
    } catch (error) {
        res.status(500).json({ error: 'Error creando campaña' });
    }
});

// POST /api/campanas/:id/enviar - Enviar campaña
router.post('/:id/enviar', async (req, res) => {
    try {
        const { id } = req.params;

        const [campanas] = await db.execute(
            'SELECT * FROM campañas WHERE id = ? AND negocio_id = ?',
            [id, req.negocioId]
        );

        if (campanas.length === 0) {
            return res.status(404).json({ error: 'Campaña no encontrada' });
        }

        const campana = campanas[0];

        if (campana.estado === 'completada') {
            return res.status(400).json({ error: 'La campaña ya fue enviada' });
        }

        // Get active clients
        const [clientes] = await db.execute(
            'SELECT whatsapp FROM clientes WHERE negocio_id = ? AND activo = 1 AND whatsapp IS NOT NULL',
            [req.negocioId]
        );

        if (clientes.length === 0) {
            return res.status(400).json({ error: 'No hay clientes activos para enviar' });
        }

        await db.execute(
            'UPDATE campañas SET estado = "enviando", total_enviados = ? WHERE id = ?',
            [clientes.length, id]
        );

        // Send via socket to Instance Manager
        const io = req.app.get('io');
        if (io) {
            io.emit('campana_enviar', {
                negocioId: req.negocioId,
                campanaId: parseInt(id),
                mensaje: campana.mensaje,
                destinatarios: clientes.map(c => c.whatsapp)
            });
        }

        res.json({
            success: true,
            mensaje: `Campaña enviando a ${clientes.length} clientes`,
            total: clientes.length
        });
    } catch (error) {
        res.status(500).json({ error: 'Error enviando campaña' });
    }
});

// PUT /api/campanas/:id/completar - Marcar campaña como completada
router.put('/:id/completar', async (req, res) => {
    try {
        const { id } = req.params;
        const { exitosos, fallidos } = req.body;

        await db.execute(
            `UPDATE campañas SET estado = 'completada', total_exitosos = ?, total_fallidos = ?, completada_at = NOW() WHERE id = ? AND negocio_id = ?`,
            [exitosos || 0, fallidos || 0, id, req.negocioId]
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error actualizando campaña' });
    }
});

// DELETE /api/campanas/:id - Eliminar campaña
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM campañas WHERE id = ? AND negocio_id = ?', [id, req.negocioId]);
        res.json({ success: true, mensaje: 'Campaña eliminada' });
    } catch (error) {
        res.status(500).json({ error: 'Error eliminando campaña' });
    }
});

// ===== PLANTILLAS =====

router.get('/plantillas', async (req, res) => {
    try {
        const [plantillas] = await db.execute(
            'SELECT * FROM plantillas_mensajes WHERE negocio_id = ? ORDER BY created_at DESC',
            [req.negocioId]
        );
        res.json(plantillas);
    } catch (error) {
        res.status(500).json({ error: 'Error listando plantillas' });
    }
});

router.post('/plantillas', async (req, res) => {
    try {
        const { nombre, contenido, categoria } = req.body;
        if (!nombre || !contenido) {
            return res.status(400).json({ error: 'Nombre y contenido requeridos' });
        }

        const [result] = await db.execute(
            'INSERT INTO plantillas_mensajes (negocio_id, nombre, contenido, categoria) VALUES (?, ?, ?, ?)',
            [req.negocioId, nombre, contenido, categoria || 'personalizado']
        );

        res.status(201).json({ id: result.insertId, nombre, contenido, categoria: categoria || 'personalizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error creando plantilla' });
    }
});

router.delete('/plantillas/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM plantillas_mensajes WHERE id = ? AND negocio_id = ?', [req.params.id, req.negocioId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error eliminando plantilla' });
    }
});

module.exports = router;
