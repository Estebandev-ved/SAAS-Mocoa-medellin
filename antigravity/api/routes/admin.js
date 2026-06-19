const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const { verificarAdmin } = require('../middleware/admin');

const INSTANCE_MANAGER_URL = process.env.INSTANCE_MANAGER_URL || 'http://localhost:3001';

router.use(verificarAuth);
router.use(verificarAdmin);

router.get('/negocios', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const buscar = req.query.buscar || '';
        const plan = req.query.plan;
        const estado = req.query.estado;

        let whereClause = "n.rol = 'negocio'";
        let params = [];

        if (buscar) {
            whereClause += ' AND (n.nombre LIKE ? OR n.email_dueno LIKE ?)';
            params.push(`%${buscar}%`, `%${buscar}%`);
        }

        if (plan) {
            whereClause += ' AND n.plan = ?';
            params.push(plan);
        }

        if (estado === 'activo') {
            whereClause += ' AND n.suscripcion_activa = 1';
        } else if (estado === 'inactivo') {
            whereClause += ' AND n.suscripcion_activa = 0';
        }

        const [negocios] = await db.execute(
            `SELECT n.id, n.nombre, n.email_dueno, n.plan, n.whatsapp_conectado,
                    n.suscripcion_activa, n.ciudad, n.created_at,
                    (SELECT COUNT(*) FROM clientes WHERE negocio_id = n.id) as total_clientes,
                    (SELECT COUNT(*) FROM pedidos WHERE negocio_id = n.id) as total_pedidos
             FROM negocios n
             WHERE ${whereClause}
             ORDER BY n.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const [countResult] = await db.execute(
            `SELECT COUNT(*) as total FROM negocios n WHERE ${whereClause}`,
            params
        );

        res.json({
            negocios: negocios,
            pagination: {
                page: page,
                limit: limit,
                total: countResult[0]?.total || 0,
                pages: Math.ceil((countResult[0]?.total || 0) / limit)
            }
        });
    } catch (error) {
        console.error('[Admin] Error negocios:', error);
        res.status(500).json({ error: 'Error al obtener negocios' });
    }
});

router.get('/negocios/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [negocio] = await db.execute(
            `SELECT n.*,
                    (SELECT COUNT(*) FROM clientes WHERE negocio_id = n.id) as total_clientes,
                    (SELECT COUNT(*) FROM pedidos WHERE negocio_id = n.id) as total_pedidos,
                    (SELECT COALESCE(SUM(total), 0) FROM pedidos WHERE negocio_id = n.id) as total_ventas
             FROM negocios n
             WHERE n.id = ? AND n.rol = 'negocio'`,
            [id]
        );

        if (negocio.length === 0) {
            return res.status(404).json({ error: 'Negocio no encontrado' });
        }

        res.json({
            ...negocio[0],
            conversaciones_recientes: [],
            pedidos_recientes: []
        });
    } catch (error) {
        console.error('[Admin] Error negocio:', error);
        res.status(500).json({ error: 'Error al obtener negocio' });
    }
});

router.put('/negocios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nombre, plan, suscripcion_activa, bot_nombre, bot_tono
        } = req.body;

        const updates = [];
        const values = [];

        if (nombre !== undefined) {
            updates.push('nombre = ?');
            values.push(nombre);
        }
        if (plan !== undefined) {
            updates.push('plan = ?');
            values.push(plan);
        }
        if (suscripcion_activa !== undefined) {
            updates.push('suscripcion_activa = ?');
            values.push(suscripcion_activa);
        }
        if (bot_nombre !== undefined) {
            updates.push('bot_nombre = ?');
            values.push(bot_nombre);
        }
        if (bot_tono !== undefined) {
            updates.push('bot_tono = ?');
            values.push(bot_tono);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
        }

        values.push(id);
        await db.execute(
            `UPDATE negocios SET ${updates.join(', ')} WHERE id = ? AND rol = 'negocio'`,
            values
        );

        res.json({ success: true, mensaje: 'Negocio actualizado' });
    } catch (error) {
        console.error('[Admin] Error updating:', error);
        res.status(500).json({ error: 'Error al actualizar negocio' });
    }
});

router.get('/estadisticas', async (req, res) => {
    try {
        const [totalNegocios] = await db.execute(
            `SELECT COUNT(*) as total FROM negocios WHERE rol = 'negocio'`
        );

        const [negociosActivos] = await db.execute(
            `SELECT COUNT(*) as total FROM negocios 
             WHERE rol = 'negocio' AND suscripcion_activa = 1`
        );

        const [ventasMes] = await db.execute(
            `SELECT COALESCE(SUM(total), 0) as total FROM pedidos 
             WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) 
             AND YEAR(created_at) = YEAR(CURRENT_DATE())`
        );

        const [pedidosMes] = await db.execute(
            `SELECT COUNT(*) as total FROM pedidos 
             WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) 
             AND YEAR(created_at) = YEAR(CURRENT_DATE())`
        );

        const [negociosPorPlan] = await db.execute(
            `SELECT plan, COUNT(*) as total FROM negocios WHERE rol = 'negocio' GROUP BY plan`
        );

        const [whatsappConectados] = await db.execute(
            `SELECT COUNT(*) as total FROM negocios WHERE whatsapp_conectado = 1 AND rol = 'negocio'`
        );

        res.json({
            total_negocios: totalNegocios[0]?.total || 0,
            negocios_activos: negociosActivos[0]?.total || 0,
            ventas_mes: parseFloat(ventasMes[0]?.total || 0),
            pedidos_mes: pedidosMes[0]?.total || 0,
            tasa_ia_promedio: 0,
            negocios_por_plan: negociosPorPlan.reduce((acc, row) => {
                acc[row.plan] = row.total;
                return acc;
            }, {}),
            whatsapp_conectados: whatsappConectados[0]?.total || 0,
            tokens_hoy: 0
        });
    } catch (error) {
        console.error('[Admin] Error estadisticas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

router.get('/whatsapps', async (req, res) => {
    try {
        try {
            const response = await fetch(`${INSTANCE_MANAGER_URL}/internal/status/all`);
            if (response.ok) {
                const status = await response.json();
                return res.json(status);
            }
        } catch {
            console.log('[Admin] Instance Manager no disponible');
        }

        const [negocios] = await db.execute(
            `SELECT id, nombre, whatsapp_conectado, numero_whatsapp
             FROM negocios WHERE rol = 'negocio'`
        );

        res.json({
            whatsapps: negocios.map(n => ({
                negocio_id: n.id,
                nombre: n.nombre,
                conectado: n.whatsapp_conectado,
                numero: n.numero_whatsapp
            }))
        });
    } catch (error) {
        console.error('[Admin] Error whatsapps:', error);
        res.status(500).json({ error: 'Error al obtener estado de WhatsApps' });
    }
});

router.post('/demo', async (req, res) => {
    try {
        const { nombre, email, telefono } = req.body;

        const bcrypt = require('bcryptjs');
        const passwordHash = await bcrypt.hash('Demo2024#', 10);

        const [result] = await db.execute(
            `INSERT INTO negocios (nombre, email_dueno, password, whatsapp, plan, 
                                   activo, suscripcion_activa, bot_nombre, bot_tono,
                                   terminos_aceptados, trial_hasta)
             VALUES (?, ?, ?, ?, 'starter', 1, 1, 'Asistente', 'amigable', 1, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
            [nombre || 'Demo Temporal', email || `demo_${Date.now()}@demo.com`, passwordHash, telefono || '+573000000000']
        );

        res.json({
            success: true,
            negocio_id: result.insertId,
            mensaje: 'Negocio demo creado exitosamente',
            credenciales: {
                email: email || `demo_${Date.now()}@demo.com`,
                password: 'Demo2024#'
            }
        });
    } catch (error) {
        console.error('[Admin] Error demo:', error);
        res.status(500).json({ error: 'Error al crear negocio demo' });
    }
});

