const db = require('../../db/config');

// Atención humana: cuando el cliente pide hablar con una persona (o califica mal
// la entrega), el bot se calla y avisa al dueño por WhatsApp. El dueño responde
// desde Conversaciones y devuelve el chat al bot con "Retomar bot". Si nadie lo
// retoma, el bot vuelve solo pasadas HUMANO_TIMEOUT_HORAS (12 por defecto).

const TIMEOUT_HORAS = parseFloat(process.env.HUMANO_TIMEOUT_HORAS) || 12;

const quitarAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

// Frases claras de "quiero una persona". Se evita "persona"/"dueño" sueltos para
// no confundir "un pedido para una persona" con una derivación.
function pideHumano(texto) {
    const t = quitarAcentos(String(texto || '').toLowerCase());
    if (t.length > 300) return false;
    return /\b(asesor|asesora|agente humano|persona real|atencion humana|humano|supervisor|supervisora|gerente|encargado|encargada)\b/.test(t)
        || /hablar con (alguien|una persona|un humano|el dueno|la dueno|el encargado|la encargada|un agente|un asesor|una asesora)/.test(t);
}

// ¿El chat sigue en manos de una persona? Si ya pasó el tiempo, lo devuelve al bot.
async function estaEnHumano(cliente) {
    if (!cliente || !cliente.atencion_humana) return false;
    const desde = cliente.humano_desde ? new Date(cliente.humano_desde).getTime() : 0;
    if (desde && Date.now() - desde > TIMEOUT_HORAS * 3600 * 1000) {
        try { await db.execute('UPDATE clientes SET atencion_humana = 0, humano_desde = NULL WHERE id = ?', [cliente.id]); } catch (e) { /* nada */ }
        return false;
    }
    return true;
}

async function derivarAHumano({ sock, jid, negocioId, cliente, numero, motivo, avisoCliente }) {
    try {
        await db.execute('UPDATE clientes SET atencion_humana = 1, humano_desde = NOW() WHERE id = ?', [cliente.id]);
    } catch (e) {
        // Sin la columna (migración pendiente) no se puede pausar el bot: no se promete algo que no se cumple.
        console.error('[AtencionHumana] No se pudo marcar al cliente (¿migración v3 sin correr?):', e.message);
        return false;
    }

    const aviso = avisoCliente || 'Entendido 🙌 Ya le avisé a una persona del equipo para que te atienda directamente. Te escribirá en cuanto pueda; mientras tanto no te enviaré más mensajes automáticos.';
    await sock.sendMessage(jid, { text: aviso });
    await db.execute(
        `INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada)
         VALUES (?, ?, 'salida', ?, 'derivacion', 'atencion_humana')`,
        [negocioId, `+${numero}`, aviso]
    );

    const nombre = cliente.nombre && cliente.nombre !== 'Pendiente' ? cliente.nombre : `+${numero}`;
    const texto = `🙋 ${nombre} (+${numero}) necesita atención personal${motivo ? ` — ${motivo}` : ''}. El bot dejó de responderle. Entra a Conversaciones para atenderlo y, cuando termines, pulsa "Retomar bot".`;
    try {
        await db.execute(
            'INSERT INTO notificaciones (negocio_id, tipo, titulo, mensaje, datos) VALUES (?, ?, ?, ?, ?)',
            [negocioId, 'atencion_humana', 'Un cliente pide atención personal', texto, JSON.stringify({ referencia_id: String(cliente.id), cliente_id: String(cliente.id) })]
        );
        const [neg] = await db.execute('SELECT whatsapp FROM negocios WHERE id = ?', [negocioId]);
        const dueno = neg[0]?.whatsapp;
        if (dueno) {
            const instanceManager = require('../InstanceManager');
            await instanceManager.sendMessage(negocioId, dueno.replace(/[^0-9]/g, ''), texto);
        }
    } catch (e) {
        console.error('[AtencionHumana] No se pudo avisar al dueño:', e.message);
    }
    return true;
}

module.exports = { pideHumano, estaEnHumano, derivarAHumano, TIMEOUT_HORAS };
