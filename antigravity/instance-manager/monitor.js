const db = require('../db/config');
const instanceManager = require('./InstanceManager');

const CHECK_INTERVAL = 5 * 60 * 1000;

const PLAN_LIMITS = {
    starter: 50000,
    professional: 250000,
    enterprise: Infinity
};

class Monitor {
    constructor() {
        this.intervalId = null;
        this.stats = {
            lastCheck: null,
            whatsappDesconectados: 0,
            erroresTasa: 0,
            tokensAlerta: 0,
            spamBloqueados: 0
        };
    }

    start() {
        console.log('[Monitor] Iniciando sistema de monitoreo...');
        
        this.checkAll();
        
        this.intervalId = setInterval(() => {
            this.checkAll();
        }, CHECK_INTERVAL);

        console.log(`[Monitor] Monitoreo activo cada ${CHECK_INTERVAL / 1000 / 60} minutos`);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[Monitor] Sistema de monitoreo detenido');
        }
    }

    async checkAll() {
        this.stats.lastCheck = new Date().toISOString();
        
        console.log('[Monitor] Ejecutando verificación completa...');

        await this.checkWhatsAppDesconectados();
        await this.checkTasaErrores();
        await this.checkConsumoTokens();
        await this.checkSospechosSpam();

        console.log('[Monitor] Verificación completada');
    }

    async checkWhatsAppDesconectados() {
        try {
            const instances = instanceManager.getAllInstances();
            const negocioIds = instances.map(i => i.negocioId);

            if (negocioIds.length === 0) return;

            const placeholders = negocioIds.map(() => '?').join(',');
            const [negocios] = await db.execute(
                `SELECT id, nombre, email_dueno, whatsapp_ultima_conexion 
                 FROM negocios WHERE id IN (${placeholders})`,
                negocioIds
            );

            let desconectados = 0;

            for (const negocio of negocios) {
                const instance = instanceManager.getInstance(negocio.id);
                
                if (!instance || !instance.isConnected()) {
                    desconectados++;

                    const ultimaConexion = new Date(negocio.whatsapp_ultima_conexion);
                    const haceMinutos = (Date.now() - ultimaConexion) / 1000 / 60;

                    if (haceMinutos > 30) {
                        console.log(`[Monitor] WhatsApp de ${negocio.nombre} desconectado hace ${Math.round(haceMinutos)} minutos`);

                        await this.notificarDesconexion(negocio.id, negocio.email_dueno, negocio.nombre);

                        await this.intentarReconexion(negocio.id);
                    }
                }
            }

            this.stats.whatsappDesconectados = desconectados;

        } catch (error) {
            console.error('[Monitor] Error verificando WhatsApps:', error);
        }
    }

    async intentarReconexion(negocioId) {
        try {
            console.log(`[Monitor] Intentando reconectar negocio ${negocioId}...`);
            
            await instanceManager.stopInstance(negocioId);
            
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            await instanceManager.startInstance(negocioId);
            
            console.log(`[Monitor] Reconexión intentada para negocio ${negocioId}`);

        } catch (error) {
            console.error(`[Monitor] Error en reconexión negocio ${negocioId}:`, error.message);
        }
    }

    async notificarDesconexion(negocioId, email, nombre) {
        try {
            await db.execute(
                `INSERT INTO notificaciones (negocio_id, tipo, titulo, mensaje)
                 VALUES (?, 'alerta_whatsapp', 'WhatsApp desconectado', ?)`,
                [negocioId, `Tu WhatsApp se ha desconectado. El sistema intentará reconectarse automáticamente.`]
            );

            console.log(`[Monitor] Notificación de desconexión enviada a ${email}`);

        } catch (error) {
            console.error('[Monitor] Error enviando notificación:', error);
        }
    }

    async checkTasaErrores() {
        try {
            const hace7Dias = new Date();
            hace7Dias.setDate(hace7Dias.getDate() - 7);
            const fecha7dias = hace7Dias.toISOString().slice(0, 10);

            const [stats] = await db.execute(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN intencion_detectada = 'error' THEN 1 ELSE 0 END) as errores
                 FROM agente_logs 
                 WHERE created_at >= ?`,
                [fecha7dias]
            );

            if (stats.length > 0 && stats[0].total > 0) {
                const tasaErrores = (stats[0].errores / stats[0].total) * 100;

                if (tasaErrores > 5) {
                    console.log(`[Monitor] ALERTA: Tasa de errores ${tasaErrores.toFixed(2)}% (umbral: 5%)`);
                    this.stats.erroresTasa = Math.round(tasaErrores);
                }
            }

        } catch (error) {
            console.error('[Monitor] Error verificando tasa de errores:', error);
        }
    }

    async checkConsumoTokens() {
        try {
            const [negocios] = await db.execute(
                'SELECT id, nombre, plan, email_dueno FROM negocios WHERE activo = 1 AND suscripcion_activa = 1'
            );

            const hoy = new Date().toISOString().split('T')[0];
            const mesActual = hoy.substring(0, 7);

            for (const negocio of negocios) {
                const limite = PLAN_LIMITS[negocio.plan] || PLAN_LIMITS.starter;
                if (limite === Infinity) continue;

                const [tokensStats] = await db.execute(
                    `SELECT COALESCE(SUM(tokens_usados), 0) as total 
                     FROM agente_logs 
                     WHERE negocio_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
                    [negocio.id, mesActual]
                );

                const tokensUsados = tokensStats[0]?.total || 0;
                const porcentaje = (tokensUsados / limite) * 100;

                if (porcentaje > 80) {
                    console.log(`[Monitor] ALERTA: Negocio ${negocio.nombre} ha usado ${porcentaje.toFixed(0)}% de tokens del mes`);

                    await db.execute(
                        `INSERT INTO notificaciones (negocio_id, tipo, titulo, mensaje)
                         VALUES (?, 'alerta_tokens', 'Uso de IA alto', ?)`,
                        [negocio.id, `Has usado ${Math.round(porcentaje)}% de tu límite mensual de tokens.`]
                    );

                    this.stats.tokensAlerta++;
                }
            }

        } catch (error) {
            console.error('[Monitor] Error verificando consumo de tokens:', error);
        }
    }

    async checkSospechosSpam() {
        try {
            const hace1Minuto = new Date();
            hace1Minuto.setMinutes(hace1Minuto.getMinutes() - 1);

            const [sospechosos] = await db.execute(
                `SELECT numero_cliente, negocio_id, COUNT(*) as mensajes
                 FROM mensajes 
                 WHERE created_at >= ? AND tipo = 'entrada'
                 GROUP BY numero_cliente, negocio_id
                 HAVING mensajes > 10`,
                [hace1Minuto.toISOString()]
            );

            for (const sospechoso of sospechosos) {
                console.log(`[Monitor] Posible spam detectado: ${sospechoso.numero_cliente} en negocio ${sospechoso.negocio_id}`);

                this.bloquearTemporalmente(sospechoso.negocio_id, sospechoso.numero_cliente);
                
                this.stats.spamBloqueados++;
            }

        } catch (error) {
            console.error('[Monitor] Error verificando spam:', error);
        }
    }

    async bloquearTemporalmente(negocioId, numero) {
        try {
            const redis = require('redis');
            const redisClient = redis.createClient({
                url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
            });

            try {
                await redisClient.connect();
                
                const key = `blocked:${negocioId}:${numero}`;
                await redisClient.setEx(key, 30 * 60, '1');
                
                console.log(`[Monitor] Número ${numero} bloqueado por 30 minutos`);
            } catch {
                console.log('[Monitor] Redis no disponible para bloquear spam');
            }

        } catch (error) {
            console.error('[Monitor] Error bloqueando spam:', error);
        }
    }

    async esNumeroBloqueado(negocioId, numero) {
        try {
            const redis = require('redis');
            const redisClient = redis.createClient({
                url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
            });

            try {
                await redisClient.connect();
                
                const key = `blocked:${negocioId}:${numero}`;
                const blocked = await redisClient.get(key);
                
                return !!blocked;
            } catch {
                return false;
            }

        } catch (error) {
            return false;
        }
    }

    getStats() {
        return {
            ...this.stats,
            activeInstances: instanceManager.getInstanceCount(),
            uptime: process.uptime()
        };
    }
}

const monitor = new Monitor();

module.exports = monitor;
