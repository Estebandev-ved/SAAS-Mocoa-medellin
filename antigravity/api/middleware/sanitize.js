const validator = require('validator');
const xss = require('xss-filters');

const TELEFONO_COLOMBIANO_REGEX = /^(\+57)?[0-9]{10}$/;
const NUMERO_WHATSAPP_REGEX = /^(\+57)?[0-9]{10}$/;

function sanitizeInput(req, res, next) {
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }
    if (req.query) {
        req.query = sanitizeObject(req.query);
    }
    if (req.params) {
        req.params = sanitizeObject(req.params);
    }
    next();
}

function sanitizeObject(obj) {
    if (typeof obj === 'string') {
        return validator.escape(validator.trim(obj));
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    if (obj && typeof obj === 'object') {
        const sanitized = {};
        for (const key in obj) {
            sanitized[key] = sanitizeObject(obj[key]);
        }
        return sanitized;
    }

    return obj;
}

function sanitizeHtml(input) {
    if (typeof input !== 'string') return input;
    return xss.inHTMLData(input);
}

function sanitizarRespuestaBot(respuesta) {
    if (typeof respuesta !== 'string') return respuesta;
    return xss.inHTMLData(respuesta);
}

function validarTelefono(telefono) {
    if (!telefono) return { valido: false, error: 'Teléfono requerido' };

    const limpio = telefono.replace(/\s/g, '').replace(/-/g, '');

    if (!TELEFONO_COLOMBIANO_REGEX.test(limpio)) {
        return { 
            valido: false, 
            error: 'Formato de teléfono inválido. Use 10 dígitos o +57 seguido de 10 dígitos.' 
        };
    }

    return { valido: true, telefono: limpio.startsWith('+57') ? limpio : `+57${limpio}` };
}

function validarEmail(email) {
    if (!email) return { valido: false, error: 'Email requerido' };

    if (!validator.isEmail(email)) {
        return { valido: false, error: 'Formato de email inválido' };
    }

    return { valido: true, email: validator.normalizeEmail(email) };
}

function validarPassword(password) {
    if (!password) return { valido: false, error: 'Password requerido' };

    if (password.length < 8) {
        return { valido: false, error: 'La contraseña debe tener al menos 8 caracteres' };
    }

    if (!/[A-Z]/.test(password)) {
        return { valido: false, error: 'La contraseña debe tener al menos una mayúscula' };
    }

    if (!/[a-z]/.test(password)) {
        return { valido: false, error: 'La contraseña debe tener al menos una minúscula' };
    }

    if (!/[0-9]/.test(password)) {
        return { valido: false, error: 'La contraseña debe tener al menos un número' };
    }

    return { valido: true };
}

function validarNumeroPedido(numeroPedido) {
    if (!numeroPedido) return { valido: false, error: 'Número de pedido requerido' };

    const limpio = numeroPedido.toUpperCase().trim();

    const patron = /^#?AG-\d{3,4}-\d{6}$/;
    if (!patron.test(limpio)) {
        return { valido: false, error: 'Formato de número de pedido inválido' };
    }

    return { valido: true, numeroPedido: limpio.startsWith('#') ? limpio : `#${limpio}` };
}

function validarMonto(monto) {
    const num = parseFloat(monto);

    if (isNaN(num)) {
        return { valido: false, error: 'Monto inválido' };
    }

    if (num < 0) {
        return { valido: false, error: 'El monto no puede ser negativo' };
    }

    if (num > 100000000) {
        return { valido: false, error: 'El monto excede el límite permitido' };
    }

    return { valido: true, monto: Math.round(num) };
}

function sqlInjectionPrevention(text) {
    if (typeof text !== 'string') return text;

    const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION)\b)/gi,
        /(--|#|\/\*|\*\/)/g,
        /(;|'|"|\\)/g
    ];

    let sanitized = text;
    for (const pattern of sqlPatterns) {
        sanitized = sanitized.replace(pattern, '');
    }

    return validator.escape(sanitized);
}

function validarNIT(nit) {
    if (!nit) return { valido: false, error: 'NIT requerido' };

    const limpio = nit.replace(/\s/g, '').replace(/-/g, '');

    if (!/^\d{9,10}$/.test(limpio)) {
        return { valido: false, error: 'El NIT debe tener 9 o 10 dígitos' };
    }

    return { valido: true, nit: limpio };
}

function sanitizarMensajeWhatsApp(mensaje) {
    if (typeof mensaje !== 'string') return '';

    let limpio = mensaje.trim();

    limpio = limpio.substring(0, 4096);

    limpio = limpio.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return validator.escape(limpio);
}

module.exports = {
    sanitizeInput,
    sanitizeHtml,
    sanitizarRespuestaBot,
    validarTelefono,
    validarEmail,
    validarPassword,
    validarNumeroPedido,
    validarMonto,
    sqlInjectionPrevention,
    validarNIT,
    sanitizarMensajeWhatsApp
};
