const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss');

const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:", "http://localhost:*", "https://*"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  xFrameOptions: 'DENY',
  referrerPolicy: 'strict-origin-when-cross-origin',
});

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    error: 'Demasiados intentos de acceso fallidos. Por seguridad, intente de nuevo en 15 minutos.',
    codigo: 'RATE_LIMIT_LOGIN'
  },
});

const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    error: 'Demasiadas peticiones, intente de nuevo en un minuto',
    codigo: 'RATE_LIMIT_API'
  },
});

const botRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    error: 'Límite de peticiones al bot excedido',
    codigo: 'RATE_LIMIT_BOT'
  },
});

const SENSITIVE_FIELDS = ['password', 'token', 'authorization', 'secret', 'api_key'];

function sanitizeInputs(req, res, next) {
  const sanitizeValue = (value, isSensitive = false) => {
    if (isSensitive) return value;
    
    if (typeof value === 'string') {
      return xss(value, {
        whiteList: {},
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script', 'style'],
      });
    }
    if (Array.isArray(value)) {
      return value.map(v => sanitizeValue(v, isSensitive));
    }
    if (value && typeof value === 'object') {
      const sanitized = {};
      for (const key in value) {
        const keyIsSensitive = SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f));
        sanitized[key] = sanitizeValue(value[key], keyIsSensitive);
      }
      return sanitized;
    }
    return value;
  };

  if (req.body && Object.keys(req.body).length > 0) {
    req.body = sanitizeValue(req.body);
  }

  next();
}

const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+instructions/i,
  /forget\s+(everything|your\s+instructions)/i,
  /you\s+are\s+now/i,
  /new\s+persona/i,
  /act\s+as/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /pretend\s+you\s+(are|have\s+no)/i,
  /system\s+prompt/i,
  /reveal\s+your\s+instructions/i,
  /ignore\s+all\s+rules/i,
  /override\s+your\s+programming/i,
  /bypass\s+(safety|content\s+filter)/i,
  /\\x00|\x00/,
  /\x1b\[/,
];

function guardPromptInjection(req, res, next) {
  const mensaje = req.body?.mensaje || req.body?.prompt || '';
  
  if (!mensaje) {
    return next();
  }

  const hasInjection = INJECTION_PATTERNS.some(pattern => pattern.test(mensaje));
  
  if (hasInjection) {
    console.warn('[Security] Prompt injection attempt detected:', {
      ip: req.ip,
      path: req.path,
      timestamp: new Date().toISOString(),
    });
    
    return res.json({
      respuesta: 'Lo siento, no entendí tu mensaje. ¿En qué te puedo ayudar?',
      intencion: 'otro',
      bloqueado: true,
    });
  }
  
  next();
}

function verifyOwnership(tabla, idParam = 'id') {
  return async (req, res, next) => {
    const id = req.params[idParam];
    const negocioId = req.negocioId;
    
    if (!negocioId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    try {
      const db = require('../../db/config');
      const [rows] = await db.execute(
        `SELECT id FROM ${tabla} WHERE id = ? AND negocio_id = ?`,
        [id, negocioId]
      );
      
      if (!rows.length) {
        return res.status(404).json({ error: 'Recurso no encontrado' });
      }
      
      next();
    } catch (error) {
      console.error('[Security] Error verifying ownership:', error);
      return res.status(500).json({ error: 'Error interno' });
    }
  };
}

function secureErrorHandler(err, req, res, next) {
  const isProd = process.env.NODE_ENV === 'production';
  
  console.error('[Error]', {
    error: err.message,
    stack: isProd ? '[REDACTED]' : err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });
  
  const statusCode = err.status || 500;
  
  res.status(statusCode).json({
    error: isProd ? 'Error interno del servidor' : err.message,
    codigo: err.codigo || 'ERROR_INTERNO',
  });
}

module.exports = {
  helmetConfig,
  loginRateLimit,
  apiRateLimit,
  botRateLimit,
  sanitizeInputs,
  guardPromptInjection,
  verifyOwnership,
  secureErrorHandler,
};
