const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const { PLANS, getPlan, getPlanPrice, checkLimit, getNextPlan, getPrevPlan, getAllPlans } = require('../../config/planConfig');

router.use(verificarAuth);

// ===== PLAN INFO =====

// GET /api/suscripcion/planes - Listar todos los planes
router.get('/planes', (req, res) => {
    const planes = getAllPlans().map(p => ({
        id: p.id,
        name: p.name,
        nameEs: p.nameEs,
        price: p.price,
        priceUSD: p.priceUSD,
        trialDays: p.trialDays,
        features: p.features,
        color: p.color,
        popular: p.popular,
    }));
    res.json(planes);
});

// GET /api/suscripcion/actual - Estado actual de la suscripción
router.get('/actual', async (req, res) => {
    try {
        const [negocios] = await db.execute(
            `SELECT plan, suscripcion_activa, suscripcion_inicio, suscripcion_fin,
                    trial_hasta, trial_inicio, stripe_customer_id
             FROM negocios WHERE id = ?`,
            [req.negocioId]
        );

        if (negocios.length === 0) {
            return res.status(404).json({ error: 'Negocio no encontrado' });
        }

        const n = negocios[0];
        const planActual = getPlan(n.plan);
        const now = new Date();

        // Check trial status
        const enTrial = n.trial_hasta && new Date(n.trial_hasta) > now && !n.suscripcion_activa;
        const diasTrialRestantes = n.trial_hasta
            ? Math.max(0, Math.ceil((new Date(n.trial_hasta) - now) / (1000 * 60 * 60 * 24)))
            : 0;

        // Check subscription status
        const suscripcionVencida = n.suscripcion_fin && new Date(n.suscripcion_fin) < now;
        const suscripcionActiva = n.suscripcion_activa && !suscripcionVencida;

        // Uso real del mes — antes esto leía de `subscription_usage`, una
        // tabla que nada en el proyecto escribe, así que siempre devolvía
        // ceros sin importar el uso real. Se calcula en vivo igual que
        // GET /api/suscripcion/uso, desde las tablas operativas.
        const periodo = now.toISOString().substring(0, 7);
        const [logsStats] = await db.execute(
            `SELECT COUNT(*) as total FROM agente_logs
             WHERE negocio_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
            [req.negocioId, periodo]
        );
        const [clientesStats] = await db.execute(
            `SELECT COUNT(*) as total FROM clientes
             WHERE negocio_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
            [req.negocioId, periodo]
        );
        const uso = {
            mensajes_usados: logsStats[0]?.total || 0,
            clientes_nuevos: clientesStats[0]?.total || 0,
            productos_creados: 0,
        };

        // Check limits
        const limiteMensajes = checkLimit(n.plan, 'maxMessages', uso.mensajes_usados);
        const limiteClientes = checkLimit(n.plan, 'maxClients', uso.clientes_nuevos);

        // Next billing date
        const proximoPago = n.suscripcion_fin ? new Date(n.suscripcion_fin).toISOString().split('T')[0] : null;

        res.json({
            plan: n.plan,
            plan_nombre: planActual.nameEs,
            plan_precio: planActual.price,
            plan_features: planActual.features,
            estado: suscripcionActiva ? 'activa' : enTrial ? 'trial' : 'inactiva',
            en_trial: enTrial,
            dias_trial_restantes: diasTrialRestantes,
            trial_fin: n.trial_hasta,
            suscripcion_activa: suscripcionActiva,
            suscripcion_inicio: n.suscripcion_inicio,
            suscripcion_fin: n.suscripcion_fin,
            proximo_pago: proximoPago,
            stripe_customer_id: n.stripe_customer_id,
            uso: {
                mensajes: uso.mensajes_usados,
                mensajes_limite: limiteMensajes.limit,
                mensajes_restantes: limiteMensajes.remaining,
                mensajes_porcentaje: limiteMensajes.percentage || 0,
                clientes: uso.clientes_nuevos,
                clientes_limite: limiteClientes.limit,
            },
            siguiente_plan: getNextPlan(n.plan) ? {
                id: getNextPlan(n.plan).id,
                nombre: getNextPlan(n.plan).nameEs,
                precio: getNextPlan(n.plan).price,
            } : null,
        });
    } catch (error) {
        console.error('[Suscripcion] Error:', error.message);
        res.status(500).json({ error: 'Error obteniendo suscripción' });
    }
});