router.get('/suscripciones', async (req, res) => {
    try {
        const [suscripciones] = await db.execute(
            `SELECT n.id as negocio_id, n.nombre as negocio_nombre, n.plan, n.suscripcion_activa,
                    n.trial_hasta, n.created_at as fecha_inicio
             FROM negocios n
             WHERE n.rol = 'negocio'
             ORDER BY n.created_at DESC
             LIMIT 100`
        );
        
        const precios = { starter: 450000, professional: 850000, enterprise: 1800000 };
        const mrr = suscripciones.reduce((acc, s) => acc + (precios[s.plan] || 0), 0);
        
        res.json({
            suscripciones: suscripciones,
            stats: {
                mrr,
                churn_mes: 0,
                trials_activos: 0
            }
        });
    } catch (error) {
        console.error('[Admin] Error suscripciones:', error);
        res.status(500).json({ error: 'Error al obtener suscripciones' });
    }
});

router.put('/suscripciones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { plan } = req.body;
        
        if (plan) {
            await db.execute('UPDATE negocios SET plan = ? WHERE id = ?', [plan, id]);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('[Admin] Error update suscripcion:', error);
        res.status(500).json({ error: 'Error al actualizar suscripción' });
    }
});

router.get('/logs', async (req, res) => {
    res.json({ logs: [] });
});

router.get('/config', async (req, res) => {
    res.json({
        config: {
            plataforma: { nombre: 'Antigravity', email_soporte: 'soporte@antigravity.co' },
            planes: {
                starter: { precio: 450000 },
                professional: { precio: 850000 },
                enterprise: { precio: 1800000 }
            }
        }
    });
});

router.put('/config', async (req, res) => {
    res.json({ success: true });
});

router.post('/whatsapps/:id/reconectar', async (req, res) => {
    res.json({ success: true, mensaje: 'Reconexión iniciada' });
});

module.exports = router;
