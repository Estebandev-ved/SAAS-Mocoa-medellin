const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');

const BRAIN_URL = process.env.BRAIN_URL || 'http://localhost:8000';

const AGENTES_VALIDOS = ['ventas', 'pagos', 'pedidos', 'faq', 'reclamos', 'retencion'];

const LIMITES_AGENTES_POR_PLAN = {
    starter: 3,
    professional: 6,
    enterprise: 6
};

const AGENTES_POR_DEFECTO = {
    starter: ['ventas', 'faq', 'pagos'],
    professional: ['ventas', 'pagos', 'pedidos', 'faq', 'reclamos', 'retencion'],
    enterprise: ['ventas', 'pagos', 'pedidos', 'faq', 'reclamos', 'retencion']
};

router.use(verificarAuth);

router.get('/config', async (req, res) => {
    try {
        const [negocios] = await db.execute(
            `SELECT bot_nombre, bot_tono, horario_activo_inicio, horario_activo_fin,
                    bot_bienvenida, mensaje_fuera_horario, bot_agentes_activos
             FROM negocios WHERE id = ?`,
            [req.negocioId]
        );

        if (negocios.length === 0) {
            return res.status(404).json({ error: 'Negocio no encontrado' });
        }

        const negocio = negocios[0];
        let agentesActivos = AGENTES_POR_DEFECTO[req.negocio.plan] || AGENTES_POR_DEFECTO.starter;

        if (negocio.bot_agentes_activos) {
            try {
                agentesActivos = JSON.parse(negocio.bot_agentes_activos);
            } catch {
                agentesActivos = AGENTES_POR_DEFECTO[req.negocio.plan] || AGENTES_POR_DEFECTO.starter;
            }
        }

        res.json({
            bot_nombre: negocio.bot_nombre || 'Asistente',
            bot_tono: negocio.bot_tono || 'amigable',
            horario_inicio: negocio.horario_activo_inicio ? String(negocio.horario_activo_inicio).slice(0, 5) : '08:00',
            horario_fin: negocio.horario_activo_fin ? String(negocio.horario_activo_fin).slice(0, 5) : '20:00',
            mensaje_bienvenida: negocio.bot_bienvenida || '¡Hola! ¿En qué puedo ayudarte hoy?',
            mensaje_fuera_horario: negocio.mensaje_fuera_horario || 'Estamos fuera de horario. ¿Te contactamos mañana?',
            agentes_activos: agentesActivos,
            agentes_disponibles: AGENTES_VALIDOS,
            limite_agentes: LIMITES_AGENTES_POR_PLAN[req.negocio.plan] || 3
        });
    } catch (error) {
        console.error('[BotConfig] Error:', error);
        res.status(500).json({ error: 'Error al cargar configuración del bot' });
    }
});

