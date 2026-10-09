const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const { getPlan, PLAN_ORDER } = require('../../config/planConfig');
const billing = require('../services/billing');
const efipay = require('../services/efipay');

// El webhook de Stripe vive en api/index.js: necesita el body crudo, así que se
// registra antes de express.json().

const FRONTEND_URL = () => process.env.FRONTEND_URL || 'http://localhost:5173';

// Comprueba que este negocio pueda pagar por `plan` y devuelve un error listo
// para responder, o null si todo está bien.
async function errorDeCompra(negocioId, plan) {
    if (!billing.planValido(plan)) return { status: 400, body: { error: 'Plan inválido' } };

    const [rows] = await db.execute(
        `SELECT plan, plan_pendiente, suscripcion_activa, suscripcion_inicio, suscripcion_fin, trial_hasta
         FROM negocios WHERE id = ?`,
        [negocioId]
    );
    const n = rows[0];
    if (!n) return { status: 404, body: { error: 'Negocio no encontrado' } };

    const motivo = billing.validarCompra(n, plan);
    if (motivo) return { status: 400, body: { error: motivo } };

    // Bajar de plan pagando uno menor no puede dejar el catálogo por encima del límite.
    if (PLAN_ORDER.indexOf(plan) < PLAN_ORDER.indexOf(n.plan)) {
        const bloqueos = await billing.bloqueosDowngrade(negocioId, plan);
        if (bloqueos.length) return { status: 409, body: { error: bloqueos[0], codigo: 'LIMITES_EXCEDIDOS', bloqueos } };
    }
    return null;
}

// POST /api/stripe/checkout
// Con Stripe: devuelve la URL de pago. Sin Stripe y solo en desarrollo: activa
// el plan como pago de prueba. En producción sin Stripe no cambia nada.
router.post('/checkout', verificarAuth, async (req, res) => {
    try {
        const { plan } = req.body;
        const error = await errorDeCompra(req.negocioId, plan);
        if (error) return res.status(error.status).json(error.body);

        const planData = getPlan(plan);

        if (billing.modoPagos() === 'no_disponible') {
            return res.status(503).json({
                error: 'Los pagos no están disponibles en este momento. Escríbenos y activamos tu plan.',
                codigo: 'PAGOS_NO_DISPONIBLES',
            });
        }

        // ===== Pago de prueba (solo desarrollo) =====
        if (billing.modoPagos() === 'emulado') {
            const resultado = await billing.activarPlan(req.negocioId, plan, { metodo: 'emulado' });
            return res.json({
                emulado: true,
                mensaje: `Pago de prueba registrado. Plan ${planData.nameEs} activado.`,
                invoice: resultado.invoiceNum,
                monto: resultado.monto,
                nuevo_fin: resultado.nuevoFin,
            });
        }

        // ===== Efipay (pasarela real del negocio): redirige al checkout; el plan lo activa el webhook =====
        if (billing.modoPagos() === 'efipay') {
            try {
                const { url } = await efipay.crearPago(req.negocioId, plan, planData);
                return res.json({ url });
            } catch (err) {
                // El log es lo que permite diagnosticar en Railway: sin esto todo se veía como
                // "Error creando sesión de pago" sin saber si faltaba la tabla o Efipay rechazó la petición.
                if (err.code === 'ER_NO_SUCH_TABLE') {
                    console.error('[Efipay] FALTA la tabla pagos_efipay: correr node db/migrate_efipay.js (o poner RUN_MIGRATIONS_ON_START=true y redesplegar).');
                    return res.status(503).json({ error: 'Los pagos aún no están listos. Escríbenos y activamos tu plan.', codigo: 'EFIPAY_SIN_MIGRAR' });
                }
                const http = err.response?.status;
                const detalle = err.response?.data ? JSON.stringify(err.response.data).slice(0, 600) : err.message;
                console.error(`[Efipay] No se pudo crear el pago (HTTP ${http || 'sin respuesta'}): ${detalle}`);
                const credenciales = http === 401 || http === 403;
                return res.status(502).json({
                    error: credenciales
                        ? 'La pasarela de pagos rechazó nuestras credenciales. Escríbenos y activamos tu plan.'
                        : 'No pudimos iniciar el pago con Efipay. Intenta de nuevo en unos minutos o escríbenos.',
                    codigo: credenciales ? 'EFIPAY_CREDENCIALES' : 'EFIPAY_ERROR',
                });
            }
        }

        // ===== Stripe real =====
        const [negocios] = await db.execute(
            'SELECT nombre, email_dueno, stripe_customer_id FROM negocios WHERE id = ?',
            [req.negocioId]
        );
        const negocio = negocios[0];

        let customerId = negocio.stripe_customer_id;
        if (!customerId) {
            const customer = await billing.stripe.customers.create({
                name: negocio.nombre,
                email: negocio.email_dueno,
                metadata: { negocio_id: String(req.negocioId) },
            });
            customerId = customer.id;
            await db.execute('UPDATE negocios SET stripe_customer_id = ? WHERE id = ?', [customerId, req.negocioId]);
        }

        const session = await billing.stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'cop',
                    product_data: {
                        name: `Plan ${planData.nameEs} - Antigravity`,
                        description: `Suscripción mensual plan ${planData.nameEs}`,
                    },
                    // Stripe recibe el monto en la unidad menor de la moneda (centavos).
                    unit_amount: planData.price * 100,
                    recurring: { interval: 'month' },
                },
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: `${FRONTEND_URL()}/suscripcion?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${FRONTEND_URL()}/suscripcion?cancelled=true`,
            metadata: { negocio_id: String(req.negocioId), plan },
        });

        res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
        console.error('[Stripe] Error checkout:', error.message);
        res.status(500).json({ error: 'Error creando sesión de pago' });
    }
});

