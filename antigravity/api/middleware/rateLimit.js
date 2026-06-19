const rateLimit = require('express-rate-limit');
const redisStore = require('rate-limit-redis');
const db = require('../../db/config');

const redisClient = require('redis').createClient({
    url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
});

const LOGIN_RATE_LIMIT = {
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.'
};

const API_RATE_LIMIT = {
    windowMs: 60 * 1000,
    max: 100,
    message: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.'
};

const BOT_RATE_LIMIT = {
    windowMs: 60 * 1000,
    max: 30,
    message: 'Demasiados mensajes del bot. Espera un momento.'
};

function createLoginRateLimiter() {
    return rateLimit({
        ...LOGIN_RATE_LIMIT,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            return req.ip || req.headers['x-forwarded-for'] || 'unknown';
        },
        handler: (req, res) => {
            res.status(429).json({
                error: LOGIN_RATE_LIMIT.message,
                codigo: 'RATE_LIMIT_LOGIN'
            });
        }
    });
}

function createApiRateLimiter() {
    return rateLimit({
        ...API_RATE_LIMIT,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            return req.ip || req.headers['x-forwarded-for'] || 'unknown';
        },
        handler: (req, res) => {
            res.status(429).json({
                error: API_RATE_LIMIT.message,
                codigo: 'RATE_LIMIT_API'
            });
        }
    });
}

async function botRateLimiterMiddleware(req, res, next) {
    const negocioId = req.negocioId;

    if (!negocioId) {
        return next();
    }

    try {
        const [negocios] = await db.execute(
            'SELECT plan FROM negocios WHERE id = ?',
            [negocioId]
        );

        const plan = negocios[0]?.plan || 'starter';
        const limite = plan === 'enterprise' ? 100 : plan === 'professional' ? 50 : BOT_RATE_LIMIT.max;

        const key = `bot_rate:${negocioId}:${Date.now()}`;

        try {
            await redisClient.connect();
            const current = await redisClient.incr(key);
            
            if (current === 1) {
                await redisClient.expire(key, Math.floor(BOT_RATE_LIMIT.windowMs / 1000));
            }

            if (current > limite) {
                return res.status(429).json({
                    error: 'Demasiados mensajes. Espera un momento.',
                    codigo: 'RATE_LIMIT_BOT',
                    retry_after: Math.ceil(BOT_RATE_LIMIT.windowMs / 1000)
                });
            }
        } catch (redisError) {
            console.log('[RateLimit] Redis no disponible, continuando sin límite');
        }

        next();
    } catch (error) {
        console.error('[RateLimit] Error en middleware:', error);
        next();
    }
}

async function verificarLimiteTokensDiario(negocioId) {
    try {
        const [negocios] = await db.execute(
            'SELECT plan FROM negocios WHERE id = ?',
            [negocioId]
        );

        const plan = negocios[0]?.plan || 'starter';
        const limites = {
            starter: 50000,
            professional: 250000,
            enterprise: Infinity
        };

        const limiteDiario = limites[plan] || limites.starter;

        const hoy = new Date().toISOString().split('T')[0];
        const [stats] = await db.execute(
            `SELECT COALESCE(SUM(tokens_usados), 0) as total FROM agente_logs 
             WHERE negocio_id = ? AND DATE(created_at) = ?`,
            [negocioId, hoy]
        );

        const tokensUsados = stats[0]?.total || 0;

        return {
            permitido: tokensUsados < limiteDiario,
            usado: tokensUsados,
            limite: limiteDiario,
            restante: Math.max(0, limiteDiario - tokensUsados),
            porcentaje: Math.round((tokensUsados / limiteDiario) * 100)
        };

    } catch (error) {
        console.error('[RateLimit] Error verificando límite de tokens:', error);
        return { permitido: true };
    }
}

module.exports = {
    createLoginRateLimiter,
    createApiRateLimiter,
    botRateLimiterMiddleware,
    verificarLimiteTokensDiario
};