router.put('/config', async (req, res) => {
    try {
        const {
            bot_nombre,
            bot_tono,
            horario_inicio,
            horario_fin,
            mensaje_bienvenida,
            mensaje_fuera_horario
        } = req.body;

        if (bot_tono && !['formal', 'amigable', 'casual'].includes(bot_tono)) {
            return res.status(400).json({ error: 'Tono inválido. Use: formal, amigable o casual' });
        }

        if (horario_inicio && !/^\d{2}:\d{2}$/.test(horario_inicio)) {
            return res.status(400).json({ error: 'Formato de horario inválido. Use HH:MM' });
        }

        if (horario_fin && !/^\d{2}:\d{2}$/.test(horario_fin)) {
            return res.status(400).json({ error: 'Formato de horario inválido. Use HH:MM' });
        }

        const updates = [];
        const values = [];

        if (bot_nombre !== undefined) {
            updates.push('bot_nombre = ?');
            values.push(bot_nombre);
        }
        if (bot_tono !== undefined) {
            updates.push('bot_tono = ?');
            values.push(bot_tono);
        }
        if (horario_inicio !== undefined) {
            updates.push('horario_activo_inicio = ?');
            values.push(horario_inicio + ':00');
        }
        if (horario_fin !== undefined) {
            updates.push('horario_activo_fin = ?');
            values.push(horario_fin + ':00');
        }
        if (mensaje_bienvenida !== undefined) {
            updates.push('bot_bienvenida = ?');
            values.push(mensaje_bienvenida);
        }
        if (mensaje_fuera_horario !== undefined) {
            updates.push('mensaje_fuera_horario = ?');
            values.push(mensaje_fuera_horario);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
        }

        values.push(req.negocioId);
        await db.execute(
            `UPDATE negocios SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        try {
            await fetch(`${BRAIN_URL}/catalogo/invalidar/${req.negocioId}`, { method: 'POST' });
        } catch {
            console.log('[BotConfig] No se pudo invalidar cache del brain');
        }

        res.json({
            success: true,
            mensaje: 'Configuración del bot actualizada'
        });
    } catch (error) {
        console.error('[BotConfig] Error updating:', error);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
});

router.put('/config/agentes', async (req, res) => {
    try {
        const { agentes } = req.body;

        if (!Array.isArray(agentes)) {
            return res.status(400).json({ error: 'Agentes debe ser un array' });
        }

        const agentesInvalidos = agentes.filter(a => !AGENTES_VALIDOS.includes(a));
        if (agentesInvalidos.length > 0) {
            return res.status(400).json({
                error: 'Agentes inválidos',
                invalidos: agentesInvalidos,
                validos: AGENTES_VALIDOS
            });
        }

        const limite = LIMITES_AGENTES_POR_PLAN[req.negocio.plan] || 3;
        if (agentes.length > limite) {
            return res.status(403).json({
                error: `Tu plan permite máximo ${limite} agentes`,
                plan_actual: req.negocio.plan,
                agentes_solicitados: agentes.length,
                limite: limite,
                upgrade_url: '/dashboard/plan'
            });
        }

        await db.execute(
            'UPDATE negocios SET bot_agentes_activos = ? WHERE id = ?',
            [JSON.stringify(agentes), req.negocioId]
        );

        try {
            await fetch(`${BRAIN_URL}/catalogo/invalidar/${req.negocioId}`, { method: 'POST' });
        } catch {
            console.log('[BotConfig] No se pudo invalidar cache del brain');
        }

        res.json({
            success: true,
            mensaje: 'Agentes actualizados',
            agentes_activos: agentes,
            limite: limite
        });
    } catch (error) {
        console.error('[BotConfig] Error updating agents:', error);
        res.status(500).json({ error: 'Error al actualizar agentes' });
    }
});

router.post('/test', async (req, res) => {
    try {
        const { mensaje } = req.body;

        if (!mensaje || mensaje.trim().length === 0) {
            return res.status(400).json({ error: 'Mensaje es requerido' });
        }

        if (mensaje.length > 500) {
            return res.status(400).json({ error: 'Mensaje muy largo (máx 500 caracteres)' });
        }

        const [negocios] = await db.execute(
            `SELECT n.*, GROUP_CONCAT(p.id, '::', p.nombre, '::', p.precio SEPARATOR '||') as productos
             FROM negocios n
             LEFT JOIN productos p ON p.negocio_id = n.id AND p.activo = 1
             WHERE n.id = ?
             GROUP BY n.id`,
            [req.negocioId]
        );

        if (negocios.length === 0) {
            return res.status(404).json({ error: 'Negocio no encontrado' });
        }

        const negocio = negocios[0];

        const productos = [];
        if (negocio.productos) {
            negocio.productos.split('||').forEach(p => {
                const parts = p.split('::');
                if (parts.length >= 3) {
                    productos.push({
                        id: parseInt(parts[0]),
                        nombre: parts[1],
                        precio: parseFloat(parts[2])
                    });
                }
            });
        }

        const contexto = {
            negocio_id: req.negocioId,
            cliente_id: 0,
            mensaje: mensaje,
            negocio_config: {
                id: negocio.id,
                nombre: negocio.nombre,
                bot_nombre: negocio.bot_nombre || 'Asistente',
                bot_tono: negocio.bot_tono || 'amigable',
                productos: productos,
                metodos_pago: ['Nequi', 'Bancolombia'],
                horario_inicio: negocio.horario_activo_inicio || '08:00:00',
                horario_fin: negocio.horario_activo_fin || '20:00:00'
            }
        };

        let resultado;
        try {
            const response = await fetch(`${BRAIN_URL}/procesar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mensaje: mensaje,
                    contexto: [],
                    negocio_id: req.negocioId,
                    cliente_id: 0
                })
            });

            if (!response.ok) {
                throw new Error('Brain API error');
            }

            resultado = await response.json();
        } catch (error) {
            console.error('[BotConfig] Error calling brain:', error);
            return res.status(500).json({
                error: 'Error al conectar con el servicio de IA',
                respuesta_fallback: 'Hola, estoy configurando mi cerebro. Prueba en unos minutos.'
            });
        }

        res.json({
            mensaje_enviado: mensaje,
            respuesta: resultado.respuesta,
            intencion: resultado.intencion,
            agente_usado: resultado.agente_usado,
            tokens_usados: resultado.tokens_usados,
            tiempo_ms: resultado.tiempo_ms,
            datos_accion: resultado.datos_accion
        });
    } catch (error) {
        console.error('[BotConfig] Error test:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

module.exports = router;
