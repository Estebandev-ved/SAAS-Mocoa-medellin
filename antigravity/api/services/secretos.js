// Cifrado de secretos que se guardan en la base de datos (p. ej. el token de acceso de Instagram del negocio).
// AES-256-GCM con una llave derivada de SECRETS_ENC_KEY (o, si no está, de TOTP_ENC_KEY / JWT_SECRET).
// Lo cifrado lleva el prefijo "enc:v1:" para distinguirlo de valores viejos en texto plano, que se siguen leyendo
// (y se cifran la próxima vez que se guarden).

const crypto = require('crypto');

const PREFIJO = 'enc:v1:';

function llave() {
    const base = process.env.SECRETS_ENC_KEY || process.env.TOTP_ENC_KEY || process.env.JWT_SECRET;
    if (!base) throw new Error('Falta SECRETS_ENC_KEY (o JWT_SECRET) para cifrar secretos');
    return crypto.createHash('sha256').update(`secreto:${base}`).digest();
}

function cifrarSecreto(texto) {
    if (texto === null || texto === undefined || texto === '') return null;
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', llave(), iv);
    const ct = Buffer.concat([c.update(String(texto), 'utf8'), c.final()]);
    return PREFIJO + [iv, c.getAuthTag(), ct].map((b) => b.toString('hex')).join(':');
}

/** Devuelve el secreto en claro, o null si no hay o no se pudo descifrar (llave cambiada, dato corrupto). */
function descifrarSecreto(valor) {
    if (!valor) return null;
    const v = String(valor);
    if (!v.startsWith(PREFIJO)) return v; // valor viejo en texto plano
    try {
        const [iv, tag, ct] = v.slice(PREFIJO.length).split(':').map((h) => Buffer.from(h, 'hex'));
        const d = crypto.createDecipheriv('aes-256-gcm', llave(), iv);
        d.setAuthTag(tag);
        return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
    } catch (e) {
        console.error('[Secretos] No se pudo descifrar un secreto guardado:', e.message);
        return null;
    }
}

const estaCifrado = (valor) => typeof valor === 'string' && valor.startsWith(PREFIJO);

module.exports = { cifrarSecreto, descifrarSecreto, estaCifrado, PREFIJO };
