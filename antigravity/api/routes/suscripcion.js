const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const {
    PLAN_ORDER, FEATURE_LABELS, LIMIT_LABELS, getPlan, getAllPlans, getIncludedFeatureLabels, checkLimit,
} = require('../../config/planConfig');
const billing = require('../services/billing');

router.use(verificarAuth);

const COLUMNAS_NEGOCIO = `plan, plan_pendiente, suscripcion_activa, suscripcion_inicio, suscripcion_fin,
                          trial_hasta, trial_inicio, stripe_customer_id`;

async function cargarNegocio(negocioId) {
    const [rows] = await db.execute(`SELECT ${COLUMNAS_NEGOCIO} FROM negocios WHERE id = ?`, [negocioId]);
    return rows[0] || null;
}

// Un downgrade programado se aplica cuando el ciclo pagado termina. Se hace al
// consultar (y en tenant.js) porque no hay un job de renovación que lo haga.
async function aplicarPlanPendienteVencido(negocioId, n) {
    if (!n.plan_pendiente || n.suscripcion_activa) return n;
    const { estado } = billing.calcularEstado(n);
    if (estado !== 'vencida') return n;
    await db.execute('UPDATE negocios SET plan = ?, plan_pendiente = NULL WHERE id = ?', [n.plan_pendiente, negocioId]);
    return { ...n, plan: n.plan_pendiente, plan_pendiente: null };
}

function resumenPlan(id) {
    const p = getPlan(id);
    return { id: p.id, nombre: p.nameEs, precio: p.price };
}

// ===== PLAN INFO =====

// GET /api/suscripcion/planes - Los 3 planes, con lo que incluye cada uno
router.get('/planes', (req, res) => {
    const planes = getAllPlans().map((p, i) => {
        const limites = Object.entries(LIMIT_LABELS)
            .filter(([k]) => p.features[k] !== undefined && p.features[k] !== 0)
            .map(([k, label]) => ({
                key: k, label,
                valor: p.features[k],
            }));
        // "Todo lo de X, más:" solo si este plan realmente incluye todo lo de X.
        // Emprendedor (la caja) es un producto aparte: Starter no lo incluye.
        const previo = i > 0 ? PLAN_ORDER[i - 1] : null;
        const anterior = previo && billing.compararPlanes(previo, p.id).pierdes.length === 0 ? previo : null;
        const nuevas = anterior
            ? billing.compararPlanes(anterior, p.id).ganas
            : getIncludedFeatureLabels(p.id);
        return {
            id: p.id,
            nombre: p.nameEs,
            precio: p.price,
            precio_usd: p.priceUSD,
            popular: !!p.popular,
            limites,
            incluye_todo_de: anterior ? getPlan(anterior).nameEs : null,
            caracteristicas: nuevas,
        };
    });
    res.json(planes);
});

// GET /api/suscripcion/actual - Estado actual de la suscripción
router.get('/actual', async (req, res) => {
    try {
        let n = await cargarNegocio(req.negocioId);
        if (!n) return res.status(404).json({ error: 'Negocio no encontrado' });
        n = await aplicarPlanPendienteVencido(req.negocioId, n);

        const now = new Date();
        const { estado, en_trial, acceso_hasta } = billing.calcularEstado(n, now);
        const planActual = getPlan(n.plan);
        const diasTrialRestantes = en_trial && n.trial_hasta
            ? Math.max(0, Math.ceil((new Date(n.trial_hasta) - now) / 86400000))
            : 0;
        const diasRestantes = acceso_hasta
            ? Math.max(0, Math.ceil((new Date(acceso_hasta) - now) / 86400000))
            : null;

        res.json({
            plan: n.plan,
            plan_nombre: planActual.nameEs,
            plan_precio: planActual.price,
            estado,
            en_trial,
            dias_trial_restantes: diasTrialRestantes,
            trial_fin: n.trial_hasta,
            suscripcion_activa: estado === 'activa',
            suscripcion_inicio: n.suscripcion_inicio,
            suscripcion_fin: n.suscripcion_fin,
            // Fecha del próximo cobro: solo existe si la suscripción sigue renovándose.
            proximo_pago: estado === 'activa' && n.suscripcion_fin
                ? new Date(n.suscripcion_fin).toISOString().split('T')[0] : null,
            acceso_hasta: acceso_hasta ? new Date(acceso_hasta).toISOString().split('T')[0] : null,
            dias_restantes: diasRestantes,
            plan_pendiente: n.plan_pendiente ? resumenPlan(n.plan_pendiente) : null,
            puede_cancelar: estado === 'activa' && !!n.suscripcion_fin,
            puede_reactivar: estado === 'cancelada',
            modo_pagos: billing.modoPagos(),
            tiene_facturacion_stripe: !!n.stripe_customer_id,
            tiene_suscripcion_stripe: !!(await billing.stripeSubIdDe(req.negocioId)),
        });
    } catch (error) {
        console.error('[Suscripcion] Error:', error.message);
        res.status(500).json({ error: 'Error obteniendo suscripción' });
    }
});

