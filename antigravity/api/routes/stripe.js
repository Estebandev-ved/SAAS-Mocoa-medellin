const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const { getPlan, getPlanPrice } = require('../../config/planConfig');

const STRIPE_CONFIGURADO = !!process.env.STRIPE_SECRET_KEY;
let stripe = null;
if (STRIPE_CONFIGURADO) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// ===== MODO EMULADO =====
// Simula pagos instantáneos sin Stripe real
// Ideal para desarrollo y demostración

async function simularPago(negocioId, plan) {
    const planData = getPlan(plan);
    const now = new Date();
    const fin = new Date(now);
    fin.setMonth(fin.getMonth() + 1);

    // 1. Actualizar negocio
    await db.execute(
        `UPDATE negocios SET plan = ?, suscripcion_activa = 1,
         suscripcion_inicio = ?, suscripcion_fin = ?
         WHERE id = ?`,
        [plan, now, fin, negocioId]
    );

    // 2. Actualizar/crear suscripción
        const [existSub] = await db.execute(
        'SELECT id FROM suscripciones WHERE negocio_id = ? ORDER BY id DESC LIMIT 1',
        [negocioId]
    );

    if (existSub.length > 0) {
        await db.execute(
            `UPDATE suscripciones SET plan = ?, estado = 'activa',
             pago_inicio = ?, pago_fin = ?, monto_mensual = ?
             WHERE id = ?`,
            [plan, now, fin, planData.price, existSub[0].id]
        );
    } else {
        await db.execute(
            `INSERT INTO suscripciones (negocio_id, plan, estado, trial_inicio, pago_inicio, pago_fin, monto_mensual)
             VALUES (?, ?, 'activa', ?, ?, ?, ?)`,
            [negocioId, plan, now, now, fin, planData.price]
        );
    }

    // 3. Crear factura
    const invoiceNum = `INV-EMULADO-${Date.now()}-${negocioId}`;
    await db.execute(
        `INSERT INTO invoices (negocio_id, numero, plan, monto, estado, metodo_pago, fecha_pago, fecha_vencimiento, descripcion)
         VALUES (?, ?, ?, ?, 'pagada', 'emulado', NOW(), ?, ?)`,
        [negocioId, invoiceNum, plan, planData.price, fin, `Pago emulado plan ${planData.nameEs}`]
    );

    // 4. Registrar en historial
    await db.execute(
        `INSERT INTO billing_history (negocio_id, tipo, plan_nuevo, monto, descripcion)
         VALUES (?, 'payment_success', ?, ?, ?)`,
        [negocioId, plan, planData.price, `Pago emulado exitoso - Plan ${planData.nameEs}`]
    );

    console.log(`[Stripe-Emulado] Pago simulado: negocio ${negocioId}, plan ${plan}, $${planData.price}`);

    return { invoiceNum, nuevoFin: fin, monto: planData.price };
}

