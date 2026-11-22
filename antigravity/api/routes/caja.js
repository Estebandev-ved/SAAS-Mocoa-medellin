// Puente con la "caja" (inventario, ventas y plata para emprendedores, app aparte
// en Spring Boot). Antigravity solo vende el plan y prueba quién es el cliente:
// aquí se emite un JWT de corta vida que la caja valida con su propio secreto
// (CAJA_JWT_SECRET, distinto de JWT_SECRET — la caja nunca debe poder forjar ni
// aceptar tokens del panel).
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const { injectTenantId } = require('../middleware/tenant');
const { hasFeature } = require('../../config/planConfig');
const { calcularEstado } = require('../services/billing');

const router = express.Router();

const ISSUER = 'antigravity';
const AUDIENCE = 'caja';
const EXPIRA_EN = '12h';

// billing.calcularEstado distingue 5 estados; la caja solo entiende 3.
//   trial      -> trial
//   activa     -> activo
//   cancelada  -> activo   (ya pagó el ciclo: conserva acceso hasta vigente_hasta)
//   vencida / inactiva -> vencido
const ESTADO_CAJA = {
    trial: 'trial',
    activa: 'activo',
    cancelada: 'activo',
    vencida: 'vencido',
    inactiva: 'vencido',
};

function estadoParaCaja(negocio, ahora = new Date()) {
    const { estado, acceso_hasta } = calcularEstado(negocio, ahora);
    return {
        estado: ESTADO_CAJA[estado] || 'vencido',
        vigente_hasta: acceso_hasta ? new Date(acceso_hasta).toISOString() : null,
    };
}

// Enlaces: cuentas de Antigravity que usan un negocio que YA existe en la caja (p. ej. el dueño, cuyos datos de
// siempre están como negocio 1). Sin mover ningún dato: el token le dice a la caja "este es el negocio N".
//   CAJA_ENLACES="dueno@correo.co:1,42:5"   → la clave es el correo o el id de Antigravity; el valor, el negocio de la caja.
// Cualquier otra cuenta entra a su propio negocio, que es el número de su cuenta en Antigravity.
function parsearEnlaces(texto) {
    const porEmail = new Map();
    const porId = new Map();
    for (const par of String(texto || '').split(',')) {
        const corte = par.lastIndexOf(':');
        if (corte < 1) continue;
        const clave = par.slice(0, corte).trim();
        const destino = Number(par.slice(corte + 1).trim());
        if (!clave || !Number.isInteger(destino) || destino <= 0) continue;
        if (clave.includes('@')) porEmail.set(clave.toLowerCase(), destino);
        else if (/^\d+$/.test(clave)) porId.set(Number(clave), destino);
    }
    return { porEmail, porId };
}

// El negocio 1 de la caja es el del dueño (el del PIN). Si una cuenta de Antigravity cualquiera tuviera el id 1,
// entraría a esos datos: por eso nadie llega al negocio reservado si no está enlazado a propósito.
const NEGOCIO_RESERVADO_POR_DEFECTO = 1;

// Fábrica para poder probar el handler sin base de datos ni servidor.
function crearTokenHandler({ pool = db, env = process.env, ahora = () => new Date() } = {}) {
    return async function emitirTokenCaja(req, res) {
        try {
            const secreto = env.CAJA_JWT_SECRET;
            const urlCaja = env.CAJA_URL;
            if (!secreto || !urlCaja) {
                console.error('[Caja] Faltan CAJA_JWT_SECRET y/o CAJA_URL en las variables de entorno');
                return res.status(503).json({
                    error: 'La caja no está configurada en este servidor',
                    codigo: 'CAJA_NO_CONFIGURADA'
                });
            }

            const { id, nombre, plan } = req.negocio;

            if (!hasFeature(plan, 'cajaInventario')) {
                return res.status(403).json({
                    error: 'Tu plan no incluye la caja. Cambia al plan Emprendedor para usarla.',
                    codigo: 'PLAN_INSUFICIENTE',
                    plan_actual: plan,
                    upgrade_url: '/dashboard/plan'
                });
            }

            const [rows] = await pool.execute(
                `SELECT suscripcion_activa, suscripcion_inicio, suscripcion_fin, trial_hasta
                 FROM negocios WHERE id = ?`,
                [id]
            );
            if (!rows[0]) {
                return res.status(404).json({ error: 'Negocio no encontrado', codigo: 'NEGOCIO_NO_EXISTE' });
            }

            const { estado, vigente_hasta } = estadoParaCaja(rows[0], ahora());

            const enlaces = parsearEnlaces(env.CAJA_ENLACES);
            const correo = String(req.negocio.email || '').trim().toLowerCase();
            const enlazado = enlaces.porEmail.get(correo) ?? enlaces.porId.get(id);
            const negocioCaja = enlazado ?? id;
            const crudo = String(env.CAJA_NEGOCIO_RESERVADO ?? '').trim();
            const reservado = /^\d+$/.test(crudo) ? Number(crudo) : NEGOCIO_RESERVADO_POR_DEFECTO;   // 0 lo apaga
            if (enlazado === undefined && negocioCaja === reservado) {
                console.error(`[Caja] La cuenta ${id} coincide con el negocio reservado ${reservado} de la caja y no está enlazada: no se emite token`);
                return res.status(403).json({
                    error: 'Esta cuenta todavía no se puede conectar a la caja. Escríbenos y la activamos.',
                    codigo: 'CAJA_NEGOCIO_RESERVADO'
                });
            }
            if (enlazado !== undefined) console.log(`[Caja] Cuenta ${id} enlazada al negocio ${negocioCaja} de la caja`);

            const token = jwt.sign(
                { negocio_id: negocioCaja, nombre, plan, estado, vigente_hasta },
                secreto,
                { algorithm: 'HS256', issuer: ISSUER, audience: AUDIENCE, expiresIn: EXPIRA_EN }
            );

            // El token va en el fragmento (#), no en el query: el fragmento no viaja
            // al servidor de la caja ni queda en sus logs de acceso.
            res.json({ token, url: urlCaja.replace(/\/+$/, '') + '/#token=' + token });
        } catch (error) {
            console.error('[Caja] Error emitiendo token:', error.message);
            res.status(500).json({ error: 'Error al abrir la caja' });
        }
    };
}

router.post('/token', verificarAuth, injectTenantId, crearTokenHandler());

module.exports = router;
module.exports.crearTokenHandler = crearTokenHandler;
module.exports.estadoParaCaja = estadoParaCaja;
module.exports.parsearEnlaces = parsearEnlaces;
