// Almacén de contadores del rate limit sobre Redis (ioredis), para que el límite sea
// compartido entre varias instancias de la API. Sin REDIS_URL se usa la memoria de
// cada proceso (comportamiento de siempre), que solo es correcto con una instancia.
//
// Implementa la interfaz de Store de express-rate-limit v8 (init/get/increment/decrement/resetKey)
// sin depender de otro paquete: ioredis ya está en el proyecto.

let cliente = null;
let intentado = false;

function obtenerCliente() {
    if (intentado) return cliente;
    intentado = true;
    if (!process.env.REDIS_URL) return null;
    try {
        const Redis = require('ioredis');
        cliente = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2, enableOfflineQueue: false, lazyConnect: false });
        cliente.on('error', (e) => console.error('[RateLimit] Redis:', e.message));
    } catch (e) {
        console.error('[RateLimit] No se pudo iniciar Redis, se usa memoria local:', e.message);
        cliente = null;
    }
    return cliente;
}

class RedisRateLimitStore {
    constructor(redis, prefijo) {
        this.redis = redis;
        this.prefijo = `rl:${prefijo}:`;
        this.windowMs = 60000;
        // Si Redis falla, no se tumba la API ni se bloquea a todos: se deja pasar (fail-open) y se registra.
        this.localTotalHits = false;
    }

    init(options) {
        this.windowMs = options.windowMs;
    }

    clave(key) {
        return this.prefijo + key;
    }

    async get(key) {
        try {
            const [hits, ttl] = await Promise.all([this.redis.get(this.clave(key)), this.redis.pttl(this.clave(key))]);
            if (hits === null) return undefined;
            return { totalHits: Number(hits), resetTime: new Date(Date.now() + Math.max(ttl, 0)) };
        } catch (e) {
            console.error('[RateLimit] get:', e.message);
            return undefined;
        }
    }

    async increment(key) {
        const k = this.clave(key);
        try {
            const res = await this.redis.multi().incr(k).pttl(k).exec();
            const hits = Number(res[0][1]);
            let ttl = Number(res[1][1]);
            if (ttl < 0) {
                // Primera vez (o clave sin vencimiento): se fija la ventana.
                await this.redis.pexpire(k, this.windowMs);
                ttl = this.windowMs;
            }
            return { totalHits: hits, resetTime: new Date(Date.now() + ttl) };
        } catch (e) {
            console.error('[RateLimit] increment (se deja pasar):', e.message);
            return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
        }
    }

    async decrement(key) {
        try {
            await this.redis.decr(this.clave(key));
        } catch (e) {
            console.error('[RateLimit] decrement:', e.message);
        }
    }

    async resetKey(key) {
        try {
            await this.redis.del(this.clave(key));
        } catch (e) {
            console.error('[RateLimit] resetKey:', e.message);
        }
    }
}

/** Devuelve un store de Redis para el limitador `prefijo`, o undefined (memoria) si no hay REDIS_URL. */
function crearStore(prefijo) {
    const redis = obtenerCliente();
    return redis ? new RedisRateLimitStore(redis, prefijo) : undefined;
}

module.exports = { crearStore, RedisRateLimitStore };
