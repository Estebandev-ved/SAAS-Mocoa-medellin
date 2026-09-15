const express = require('express');
const router = express.Router();
const { verificarAuth } = require('../middleware/auth');
const { createBackup, exportCSV } = require('../../db/backup');

router.use(verificarAuth);

// POST /api/backup/create - Crear backup manual
router.post('/create', async (req, res) => {
    try {
        const result = await createBackup();
        res.json({ success: true, mensaje: 'Backup creado', archivo: result.file, size: result.size });
    } catch (error) {
        console.error('[Backup] Error:', error.message);
        res.status(500).json({ error: 'Error creando backup' });
    }
});

// GET /api/backup/export/:table - Exportar tabla como CSV
router.get('/export/:table', async (req, res) => {
    try {
        const { table } = req.params;
        const allowedTables = ['clientes', 'productos', 'pedidos', 'conversaciones', 'mensajes'];

        if (!allowedTables.includes(table)) {
            return res.status(400).json({ error: 'Tabla no permitida para exportar' });
        }

        const csv = await exportCSV(table, req.negocioId);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${table}_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csv);
    } catch (error) {
        console.error('[Export] Error:', error.message);
        res.status(500).json({ error: 'Error exportando datos' });
    }
});

// GET /api/backup/archivar - Archivar conversaciones viejas (>30 días)
router.post('/archivar', async (req, res) => {
    try {
        const db = require('../../db/config');
        const dias = req.body.dias || 30;

        const [result] = await db.execute(
            `UPDATE conversaciones SET activa = 0 WHERE activa = 1 AND updated_at < DATE_SUB(NOW(), INTERVAL ? DAY) AND negocio_id = ?`,
            [dias, req.negocioId]
        );

        res.json({
            success: true,
            archivadas: result.affectedRows,
            mensaje: `${result.affectedRows} conversaciones archivadas (más de ${dias} días)`
        });
    } catch (error) {
        console.error('[Archivar] Error:', error.message);
        res.status(500).json({ error: 'Error archivando conversaciones' });
    }
});

module.exports = router;
