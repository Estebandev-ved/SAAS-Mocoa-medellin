const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');

router.use(verificarAuth);

// GET /api/horarios - Obtener horarios del negocio
router.get('/', async (req, res) => {
    try {
        const [horarios] = await db.execute(
            'SELECT * FROM horarios_avanzados WHERE negocio_id = ? ORDER BY dia_semana',
            [req.negocioId]
        );

        const [festivos] = await db.execute(
            'SELECT * FROM festivos WHERE negocio_id = ? AND fecha >= CURDATE() ORDER BY fecha',
            [req.negocioId]
        );

        res.json({ horarios, festivos });
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo horarios' });
    }
});

// PUT /api/horarios - Actualizar horarios
router.put('/', async (req, res) => {
    try {
        const { horarios } = req.body;

        if (!Array.isArray(horarios)) {
            return res.status(400).json({ error: 'horarios debe ser un array' });
        }

        for (const h of horarios) {
            await db.execute(
                `INSERT INTO horarios_avanzados (negocio_id, dia_semana, hora_inicio, hora_fin, activo)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE hora_inicio = VALUES(hora_inicio), hora_fin = VALUES(hora_fin), activo = VALUES(activo)`,
                [req.negocioId, h.dia, h.inicio, h.fin, h.activo ? 1 : 0]
            );
        }

        res.json({ success: true, mensaje: 'Horarios actualizados' });
    } catch (error) {
        res.status(500).json({ error: 'Error actualizando horarios' });
    }
});

// POST /api/horarios/festivos - Agregar festivo
router.post('/festivos', async (req, res) => {
    try {
        const { fecha, nombre } = req.body;
        if (!fecha || !nombre) {
            return res.status(400).json({ error: 'Fecha y nombre requeridos' });
        }

        await db.execute(
            'INSERT INTO festivos (negocio_id, fecha, nombre) VALUES (?, ?, ?)',
            [req.negocioId, fecha, nombre]
        );

        res.status(201).json({ success: true, mensaje: 'Festivo agregado' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Esa fecha ya es festiva' });
        }
        res.status(500).json({ error: 'Error agregando festivo' });
    }
});

// DELETE /api/horarios/festivos/:id - Eliminar festivo
router.delete('/festivos/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM festivos WHERE id = ? AND negocio_id = ?', [req.params.id, req.negocioId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error eliminando festivo' });
    }
});

// GET /api/horarios/verificar - Verificar si el negocio está abierto ahora
router.get('/verificar', async (req, res) => {
    try {
        const now = new Date();
        const diaSemana = now.getDay();
        const horaActual = now.toTimeString().substring(0, 8);

        // Check holidays
        const [festivos] = await db.execute(
            'SELECT id FROM festivos WHERE negocio_id = ? AND fecha = CURDATE()',
            [req.negocioId]
        );

        if (festivos.length > 0) {
            return res.json({ abierto: false, razon: 'festivo' });
        }

        // Check schedule
        const [horarios] = await db.execute(
            'SELECT * FROM horarios_avanzados WHERE negocio_id = ? AND dia_semana = ? AND activo = 1',
            [req.negocioId, diaSemana]
        );

        if (horarios.length === 0) {
            return res.json({ abierto: false, razon: 'dia_no_laboral' });
        }

        const h = horarios[0];
        const abierto = horaActual >= h.hora_inicio && horaActual <= h.hora_fin;

        res.json({ abierto, razon: abierto ? 'dentro_horario' : 'fuera_horario', horario: `${h.hora_inicio}-${h.hora_fin}` });
    } catch (error) {
        res.status(500).json({ error: 'Error verificando horario' });
    }
});

module.exports = router;