// ===== UPGRADE =====

// POST /api/suscripcion/upgrade - Cambiar a plan superior
router.post('/upgrade', async (req, res) => {
    try {
        const { plan } = req.body;
        const nextPlan = getPlan(plan);

        if (!nextPlan) {
            return res.status(400).json({ error: 'Plan inválido' });
        }

        const [negocios] = await db.execute(
            'SELECT plan, suscripcion_activa, suscripcion_fin FROM negocios WHERE id = ?',
            [req.negocioId]
        );
        const actual = negocios[0];

        // Determine new plan
        const planOrder = ['starter', 'professional', 'enterprise'];
        const actualIdx = planOrder.indexOf(actual.plan);
        const nuevoIdx = planOrder.indexOf(plan);

        if (nuevoIdx <= actualIdx) {
            return res.status(400).json({ error: 'Use downgrade para cambiar a un plan inferior' });
        }

        const now = new Date();
        const nuevoInicio = actual.suscripcion_activa ? now : now;
        const nuevoFin = new Date(now);
        nuevoFin.setMonth(nuevoFin.getMonth() + 1);

        // Update negocio
        await db.execute(
            `UPDATE negocios SET plan = ?, suscripcion_activa = 1,
             suscripcion_inicio = ?, suscripcion_fin = ?
             WHERE id = ?`,
            [plan, nuevoInicio, nuevoFin, req.negocioId]
        );

        // Update or create subscription record
        const [existSub] = await db.execute(
            'SELECT id FROM suscripciones WHERE negocio_id = ? ORDER BY id DESC LIMIT 1',
            [req.negocioId]
        );

        if (existSub.length > 0) {
            await db.execute(
                `UPDATE suscripciones SET plan = ?, estado = 'activa',
                 pago_inicio = ?, pago_fin = ?, monto_mensual = ?
                 WHERE id = ?`,
                [plan, nuevoInicio, nuevoFin, nextPlan.price, existSub[0].id]
            );
        } else {
            await db.execute(
                `INSERT INTO suscripciones (negocio_id, plan, estado, pago_inicio, pago_fin, monto_mensual)
                 VALUES (?, ?, 'activa', ?, ?, ?)`,
                [req.negocioId, plan, nuevoInicio, nuevoFin, nextPlan.price]
            );
        }

        // Create invoice
        const invoiceNum = `INV-${Date.now()}-${req.negocioId}`;
        await db.execute(
            `INSERT INTO invoices (negocio_id, numero, plan, monto, estado, fecha_pago, fecha_vencimiento, descripcion)
             VALUES (?, ?, ?, ?, 'pagada', NOW(), ?, ?)`,
            [req.negocioId, invoiceNum, plan, nextPlan.price, nuevoFin, `Upgrade de ${actual.plan} a ${plan}`]
        );

        // Log billing history
        await db.execute(
            `INSERT INTO billing_history (negocio_id, tipo, plan_anterior, plan_nuevo, monto, descripcion)
             VALUES (?, 'upgrade', ?, ?, ?, ?)`,
            [req.negocioId, actual.plan, plan, nextPlan.price, `Upgrade de ${actual.plan} a ${plan}`]
        );

        console.log(`[Suscripcion] Upgrade: negocio ${req.negocioId} de ${actual.plan} a ${plan}`);

        res.json({
            success: true,
            mensaje: `Plan actualizado a ${nextPlan.nameEs}`,
            plan: nextPlan.id,
            precio: nextPlan.price,
            nuevo_fin: nuevoFin,
        });
    } catch (error) {
        console.error('[Suscripcion] Error upgrade:', error.message);
        res.status(500).json({ error: 'Error procesando upgrade' });
    }
});

