const db = require('../../db/config');
const { enviarWhatsApp } = require('./automationsService');

// Envío de campañas masivas sin Redis ni worker aparte: la tabla `campañas`
// es la cola. Cada ciclo toma las campañas 'programada' cuya fecha ya llegó
// (o sin fecha), las reclama de forma atómica y las envía una por una con
// pausas aleatorias (anti-bloqueo de WhatsApp). Solo se escribe a clientes que
// aceptaron marketing (Ley 1581).

const entero = (v, def) => (Number.isFinite(parseInt(v)) ? parseInt(v) : def);
const PAUSA_MIN_MS = entero(process.env.CAMPANA_PAUSA_MIN_MS, 2000);
const PAUSA_MAX_MS = Math.max(PAUSA_MIN_MS, entero(process.env.CAMPANA_PAUSA_MAX_MS, 5000));

// Tope por campaña: con WhatsApp por QR, ráfagas grandes de mensajes a gente
// que no escribió primero son la causa típica de bloqueo del número.
const MAX_DESTINATARIOS = parseInt(process.env.CAMPANA_MAX_DESTINATARIOS) || 200;

let procesando = false;

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// Sustituye {nombre} por el primer nombre del cliente (o lo quita, sin dejar un espacio huérfano).
// El frontend muestra esta misma regla en la vista previa de la campaña.
function personalizar(mensaje, cliente) {
    const primer = String((cliente && cliente.nombre) || '').trim().split(/\s+/)[0] || '';
    const texto = String(mensaje || '').replace(/\{nombre\}/gi, primer);
    return primer ? texto : texto.replace(/[ \t]+([,.!¡?¿])/g, '$1').replace(/^[,\s]+/, '').replace(/ {2,}/g, ' ');
}

async function destinatarios(negocioId, segmento, segmentoConfig) {
    let cfg = {};
    try {
        cfg = typeof segmentoConfig === 'string' ? JSON.parse(segmentoConfig) : (segmentoConfig || {});
    } catch (e) { cfg = {}; }

    let query = `SELECT c.id, c.whatsapp, c.nombre FROM clientes c
                 WHERE c.negocio_id = ? AND c.acepta_marketing = 1 AND c.whatsapp IS NOT NULL`;
    const params = [negocioId];

    if (segmento === 'inactivos') {
        query += ` AND c.id IN (SELECT cliente_id FROM pedidos WHERE negocio_id = ?
                   GROUP BY cliente_id HAVING DATEDIFF(NOW(), MAX(created_at)) > ?)`;
        params.push(negocioId, Number(cfg.dias) || 30);
    } else if (segmento === 'nuevos') {
        query += ' AND c.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)';
        params.push(Number(cfg.dias) || 30);
    } else if (segmento === 'compraron_x') {
        if (!cfg.producto_id) return [];
        query += ` AND c.id IN (SELECT p.cliente_id FROM pedidos p
                   JOIN items_pedido ip ON p.id = ip.pedido_id
                   WHERE p.negocio_id = ? AND ip.producto_id = ?)`;
        params.push(negocioId, cfg.producto_id);
    }

    const [rows] = await db.execute(query, params);
    return rows;
}

// Cuenta cuántos recibirían la campaña (para mostrarlo antes de crearla).
async function contarDestinatarios(negocioId, segmento, segmentoConfig) {
    return (await destinatarios(negocioId, segmento, segmentoConfig)).length;
}

async function enviarCampana(camp) {
    const lista = (await destinatarios(camp.negocio_id, camp.segmento, camp.segmento_config)).slice(0, MAX_DESTINATARIOS);
    await db.execute('UPDATE campañas SET total_destinatarios = ? WHERE id = ?', [lista.length, camp.id]);

    let enviados = 0;
    let fallidos = 0;
    for (const cliente of lista) {
        // Si el dueño la canceló mientras se enviaba, se detiene.
        const [[estado]] = await db.execute('SELECT estado FROM campañas WHERE id = ?', [camp.id]);
        if (!estado || estado.estado !== 'enviando') break;

        const ok = await enviarWhatsApp(camp.negocio_id, cliente.whatsapp, personalizar(camp.mensaje, cliente));
        if (ok) enviados++; else fallidos++;

        await db.execute('UPDATE campañas SET total_enviados = ?, total_fallidos = ? WHERE id = ?', [enviados, fallidos, camp.id]);
        await pausa(PAUSA_MIN_MS + Math.random() * (PAUSA_MAX_MS - PAUSA_MIN_MS));
    }

    await db.execute(
        `UPDATE campañas SET estado = 'completada', total_enviados = ?, total_fallidos = ?
         WHERE id = ? AND estado = 'enviando'`,
        [enviados, fallidos, camp.id]
    );
    console.log(`[Campañas] ${camp.id} terminada: ${enviados} enviadas, ${fallidos} fallidas de ${lista.length}`);
}

async function procesarCampanasPendientes() {
    if (procesando) return;
    procesando = true;
    try {
        const [pendientes] = await db.execute(
            `SELECT * FROM campañas WHERE estado = 'programada'
             AND (fecha_envio IS NULL OR fecha_envio <= NOW()) ORDER BY created_at LIMIT 5`
        );
        for (const camp of pendientes) {
            // Reclamo atómico: si otra instancia ya la tomó, affectedRows = 0.
            const [r] = await db.execute(
                `UPDATE campañas SET estado = 'enviando' WHERE id = ? AND estado = 'programada'`, [camp.id]
            );
            if (r.affectedRows === 0) continue;
            try {
                await enviarCampana(camp);
            } catch (e) {
                console.error(`[Campañas] Error en campaña ${camp.id}:`, e.message);
                await db.execute(`UPDATE campañas SET estado = 'completada' WHERE id = ? AND estado = 'enviando'`, [camp.id]);
            }
        }
    } catch (error) {
        console.error('[Campañas] Error procesando pendientes:', error.code || error.message);
    } finally {
        procesando = false;
    }
}

// Una campaña que quedó 'enviando' tras un reinicio no se reanuda sola (no hay
// registro por destinatario y reenviaría a los que ya la recibieron): se cierra.
async function cerrarCampanasHuerfanas() {
    try {
        await db.execute(`UPDATE campañas SET estado = 'cancelada' WHERE estado = 'enviando'`);
    } catch (e) {
        console.error('[Campañas] Error cerrando huérfanas:', e.code || e.message);
    }
}

module.exports = { personalizar, procesarCampanasPendientes, cerrarCampanasHuerfanas, contarDestinatarios, destinatarios, MAX_DESTINATARIOS };
