// Pasarela de pagos Efipay (checkout por redirección). Portado del backend de
// dopamina-crew, con tres diferencias a propósito:
//  - no hay "auto-aprobar si no hay token": sin credenciales los pagos simplemente no
//    están disponibles (ver billing.modoPagos), nunca se activa un plan sin cobrar;
//  - la firma del webhook se compara en tiempo constante y con largos verificados;
//  - qué negocio/plan se paga sale de nuestra tabla `pagos_efipay`, no del payload.
const crypto = require('crypto');
const axios = require('axios');
const db = require('../../db/config');
const billing = require('./billing');

// Errores típicos al pegar variables en Railway: comillas, espacios o saltos de línea al final,
// y pegar el token con el prefijo "Bearer " ya puesto (el servicio lo agrega).
const limpiar = (v) => String(v || '').trim().replace(/^["']+|["']+$/g, '').trim();
const API_URL = () => limpiar(process.env.EFIPAY_API_URL || 'https://sag.efipay.co/api/v1').replace(/\/+$/, '');
const TOKEN = () => limpiar(process.env.EFIPAY_ACCESS_TOKEN).replace(/^Bearer\s+/i, '');
const OFFICE = () => Number(limpiar(process.env.EFIPAY_OFFICE_ID));
const FRONTEND_URL = () => process.env.FRONTEND_URL || 'http://localhost:5173';
const API_PUBLIC_URL = () => process.env.API_PUBLIC_URL || 'http://localhost:3002';

const headers = () => ({ Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' });

// Estados que Efipay puede devolver, normalizados.
function clasificarEstado(status) {
    const s = String(status || '').toLowerCase();
    if (['aprobada', 'aprobado', 'pagado', 'success'].includes(s)) return 'aprobado';
    if (['rechazada', 'fallida', 'rejected', 'failed'].includes(s)) return 'rechazado';
    return 'pendiente';
}

function firmaValida(firma, cuerpoCrudo) {
    const secreto = process.env.EFIPAY_WEBHOOK_TOKEN;
    if (!secreto || !firma) return false;
    const esperada = crypto.createHmac('sha256', secreto).update(cuerpoCrudo).digest('hex');
    const a = Buffer.from(esperada);
    const b = Buffer.from(String(firma));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Crea el pago en Efipay y devuelve la URL a la que mandar al dueño.
async function crearPago(negocioId, plan, planData) {
    const referencia = `NOMA-${negocioId}-${Date.now()}`;
    const monto = planData.price;

    const [ins] = await db.execute(
        'INSERT INTO pagos_efipay (negocio_id, plan, monto, referencia) VALUES (?, ?, ?, ?)',
        [negocioId, plan, monto, referencia]
    );

    const payment = {
        description: `Suscripción plan ${planData.nameEs} - Antigravity`,
        amount: monto,
        currency_type: 'COP',
        checkout_type: 'redirect',
    };
    if (process.env.EFIPAY_CHECKOUT_TEMPLATE_ID) payment.checkout_template_id = process.env.EFIPAY_CHECKOUT_TEMPLATE_ID;

    const front = FRONTEND_URL();
    const body = {
        payment,
        advanced_options: {
            has_comments: false,
            references: [referencia],
            result_urls: {
                approved: `${front}/suscripcion?success=true`,
                rejected: `${front}/suscripcion?cancelled=true`,
                pending: `${front}/suscripcion?success=true`,
                webhook: `${API_PUBLIC_URL()}/api/webhook/efipay`,
            },
        },
        office: OFFICE(),
    };

    try {
        const { data } = await axios.post(`${API_URL()}/payment/generate-payment`, body, { headers: headers(), timeout: 20000 });
        if (!data?.saved || !data?.url) throw new Error('Efipay no devolvió una URL de pago');
        await db.execute('UPDATE pagos_efipay SET payment_id = ? WHERE id = ?', [data.payment_id || null, ins.insertId]);
        return { url: data.url, referencia };
    } catch (err) {
        await db.execute("UPDATE pagos_efipay SET estado = 'rechazado', efipay_status = 'error_creacion' WHERE id = ?", [ins.insertId]);
        throw err;
    }
}

// Aplica un estado a un pago nuestro. Idempotente: Efipay puede repetir el webhook y
// el dueño puede refrescar la página, pero el plan se activa una sola vez.
async function aplicarEstado(pago, statusEfipay) {
    const nuevo = clasificarEstado(statusEfipay);
    if (nuevo === 'pendiente') {
        await db.execute('UPDATE pagos_efipay SET efipay_status = ? WHERE id = ?', [statusEfipay || null, pago.id]);
        return 'pendiente';
    }
    const [r] = await db.execute(
        "UPDATE pagos_efipay SET estado = ?, efipay_status = ? WHERE id = ? AND estado = 'pendiente'",
        [nuevo, statusEfipay || null, pago.id]
    );
    if (r.affectedRows === 1 && nuevo === 'aprobado') {
        await billing.activarPlan(pago.negocio_id, pago.plan, { metodo: 'efipay', referenciaPago: pago.payment_id || pago.referencia });
        console.log(`[Efipay] Pago aprobado: negocio ${pago.negocio_id}, plan ${pago.plan}`);
    }
    return nuevo;
}

// Webhook de Efipay. Debe recibir el body crudo (la firma es sobre esos bytes).
async function manejarWebhook(req, res) {
    const cuerpo = req.body; // Buffer (express.raw)
    if (!firmaValida(req.headers['signature'], cuerpo)) {
        return res.status(401).json({ error: 'Firma inválida' });
    }
    try {
        const json = JSON.parse(cuerpo.toString('utf8'));
        const status = json.transaction?.status;
        const checkout = json.checkout || {};
        const referencias = checkout.payment_gateway?.advanced_option?.references || [];

        let pago = null;
        const paymentId = checkout.payment_referenceable_id;
        if (paymentId) {
            [[pago]] = await db.execute('SELECT * FROM pagos_efipay WHERE payment_id = ? LIMIT 1', [String(paymentId)]);
        }
        if (!pago) {
            for (const ref of referencias) {
                [[pago]] = await db.execute('SELECT * FROM pagos_efipay WHERE referencia = ? LIMIT 1', [String(ref)]);
                if (pago) break;
            }
        }
        if (!pago) return res.json({ ok: true, ignorado: 'pago desconocido' });

        await aplicarEstado(pago, status);
        res.json({ ok: true });
    } catch (error) {
        console.error('[Efipay] Error procesando webhook:', error.message);
        res.status(500).json({ error: 'Error procesando webhook' });
    }
}

// Respaldo del webhook (que en desarrollo local ni siquiera llega): consulta a
// Efipay el estado de los pagos pendientes de este negocio y los aplica.
async function verificarPendientes(negocioId) {
    const [pendientes] = await db.execute(
        "SELECT * FROM pagos_efipay WHERE negocio_id = ? AND estado = 'pendiente' AND payment_id IS NOT NULL ORDER BY id DESC LIMIT 5",
        [negocioId]
    );
    let aprobados = 0;
    for (const pago of pendientes) {
        try {
            const { data } = await axios.get(`${API_URL()}/payment/status/${pago.payment_id}`, { headers: headers(), timeout: 15000 });
            const status = data?.transaction?.status || data?.status || data?.estado;
            if (status && (await aplicarEstado(pago, status)) === 'aprobado') aprobados += 1;
        } catch (err) {
            console.error(`[Efipay] No se pudo consultar el pago ${pago.payment_id}:`, err.message);
        }
    }
    return { revisados: pendientes.length, aprobados };
}

// Dice si Efipay acepta nuestras credenciales, sin revelar ningún secreto. Prueba la MISMA ruta
// del pago (POST generate-payment) con un cuerpo vacío: Efipay autentica primero, así que un
// token malo da 401/403 y uno válido da un error de validación (400/422) — nunca se crea un pago.
// (Una versión anterior consultaba /payment/status/0, que responde 404 sin mirar el token y daba
// un falso "token aceptado".)
async function diagnosticar() {
    const out = {
        api_url: API_URL(),
        token_longitud: TOKEN().length,
        office_id: OFFICE() || null,
        webhook_token_configurado: !!limpiar(process.env.EFIPAY_WEBHOOK_TOKEN),
        tabla_pagos_efipay: null,
        http_auth: null,
        credenciales_ok: null,
        interpretacion: '',
    };
    try {
        const [t] = await db.execute("SHOW TABLES LIKE 'pagos_efipay'");
        out.tabla_pagos_efipay = t.length > 0;
    } catch (e) { out.tabla_pagos_efipay = `error: ${e.code || e.message}`; }

    if (!out.token_longitud) { out.interpretacion = 'Falta EFIPAY_ACCESS_TOKEN.'; return out; }
    if (!out.office_id) { out.interpretacion = 'EFIPAY_OFFICE_ID falta o no es un número.'; return out; }
    try {
        const r = await axios.post(`${API_URL()}/payment/generate-payment`, {}, { headers: headers(), timeout: 15000, validateStatus: () => true });
        out.http_auth = r.status;
        if (r.status === 401 || r.status === 403) {
            out.credenciales_ok = false;
            out.interpretacion = 'Efipay RECHAZÓ el token (401/403 "Unauthenticated"): no es un token de acceso válido para esta API. Revisa que sea el token de acceso (Bearer) creado en el panel de Efipay, que esté activo, completo y sin comillas ni espacios, y que corresponda a la oficina configurada.';
        } else if (r.status === 400 || r.status === 422 || (r.status >= 200 && r.status < 300)) {
            out.credenciales_ok = true;
            out.interpretacion = 'Efipay aceptó el token (rechazó el cuerpo vacío de la prueba, como se espera).';
        } else {
            out.interpretacion = `Respuesta no concluyente de Efipay (HTTP ${r.status}).`;
        }
    } catch (e) {
        out.interpretacion = `No se pudo contactar a Efipay (${e.code || e.message}). Revisa EFIPAY_API_URL.`;
    }
    return out;
}

module.exports = { diagnosticar, crearPago, manejarWebhook, verificarPendientes, firmaValida, clasificarEstado };