// GET /api/suscripcion/cambio/:plan - Qué implica pasar a ese plan (para confirmar antes de actuar)
router.get('/cambio/:plan', async (req, res) => {
    try {
        const destino = req.params.plan;
        if (!billing.planValido(destino)) return res.status(400).json({ error: 'Plan inválido' });

        const n = await cargarNegocio(req.negocioId);
        if (!n) return res.status(404).json({ error: 'Negocio no encontrado' });

        const { estado, acceso_hasta } = billing.calcularEstado(n);
        const sube = PLAN_ORDER.indexOf(destino) > PLAN_ORDER.indexOf(n.plan);
        const baja = PLAN_ORDER.indexOf(destino) < PLAN_ORDER.indexOf(n.plan);
        const hayCicloPagado = estado === 'activa' && !!n.suscripcion_fin;

        // activar    prueba/vencida/inactiva: cualquier plan se paga completo y arranca un ciclo
        // upgrade    subir con el ciclo vigente
        // downgrade  bajar (se programa para el fin del ciclo)
        // mismo      ya está en ese plan
        let tipo;
        if (['trial', 'vencida', 'inactiva'].includes(estado)) tipo = 'activar';
        else if (sube) tipo = 'upgrade';
        else if (baja) tipo = 'downgrade';
        else tipo = 'mismo';

        const { ganas, pierdes, limites } = billing.compararPlanes(n.plan, destino);
        const bloqueos = baja ? await billing.bloqueosDowngrade(req.negocioId, destino) : [];
        const motivoBloqueo = tipo === 'downgrade' ? null : billing.validarCompra(n, destino);

        res.json({
            tipo,
            estado,
            plan_actual: resumenPlan(n.plan),
            plan_destino: resumenPlan(destino),
            ganas, pierdes, limites, bloqueos,
            motivo_bloqueo: motivoBloqueo,
            se_cobra_ahora: tipo === 'activar' || tipo === 'upgrade',
            reinicia_ciclo: tipo === 'upgrade',
            efectivo: tipo === 'downgrade' && hayCicloPagado ? 'fin_de_ciclo' : 'inmediato',
            efectivo_el: tipo === 'downgrade' && hayCicloPagado && acceso_hasta
                ? new Date(acceso_hasta).toISOString().split('T')[0] : null,
        });
    } catch (error) {
        console.error('[Suscripcion] Error cambio:', error.message);
        res.status(500).json({ error: 'Error calculando el cambio de plan' });
    }
});

// ===== DOWNGRADE =====