// ===== DOWNGRADE =====

// POST /api/suscripcion/downgrade - Cambiar a plan inferior
router.post('/downgrade', async (req, res) => {
    try {
        const { plan } = req.body;
        const nuevoPlan = getPlan(plan);

        if (!nuevoPlan) {
            return res.status(400).json({ error: 'Plan inválido' });
        }

        const [negocios] = await db.execute(
            'SELECT plan FROM negocios WHERE id = ?',
            [req.negocioId]
        );
        const actual = negocios[0];

        const planOrder = ['starter', 'professional', 'enterprise'];
        const actualIdx = planOrder.indexOf(actual.plan);
        const nuevoIdx = planOrder.indexOf(plan);

        if (nuevoIdx >= actualIdx) {
            return res.status(400).json({ error: 'Use upgrade para cambiar a un plan superior' });
        }

        // Downgrade takes effect at next billing cycle
        await db.execute(
            'UPDATE negocios SET plan = ? WHERE id = ?',
            [plan, req.negocioId]
        );

        await db.execute(
            `INSERT INTO billing_history (negocio_id, tipo, plan_anterior, plan_nuevo, monto, descripcion)
             VALUES (?, 'downgrade', ?, ?, ?, ?)`,
            [req.negocioId, actual.plan, plan, nuevoPlan.price, `Downgrade de ${actual.plan} a ${plan} (efectivo en próximo ciclo)`]
        );

        console.log(`[Suscripcion] Downgrade: negocio ${req.negocioId} de ${actual.plan} a ${plan}`);

        res.json({
            success: true,
            mensaje: `Plan cambiado a ${nuevoPlan.nameEs}. Efectivo en el próximo ciclo de facturación.`,
            plan: nuevoPlan.id,
        });
    } catch (error) {
        console.error('[Suscripcion] Error downgrade:', error.message);
        res.status(500).json({ error: 'Error procesando downgrade' });
    }
});

// ===== CANCEL =====

// POST /api/suscripcion/cancelar - Cancelar suscripción
router.post('/cancelar', async (req, res) => {
    try {
        const { motivo } = req.body;

        const [negocios] = await db.execute(
            'SELECT plan, suscripcion_activa FROM negocios WHERE id = ?',
            [req.negocioId]
        );
        const actual = negocios[0];

        if (!actual.suscripcion_activa) {
            return res.status(400).json({ error: 'No tienes una suscripción activa' });
        }

        await db.execute(
            `UPDATE negocios SET suscripcion_activa = 0 WHERE id = ?`,
            [req.negocioId]
        );

        await db.execute(
            `UPDATE suscripciones SET estado = 'cancelada' WHERE negocio_id = ? AND estado = 'activa'`,
            [req.negocioId]
        );

        await db.execute(
            `INSERT INTO billing_history (negocio_id, tipo, plan_anterior, monto, descripcion, metadata)
             VALUES (?, 'cancellation', ?, 0, ?, ?)`,
            [req.negocioId, actual.plan, motivo || 'Cancelación solicitada por el usuario', JSON.stringify({ motivo })]
        );

        console.log(`[Suscripcion] Cancelación: negocio ${req.negocioId}, plan ${actual.plan}`);

        res.json({
            success: true,
            mensaje: 'Suscripción cancelada. Mantienes acceso hasta el fin del período facturado.',
        });
    } catch (error) {
        console.error('[Suscripcion] Error cancelar:', error.message);
        res.status(500).json({ error: 'Error cancelando suscripción' });
    }
});

// ===== REACTIVATE =====

