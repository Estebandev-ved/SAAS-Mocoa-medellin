// Validación de los webhooks de Meta (Instagram, WhatsApp Cloud): cada petición trae la cabecera
// `X-Hub-Signature-256: sha256=<hmac>` calculada con el secreto de la app sobre el cuerpo EXACTO recibido.
// Sin esta comprobación cualquiera podría enviar eventos falsos y hacer que el bot responda y gaste IA.

const crypto = require('crypto');

/** ¿La firma de `cuerpoCrudo` (Buffer o texto) coincide con la cabecera? Falso si falta algo. */
function firmaValida(cuerpoCrudo, cabecera, secreto) {
    if (!secreto || !cabecera || cuerpoCrudo === undefined || cuerpoCrudo === null) return false;
    const m = /^sha256=([0-9a-f]{64})$/i.exec(String(cabecera).trim());
    if (!m) return false;
    const esperado = crypto.createHmac('sha256', secreto).update(cuerpoCrudo).digest();
    const recibido = Buffer.from(m[1], 'hex');
    return recibido.length === esperado.length && crypto.timingSafeEqual(recibido, esperado);
}

/** Genera la cabecera que mandaría Meta (para pruebas). */
function firmar(cuerpoCrudo, secreto) {
    return `sha256=${crypto.createHmac('sha256', secreto).update(cuerpoCrudo).digest('hex')}`;
}

module.exports = { firmaValida, firmar };
