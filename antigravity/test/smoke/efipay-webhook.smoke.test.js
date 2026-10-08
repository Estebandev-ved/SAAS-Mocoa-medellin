// Smoke test del webhook de Efipay contra la base real: ejecuta manejarWebhook() en el
// mismo proceso (sin HTTP ni Efipay) con un negocio temporal. Necesita MySQL accesible y
// haber corrido `node db/migrate_efipay.js`.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.EFIPAY_WEBHOOK_TOKEN = 'token-de-prueba';
const db = require('../../db/config');
const efipay = require('../../api/services/efipay');

const SUFIJO = Date.now();
const REFERENCIA = `NOMA-SMOKE-${SUFIJO}`;

function llamarWebhook(payload, firmaOverride) {
    const cuerpo = Buffer.from(JSON.stringify(payload));
    const firma = firmaOverride ?? crypto.createHmac('sha256', 'token-de-prueba').update(cuerpo).digest('hex');
    return new Promise((resolve, reject) => {
        const req = { body: cuerpo, headers: { signature: firma } };
        const res = {
            statusCode: 200,
            status(c) { this.statusCode = c; return this; },
            json(b) { resolve({ status: this.statusCode, body: b }); },
        };
        efipay.manejarWebhook(req, res).catch(reject);
    });
}

const payload = (status, ref = REFERENCIA) => ({
    transaction: { status },
    checkout: { payment_gateway: { advanced_option: { references: [ref] } } },
});

test.after(() => db.end());

test('webhook de Efipay: firma, aprobación e idempotencia', async (t) => {
    let negocioId;

    await t.test('preparar negocio y pago pendiente', async () => {
        const [neg] = await db.execute(
            `INSERT INTO negocios (nombre, email_dueno, password, plan, rol, suscripcion_activa)
             VALUES (?, ?, 'x', 'starter', 'negocio', 0)`,
            [`Smoke Efipay ${SUFIJO}`, `smoke-efipay-${SUFIJO}@test.local`]
        );
        negocioId = neg.insertId;
        await db.execute(
            `INSERT INTO pagos_efipay (negocio_id, plan, monto, referencia, payment_id) VALUES (?, 'professional', 100000, ?, ?)`,
            [negocioId, REFERENCIA, `pid-${SUFIJO}`]
        );
    });

    await t.test('firma inválida -> 401 y no pasa nada', async () => {
        const r = await llamarWebhook(payload('Aprobada'), 'firma-falsa');
        assert.equal(r.status, 401);
        const [[n]] = await db.execute('SELECT plan FROM negocios WHERE id = ?', [negocioId]);
        assert.equal(n.plan, 'starter');
    });

    await t.test('estado pendiente no activa el plan', async () => {
        const r = await llamarWebhook(payload('Pendiente'));
        assert.equal(r.status, 200);
        const [[n]] = await db.execute('SELECT plan FROM negocios WHERE id = ?', [negocioId]);
        assert.equal(n.plan, 'starter');
    });

    await t.test('aprobada activa el plan y crea una factura', async () => {
        const r = await llamarWebhook(payload('Aprobada'));
        assert.equal(r.status, 200);
        const [[n]] = await db.execute('SELECT plan, suscripcion_activa FROM negocios WHERE id = ?', [negocioId]);
        assert.equal(n.plan, 'professional');
        assert.equal(n.suscripcion_activa, 1);
        const [facturas] = await db.execute('SELECT metodo_pago, estado FROM invoices WHERE negocio_id = ?', [negocioId]);
        assert.equal(facturas.length, 1);
        assert.equal(facturas[0].metodo_pago, 'efipay');
    });

    await t.test('el mismo webhook repetido no vuelve a cobrar ni a facturar', async () => {
        await llamarWebhook(payload('Aprobada'));
        const [facturas] = await db.execute('SELECT id FROM invoices WHERE negocio_id = ?', [negocioId]);
        assert.equal(facturas.length, 1);
    });

    await t.test('referencia desconocida se ignora sin error', async () => {
        const r = await llamarWebhook(payload('Aprobada', 'NOMA-NO-EXISTE'));
        assert.equal(r.status, 200);
        assert.ok(r.body.ignorado);
    });

    await t.test('limpiar datos de prueba', async () => {
        for (const tabla of ['invoices', 'billing_history', 'suscripciones', 'pagos_efipay']) {
            await db.execute(`DELETE FROM ${tabla} WHERE negocio_id = ?`, [negocioId]);
        }
        await db.execute('DELETE FROM negocios WHERE id = ?', [negocioId]);
    });
});
