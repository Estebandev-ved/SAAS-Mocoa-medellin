const crypto = require('crypto');

// TOTP (RFC 6238, SHA-1, 6 dígitos, 30 s): compatible con Google Authenticator, Authy, Microsoft Authenticator, etc.
const PERIODO = 30;
const DIGITOS = 6;
const VENTANA = 1; // tolera ±30 s de desfase entre el reloj del celular y el servidor
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
    let bits = 0, valor = 0, out = '';
    for (const byte of buf) {
        valor = (valor << 8) | byte;
        bits += 8;
        while (bits >= 5) { out += ALFABETO[(valor >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits > 0) out += ALFABETO[(valor << (5 - bits)) & 31];
    return out;
}

function base32Decode(str) {
    let bits = 0, valor = 0;
    const out = [];
    for (const c of String(str).toUpperCase().replace(/=+$/, '')) {
        const i = ALFABETO.indexOf(c);
        if (i < 0) throw new Error('Base32 inválido');
        valor = (valor << 5) | i;
        bits += 5;
        if (bits >= 8) { out.push((valor >>> (bits - 8)) & 255); bits -= 8; }
    }
    return Buffer.from(out);
}

function generarSecreto() {
    return base32Encode(crypto.randomBytes(20));
}

function codigoEnPaso(secretoBase32, paso) {
    const contador = Buffer.alloc(8);
    contador.writeBigUInt64BE(BigInt(paso));
    const h = crypto.createHmac('sha1', base32Decode(secretoBase32)).update(contador).digest();
    const offset = h[h.length - 1] & 0xf;
    const num = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
    return String(num % 10 ** DIGITOS).padStart(DIGITOS, '0');
}

function pasoActual(ahoraMs = Date.now()) {
    return Math.floor(ahoraMs / 1000 / PERIODO);
}

// Devuelve el paso (número) en que el código es válido, o null. El llamador debe guardar ese
// paso y rechazar cualquier código con paso <= al último usado (un código sirve una sola vez).
function verificarCodigo(secretoBase32, codigo, { ahoraMs = Date.now(), ultimoPaso = null } = {}) {
    const limpio = String(codigo || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(limpio)) return null;
    const actual = pasoActual(ahoraMs);
    for (let d = -VENTANA; d <= VENTANA; d++) {
        const paso = actual + d;
        if (ultimoPaso !== null && paso <= Number(ultimoPaso)) continue;
        const esperado = codigoEnPaso(secretoBase32, paso);
        if (crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(limpio))) return paso;
    }
    return null;
}

function otpauthUrl(secreto, email, emisor = 'Antigravity') {
    const etiqueta = encodeURIComponent(`${emisor}:${email}`);
    return `otpauth://totp/${etiqueta}?secret=${secreto}&issuer=${encodeURIComponent(emisor)}&algorithm=SHA1&digits=${DIGITOS}&period=${PERIODO}`;
}

// --- Cifrado del secreto en la base de datos (AES-256-GCM) ---
// Si se filtra la base de datos, los secretos TOTP no sirven sin la llave. Usa TOTP_ENC_KEY;
// si no existe cae a JWT_SECRET (cambiarlo invalidaría los 2FA ya configurados).
function llave() {
    const base = process.env.TOTP_ENC_KEY || process.env.JWT_SECRET;
    if (!base) throw new Error('Falta TOTP_ENC_KEY o JWT_SECRET para cifrar el secreto 2FA');
    return crypto.createHash('sha256').update(`totp:${base}`).digest();
}

function cifrar(texto) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', llave(), iv);
    const ct = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
    return [iv, c.getAuthTag(), ct].map(b => b.toString('hex')).join(':');
}

function descifrar(valor) {
    const [iv, tag, ct] = String(valor).split(':').map(h => Buffer.from(h, 'hex'));
    const d = crypto.createDecipheriv('aes-256-gcm', llave(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

// --- Códigos de respaldo (por si se pierde el celular) ---
const hashCodigo = (c) => crypto.createHash('sha256').update(String(c).replace(/-/g, '').toUpperCase()).digest('hex');

function generarCodigosRespaldo(cantidad = 8) {
    const claros = Array.from({ length: cantidad }, () => {
        const raw = base32Encode(crypto.randomBytes(5)).slice(0, 8); // 8 caracteres, 40 bits
        return `${raw.slice(0, 4)}-${raw.slice(4)}`;
    });
    return { claros, hashes: claros.map(hashCodigo) };
}

// Si el código coincide con uno de respaldo, devuelve la lista restante (sin ese); si no, null.
function consumirCodigoRespaldo(hashesGuardados, codigo) {
    const limpio = String(codigo || '').trim();
    if (!/^[A-Za-z2-7]{4}-?[A-Za-z2-7]{4}$/.test(limpio)) return null;
    const h = hashCodigo(limpio);
    const i = hashesGuardados.indexOf(h);
    if (i < 0) return null;
    return hashesGuardados.filter((_, j) => j !== i);
}

module.exports = {
    generarSecreto, verificarCodigo, otpauthUrl, codigoEnPaso, pasoActual,
    cifrar, descifrar, generarCodigosRespaldo, consumirCodigoRespaldo, base32Decode, base32Encode
};