// POST /api/suscripcion/downgrade - Bajar de plan (se programa para el fin del ciclo pagado)
router.post('/downgrade', async (req, res) => {
    try {
        const { plan } = req.body;
        if (!billing.planValido(plan)) return res.status(400).json({ error: 'Plan inválido' });

        const n = await cargarNegocio(req.negocioId);
        if (!n) return res.status(404).json({ error: 'Negocio no encontrado' });

        if (PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(n.plan)) {
            return res.status(400).json({ error: 'Ese no es un plan inferior al tuyo' });
        }

        const bloqueos = await billing.bloqueosDowngrade(req.negocioId, plan);
        if (bloqueos.length) {
            return res.status(409).json({ error: bloqueos[0], codigo: 'LIMITES_EXCEDIDOS', bloqueos });
        }

        const { estado, acceso_hasta } = billing.calcularEstado(n);
        const hayCicloPagado = estado === 'activa' && !!n.suscripcion_fin;
        const nuevoPlan = getPlan(plan);

        // Con Stripe real, el precio del cobro recurrente vive en Stripe: el cambio
        // se hace en su portal de facturación para que el cobro y el plan no se separen.
        if (hayCicloPagado && billing.STRIPE_CONFIGURADO && await billing.stripeSubIdDe(req.negocioId)) {
            return res.status(409).json({
                error: 'Cambia tu plan desde el portal de facturación.',
                codigo: 'USAR_PORTAL',
            });
        }

        if (!hayCicloPagado) {
            // Prueba gratis o cuenta sin ciclo pagado: no hay nada que esperar.
            await db.execute('UPDATE negocios SET plan = ?, plan_pendiente = NULL WHERE id = ?', [plan, req.negocioId]);
        } else {
            await db.execute('UPDATE negocios SET plan_pendiente = ? WHERE id = ?', [plan, req.negocioId]);
        }

        await db.execute(
            `INSERT INTO billing_history (negocio_id, tipo, plan_anterior, plan_nuevo, monto, descripcion)
             VALUES (?, 'downgrade', ?, ?, ?, ?)`,
            [req.negocioId, n.plan, plan, nuevoPlan.price,
             hayCicloPagado
                ? `Cambio a ${nuevoPlan.nameEs} programado para el fin del ciclo`
                : `Cambio a ${nuevoPlan.nameEs}`]
        );

        const fecha = acceso_hasta ? new Date(acceso_hasta).toISOString().split('T')[0] : null;
        res.json({
            success: true,
            programado: hayCicloPagado,
            efectivo_el: hayCicloPagado ? fecha : null,
            plan: nuevoPlan.id,
            mensaje: hayCicloPagado
                ? `Pasarás a ${nuevoPlan.nameEs} cuando termine tu ciclo actual. Hasta entonces conservas tu plan.`
                : `Tu plan ahora es ${nuevoPlan.nameEs}.`,
        });
    } catch (error) {
        console.error('[Suscripcion] Error downgrade:', error.message);
        res.status(500).json({ error: 'Error procesando el cambio de plan' });
    }
});

// POST /api/suscripcion/downgrade/cancelar - Arrepentirse de un cambio programado
router.post('/downgrade/cancelar', async (req, res) => {
    try {
        const [result] = await db.execute(
            'UPDATE negocios SET plan_pendiente = NULL WHERE id = ? AND plan_pendiente IS NOT NULL',
            [req.negocioId]
        );
        if (!result.affectedRows) return res.status(400).json({ error: 'No tienes ningún cambio programado' });
        res.json({ success: true, mensaje: 'Cambio de plan cancelado. Sigues en tu plan actual.' });
    } catch (error) {
        console.error('[Suscripcion] Error cancelando downgrade:', error.message);
        res.status(500).json({ error: 'Error cancelando el cambio de plan' });
    }
});

// ===== CANCEL =====

// POST /api/suscripcion/cancelar - Cancelar la renovación (el acceso sigue hasta el fin del ciclo)
router.post('/cancelar', async (req, res) => {
    try {
        const motivo = typeof req.body.motivo === 'string' ? req.body.motivo.trim().slice(0, 500) : '';

        const n = await cargarNegocio(req.negocioId);
        if (!n) return res.status(404).json({ error: 'Negocio no encontrado' });

        const { estado, en_trial, acceso_hasta } = billing.calcularEstado(n);
        if (en_trial) {
            return res.status(400).json({ error: 'Estás en prueba gratis: no tienes ningún cobro que cancelar.' });
        }
        if (estado !== 'activa' || !n.suscripcion_fin) {
            return res.status(400).json({ error: 'No tienes una suscripción con cobro recurrente para cancelar.' });
        }

        await billing.stripeCancelarAlFinal(req.negocioId, true);

        // `suscripcion_fin` no se toca: es la fecha hasta la que ya pagó y tiene acceso.
        await db.execute(
            'UPDATE negocios SET suscripcion_activa = 0, plan_pendiente = NULL WHERE id = ?',
            [req.negocioId]
        );
        await db.execute(
            `UPDATE suscripciones SET estado = 'cancelada' WHERE negocio_id = ? AND estado = 'activa'`,
            [req.negocioId]
        );
        await db.execute(
            `INSERT INTO billing_history (negocio_id, tipo, plan_anterior, monto, descripcion, metadata)
             VALUES (?, 'cancellation', ?, 0, ?, ?)`,
            [req.negocioId, n.plan, motivo || 'Cancelación solicitada por el usuario', JSON.stringify({ motivo })]
        );

        const hasta = new Date(acceso_hasta).toISOString().split('T')[0];
        const hastaLegible = new Date(acceso_hasta).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
        res.json({
            success: true,
            acceso_hasta: hasta,
            mensaje: `Suscripción cancelada. Conservas el acceso hasta el ${hastaLegible} y no se te volverá a cobrar.`,
        });
    } catch (error) {
        console.error('[Suscripcion] Error cancelar:', error.message);
        res.status(500).json({ error: 'Error cancelando suscripción' });
    }
});