// POST /api/stripe/confirm - Igual que /checkout en modo de prueba (se conserva por compatibilidad)
router.post('/confirm', verificarAuth, async (req, res) => {
    try {
        if (billing.modoPagos() !== 'emulado') {
            return res.status(403).json({ error: 'Esta ruta solo funciona con pagos de prueba en desarrollo' });
        }

        const { plan } = req.body;
        const error = await errorDeCompra(req.negocioId, plan);
        if (error) return res.status(error.status).json(error.body);

        const resultado = await billing.activarPlan(req.negocioId, plan, { metodo: 'emulado' });
        res.json({
            success: true,
            emulado: true,
            mensaje: `Plan ${getPlan(plan).nameEs} activado (pago de prueba)`,
            invoice: resultado.invoiceNum,
            monto: resultado.monto,
            nuevo_fin: resultado.nuevoFin,
        });
    } catch (error) {
        console.error('[Stripe-Emulado] Error:', error.message);
        res.status(500).json({ error: 'Error procesando pago de prueba' });
    }
});

// POST /api/stripe/portal - Portal de facturación de Stripe (cambiar tarjeta, facturas, plan)
router.post('/portal', verificarAuth, async (req, res) => {
    try {
        if (!billing.STRIPE_CONFIGURADO) {
            return res.status(400).json({ error: 'El portal de facturación solo existe con Stripe configurado' });
        }

        const [negocios] = await db.execute(
            'SELECT stripe_customer_id FROM negocios WHERE id = ?',
            [req.negocioId]
        );
        if (!negocios[0]?.stripe_customer_id) {
            return res.status(400).json({ error: 'No tienes cuenta de facturación asociada' });
        }

        const session = await billing.stripe.billingPortal.sessions.create({
            customer: negocios[0].stripe_customer_id,
            return_url: `${FRONTEND_URL()}/suscripcion`,
        });
        res.json({ url: session.url });
    } catch (error) {
        console.error('[Stripe] Error portal:', error.message);
        res.status(500).json({ error: 'Error creando portal de facturación' });
    }
});

// GET /api/stripe/status
router.get('/status', verificarAuth, (req, res) => {
    const modo = billing.modoPagos();
    res.json({
        stripe_configurado: billing.STRIPE_CONFIGURADO,
        efipay_configurado: billing.EFIPAY_CONFIGURADO,
        webhook_configurado: modo === 'efipay' ? !!process.env.EFIPAY_WEBHOOK_TOKEN : !!process.env.STRIPE_WEBHOOK_SECRET,
        modo: modo === 'stripe' || modo === 'efipay' ? 'live' : modo,
        pasarela: modo === 'stripe' || modo === 'efipay' ? modo : null,
        mensaje: modo === 'efipay' ? 'Efipay conectado'
            : modo === 'stripe' ? 'Stripe conectado'
            : modo === 'emulado' ? 'Pagos de prueba (solo desarrollo)'
            : 'Pagos no disponibles',
    });
});

// POST /api/stripe/efipay/verificar — al volver del checkout de Efipay: consulta el estado de los
// pagos pendientes de este negocio y activa el plan si ya fue aprobado (respaldo del webhook).
router.post('/efipay/verificar', verificarAuth, async (req, res) => {
    if (billing.modoPagos() !== 'efipay') return res.json({ revisados: 0, aprobados: 0 });
    try {
        res.json(await efipay.verificarPendientes(req.negocioId));
    } catch (error) {
        console.error('[Efipay] Error verificando pagos:', error.message);
        res.status(500).json({ error: 'No se pudo verificar el pago' });
    }
});

module.exports = router;
