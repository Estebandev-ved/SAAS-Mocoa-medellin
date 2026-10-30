// Regalo de un plan por unos días (por defecto un mes) sin cobrar: lo da el administrador.
// Deja la cuenta igual que una prueba gratis (suscripcion_inicio vacío = estado "trial"), con el plan elegido y
// el fin del regalo en trial_hasta y suscripcion_fin. Al terminar, la cuenta queda vencida hasta que pague.

const db = require('../../db/config');
const { PLAN_ORDER } = require('../../config/planConfig');

const DIAS_POR_DEFECTO = 30;
const DIAS_MAXIMOS = 90;
const MAX_CUENTAS_POR_LOTE = 100;

/** Valida plan y días. Devuelve { plan, dias } o { error }. */
function validarRegalo({ plan, dias }) {
    if (!PLAN_ORDER.includes(plan)) return { error: `Plan no válido. Usa: ${PLAN_ORDER.join(', ')}` };
    const n = dias === undefined || dias === null || dias === '' ? DIAS_POR_DEFECTO : Math.round(Number(dias));
    if (!Number.isFinite(n) || n < 1 || n > DIAS_MAXIMOS) return { error: `Los días deben estar entre 1 y ${DIAS_MAXIMOS}` };
    return { plan, dias: n };
}

/**
 * Regala el plan a una cuenta (por id). No toca cuentas con un ciclo pagado vigente: se les extendería
 * a mano para no pisar lo que ya pagaron. Devuelve { ok, id, hasta } o { ok:false, id, motivo }.
 */
async function regalarPlan(negocioId, { plan, dias }) {
    const [filas] = await db.execute(
        "SELECT id, suscripcion_inicio, suscripcion_fin, suscripcion_activa FROM negocios WHERE id = ? AND (rol IS NULL OR rol = 'negocio')",
        [negocioId]
    );
    if (filas.length === 0) return { ok: false, id: negocioId, motivo: 'no_existe' };
    const n = filas[0];
    if (n.suscripcion_inicio && n.suscripcion_activa && n.suscripcion_fin && new Date(n.suscripcion_fin) > new Date()) {
        return { ok: false, id: negocioId, motivo: 'tiene_plan_pagado' };
    }
    await db.execute(
        `UPDATE negocios
         SET plan = ?, plan_pendiente = NULL, suscripcion_activa = 1, suscripcion_inicio = NULL,
             trial_inicio = NOW(), trial_hasta = DATE_ADD(NOW(), INTERVAL ? DAY), suscripcion_fin = DATE_ADD(NOW(), INTERVAL ? DAY)
         WHERE id = ?`,
        [plan, dias, dias, negocioId]
    );
    const [r] = await db.execute('SELECT trial_hasta FROM negocios WHERE id = ?', [negocioId]);
    return { ok: true, id: negocioId, hasta: r[0] ? r[0].trial_hasta : null };
}

/** Regala a varias cuentas por correo. Devuelve el detalle por correo para que el admin vea qué pasó con cada una. */
async function regalarPorCorreos(correos, datos) {
    const lista = [...new Set((correos || []).map((c) => String(c).trim().toLowerCase()).filter(Boolean))].slice(0, MAX_CUENTAS_POR_LOTE);
    const resultados = [];
    for (const correo of lista) {
        const [f] = await db.execute("SELECT id FROM negocios WHERE LOWER(email_dueno) = ? AND (rol IS NULL OR rol = 'negocio')", [correo]);
        if (f.length === 0) { resultados.push({ correo, ok: false, motivo: 'no_existe' }); continue; }
        resultados.push({ correo, ...(await regalarPlan(f[0].id, datos)) });
    }
    return resultados;
}

module.exports = { validarRegalo, regalarPlan, regalarPorCorreos, DIAS_POR_DEFECTO, DIAS_MAXIMOS, MAX_CUENTAS_POR_LOTE };
