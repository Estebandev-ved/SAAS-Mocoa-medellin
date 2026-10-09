const db = require('../db/config');

class SubscriptionNotifier {
    constructor(io) {
        this.io = io;
        this.running = false;
    }

    start(intervalMs = 3600000) { // Every hour
        if (this.running) return;
        this.running = true;
        console.log('[SubscriptionNotifier] Iniciado (intervalo: ' + (intervalMs / 1000) + 's)');

        this.check();
        setInterval(() => this.check(), intervalMs);
    }

    async check() {
        try {
            await this.checkTrialExpiring();
            await this.checkSubscriptionExpiring();
            await this.checkPaymentFailed();
            await this.checkUsageLimits();
        } catch (error) {
            console.error('[SubscriptionNotifier] Error:', error.message);
        }
    }

    // Notify businesses whose trial ends in 1, 2, or 3 days
    async checkTrialExpiring() {
        const now = new Date();
        const [negocios] = await db.execute(
            `SELECT id, nombre, email_dueno, trial_hasta, whatsapp
             FROM negocios
             WHERE trial_hasta IS NOT NULL
             AND suscripcion_activa = 0
             AND DATEDIFF(trial_hasta, NOW()) BETWEEN 0 AND 3`
        );

        for (const n of negocios) {
            const diasRestantes = Math.ceil((new Date(n.trial_hasta) - now) / (1000 * 60 * 60 * 24));
            console.log(`[SubscriptionNotifier] Trial vence en ${diasRestantes}d: ${n.nombre} (${n.email_dueno})`);

            // Emit socket notification
            if (this.io) {
                this.io.emit('subscription_alert', {
                    negocio_id: n.id,
                    tipo: 'trial_expiring',
                    dias_restantes: diasRestantes,
                    mensaje: `Tu período de prueba vence en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''}. ¡Activa tu plan!`,
                });
            }

            // TODO: Send email via SMTP
            // TODO: Send WhatsApp notification via bot
        }

        return negocios.length;
    }

    // Notify businesses whose subscription expires in 3, 7 days
    async checkSubscriptionExpiring() {
        const [negocios] = await db.execute(
            `SELECT id, nombre, email_dueno, suscripcion_fin, plan
             FROM negocios
             WHERE suscripcion_activa = 1
             AND suscripcion_fin IS NOT NULL
             AND DATEDIFF(suscripcion_fin, NOW()) BETWEEN 0 AND 7`
        );

        for (const n of negocios) {
            const diasRestantes = Math.ceil((new Date(n.suscripcion_fin) - new Date()) / (1000 * 60 * 60 * 24));
            console.log(`[SubscriptionNotifier] Sub vence en ${diasRestantes}d: ${n.nombre}`);

            if (this.io) {
                this.io.emit('subscription_alert', {
                    negocio_id: n.id,
                    tipo: 'subscription_expiring',
                    dias_restantes: diasRestantes,
                    plan: n.plan,
                    mensaje: `Tu plan ${n.plan} vence en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''}. Renueva para no perder acceso.`,
                });
            }
        }

        return negocios.length;
    }

    // Handle failed payments
    async checkPaymentFailed() {
        const [pagosFallidos] = await db.execute(
            `SELECT bh.negocio_id, n.nombre, n.email_dueno, bh.descripcion, bh.created_at
             FROM billing_history bh
             JOIN negocios n ON n.id = bh.negocio_id
             WHERE bh.tipo = 'payment_failed'
             AND bh.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
             ORDER BY bh.created_at DESC`
        );

        for (const p of pagosFallidos) {
            console.log(`[SubscriptionNotifier] Pago fallido: ${p.nombre} - ${p.descripcion}`);

            if (this.io) {
                this.io.emit('subscription_alert', {
                    negocio_id: p.negocio_id,
                    tipo: 'payment_failed',
                    mensaje: 'Tu último pago falló. Actualiza tu método de pago para mantener tu servicio activo.',
                    fecha: p.created_at,
                });
            }
        }

        return pagosFallidos.length;
    }

    // Warn businesses approaching usage limits
    async checkUsageLimits() {
        const periodo = new Date().toISOString().substring(0, 7);
        const [negocios] = await db.execute(
            `SELECT n.id, n.plan, n.nombre,
                    COALESCE(su.mensajes_usados, 0) as mensajes_usados
             FROM negocios n
             LEFT JOIN subscription_usage su ON su.negocio_id = n.id AND su.periodo = ?
             WHERE n.suscripcion_activa = 1 OR n.trial_hasta > NOW()`,
            [periodo]
        );

            const { checkLimit } = require('../config/planConfig');

        for (const n of negocios) {
            const limit = checkLimit(n.plan, 'maxMessages', n.mensajes_usados);
            if (limit.limit !== -1 && limit.percentage >= 80) {
                console.log(`[SubscriptionNotifier] Uso alto (${limit.percentage}%): ${n.nombre}`);

                if (this.io) {
                    this.io.emit('subscription_alert', {
                    negocio_id: n.id,
                        tipo: 'usage_warning',
                        porcentaje: limit.percentage,
                        mensajes_usados: n.mensajes_usados,
                        limite: limit.limit,
                        mensaje: `Has usado el ${limit.percentage}% de tus mensajes del mes (${n.mensajes_usados}/${limit.limit}).`,
                    });
                }
            }
        }
    }

    // Update usage counters (call this from message handler)
    async trackUsage(negocioId, tipo, cantidad = 1) {
        const periodo = new Date().toISOString().substring(0, 7);

        const campoMap = {
            mensaje: 'mensajes_usados',
            cliente: 'clientes_nuevos',
            producto: 'productos_creados',
            campaña: 'campañas_enviadas',
            ai_token: 'ai_tokens_usados',
        };

        const campo = campoMap[tipo];
        if (!campo) return;

        try {
            await db.execute(
                `INSERT INTO subscription_usage (negocio_id, periodo, ${campo})
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE ${campo} = ${campo} + ?`,
                [negocioId, periodo, cantidad, cantidad]
            );
        } catch (error) {
            console.error('[SubscriptionNotifier] Error tracking usage:', error.message);
        }
    }
}

module.exports = SubscriptionNotifier;
