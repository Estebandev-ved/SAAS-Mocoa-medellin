const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');

// Router canónico para /api/automations — los switches de la página
// "Automatizaciones" del dashboard. Antes esto vivía duplicado dentro de
// routes/all.js (con su propio pool de MySQL); se movió aquí, a su propio
// archivo, para que quede junto al resto de routers de un solo recurso.
//
// Los ids del frontend (AutomationsPage.jsx) y del catálogo "de verdad" en
// routes/automations.js (montado en /api/automatizaciones) ya están
// alineados: recordatorio_pago, reengagement, stock_bajo, reporte_semanal y
// campaña_masiva son los mismos ids en los dos lados (antes el frontend
// usaba stock_alert/campana_masiva — se corrigió ahí, ver AutomationsPage.jsx).
//
// De esos, cuatro SÍ disparan algo real ahora (ver api/scheduler.js y
// services/automationsService.js, usados desde acá, pedidos.js y
// domicilios.js): recordatorio_pago, stock_bajo, resena y reengagement
// (contacta clientes con `ultimo_pedido` más viejo que `config.dias`, con el
// mensaje/oferta configurados, sin repetir al mismo cliente dentro del mismo
// ciclo). campaña_masiva SÍ tiene motor de envío real (api/routes/automations.js
// + queue/, con Bull sobre Redis), pero depende de infraestructura que hay
// que levantar aparte: `bull` como dependencia de npm (agregado a
// package.json — falta correr `npm install`), Redis corriendo, y el proceso
// del worker (`node queue/index.js`, o el contenedor `queue` de
// infra/docker-compose.yml) activo. Si algo de eso falta, crear una campaña
// no revienta — queda como 'borrador' y se puede reintentar con
// POST /api/automatizaciones/campañas/:id/enviar una vez esté todo arriba.
// bot_ventas y notificaciones tampoco tienen ids equivalentes en el catálogo
// oficial: bot_ventas ya se controla de verdad con conectar/desconectar
// WhatsApp (api/business/whatsapp/*), y notificaciones ya pasa en tiempo
// real por el socket mientras el dashboard esté abierto — este switch por
// ahora solo guarda la preferencia, no bloquea nada.
router.use(verificarAuth);

router.get('/', async (req, res) => {
    try {
        const [configs] = await db.execute(
            'SELECT tipo, activa FROM automatizaciones_config WHERE negocio_id = ?',
            [req.negocioId]
        );
        const automations = {};
        configs.forEach(c => { automations[c.tipo] = { activa: !!c.activa }; });
        res.json({ automations });
    } catch (error) {
        console.error('[Automations] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener automatizaciones' });
    }
});

router.put('/', async (req, res) => {
    try {
        const { tipo, activa } = req.body;

        if (!tipo) {
            return res.status(400).json({ error: 'tipo es requerido' });
        }

        const [existing] = await db.execute(
            'SELECT id FROM automatizaciones_config WHERE negocio_id = ? AND tipo = ?',
            [req.negocioId, tipo]
        );

        if (existing.length > 0) {
            await db.execute(
                'UPDATE automatizaciones_config SET activa = ?, updated_at = NOW() WHERE id = ?',
                [!!activa, existing[0].id]
            );
        } else {
            await db.execute(
                `INSERT INTO automatizaciones_config (negocio_id, tipo, activa, config, plan_requerido) VALUES (?, ?, ?, '{}', 'starter')`,
                [req.negocioId, tipo, !!activa]
            );
        }

        res.json({ success: true, tipo, activa: !!activa });
    } catch (error) {
        console.error('[Automations] Error guardando:', error.message);
        res.status(500).json({ error: 'Error al guardar automatización' });
    }
});

module.exports = router;
