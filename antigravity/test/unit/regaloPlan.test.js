const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const cuentas = new Map();
const actualizaciones = [];
const db = {
    async execute(sql, p = []) {
        const q = sql.replace(/\s+/g, ' ').trim();
        if (q.startsWith('SELECT id, suscripcion_inicio')) { const c = cuentas.get(p[0]); return [c && c.rol !== 'admin' ? [c] : []]; }
        if (q.startsWith('SELECT id FROM negocios WHERE LOWER(email_dueno)')) { const c = [...cuentas.values()].find((x) => x.email === p[0] && x.rol !== 'admin'); return [c ? [{ id: c.id }] : []]; }
        if (q.startsWith('UPDATE negocios SET plan = ?')) { actualizaciones.push(p); const c = cuentas.get(p[3]); c.plan = p[0]; return [{ affectedRows: 1 }]; }
        if (q.startsWith('SELECT trial_hasta')) return [[{ trial_hasta: '2026-12-01' }]];
        return [[]];
    },
};
const r = path.join('..', '..', 'db', 'config');
const ruta = require.resolve(r);
require.cache[ruta] = { id: ruta, filename: ruta, loaded: true, exports: db };
const regalo = require('../../api/services/regaloPlan');
const billing = require('../../api/services/billing');

test('valida plan y días (por defecto 30, máximo 90)', () => {
    assert.deepStrictEqual(regalo.validarRegalo({ plan: 'starter' }), { plan: 'starter', dias: 30 });
    assert.deepStrictEqual(regalo.validarRegalo({ plan: 'professional', dias: '15' }), { plan: 'professional', dias: 15 });
    for (const mal of [{ plan: 'gratis' }, { plan: 'starter', dias: 0 }, { plan: 'starter', dias: 91 }, { plan: 'starter', dias: 'x' }, {}]) {
        assert.ok(regalo.validarRegalo(mal).error, JSON.stringify(mal));
    }
});

test('regala el plan a una cuenta nueva y a una con plan vencido; no pisa un plan pagado vigente ni toca admins', async () => {
    const futuro = new Date(Date.now() + 10 * 86400000);
    const pasado = new Date(Date.now() - 10 * 86400000);
    cuentas.set(1, { id: 1, email: 'nueva@x.co', plan: 'emprendedor', suscripcion_inicio: null, suscripcion_fin: null, suscripcion_activa: 1 });
    cuentas.set(2, { id: 2, email: 'vencida@x.co', plan: 'starter', suscripcion_inicio: pasado, suscripcion_fin: pasado, suscripcion_activa: 0 });
    cuentas.set(3, { id: 3, email: 'paga@x.co', plan: 'starter', suscripcion_inicio: pasado, suscripcion_fin: futuro, suscripcion_activa: 1 });
    cuentas.set(4, { id: 4, email: 'admin@x.co', plan: 'enterprise', rol: 'admin' });

    assert.strictEqual((await regalo.regalarPlan(1, { plan: 'professional', dias: 30 })).ok, true);
    assert.strictEqual((await regalo.regalarPlan(2, { plan: 'starter', dias: 30 })).ok, true);
    assert.strictEqual((await regalo.regalarPlan(3, { plan: 'enterprise', dias: 30 })).motivo, 'tiene_plan_pagado');
    assert.strictEqual((await regalo.regalarPlan(4, { plan: 'starter', dias: 30 })).motivo, 'no_existe');
    assert.strictEqual(cuentas.get(1).plan, 'professional');
    assert.strictEqual(cuentas.get(3).plan, 'starter');
    assert.deepStrictEqual(actualizaciones[0], ['professional', 30, 30, 1]);
});

test('por correos: informa cuenta por cuenta, ignora repetidos y mayúsculas', async () => {
    const res = await regalo.regalarPorCorreos(['NUEVA@x.co', 'nueva@x.co', 'nadie@x.co', 'paga@x.co'], { plan: 'starter', dias: 30 });
    assert.strictEqual(res.length, 3);
    assert.strictEqual(res.find((x) => x.correo === 'nueva@x.co').ok, true);
    assert.strictEqual(res.find((x) => x.correo === 'nadie@x.co').motivo, 'no_existe');
    assert.strictEqual(res.find((x) => x.correo === 'paga@x.co').motivo, 'tiene_plan_pagado');
});

test('una cuenta regalada se ve como "prueba" con acceso hasta el fin y vence después', () => {
    const fin = new Date(Date.now() + 30 * 86400000);
    const cuenta = { suscripcion_activa: 1, suscripcion_inicio: null, trial_hasta: fin, suscripcion_fin: fin };
    assert.strictEqual(billing.calcularEstado(cuenta).estado, 'trial');
    assert.strictEqual(billing.calcularEstado(cuenta, new Date(fin.getTime() + 1000)).estado, 'vencida');
});
