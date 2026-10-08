// Lógica de suscripción compartida por /api/suscripcion, /api/stripe y /api/business.
// Antes estaba copiada en cada ruta (y tres de ellas activaban planes sin cobrar).
const db = require('../../db/config');
const {
    PLAN_ORDER, FEATURE_LABELS, LIMIT_LABELS,
    getPlan, getPlanFeatures,
} = require('../../config/planConfig');

const STRIPE_CONFIGURADO = !!process.env.STRIPE_SECRET_KEY;
let stripe = null;
if (STRIPE_CONFIGURADO) stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Efipay es la pasarela real del negocio (decisión del 26 sept); Stripe queda como
// alternativa. Si ambas estuvieran configuradas, gana Efipay.
const EFIPAY_CONFIGURADO = !!(process.env.EFIPAY_ACCESS_TOKEN && process.env.EFIPAY_OFFICE_ID);

// Los pagos simulados activan un plan sin cobrar nada: solo valen en desarrollo
// (o si alguien los habilita a propósito con PAGOS_EMULADOS=true). En producción
// sin pasarela configurada, cambiar de plan simplemente no está disponible.
function pagosEmulados() {
    if (EFIPAY_CONFIGURADO || STRIPE_CONFIGURADO) return false;
    return process.env.NODE_ENV !== 'production' || process.env.PAGOS_EMULADOS === 'true';
}

function modoPagos() {
    if (EFIPAY_CONFIGURADO) return 'efipay';
    if (STRIPE_CONFIGURADO) return 'stripe';
    return pagosEmulados() ? 'emulado' : 'no_disponible';
}

const PREFIJO_FACTURA = { stripe: 'STR', efipay: 'EFI', emulado: 'EMU' };

const idx = (plan) => PLAN_ORDER.indexOf(plan);

// ===== Estado de la suscripción =====
// trial      prueba gratis en curso
// activa     ciclo pagado en curso (o cuenta sin cobro recurrente, p. ej. admin/demo)
// cancelada  canceló, pero conserva el acceso hasta `suscripcion_fin`
// vencida    el ciclo o la prueba terminaron: hay que pagar para seguir
// inactiva   nunca activó nada
function calcularEstado(n, now = new Date()) {
    const fin = n.suscripcion_fin ? new Date(n.suscripcion_fin) : null;
    const trialHasta = n.trial_hasta ? new Date(n.trial_hasta) : null;
    const activa = !!n.suscripcion_activa;

    // Las cuentas nuevas quedan con suscripcion_activa=1 y fin a 7 días, sin
    // suscripcion_inicio (ese campo solo lo fija un pago real). Quien ya pagó
    // deja de estar en prueba aunque `trial_hasta` todavía no haya pasado.
    const enTrial = !!(trialHasta && trialHasta > now && !n.suscripcion_inicio);
    if (enTrial) return { estado: 'trial', en_trial: true, acceso_hasta: trialHasta };

    if (activa && (!fin || fin > now)) return { estado: 'activa', en_trial: false, acceso_hasta: fin };
    if (!activa && fin && fin > now) return { estado: 'cancelada', en_trial: false, acceso_hasta: fin };
    if (fin || trialHasta) return { estado: 'vencida', en_trial: false, acceso_hasta: null };
    return { estado: 'inactiva', en_trial: false, acceso_hasta: null };
}

// ===== Comparación de planes (para explicar qué se gana / se pierde) =====
function compararPlanes(desde, hacia) {
    const a = getPlanFeatures(desde);
    const b = getPlanFeatures(hacia);

    const features = Object.entries(FEATURE_LABELS);
    const ganas = features.filter(([k]) => !a[k] && b[k]).map(([, l]) => l);
    const pierdes = features.filter(([k]) => a[k] && !b[k]).map(([, l]) => l);

    const limites = Object.entries(LIMIT_LABELS)
        .filter(([k]) => a[k] !== undefined || b[k] !== undefined)
        .map(([k, label]) => ({ key: k, label, actual: a[k] ?? 0, nuevo: b[k] ?? 0 }))
        .filter(l => l.actual !== l.nuevo);

    return { ganas, pierdes, limites };
}

// Qué impide bajar a `planDestino` con lo que el negocio tiene hoy.
async function bloqueosDowngrade(negocioId, planDestino) {
    const bloqueos = [];
    const maxProductos = getPlanFeatures(planDestino).maxProducts;
    if (maxProductos !== undefined && maxProductos !== -1) {
        const [[row]] = await db.execute('SELECT COUNT(*) AS total FROM productos WHERE negocio_id = ?', [negocioId]);
        if (row.total > maxProductos) {
            bloqueos.push(
                `Tienes ${row.total} productos y el plan ${getPlan(planDestino).nameEs} permite ${maxProductos}. ` +
                `Elimina ${row.total - maxProductos} para poder bajar.`
            );
        }
    }
    return bloqueos;
}

// Los nombres de plan entran por el body: solo se aceptan los conocidos.
function planValido(plan) {
    return typeof plan === 'string' && PLAN_ORDER.includes(plan);
}

