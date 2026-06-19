const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verificarAuth } = require('../middleware/auth');

const BRAIN_URL = process.env.BRAIN_URL || 'http://localhost:8000';

router.use(verificarAuth);

router.get('/stats', async (req, res) => {
    try {
        const response = await axios.get(`${BRAIN_URL}/agentes/stats`);
        res.json(response.data);
    } catch (error) {
        console.error('[AgentesAPI] Error obtieniendo stats:', error.message);
        res.json({
            supervisores: 0,
            workers: 0,
            cola: 0,
            mensajes_procesados: 0,
            tiempo_respuesta_promedio_ms: 0,
            error: 'Brain no disponible'
        });
    }
});

router.get('/presupuesto', async (req, res) => {
    try {
        const negocioId = req.negocio.id;
        const response = await axios.get(`${BRAIN_URL}/agentes/presupuesto/${negocioId}`);
        res.json(response.data);
    } catch (error) {
        console.error('[AgentesAPI] Error presupuesto:', error.message);
        res.json({
            tokens_usados: 0,
            limite: 50000,
            porcentaje: 0,
            restantes: 50000
        });
    }
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

router.post('/seguimiento/ejecutar', async (req, res) => {
    try {
        const negocioId = req.negocio.id;
        const response = await axios.post(`${BRAIN_URL}/agentes/ejecutar-seguimiento/${negocioId}`);
        res.json(response.data);
    } catch (error) {
        console.error('[AgentesAPI] Error seguimiento:', error.message);
        res.json({ error: 'Error ejecutando seguimiento' });
    }
});

module.exports = router;