// POST /api/stripe/checkout
router.post('/checkout', verificarAuth, async (req, res) => {
    try {
        const { plan } = req.body;
        const planData = getPlan(plan);

        if (!planData) {
            return res.status(400).json({ error: 'Plan inválido' });
        }

        // ===== MODO EMULADO =====
        if (!STRIPE_CONFIGURADO) {
            console.log(`[Stripe] Modo emulado - procesando pago simulado para plan ${plan}`);

            const resultado = await simularPago(req.negocioId, plan);

            // Redirect directo al success
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            return res.json({
                emulado: true,
                mensaje: `Pago simulado exitoso. Plan ${planData.nameEs} activado.`,
                invoice: resultado.invoiceNum,
                redirect: `${frontendUrl}/dashboard/plan?success=true&emulado=true`,
            });
        }

        // ===== MODO STRIPE REAL =====
        const [negocios] = await db.execute(
            'SELECT nombre, email, stripe_customer_id FROM negocios WHERE id = ?',
            [req.negocioId]
        );
        const negocio = negocios[0];

        let customerId = negocio.stripe_customer_id;
        if (!customerId) {
            const customer = await stripe.customers.create({
                name: negocio.nombre,
                email: negocio.email,
                metadata: { negocio_id: req.negocioId },
            });
            customerId = customer.id;
            await db.execute('UPDATE negocios SET stripe_customer_id = ? WHERE id = ?', [customerId, req.negocioId]);
        }

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'cop',
                    product_data: {
                        name: `Plan ${planData.nameEs} - Antigravity`,
                        description: `Suscripción mensual plan ${planData.nameEs}`,
                    },
                    unit_amount: planData.price,
                    recurring: { interval: 'month' },
                },
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/plan?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/plan?cancelled=true`,
            metadata: { negocio_id: req.negocioId, plan },
        });

        res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
        console.error('[Stripe] Error checkout:', error.message);
        res.status(500).json({ error: 'Error creando sesión de pago' });
    }
});

// POST /api/stripe/confirm - Confirmar pago emulado (para testing)
router.post('/confirm', verificarAuth, async (req, res) => {
    try {
        if (STRIPE_CONFIGURADO) {
            return res.status(400).json({ error: 'Esta ruta solo funciona en modo emulado' });
        }

        const { plan } = req.body;
        const planData = getPlan(plan);

        if (!planData) {
            return res.status(400).json({ error: 'Plan inválido' });
        }

        const resultado = await simularPago(req.negocioId, plan);

        res.json({
            success: true,
            emulado: true,
            mensaje: `Plan ${planData.nameEs} activado correctamente (pago emulado)`,
            invoice: resultado.invoiceNum,
            monto: resultado.monto,
            nuevo_fin: resultado.nuevoFin,
        });
    } catch (error) {
        console.error('[Stripe-Emulado] Error:', error.message);
        res.status(500).json({ error: 'Error procesando pago emulado' });
    }
});

// POST /api/stripe/webhook - Solo para Stripe real
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!STRIPE_CONFIGURADO) {
        return res.status(400).json({ error: 'Stripe no configurado - usa /confirm en modo emulado' });
    }

    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('[Stripe] Webhook signature failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const { negocio_id, plan } = session.metadata;
            await simularPago(parseInt(negocio_id), plan);
        }

        if (event.type === 'invoice.payment_failed') {
            const invoice = event.data.object;
            const customer = await stripe.customers.retrieve(invoice.customer);
            const negocioId = customer.metadata.negocio_id;
            if (negocioId) {
                await db.execute(`UPDATE negocios SET suscripcion_activa = 0 WHERE id = ?`, [negocioId]);
                await db.execute(
                    `INSERT INTO billing_history (negocio_id, tipo, monto, descripcion) VALUES (?, 'payment_failed', ?, ?)`,
                    [negocioId, invoice.amount_due, `Pago fallido - ${invoice.failure_reason}`]
                );
            }
        }

        if (event.type === 'invoice.paid') {
            const invoice = event.data.object;
            if (invoice.subscription) {
                const customer = await stripe.customers.retrieve(invoice.customer);
                const negocioId = customer.metadata.negocio_id;
                if (negocioId) {
                    const now = new Date();
                    const fin = new Date(now);
                    fin.setMonth(fin.getMonth() + 1);
                    await db.execute(`UPDATE negocios SET suscripcion_fin = ?, suscripcion_activa = 1 WHERE id = ?`, [fin, negocioId]);
                    await db.execute(`UPDATE suscripciones SET pago_fin = ?, estado = 'activa' WHERE stripe_sub_id = ?`, [fin, invoice.subscription]);
                }
            }
        }

        if (event.type === 'customer.subscription.deleted') {
            const subscription = event.data.object;
            await db.execute(`UPDATE negocios SET suscripcion_activa = 0 WHERE stripe_customer_id = ?`, [subscription.customer]);
            await db.execute(`UPDATE suscripciones SET estado = 'cancelada' WHERE stripe_sub_id = ?`, [subscription.id]);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('[Stripe] Error procesando webhook:', error.message);
        res.status(500).json({ error: 'Error procesando webhook' });
    }
});

// POST /api/stripe/portal
router.post('/portal', verificarAuth, async (req, res) => {
    try {
        // En modo emulado, redirigir a la página de plan
        if (!STRIPE_CONFIGURADO) {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            return res.json({
                emulado: true,
                url: `${frontendUrl}/dashboard/plan`,
                mensaje: 'Modo emulado - gestiona tu plan desde el panel',
            });
        }

        const [negocios] = await db.execute(
            'SELECT stripe_customer_id FROM negocios WHERE id = ?',
            [req.negocioId]
        );

        if (!negocios[0]?.stripe_customer_id) {
            return res.status(400).json({ error: 'No tienes cuenta de facturación asociada' });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: negocios[0].stripe_customer_id,
            return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/plan`,
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('[Stripe] Error portal:', error.message);
        res.status(500).json({ error: 'Error creando portal de facturación' });
    }
});

// GET /api/stripe/status
router.get('/status', verificarAuth, async (req, res) => {
    try {
        res.json({
            stripe_configurado: STRIPE_CONFIGURADO,
            webhook_configurado: !!process.env.STRIPE_WEBHOOK_SECRET,
            modo: STRIPE_CONFIGURADO ? 'live' : 'emulado',
            mensaje: STRIPE_CONFIGURADO ? 'Stripe conectado' : 'Funcionando en modo emulado (pagos simulados)',
        });
    } catch (error) {
        res.status(500).json({ error: 'Error verificando estado' });
    }
});

module.exports = router;
