const express = require('express');
const router = express.Router();
const { verificarAuth } = require('../middleware/auth');

router.use(verificarAuth);

// El servicio Python `brain/` que calculaba estas métricas fue retirado del
// proyecto (un solo cerebro real en `instance-manager/`, en Node). Estos dos
// endpoints se dejan con la misma forma de respuesta que ya devolvían cuando
// el brain no estaba disponible, sin el intento de red que siempre fallaba.
router.get('/stats', async (req, res) => {
    res.json({
        supervisores: 0,
        workers: 0,
        cola: 0,
        mensajes_procesados: 0,
        tiempo_respuesta_promedio_ms: 0,
        error: 'No disponible'
    });
});

router.get('/presupuesto', async (req, res) => {
    res.json({
        tokens_usados: 0,
        limite: 50000,
        porcentaje: 0,
        restantes: 50000
    });
});

router.get('/logs', async (req, res) => {
    const db = require('../index').db;
    
    try {
        const negocioId = req.negocio.id;
        const limite = parseInt(req.query.limite) || 50;
        
        const [logs] = await db.execute(
            `SELECT al.*, c.nombre as cliente_nombre, c.telefono
             FROM agente_logs al
             LEFT JOIN clientes c ON c.id = al.cliente_id AND c.negocio_id = al.negocio_id
             WHERE al.negocio_id = ?
             ORDER BY al.fecha_creacion DESC
             LIMIT ?`,
            [negocioId, limite]
        );
        
        res.json(logs);
    } catch (error) {
        console.error('[AgentesAPI] Error logs:', error.message);
        res.json([]);
    }
});

router.get('/intenciones', async (req, res) => {
    const db = require('../index').db;
    
    try {
        const negocioId = req.negocio.id;
        const dias = parseInt(req.query.dias) || 7;
        
        const [intenciones] = await db.execute(
            `SELECT intencion_detectada, COUNT(*) as cantidad
             FROM agente_logs
             WHERE negocio_id = ? 
               AND fecha_creacion >= DATE_SUB(NOW(), INTERVAL ? DAY)
             GROUP BY intencion_detectada
             ORDER BY cantidad DESC`,
            [negocioId, dias]
        );
        
        res.json(intenciones);
    } catch (error) {
        console.error('[AgentesAPI] Error intenciones:', error.message);
        res.json([]);
    }
});

// El disparo manual por negocio pasaba por el `brain/` (Python) retirado.
// El reengagement real hoy corre solo, cada 5 min, para todos los negocios
// que lo tengan activo (ver revisarReengagement() en api/scheduler.js) — no
// hay disparo por negocio individual todavía.
router.post('/seguimiento/ejecutar', async (req, res) => {
    res.status(501).json({ error: 'El seguimiento se ejecuta automáticamente cada 5 minutos, no hay disparo manual disponible' });
});

module.exports = router;