// ===== REACTIVATE =====

// POST /api/suscripcion/reactivar - Deshacer una cancelación mientras el ciclo pagado sigue vigente
router.post('/reactivar', async (req, res) => {
    try {
        const n = await cargarNegocio(req.negocioId);
        if (!n) return res.status(404).json({ error: 'Negocio no encontrado' });

        const { estado } = billing.calcularEstado(n);
        if (estado === 'activa' || estado === 'trial') {
            return res.status(400).json({ error: 'Tu suscripción ya está activa.' });
        }
        // Reactivar no da meses gratis: sin ciclo vigente hay que pagar de nuevo.
        if (estado !== 'cancelada') {
            return res.status(402).json({
                error: 'Tu período terminó. Elige un plan para volver a activar tu cuenta.',
                codigo: 'PAGO_REQUERIDO',
            });
        }

        await billing.stripeCancelarAlFinal(req.negocioId, false);

        await db.execute('UPDATE negocios SET suscripcion_activa = 1 WHERE id = ?', [req.negocioId]);
        await db.execute(
            `UPDATE suscripciones SET estado = 'activa'
             WHERE negocio_id = ? AND estado = 'cancelada' ORDER BY id DESC LIMIT 1`,
            [req.negocioId]
        );
        await db.execute(
            `INSERT INTO billing_history (negocio_id, tipo, plan_nuevo, monto, descripcion)
             VALUES (?, 'reactivation', ?, 0, ?)`,
            [req.negocioId, n.plan, 'Reactivación antes del fin del ciclo (sin nuevo cobro)']
        );

        res.json({ success: true, mensaje: 'Suscripción reactivada. Se renovará al terminar tu ciclo actual.' });
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

        const [[logsStats]] = await db.execute(
            `SELECT COUNT(*) as mensajes, COALESCE(SUM(tokens_usados), 0) as tokens
             FROM agente_logs
             WHERE negocio_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
            [req.negocioId, periodo]
        );
        const [[negocio]] = await db.execute('SELECT plan FROM negocios WHERE id = ?', [req.negocioId]);
        const plan = negocio?.plan || 'starter';

        const [[clientesCount]] = await db.execute(
            `SELECT COUNT(*) as total FROM clientes
             WHERE negocio_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
            [req.negocioId, periodo]
        );
        // El límite de productos es sobre el catálogo completo (así lo aplica
        // tenant.js), no sobre los creados este mes.
        const [[productosCount]] = await db.execute(
            'SELECT COUNT(*) as total FROM productos WHERE negocio_id = ?',
            [req.negocioId]
        );

        const uso = {
            mensajes_usados: logsStats.mensajes || 0,
            ai_tokens_usados: logsStats.tokens || 0,
            clientes_nuevos: clientesCount.total || 0,
            productos_creados: productosCount.total || 0,
        };

        res.json({
            periodo,
            plan,
            uso,
            limites: {
                mensajes: checkLimit(plan, 'maxMessages', uso.mensajes_usados),
                clientes: checkLimit(plan, 'maxClients', uso.clientes_nuevos),
                productos: checkLimit(plan, 'maxProducts', uso.productos_creados),
            },
        });
    } catch (error) {
        console.error('[Suscripcion] Error uso:', error.message);
        res.status(500).json({ error: 'Error obteniendo uso' });
    }
});

module.exports = router;