// POST /api/suscripcion/reactivar - Reactivar suscripción cancelada
router.post('/reactivar', async (req, res) => {
    try {
        const [negocios] = await db.execute(
            'SELECT plan, suscripcion_activa, suscripcion_fin FROM negocios WHERE id = ?',
            [req.negocioId]
        );
        const actual = negocios[0];

        if (actual.suscripcion_activa) {
            return res.status(400).json({ error: 'La suscripción ya está activa' });
        }

        const now = new Date();
        const nuevoFin = new Date(now);
        nuevoFin.setMonth(nuevoFin.getMonth() + 1);

        await db.execute(
            `UPDATE negocios SET suscripcion_activa = 1, suscripcion_inicio = ?, suscripcion_fin = ? WHERE id = ?`,
            [now, nuevoFin, req.negocioId]
        );

        await db.execute(
            `UPDATE suscripciones SET estado = 'activa', pago_inicio = ?, pago_fin = ? WHERE negocio_id = ? AND estado = 'cancelada' ORDER BY id DESC LIMIT 1`,
            [now, nuevoFin, req.negocioId]
        );

        await db.execute(
            `INSERT INTO billing_history (negocio_id, tipo, plan_nuevo, monto, descripcion)
             VALUES (?, 'reactivation', ?, ?, ?)`,
            [req.negocioId, actual.plan, getPlanPrice(actual.plan), 'Reactivación de suscripción']
        );

        res.json({ success: true, mensaje: 'Suscripción reactivada' });
    } catch (error) {
        console.error('[Suscripcion] Error reactivar:', error.message);
        res.status(500).json({ error: 'Error reactivando suscripción' });
    }
});

// ===== BILLING HISTORY =====

// GET /api/suscripcion/facturas - Historial de facturas
router.get('/facturas', async (req, res) => {
    try {
        const [facturas] = await db.execute(
            'SELECT * FROM invoices WHERE negocio_id = ? ORDER BY created_at DESC LIMIT 50',
            [req.negocioId]
        );
        res.json(facturas);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo facturas' });
    }
});

// GET /api/suscripcion/historial - Historial de cambios de plan
router.get('/historial', async (req, res) => {
    try {
        const [historial] = await db.execute(
            'SELECT * FROM billing_history WHERE negocio_id = ? ORDER BY created_at DESC LIMIT 50',
            [req.negocioId]
        );
        res.json(historial);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo historial' });
    }
});

// ===== USAGE =====

// GET /api/suscripcion/uso - Uso actual del período
router.get('/uso', async (req, res) => {
    try {
        const periodo = new Date().toISOString().substring(0, 7);

        // Read REAL usage from agente_logs (authoritative source)
        const [logsStats] = await db.execute(
            `SELECT COUNT(*) as mensajes, COALESCE(SUM(tokens_usados), 0) as tokens
             FROM agente_logs
             WHERE negocio_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
            [req.negocioId, periodo]
        );

        const [negocios] = await db.execute('SELECT plan FROM negocios WHERE id = ?', [req.negocioId]);
        const plan = negocios[0]?.plan || 'starter';

        const mensajesUsados = logsStats[0]?.mensajes || 0;
        const tokensUsados = logsStats[0]?.tokens || 0;

        // Also get clients and products counts from their tables
        const [clientesCount] = await db.execute(
            `SELECT COUNT(*) as total FROM clientes
             WHERE negocio_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
            [req.negocioId, periodo]
        );
        const [productosCount] = await db.execute(
            `SELECT COUNT(*) as total FROM productos
             WHERE negocio_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
            [req.negocioId, periodo]
        );

        const uso = {
            mensajes_usados: mensajesUsados,
            ai_tokens_usados: tokensUsados,
            clientes_nuevos: clientesCount[0]?.total || 0,
            productos_creados: productosCount[0]?.total || 0,
            campañas_enviadas: 0,
        };

        res.json({
            periodo,
            plan,
            uso,
            limites: {
                mensajes: checkLimit(plan, 'maxMessages', uso.mensajes_usados),
                clientes: checkLimit(plan, 'maxClients', uso.clientes_nuevos),
                productos: checkLimit(plan, 'maxProducts', uso.productos_creados),
                campañas: checkLimit(plan, 'maxCampaigns', uso.campañas_enviadas),
            }
        });
    } catch (error) {
        console.error('[Suscripcion] Error uso:', error.message);
        res.status(500).json({ error: 'Error obteniendo uso' });
    }
});

module.exports = router;
