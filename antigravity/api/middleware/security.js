const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const compression = require('compression');
const jwt = require('jsonwebtoken');

// Helmet config (seguridad HTTP)
const helmetConfig = helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
});

// Antes el límite se contaba solo por IP: todos los negocios detrás de la
// misma IP (NAT de oficina, o simplemente el dashboard con varias pestañas
// abiertas del mismo dueño) compartían el mismo cupo de 100 req/min. La
// pantalla de WhatsApp por sí sola hace hasta ~50 req/min mientras se conecta
// (poll de estado cada 3s + poll de QR cada 2s en paralelo), así que era
// fácil agotar el cupo compartido y que CUALQUIER pantalla (p.ej. Suscripción)
// recibiera 429 durante el resto de esa ventana de 1 minuto — el error
// "aparece un rato y se va solo" que reportó el socio. Ahora se identifica al
// negocio por su JWT (verificado, no solo decodificado) y se le da su propio
// cupo; sin token válido cae de vuelta a IP.
function keyPorNegocioOIp(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET);
            if (decoded?.negocio_id) return `negocio_${decoded.negocio_id}`;
        } catch (_) {
            // Token inválido/expirado: se limita por IP, igual que un anónimo.
        }
    }
    return ipKeyGenerator(req.ip);
}

// Rate limiting global: 300 requests por minuto, por negocio autenticado (o por IP si no hay token)
const apiRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    keyGenerator: keyPorNegocioOIp,
    message: { error: 'Demasiadas peticiones. Intenta en 1 minuto.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiting para login: 5 intentos por 15 minutos
const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Demasiados intentos de login. Espera 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiting para el login del domiciliario: el PIN es de solo 4 dígitos
// (10.000 combinaciones) y esta ruta no tenía NINGÚN límite propio — solo caía
// en el límite genérico de la API (300 req/min por IP), suficiente para probar
// las 10.000 combinaciones de un teléfono en menos de una hora. Se limita por
// IP + teléfono (no solo IP) para no bloquear a otros domiciliarios que inicien
// sesión desde la misma red (bodega, wifi compartido) mientras alguien insiste
// con el número de otro.
const driverLoginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${(req.body?.telefono || '').toString().slice(0, 20)}`,
    message: { error: 'Demasiados intentos de inicio de sesión. Espera 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiting para bot: 30 mensajes por minuto por negocio
const botRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Límite de mensajes alcanzado.' }
});

// Rate limiting para WhatsApp
const whatsappRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Límite de mensajes WhatsApp alcanzado.' }
});

// Sanitización de inputs contra XSS
function sanitizeInputs(req, res, next) {
    if (req.body) {
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key]
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/on\w+="[^"]*"/gi, '')
                    .replace(/on\w+='[^']*'/gi, '');
            }
        }
    }
    next();
}

// Headers de seguridad adicionales
function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
}

// Logger de auditoría
const auditLog = [];

function auditLogger(req, res, next) {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const entry = {
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            ip: req.ip || req.headers['x-forwarded-for'],
            negocioId: req.negocioId || null,
            duration,
            userAgent: req.headers['user-agent']?.substring(0, 100)
        };
        auditLog.push(entry);
        if (auditLog.length > 1000) auditLog.shift();
        if (res.statusCode >= 400) {
            console.error(`[AUDIT] ${entry.method} ${entry.path} ${entry.status} ${entry.duration}ms`);
        }
    });
    next();
}

function sanitizeLog(text) {
    return String(text).substring(0, 200).replace(/[<>'"]/g, '');
}

function getAuditLog(limit = 100) {
    return auditLog.slice(-limit);
}

// Secure error handler
function secureErrorHandler(err, req, res, next) {
    console.error('[ERROR]', sanitizeLog(err.message || err));
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Error interno del servidor'
            : err.message
    });
}

// Cualquier puerto localhost es válido en dev: los distintos frontends
// (landing, dashboard) terminan en puertos variables (5173, 5174, 5177...)
// porque Vite incrementa el puerto cuando el anterior ya está ocupado.
// Antes esta lista estaba fija a 5173/5174 y cualquier otro puerto
// quedaba bloqueado por CORS sin ningún error visible para el usuario.
const DEV_LOCALHOST_ORIGIN = /^http:\/\/localhost:\d+$/;

function isAllowedOrigin(origin) {
    if (!origin) return false;
    if (process.env.NODE_ENV === 'production') {
        const allowed = [
            'https://antigravity.co',
            'https://app.antigravity.co',
            process.env.FRONTEND_URL
        ].filter(Boolean);
        return allowed.includes(origin);
    }
    return DEV_LOCALHOST_ORIGIN.test(origin) || origin === process.env.FRONTEND_URL;
}

// CORS production
function corsConfig(req, res, next) {
    const origin = req.headers.origin;
    if (isAllowedOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
}

// Compresión gzip
const compressionMiddleware = compression({ level: 6, threshold: 1024 });

// Token blacklist (in-memory)
const tokenBlacklist = new Set();

function blacklistToken(token) {
    tokenBlacklist.add(token);
}

function checkBlacklist(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        if (tokenBlacklist.has(token)) {
            return res.status(401).json({ error: 'Token revocado', codigo: 'TOKEN_REVOCADO' });
        }
    }
    next();
}

function isTokenBlacklisted(token) {
    return tokenBlacklist.has(token);
}

module.exports = {
    helmetConfig,
    apiRateLimit,
    loginRateLimit,
    driverLoginRateLimit,
    botRateLimit,
    whatsappRateLimit,
    sanitizeInputs,
    securityHeaders,
    auditLogger,
    sanitizeLog,
    secureErrorHandler,
    getAuditLog,
    corsConfig,
    isAllowedOrigin,
    compressionMiddleware,
    blacklistToken,
    checkBlacklist,
    isTokenBlacklisted
};