// ¿Puede este negocio pagar por `plan` ahora?
function validarCompra(n, plan) {
    const { estado } = calcularEstado(n);
    const actual = idx(n.plan);
    const nuevo = idx(plan);

    if (estado === 'activa' && nuevo <= actual) {
        return nuevo === actual
            ? 'Ya tienes este plan.'
            : 'Para bajar de plan usa el cambio de plan, no un nuevo pago.';
    }
    if (estado === 'cancelada' && nuevo <= actual) {
        return 'Tu suscripción sigue vigente hasta el fin del período: reactívala en vez de pagar de nuevo.';
    }
    return null;
}

// ===== Activación de plan =====
// Único punto donde un pago (real o de prueba) cambia el plan del negocio.
async function activarPlan(negocioId, plan, { metodo = 'emulado', stripeSubId = null, stripePaymentIntent = null, referenciaPago = null } = {}) {
    const planData = getPlan(plan);
    const now = new Date();
    const fin = new Date(now);
    fin.setMonth(fin.getMonth() + 1);
    const numero = `INV-${PREFIJO_FACTURA[metodo] || 'PAG'}-${Date.now()}-${negocioId}`;
    // La columna se llama stripe_payment_intent por historia, pero guarda la referencia de cualquier pasarela.
    const refPago = referenciaPago || stripePaymentIntent;

    // Todo o nada: un fallo a medias dejaba un plan activo sin factura ni historial.
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [[previo]] = await conn.execute(
            'SELECT plan, suscripcion_inicio FROM negocios WHERE id = ? FOR UPDATE', [negocioId]
        );

        await conn.execute(
            `UPDATE negocios SET plan = ?, plan_pendiente = NULL, suscripcion_activa = 1,
             suscripcion_inicio = ?, suscripcion_fin = ? WHERE id = ?`,
            [plan, now, fin, negocioId]
        );

        const [existSub] = await conn.execute(
            'SELECT id FROM suscripciones WHERE negocio_id = ? ORDER BY id DESC LIMIT 1', [negocioId]
        );
        if (existSub.length > 0) {
            await conn.execute(
                `UPDATE suscripciones SET plan = ?, estado = 'activa', pago_inicio = ?, pago_fin = ?,
                 monto_mensual = ?, stripe_sub_id = COALESCE(?, stripe_sub_id) WHERE id = ?`,
                [plan, now, fin, planData.price, stripeSubId, existSub[0].id]
            );
        } else {
            await conn.execute(
                `INSERT INTO suscripciones (negocio_id, plan, estado, pago_inicio, pago_fin, monto_mensual, stripe_sub_id)
                 VALUES (?, ?, 'activa', ?, ?, ?, ?)`,
                [negocioId, plan, now, fin, planData.price, stripeSubId]
            );
        }

        await conn.execute(
            `INSERT INTO invoices (negocio_id, numero, plan, monto, estado, metodo_pago, stripe_payment_intent, fecha_pago, fecha_vencimiento, descripcion)
             VALUES (?, ?, ?, ?, 'pagada', ?, ?, NOW(), ?, ?)`,
            [negocioId, numero, plan, planData.price, metodo, refPago, fin,
             `${metodo === 'emulado' ? 'Pago de prueba' : 'Pago'} plan ${planData.nameEs}`]
        );

        const tipo = idx(plan) > idx(previo.plan) ? 'upgrade'
            : previo.suscripcion_inicio ? 'renewal' : 'payment_success';
        await conn.execute(
            `INSERT INTO billing_history (negocio_id, tipo, plan_anterior, plan_nuevo, monto, descripcion)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [negocioId, tipo, previo.plan, plan, planData.price,
             tipo === 'upgrade' ? `Upgrade de ${previo.plan} a ${plan}` : `Pago plan ${planData.nameEs}`]
        );

        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }

    return { invoiceNum: numero, nuevoFin: fin, monto: planData.price };
}

// ===== Stripe (solo si está configurado) =====
async function stripeSubIdDe(negocioId) {
    const [rows] = await db.execute(
        `SELECT stripe_sub_id FROM suscripciones
         WHERE negocio_id = ? AND stripe_sub_id IS NOT NULL ORDER BY id DESC LIMIT 1`,
        [negocioId]
    );
    return rows[0]?.stripe_sub_id || null;
}

// Sin esto, "cancelar" en la app dejaba a Stripe cobrando el mes siguiente.
async function stripeCancelarAlFinal(negocioId, cancelar) {
    if (!STRIPE_CONFIGURADO) return;
    const subId = await stripeSubIdDe(negocioId);
    if (subId) await stripe.subscriptions.update(subId, { cancel_at_period_end: cancelar });
}

module.exports = {
    STRIPE_CONFIGURADO,
    EFIPAY_CONFIGURADO,
    get stripe() { return stripe; },
    pagosEmulados,
    modoPagos,
    calcularEstado,
    compararPlanes,
    bloqueosDowngrade,
    planValido,
    validarCompra,
    activarPlan,
    stripeSubIdDe,
    stripeCancelarAlFinal,
};
