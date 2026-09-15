const db = require('../../db/config');
const axios = require('axios');

// Helpers compartidos para que las automatizaciones (antes solo un switch que
// no hacía nada) disparen algo real. Usados desde routes/pedidos.js,
// routes/domicilios.js y scheduler.js.
//
// Antes de este archivo, NADA en el proyecto (ni un cron, ni el "brain" en
// Python, ni el queue) leía la tabla `automatizaciones_config` para decidir
// si ejecutar algo — todas las automatizaciones (incluidas las del catálogo
// "oficial" en routes/automations.js) eran, en la práctica, un switch que no
// activaba ningún comportamiento. Esto le da ejecución real a
// recordatorio_pago, stock_bajo y resena, siempre detrás del flag `activa`
// (por defecto apagado) para que nada le llegue a un cliente sin que el
// dueño lo prenda explícitamente.

const INSTANCE_MANAGER_URL = process.env.INSTANCE_MANAGER_URL || 'http://localhost:3001';

async function isAutomationActive(negocioId, tipo) {
    try {
        const [rows] = await db.execute(
            'SELECT activa, config FROM automatizaciones_config WHERE negocio_id = ? AND tipo = ?',
            [negocioId, tipo]
        );
        if (rows.length === 0) return { activa: false, config: {} };
        let config = {};
        if (rows[0].config) {
            try {
                config = typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config;
            } catch (e) {
                config = {};
            }
        }
        return { activa: !!rows[0].activa, config };
    } catch (error) {
        console.error('[AutomationsService] Error leyendo config:', error.message);
        return { activa: false, config: {} };
    }
}

// Evita reenviar el mismo recordatorio/alerta una y otra vez: usa la tabla
// `notificaciones` (ya existía en el schema, sin usar en ningún lado) como
// registro de "esto ya se avisó", sin necesitar una columna nueva en pedidos
// ni en productos.
async function yaSeNotifico(negocioId, tipo, referenciaId, dentroDeHoras = null) {
    try {
        let query = `SELECT id FROM notificaciones WHERE negocio_id = ? AND tipo = ? AND JSON_EXTRACT(datos, '$.referencia_id') = ?`;
        const params = [negocioId, tipo, String(referenciaId)];
        if (dentroDeHoras) {
            query += ' AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)';
            params.push(dentroDeHoras);
        }
        query += ' LIMIT 1';
        const [rows] = await db.execute(query, params);
        return rows.length > 0;
    } catch (error) {
        console.error('[AutomationsService] Error chequeando notificación previa:', error.message);
        // Ante la duda, mejor no reenviar (evita spam si algo falla en la query).
        return true;
    }
}

async function registrarNotificacion(negocioId, tipo, titulo, mensaje, referenciaId = null, datosExtra = {}) {
    try {
        await db.execute(
            'INSERT INTO notificaciones (negocio_id, tipo, titulo, mensaje, datos) VALUES (?, ?, ?, ?, ?)',
            [negocioId, tipo, titulo, mensaje, JSON.stringify({ referencia_id: referenciaId ? String(referenciaId) : null, ...datosExtra })]
        );
    } catch (error) {
        console.error('[AutomationsService] Error registrando notificación:', error.message);
    }
}

async function enviarWhatsApp(negocioId, numero, mensaje) {
    if (!numero) return false;
    try {
        await axios.post(`${INSTANCE_MANAGER_URL}/internal/message`, {
            negocio_id: negocioId,
            numero: numero.startsWith('+') ? numero : `+${numero}`,
            mensaje
        }, { timeout: 5000 });
        return true;
    } catch (error) {
        console.error('[AutomationsService] Error enviando WhatsApp:', error.message);
        return false;
    }
}

module.exports = {
    isAutomationActive,
    yaSeNotifico,
    registrarNotificacion,
    enviarWhatsApp
};
