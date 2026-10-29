// Envío de mensajes directos por Instagram (Graph API) y utilidades para reconocer clientes de Instagram.
// Los clientes de Instagram se guardan en `clientes.whatsapp` con el prefijo "ig_" + el id del usuario en Instagram.

const { descifrarSecreto } = require('./secretos');

const PREFIJO_CLIENTE = 'ig_';
const VERSION_GRAPH = process.env.META_GRAPH_VERSION || 'v21.0';

/** ¿Este identificador de cliente es de Instagram? (también reconoce el prefijo viejo `instagram_`) */
function esClienteInstagram(identificador) {
    return typeof identificador === 'string' && (identificador.startsWith(PREFIJO_CLIENTE) || identificador.startsWith('instagram_'));
}

/** "ig_1784..." → "1784..." (el id que usa la API de Instagram). */
function idDeInstagram(identificador) {
    return String(identificador || '').replace(/^(ig_|instagram_)/, '');
}

/**
 * Manda un mensaje de texto a un usuario de Instagram con el token del negocio.
 * Devuelve { ok } o { ok:false, motivo, detalle } para poder explicarle el problema al dueño.
 * Instagram solo deja escribir dentro de las 24 h siguientes al último mensaje del cliente.
 */
async function enviarInstagram(db, negocioId, destinatarioId, texto) {
    if (!destinatarioId || !texto) return { ok: false, motivo: 'sin_destinatario' };
    const [filas] = await db.execute('SELECT instagram_token FROM negocios WHERE id = ?', [negocioId]);
    const token = descifrarSecreto(filas[0] && filas[0].instagram_token);
    if (!token) return { ok: false, motivo: 'no_conectado' };
    try {
        const r = await fetch(`https://graph.facebook.com/${VERSION_GRAPH}/me/messages?access_token=${encodeURIComponent(token)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient: { id: destinatarioId }, message: { text: String(texto).slice(0, 1000) } }),
        });
        if (r.ok) return { ok: true };
        let detalle = '';
        try { detalle = (await r.json())?.error?.message || ''; } catch (_) { /* sin cuerpo */ }
        // Códigos de Meta frecuentes: ventana de 24 h vencida o token vencido/revocado.
        const motivo = /24|window|ventana|outside/i.test(detalle) ? 'ventana_vencida' : (r.status === 401 || /token|session|expired/i.test(detalle) ? 'token_invalido' : 'error');
        return { ok: false, motivo, detalle };
    } catch (e) {
        return { ok: false, motivo: 'sin_conexion', detalle: e.message };
    }
}

async function tokenDe(db, negocioId) {
    const [filas] = await db.execute('SELECT instagram_token FROM negocios WHERE id = ?', [negocioId]);
    return descifrarSecreto(filas[0] && filas[0].instagram_token);
}

async function llamarGraph(ruta, token, cuerpo) {
    try {
        const r = await fetch(`https://graph.facebook.com/${VERSION_GRAPH}/${ruta}?access_token=${encodeURIComponent(token)}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
        });
        if (r.ok) return { ok: true };
        let detalle = '';
        try { detalle = (await r.json())?.error?.message || ''; } catch (_) { /* sin cuerpo */ }
        return { ok: false, motivo: r.status === 401 || /token|session|expired/i.test(detalle) ? 'token_invalido' : 'error', detalle };
    } catch (e) {
        return { ok: false, motivo: 'sin_conexion', detalle: e.message };
    }
}

/** Respuesta privada: el DM que Instagram permite mandar UNA vez a quien comentó (sin que haya escrito antes). */
async function enviarRespuestaPrivada(db, negocioId, comentarioId, texto) {
    if (!comentarioId || !texto) return { ok: false, motivo: 'sin_destinatario' };
    const token = await tokenDe(db, negocioId);
    if (!token) return { ok: false, motivo: 'no_conectado' };
    return llamarGraph('me/messages', token, { recipient: { comment_id: comentarioId }, message: { text: String(texto).slice(0, 1000) } });
}

/** Respuesta pública debajo del comentario. */
async function responderComentario(db, negocioId, comentarioId, texto) {
    if (!comentarioId || !texto) return { ok: false, motivo: 'sin_destinatario' };
    const token = await tokenDe(db, negocioId);
    if (!token) return { ok: false, motivo: 'no_conectado' };
    return llamarGraph(`${encodeURIComponent(comentarioId)}/replies`, token, { message: String(texto).slice(0, 300) });
}

const EXPLICACIONES = {
    sin_destinatario: 'Este cliente no tiene un usuario de Instagram guardado.',
    no_conectado: 'Tu Instagram no está conectado. Ve a Ajustes → Canales y conéctalo.',
    ventana_vencida: 'Instagram solo permite responder durante las 24 horas siguientes al último mensaje del cliente. Ya pasó ese tiempo.',
    token_invalido: 'La conexión con Instagram venció. Ve a Ajustes → Canales y vuelve a conectarla.',
    sin_conexion: 'No se pudo contactar a Instagram. Intenta de nuevo en unos segundos.',
    error: 'Instagram rechazó el mensaje.',
};
const explicarErrorInstagram = (envio) => `${EXPLICACIONES[envio.motivo] || EXPLICACIONES.error}${envio.detalle && envio.motivo === 'error' ? ` (${envio.detalle})` : ''}`;

module.exports = { PREFIJO_CLIENTE, esClienteInstagram, idDeInstagram, enviarInstagram, enviarRespuestaPrivada, responderComentario, explicarErrorInstagram };
