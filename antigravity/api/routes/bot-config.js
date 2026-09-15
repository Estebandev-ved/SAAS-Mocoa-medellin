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
            `SELECT bot_nombre, bot_tono, bot_bienvenida, horario_activo_inicio, horario_activo_fin,
                    mensaje_fuera_horario, descripcion_negocio, productos_servicios,
                    info_pagos, politicas
             FROM negocios WHERE id = ?`,
            [req.negocioId]
        );

        if (negocios.length === 0) {
            return res.status(404).json({ error: 'Negocio no encontrado' });
        }

        const negocio = negocios[0];
        let agentesActivos = AGENTES_POR_DEFECTO[req.negocio.plan] || AGENTES_POR_DEFECTO.starter;

        try {
            const [agentesRows] = await db.execute(
                "SELECT config FROM automatizaciones_config WHERE negocio_id = ? AND tipo = 'agentes'",
                [req.negocioId]
            );
            if (agentesRows.length > 0 && agentesRows[0].config) {
                const parsed = JSON.parse(agentesRows[0].config);
                if (parsed.agentes) agentesActivos = parsed.agentes;
            }
        } catch {
            // keep defaults
        }

        res.json({
            bot_nombre: negocio.bot_nombre || 'Asistente',
            bot_tono: negocio.bot_tono || 'amigable',
            bot_bienvenida: negocio.bot_bienvenida || '¡Hola! ¿En qué puedo ayudarte hoy?',
            horario_inicio: negocio.horario_activo_inicio ? String(negocio.horario_activo_inicio).slice(0, 5) : '08:00',
            horario_fin: negocio.horario_activo_fin ? String(negocio.horario_activo_fin).slice(0, 5) : '20:00',
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
            bot_bienvenida,
            horario_inicio,
            horario_fin,
            mensaje_bienvenida,
            mensaje_fuera_horario,
            descripcion_negocio,
            productos_servicios,
            info_pagos,
            politicas
        } = req.body;

        // Accept both bot_bienvenida and mensaje_bienvenida
        const bienvenida = bot_bienvenida || mensaje_bienvenida;

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
        if (bienvenida !== undefined) {
            updates.push('bot_bienvenida = ?');
            values.push(bienvenida);
        }
        if (horario_inicio !== undefined) {
            updates.push('horario_activo_inicio = ?');
            values.push(horario_inicio + ':00');
        }
        if (horario_fin !== undefined) {
            updates.push('horario_activo_fin = ?');
            values.push(horario_fin + ':00');
        }
        if (mensaje_fuera_horario !== undefined) {
            updates.push('mensaje_fuera_horario = ?');
            values.push(mensaje_fuera_horario);
        }
        if (descripcion_negocio !== undefined) {
            updates.push('descripcion_negocio = ?');
            values.push(descripcion_negocio);
        }
        if (productos_servicios !== undefined) {
            updates.push('productos_servicios = ?');
            values.push(productos_servicios);
        }
        if (info_pagos !== undefined) {
            updates.push('info_pagos = ?');
            values.push(info_pagos);
        }
        if (politicas !== undefined) {
            updates.push('politicas = ?');
            values.push(politicas);
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

        // Accept both array ["ventas","faq"] and object {ventas: true, faq: false}
        let agentesArray;
        if (Array.isArray(agentes)) {
            agentesArray = agentes;
        } else if (agentes && typeof agentes === 'object') {
            agentesArray = Object.entries(agentes).filter(([_, v]) => v === true).map(([k]) => k);
        } else {
            return res.status(400).json({ error: 'Agentes debe ser un array u objeto' });
        }

        const agentesInvalidos = agentesArray.filter(a => !AGENTES_VALIDOS.includes(a));
        if (agentesInvalidos.length > 0) {
            return res.status(400).json({
                error: 'Agentes inválidos',
                invalidos: agentesInvalidos,
                validos: AGENTES_VALIDOS
            });
        }

        const limite = LIMITES_AGENTES_POR_PLAN[req.negocio.plan] || 3;
        if (agentesArray.length > limite) {
            return res.status(403).json({
                error: `Tu plan permite máximo ${limite} agentes`,
                plan_actual: req.negocio.plan,
                agentes_solicitados: agentesArray.length,
                limite: limite,
                upgrade_url: '/dashboard/plan'
            });
        }

        const [existing] = await db.execute(
            "SELECT id FROM automatizaciones_config WHERE negocio_id = ? AND tipo = 'agentes'",
            [req.negocioId]
        );

        if (existing.length > 0) {
            await db.execute(
                "UPDATE automatizaciones_config SET config = ?, updated_at = NOW() WHERE negocio_id = ? AND tipo = 'agentes'",
                [JSON.stringify({ agentes: agentesArray }), req.negocioId]
            );
        } else {
            await db.execute(
                "INSERT INTO automatizaciones_config (negocio_id, tipo, activa, config) VALUES (?, 'agentes', 1, ?)",
                [req.negocioId, JSON.stringify({ agentes: agentesArray })]
            );
        }

        try {
            await fetch(`${BRAIN_URL}/catalogo/invalidar/${req.negocioId}`, { method: 'POST' });
        } catch {
            console.log('[BotConfig] No se pudo invalidar cache del brain');
        }

        res.json({
            success: true,
            mensaje: 'Agentes actualizados',
            agentes_activos: agentesArray,
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

        // Use Gemini directly (same as messageHandler)
        const gemini = require('../../instance-manager/agents/gemini');
        const resultado = await gemini.procesarMensaje(mensaje, req.negocioId, 0, []);

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
        res.status(500).json({ error: 'Error al conectar con el servicio de IA' });
    }
});

// ===== WHITELIST / BOT MODE =====

router.get('/whitelist', verificarAuth, async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT bot_modo, chat_whitelist FROM negocios WHERE id = ?',
            [req.negocioId]
        );
        const modo = rows[0]?.bot_modo || 'todos';
        const rawList = rows[0]?.chat_whitelist || '';
        const numeros = rawList.split(',').map(s => s.trim()).filter(Boolean);

        res.json({ modo, numeros });
    } catch (error) {
        console.error('[BotConfig] Error whitelist GET:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.put('/whitelist', verificarAuth, async (req, res) => {
    try {
        const { modo, numeros } = req.body;
        const validModos = ['todos', 'whitelist'];
        if (!validModos.includes(modo)) {
            return res.status(400).json({ error: 'Modo inválido' });
        }

        const whitelistStr = Array.isArray(numeros) ? numeros.join(',') : '';

        await db.execute(
            'UPDATE negocios SET bot_modo = ?, chat_whitelist = ? WHERE id = ?',
            [modo, whitelistStr, req.negocioId]
        );

        console.log(`[BotConfig] Bot mode changed to ${modo} for negocio ${req.negocioId}. Whitelist: ${whitelistStr || '(empty)'}`);

        res.json({ modo, numeros: whitelistStr.split(',').filter(Boolean) });
    } catch (error) {
        console.error('[BotConfig] Error whitelist PUT:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

module.exports = router;
