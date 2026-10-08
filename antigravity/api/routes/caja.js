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

            const token = jwt.sign(
                { negocio_id: id, nombre, plan, estado, vigente_hasta },
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
