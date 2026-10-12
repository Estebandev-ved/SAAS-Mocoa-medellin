const db = require('../../db/config');

// Respuesta a la encuesta de satisfacción (automatización "encuesta"): el
// cliente contesta con un número de 1 a 5 dentro de las 48 h siguientes.

function parseCalificacion(texto) {
    const m = String(texto || '').trim().match(/^([1-5])(\s*(⭐+|estrellas?|\/\s*5))?[.!]*$/i);
    return m ? Number(m[1]) : null;
}

// Devuelve { calificacion, respuesta, baja } si el mensaje era la respuesta a una
// encuesta pendiente de ese cliente; null si no (el bot sigue su flujo normal).
async function registrarRespuesta(negocioId, cliente, texto) {
    const calificacion = parseCalificacion(texto);
    if (!calificacion) return null;
    try {
        const [pendientes] = await db.execute(
            `SELECT n.id, JSON_UNQUOTE(JSON_EXTRACT(n.datos, '$.referencia_id')) AS pedido_id
             FROM notificaciones n
             WHERE n.negocio_id = ? AND n.tipo = 'encuesta'
               AND JSON_UNQUOTE(JSON_EXTRACT(n.datos, '$.cliente_id')) = ?
               AND n.created_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)
             ORDER BY n.id DESC LIMIT 1`,
            [negocioId, String(cliente.id)]
        );
        if (pendientes.length === 0) return null;

        const [r] = await db.execute(
            'INSERT IGNORE INTO encuestas (negocio_id, pedido_id, cliente_id, calificacion) VALUES (?, ?, ?, ?)',
            [negocioId, pendientes[0].pedido_id, cliente.id, calificacion]
        );
        if (r.affectedRows === 0) return null; // ya la había respondido

        const baja = calificacion <= 3;
        const respuesta = baja
            ? 'Gracias por contarnos 🙏 Lamentamos que no haya sido una gran experiencia. Una persona del equipo te contactará para ayudarte.'
            : '¡Muchas gracias por tu calificación! 🙌 Nos alegra que hayas quedado contento. ¡Te esperamos de nuevo!';
        return { calificacion, respuesta, baja };
    } catch (e) {
        console.error('[Encuesta] Error registrando respuesta:', e.message);
        return null;
    }
}

module.exports = { parseCalificacion, registrarRespuesta };
