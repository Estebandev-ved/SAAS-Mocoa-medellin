const crypto = require('crypto');

// bcrypt solo usa los primeros 72 bytes: más largo no suma seguridad.
const MIN = 8;
const MAX = 72;
const COMUNES = new Set([
    '12345678', '123456789', '1234567890', 'password', 'password1', 'contraseña', 'qwertyui',
    'qwerty123', 'abc12345', 'iloveyou', '11111111', '00000000', 'admin123', 'demo2024',
    'colombia1', 'medellin1'
]);

// Devuelve un mensaje de error en español, o null si la contraseña es aceptable.
function validarPassword(password, { email } = {}) {
    if (typeof password !== 'string') return 'La contraseña es requerida';
    if (password.length < MIN) return `La contraseña debe tener al menos ${MIN} caracteres`;
    if (Buffer.byteLength(password) > MAX) return `La contraseña no puede superar ${MAX} caracteres`;
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        return 'La contraseña debe combinar letras y números';
    }
    if (COMUNES.has(password.toLowerCase())) return 'Esa contraseña es demasiado común. Elige otra';
    if (email && password.toLowerCase() === String(email).toLowerCase()) {
        return 'La contraseña no puede ser igual a tu correo';
    }
    return null;
}

// Huella corta del hash guardado. Va dentro del JWT: al cambiar o recuperar la
// contraseña el hash cambia y todas las sesiones anteriores quedan invalidadas.
function huellaPassword(hash) {
    return crypto.createHash('sha256').update(String(hash || '')).digest('hex').slice(0, 16);
}

module.exports = { validarPassword, huellaPassword, MIN, MAX };
