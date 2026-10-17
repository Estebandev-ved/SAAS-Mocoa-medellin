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

// Devuelve { ok, motivo } para que quien llama pueda explicar por qué falló.
async function enviarWhatsAppDetalle(negocioId, numero, mensaje) {
    if (!numero) return { ok: false, motivo: 'sin_numero' };
    try {
        await axios.post(`${INSTANCE_MANAGER_URL}/internal/message`, {
            negocio_id: negocioId,
            numero: numero.startsWith('+') ? numero : `+${numero}`,
            mensaje
        }, { timeout: 15000 });
        return { ok: true };
    } catch (error) {
        const detalle = error.response?.data?.error || error.message;
        let motivo = 'error';
        if (!error.response) motivo = error.code === 'ECONNABORTED' ? 'timeout' : 'gestor_inaccesible';
        else if (/no está conectado/i.test(detalle)) motivo = 'no_conectado';
        console.error(`[AutomationsService] Error enviando WhatsApp (${motivo}) a negocio ${negocioId}:`, detalle);
        return { ok: false, motivo, detalle };
    }
}

async function enviarWhatsApp(negocioId, numero, mensaje) {
    return (await enviarWhatsAppDetalle(negocioId, numero, mensaje)).ok;
}

// Automatización "encuesta": tras la entrega pide una calificación de 1 a 5.
// La respuesta la procesa instance-manager/handlers/encuesta.js.
async function enviarEncuestaSiCorresponde(negocioId, pedidoId) {
    try {
        const { activa } = await isAutomationActive(negocioId, 'encuesta');
        if (!activa) return;
        if (await yaSeNotifico(negocioId, 'encuesta', pedidoId)) return;
        const [rows] = await db.execute(
            'SELECT p.cliente_id, c.whatsapp FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE p.id = ? AND p.negocio_id = ?',
            [pedidoId, negocioId]
        );
        if (rows.length === 0 || !rows[0].whatsapp) return;
        const mensaje = '⭐ ¿Cómo calificas tu pedido? Responde con un número del 1 (muy malo) al 5 (excelente). ¡Tu opinión nos ayuda a mejorar!';
        const enviado = await enviarWhatsApp(negocioId, rows[0].whatsapp, mensaje);
        if (enviado) {
            await registrarNotificacion(negocioId, 'encuesta', 'Encuesta de satisfacción enviada', mensaje, pedidoId, { cliente_id: String(rows[0].cliente_id) });
        }
    } catch (error) {
        console.error('[AutomationsService] Error enviando encuesta:', error.message);
    }
}

async function avisarAlDueno(negocioId, mensaje) {
    try {
        const [neg] = await db.execute('SELECT whatsapp FROM negocios WHERE id = ?', [negocioId]);
        return neg[0]?.whatsapp ? await enviarWhatsApp(negocioId, neg[0].whatsapp, mensaje) : false;
    } catch (error) {
        return false;
    }
}

module.exports = {
    enviarEncuestaSiCorresponde,
    avisarAlDueno,
    isAutomationActive,
    yaSeNotifico,
    registrarNotificacion,
    enviarWhatsApp,
    enviarWhatsAppDetalle
};
