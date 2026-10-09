const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const { verificarAdmin } = require('../middleware/admin');
const { asegurarTablaProspectos } = require('../../db/prospectosTabla');

const INSTANCE_MANAGER_URL = process.env.INSTANCE_MANAGER_URL || 'http://localhost:3001';

const PRECIOS_PLAN = { starter: 89000, professional: 189000, enterprise: 449000 };

const DEFAULT_CONFIG = {
    plataforma: {
        nombre: 'Antigravity',
        logo_url: '',
        color_primario: '#00FFD1',
        email_soporte: 'soporte@antigravity.co',
        modo_mantenimiento: false,
        mensaje_mantenimiento: ''
    },
    planes: {
        starter: { precio: 89000, mensajes_limite: 1000, clientes_max: 100, agentes_max: 2 },
        professional: { precio: 189000, mensajes_limite: 5000, clientes_max: 500, agentes_max: 4 },
        enterprise: { precio: 449000, mensajes_limite: 999999, clientes_max: 999999, agentes_max: 6 }
    },
    ia: {
        modelo_default: 'gpt-4o',
        temperatura: 0.7,
        max_tokens: 2000,
        prompt_base: ''
    },
    notificaciones: {
        email_alertas: 'admin@antigravity.co',
        alerta_wa_desconectado: true,
        alerta_error_rate: true,
        alerta_token_usage: true,
        reportes_diarios: false
    }
};

router.use(verificarAuth);
router.use(verificarAdmin);

router.get('/negocios', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const buscar = req.query.search || req.query.buscar || '';
        const plan = req.query.plan;
        const estado = req.query.estado;

        let whereClause = "n.rol = 'negocio'";
        let params = [];

        if (buscar) {
            whereClause += ' AND (n.nombre LIKE ? OR n.email_dueno LIKE ?)';
            params.push(`%${buscar}%`, `%${buscar}%`);
        }

        if (plan) {
            whereClause += ' AND n.plan = ?';
            params.push(plan);
        }

        if (estado === 'activos' || estado === 'activo') {
            whereClause += ' AND n.suspendido = 0 AND n.suscripcion_activa = 1';
        } else if (estado === 'inactivo') {
            whereClause += ' AND n.suspendido = 0 AND n.suscripcion_activa = 0';
        } else if (estado === 'trial') {
            whereClause += ' AND n.suspendido = 0 AND n.suscripcion_activa = 0 AND n.trial_hasta IS NOT NULL AND n.trial_hasta >= NOW()';
        } else if (estado === 'suspendidos') {
            whereClause += ' AND n.suspendido = 1';
        }

        const [negocios] = await db.execute(
            `SELECT n.id, n.nombre, n.email_dueno, n.plan, n.whatsapp_conectado,
                    n.suscripcion_activa, n.suspendido, n.ciudad, n.created_at,
                    n.trial_hasta,
                    (n.suspendido = 0 AND n.suscripcion_activa = 0 AND n.trial_hasta IS NOT NULL AND n.trial_hasta >= NOW()) as es_trial,
                    (SELECT COUNT(*) FROM clientes WHERE negocio_id = n.id) as total_clientes,
                    (SELECT COUNT(*) FROM pedidos WHERE negocio_id = n.id) as total_pedidos,
                    (SELECT COALESCE(SUM(total), 0) FROM pedidos WHERE negocio_id = n.id) as total_ventas
             FROM negocios n
             WHERE ${whereClause}
             ORDER BY n.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const [countResult] = await db.execute(
            `SELECT COUNT(*) as total FROM negocios n WHERE ${whereClause}`,
            params
        );

        const total = countResult[0]?.total || 0;

        res.json({
            negocios: negocios.map(n => ({ ...n, es_trial: !!n.es_trial })),
            total,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('[Admin] Error negocios:', error);
        res.status(500).json({ error: 'Error al obtener negocios' });
    }
});

router.get('/negocios/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [negocio] = await db.execute(
            `SELECT n.*,
                    (SELECT COUNT(*) FROM clientes WHERE negocio_id = n.id) as total_clientes,
                    (SELECT COUNT(*) FROM pedidos WHERE negocio_id = n.id) as total_pedidos,
                    (SELECT COALESCE(SUM(total), 0) FROM pedidos WHERE negocio_id = n.id) as total_ventas,
                    (SELECT COUNT(*) FROM agente_logs WHERE negocio_id = n.id) as total_interacciones_ia
             FROM negocios n
             WHERE n.id = ? AND n.rol = 'negocio'`,
            [id]
        );

        if (negocio.length === 0) {
            return res.status(404).json({ error: 'Negocio no encontrado' });
        }

        delete negocio[0].password;
        delete negocio[0].password_temp;

        res.json({
            ...negocio[0],
            conversaciones_recientes: [],
            pedidos_recientes: []
        });
    } catch (error) {
        console.error('[Admin] Error negocio:', error);
        res.status(500).json({ error: 'Error al obtener negocio' });
    }
});

router.put('/negocios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nombre, plan, suscripcion_activa, bot_nombre, bot_tono,
            suspended, suspendido_razon
        } = req.body;

        const updates = [];
        const values = [];

        if (nombre !== undefined) {
            updates.push('nombre = ?');
            values.push(nombre);
        }
        if (plan !== undefined) {
            updates.push('plan = ?');
            values.push(plan);
        }
        if (suscripcion_activa !== undefined) {
            updates.push('suscripcion_activa = ?');
            values.push(suscripcion_activa);
        }
        if (bot_nombre !== undefined) {
            updates.push('bot_nombre = ?');
            values.push(bot_nombre);
        }
        if (bot_tono !== undefined) {
            updates.push('bot_tono = ?');
            values.push(bot_tono);
        }
        if (suspended !== undefined) {
            updates.push('suspendido = ?');
            values.push(suspended ? 1 : 0);
            updates.push('suspendido_razon = ?');
            values.push(suspended ? (suspendido_razon || null) : null);
            updates.push('suspended_at = ?');
            values.push(suspended ? new Date() : null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
        }

        values.push(id);
        await db.execute(
            `UPDATE negocios SET ${updates.join(', ')} WHERE id = ? AND rol = 'negocio'`,
            values
        );

        res.json({ success: true, mensaje: 'Negocio actualizado' });
    } catch (error) {
        console.error('[Admin] Error updating:', error);
        res.status(500).json({ error: 'Error al actualizar negocio' });
    }
});

router.get('/estadisticas', async (req, res) => {
    try {
        const [totalNegocios] = await db.execute(
            `SELECT COUNT(*) as total FROM negocios WHERE rol = 'negocio'`
        );

        const [negociosActivos] = await db.execute(
            `SELECT COUNT(*) as total FROM negocios
             WHERE rol = 'negocio' AND suscripcion_activa = 1 AND suspendido = 0`
        );

        const [negociosNuevosMes] = await db.execute(
            `SELECT COUNT(*) as total FROM negocios
             WHERE rol = 'negocio' AND MONTH(created_at) = MONTH(CURRENT_DATE())
             AND YEAR(created_at) = YEAR(CURRENT_DATE())`
        );

        const [ventasMes] = await db.execute(
            `SELECT COALESCE(SUM(total), 0) as total FROM pedidos
             WHERE MONTH(created_at) = MONTH(CURRENT_DATE())
             AND YEAR(created_at) = YEAR(CURRENT_DATE())`
        );

        const [pedidosMes] = await db.execute(
            `SELECT COUNT(*) as total FROM pedidos
             WHERE MONTH(created_at) = MONTH(CURRENT_DATE())
             AND YEAR(created_at) = YEAR(CURRENT_DATE())`
        );

        const [negociosPorPlan] = await db.execute(
            `SELECT plan, COUNT(*) as total FROM negocios WHERE rol = 'negocio' GROUP BY plan`
        );

        const [whatsappConectados] = await db.execute(
            `SELECT COUNT(*) as total FROM negocios WHERE whatsapp_conectado = 1 AND rol = 'negocio'`
        );

        // Personas que dejaron sus datos (formulario /info y las que agrega el admin). Si la tabla
        // aún no existe se crea vacía; un fallo aquí no debe tumbar el resto del Resumen.
        let prospectos = { total: 0, nuevos: 0, esta_semana: 0, seguimientos: 0 };
        try {
            await asegurarTablaProspectos(db);
            const [[p]] = await db.execute(
                `SELECT COUNT(*) AS total,
                        COALESCE(SUM(estado = 'nuevo'), 0) AS nuevos,
                        COALESCE(SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)), 0) AS esta_semana,
                        COALESCE(SUM(proximo_seguimiento IS NOT NULL AND proximo_seguimiento <= CURDATE()
                                     AND estado NOT IN ('cliente','descartado')), 0) AS seguimientos
                 FROM prospectos`
            );
            prospectos = { total: Number(p.total), nuevos: Number(p.nuevos), esta_semana: Number(p.esta_semana), seguimientos: Number(p.seguimientos) };
        } catch (e) {
            console.error('[Admin] Prospectos en estadisticas:', e.code || e.message);
        }

        const mrr = negociosPorPlan.reduce((acc, row) => acc + (PRECIOS_PLAN[row.plan] || 0) * row.total, 0);

        res.json({
            total_negocios: totalNegocios[0]?.total || 0,
            negocios_activos: negociosActivos[0]?.total || 0,
            negocios_nuevos_mes: negociosNuevosMes[0]?.total || 0,
            ventas_mes: parseFloat(ventasMes[0]?.total || 0),
            pedidos_mes: pedidosMes[0]?.total || 0,
            mrr,
            tasa_ia_promedio: 0,
            negocios_por_plan: negociosPorPlan.reduce((acc, row) => {
                acc[row.plan] = row.total;
                return acc;
            }, {}),
            whatsapp_conectados: whatsappConectados[0]?.total || 0,
            prospectos,
            tokens_hoy: 0
        });
    } catch (error) {
        console.error('[Admin] Error estadisticas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

router.get('/inteligencia', async (req, res) => {
    try {
        const [mensajesDiarios] = await db.execute(
            `SELECT DATE(created_at) as fecha, COUNT(*) as mensajes
             FROM mensajes
             WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
             GROUP BY DATE(created_at)`
        );
        const [pedidosDiarios] = await db.execute(
            `SELECT DATE(created_at) as fecha, COUNT(*) as pedidos
             FROM pedidos
             WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
             GROUP BY DATE(created_at)`
        );

        const fechaMap = {};
        const toKey = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
        mensajesDiarios.forEach(r => {
            const key = toKey(r.fecha);
            fechaMap[key] = { fecha: key, mensajes: r.mensajes, pedidos: 0 };
        });
        pedidosDiarios.forEach(r => {
            const key = toKey(r.fecha);
            if (!fechaMap[key]) fechaMap[key] = { fecha: key, mensajes: 0, pedidos: 0 };
            fechaMap[key].pedidos = r.pedidos;
        });
        const actividad_diaria = Object.values(fechaMap).sort((a, b) => a.fecha.localeCompare(b.fecha));

        const [ranking] = await db.execute(
            `SELECT n.id, n.nombre, n.plan,
                    (SELECT COUNT(*) FROM mensajes WHERE negocio_id = n.id AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as mensajes_7d
             FROM negocios n
             WHERE n.rol = 'negocio' AND n.suspendido = 0
             ORDER BY mensajes_7d DESC`
        );

        const [negocios_inactivos] = await db.execute(
            `SELECT * FROM (
                SELECT n.id, n.nombre, n.plan, n.email_dueno,
                       (SELECT MAX(created_at) FROM mensajes WHERE negocio_id = n.id) as ultima_actividad
                FROM negocios n
                WHERE n.rol = 'negocio' AND n.suspendido = 0 AND n.suscripcion_activa = 1
             ) t
             WHERE t.ultima_actividad IS NULL OR t.ultima_actividad < DATE_SUB(NOW(), INTERVAL 7 DAY)
             ORDER BY t.ultima_actividad IS NOT NULL, t.ultima_actividad ASC`
        );

        const [trials_por_vencer] = await db.execute(
            `SELECT id, nombre, email_dueno, plan, trial_hasta
             FROM negocios
             WHERE rol = 'negocio' AND suspendido = 0 AND suscripcion_activa = 0
               AND trial_hasta IS NOT NULL AND trial_hasta BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
             ORDER BY trial_hasta ASC`
        );

        const [altasPorMes] = await db.execute(
            `SELECT DATE_FORMAT(created_at, '%Y-%m') as mes, COUNT(*) as altas
             FROM negocios
             WHERE rol = 'negocio' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
             GROUP BY mes ORDER BY mes`
        );

        const [conversion] = await db.execute(
            `SELECT
                SUM(CASE WHEN suscripcion_activa = 1 THEN 1 ELSE 0 END) as pagando,
                SUM(CASE WHEN suscripcion_activa = 0 AND trial_hasta IS NOT NULL AND trial_hasta >= NOW() THEN 1 ELSE 0 END) as en_trial,
                SUM(CASE WHEN suscripcion_activa = 0 AND (trial_hasta IS NULL OR trial_hasta < NOW()) AND suspendido = 0 THEN 1 ELSE 0 END) as trial_vencido_sin_convertir,
                SUM(CASE WHEN suspendido = 1 THEN 1 ELSE 0 END) as suspendidos
             FROM negocios WHERE rol = 'negocio'`
        );

        const [botStats] = await db.execute(
            `SELECT COUNT(*) as total_interacciones,
                    AVG(tiempo_respuesta_ms) as tiempo_respuesta_promedio,
                    COALESCE(SUM(tokens_usados), 0) as tokens_totales
             FROM agente_logs
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
        );

        const [top_intenciones] = await db.execute(
            `SELECT intencion_detectada, COUNT(*) as total
             FROM agente_logs
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND intencion_detectada IS NOT NULL
             GROUP BY intencion_detectada ORDER BY total DESC LIMIT 8`
        );

        const [tokens_diarios] = await db.execute(
            `SELECT DATE(created_at) as fecha, COALESCE(SUM(tokens_usados), 0) as tokens, COUNT(*) as interacciones
             FROM agente_logs
             WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
             GROUP BY fecha ORDER BY fecha`
        );

        const [resolucion] = await db.execute(
            `SELECT COUNT(*) as total, SUM(CASE WHEN pedido_id IS NOT NULL THEN 1 ELSE 0 END) as con_pedido
             FROM conversaciones WHERE updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
        );

        const [alertas] = await db.execute(
            `SELECT tipo, COUNT(*) as total FROM notificaciones
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY tipo`
        );

        const totalResolucion = resolucion[0]?.total || 0;
        const conPedido = resolucion[0]?.con_pedido || 0;

        res.json({
            actividad_diaria,
            ranking_actividad: ranking,
            negocios_inactivos,
            trials_por_vencer,
            altas_por_mes: altasPorMes.map(r => ({ mes: r.mes, altas: r.altas })),
            conversion: {
                pagando: Number(conversion[0]?.pagando || 0),
                en_trial: Number(conversion[0]?.en_trial || 0),
                trial_vencido_sin_convertir: Number(conversion[0]?.trial_vencido_sin_convertir || 0),
                suspendidos: Number(conversion[0]?.suspendidos || 0)
            },
            bot: {
                total_interacciones: Number(botStats[0]?.total_interacciones || 0),
                tiempo_respuesta_promedio_ms: Math.round(botStats[0]?.tiempo_respuesta_promedio || 0),
                tokens_totales: Number(botStats[0]?.tokens_totales || 0)
            },
            top_intenciones: top_intenciones.map(r => ({ ...r, total: Number(r.total) })),
            tokens_diarios: tokens_diarios.map(r => ({ ...r, fecha: toKey(r.fecha) })),
            resolucion: {
                total: totalResolucion,
                con_pedido: conPedido,
                tasa: totalResolucion > 0 ? Math.round((conPedido / totalResolucion) * 100) : 0
            },
            alertas
        });
    } catch (error) {
        console.error('[Admin] Error inteligencia:', error);
        res.status(500).json({ error: 'Error al obtener inteligencia de negocio' });
    }
});

router.get('/whatsapps', async (req, res) => {
    try {
        const [negocios] = await db.execute(
            `SELECT n.id, n.nombre, n.plan, n.whatsapp_conectado, n.numero_whatsapp, n.whatsapp_ultima_conexion,
                    (SELECT COUNT(*) FROM mensajes WHERE negocio_id = n.id AND DATE(created_at) = CURDATE()) as mensajes_hoy
             FROM negocios n WHERE n.rol = 'negocio'`
        );

        let liveStatus = new Map();
        try {
            const response = await fetch(`${INSTANCE_MANAGER_URL}/internal/status/all`);
            if (response.ok) {
                const status = await response.json();
                for (const inst of status.instances || []) {
                    liveStatus.set(inst.negocioId, inst);
                }
            }
        } catch {
            console.log('[Admin] Instance Manager no disponible');
        }

        res.json({
            whatsapps: negocios.map(n => {
                const live = liveStatus.get(n.id);
                return {
                    id: n.id,
                    negocio_id: n.id,
                    nombre_negocio: n.nombre,
                    plan: n.plan,
                    conectado: live ? !!live.connected : !!n.whatsapp_conectado,
                    numero: (live && live.phone) || n.numero_whatsapp,
                    ultimo_ping: n.whatsapp_ultima_conexion,
                    mensajes_hoy: n.mensajes_hoy
                };
            })
        });
    } catch (error) {
        console.error('[Admin] Error whatsapps:', error);
        res.status(500).json({ error: 'Error al obtener estado de WhatsApps' });
    }
});

router.post('/demo', async (req, res) => {
    try {
        const { nombre, email, telefono } = req.body;

        const bcrypt = require('bcryptjs');
        const passwordHash = await bcrypt.hash('Demo2024#', 10);
        const emailFinal = email || `demo_${Date.now()}@demo.com`;

        const [result] = await db.execute(
            `INSERT INTO negocios (nombre, email_dueno, password, whatsapp, plan,
                                   activo, suscripcion_activa, bot_nombre, bot_tono,
                                   terminos_aceptados, trial_hasta)
             VALUES (?, ?, ?, ?, 'starter', 1, 1, 'Asistente', 'amigable', 1, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
            [nombre || 'Demo Temporal', emailFinal, passwordHash, telefono || '+573000000000']
        );

        res.json({
            success: true,
            negocio_id: result.insertId,
            mensaje: 'Negocio demo creado exitosamente',
            credenciales: {
                email: emailFinal,
                password: 'Demo2024#'
            }
        });
    } catch (error) {
        console.error('[Admin] Error demo:', error);
        res.status(500).json({ error: 'Error al crear negocio demo' });
    }
});

router.get('/suscripciones', async (req, res) => {
    try {
        const plan = req.query.plan;
        const estado = req.query.estado;

        let whereClause = "n.rol = 'negocio'";
        const params = [];

        if (plan) {
            whereClause += ' AND n.plan = ?';
            params.push(plan);
        }

        const [suscripciones] = await db.execute(
            `SELECT n.id, n.id as negocio_id, n.nombre as nombre_negocio, n.email_dueno as email,
                    n.plan, n.suscripcion_activa, n.suspendido, n.trial_hasta,
                    n.suscripcion_inicio, n.suscripcion_fin, n.created_at
             FROM negocios n
             WHERE ${whereClause}
             ORDER BY n.created_at DESC
             LIMIT 200`,
            params
        );

        const ahora = Date.now();
        let mapeadas = suscripciones.map(s => {
            const enTrial = !s.suscripcion_activa && s.trial_hasta && new Date(s.trial_hasta).getTime() >= ahora;
            let estadoCalc;
            if (s.suspendido) estadoCalc = 'cancelada';
            else if (enTrial) estadoCalc = 'trial';
            else if (s.suscripcion_activa) estadoCalc = 'activa';
            else estadoCalc = 'vencida';

            return {
                id: s.id,
                negocio_id: s.negocio_id,
                nombre_negocio: s.nombre_negocio,
                email: s.email,
                plan: s.plan,
                estado: estadoCalc,
                inicio: s.suscripcion_inicio || s.created_at,
                fin: s.suscripcion_fin || s.trial_hasta
            };
        });

        if (estado) {
            mapeadas = mapeadas.filter(s => s.estado === estado);
        }

        const mrr = mapeadas
            .filter(s => s.estado === 'activa')
            .reduce((acc, s) => acc + (PRECIOS_PLAN[s.plan] || 0), 0);
        const trialsActivos = mapeadas.filter(s => s.estado === 'trial').length;
        const churnMes = mapeadas.filter(s => s.estado === 'cancelada').length;

        res.json({
            suscripciones: mapeadas,
            stats: {
                mrr,
                churn_mes: churnMes,
                trials_activos: trialsActivos
            }
        });
    } catch (error) {
        console.error('[Admin] Error suscripciones:', error);
        res.status(500).json({ error: 'Error al obtener suscripciones' });
    }
});

router.put('/suscripciones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { plan, estado } = req.body;

        const updates = [];
        const values = [];

        if (plan) {
            updates.push('plan = ?');
            values.push(plan);
        }
        if (estado === 'cancelada') {
            updates.push('suscripcion_activa = 0');
        } else if (estado === 'activa') {
            updates.push('suscripcion_activa = 1');
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
        }

        values.push(id);
        await db.execute(`UPDATE negocios SET ${updates.join(', ')} WHERE id = ?`, values);

        res.json({ success: true });
    } catch (error) {
        console.error('[Admin] Error update suscripcion:', error);
        res.status(500).json({ error: 'Error al actualizar suscripción' });
    }
});

router.get('/logs', async (req, res) => {
    try {
        const { negocio_id, desde, hasta } = req.query;

        let whereClause = '1 = 1';
        const params = [];

        if (negocio_id) {
            whereClause += ' AND l.negocio_id = ?';
            params.push(negocio_id);
        }
        if (desde) {
            whereClause += ' AND l.created_at >= ?';
            params.push(`${desde} 00:00:00`);
        }
        if (hasta) {
            whereClause += ' AND l.created_at <= ?';
            params.push(`${hasta} 23:59:59`);
        }

        const [logs] = await db.execute(
            `SELECT l.id, l.created_at as timestamp, l.negocio_id, n.nombre as nombre_negocio,
                    l.agente_utilizado, l.intencion_detectada, l.mensaje_entrada,
                    l.respuesta_texto, l.tokens_usados, l.tiempo_respuesta_ms
             FROM agente_logs l
             LEFT JOIN negocios n ON n.id = l.negocio_id
             WHERE ${whereClause}
             ORDER BY l.created_at DESC
             LIMIT 300`,
            params
        );

        res.json({
            logs: logs.map(l => ({
                id: l.id,
                timestamp: l.timestamp,
                nivel: 'info',
                nombre_negocio: l.nombre_negocio,
                tipo: l.agente_utilizado || 'bot',
                mensaje: l.mensaje_entrada,
                detalles: {
                    respuesta: l.respuesta_texto,
                    intencion: l.intencion_detectada,
                    tokens_usados: l.tokens_usados,
                    tiempo_respuesta_ms: l.tiempo_respuesta_ms
                }
            }))
        });
    } catch (error) {
        console.error('[Admin] Error logs:', error);
        res.status(500).json({ error: 'Error al obtener logs' });
    }
});

router.get('/config', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT seccion, datos FROM platform_config');
        const config = { ...DEFAULT_CONFIG };
        for (const row of rows) {
            if (config[row.seccion]) {
                config[row.seccion] = { ...config[row.seccion], ...(typeof row.datos === 'string' ? JSON.parse(row.datos) : row.datos) };
            }
        }
        res.json({ config });
    } catch (error) {
        console.error('[Admin] Error config:', error);
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
});

router.put('/config', async (req, res) => {
    try {
        const { seccion, datos } = req.body;

        if (!seccion || !DEFAULT_CONFIG[seccion]) {
            return res.status(400).json({ error: 'Sección de configuración inválida' });
        }

        await db.execute(
            `INSERT INTO platform_config (seccion, datos) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE datos = VALUES(datos)`,
            [seccion, JSON.stringify(datos || {})]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('[Admin] Error saving config:', error);
        res.status(500).json({ error: 'Error al guardar configuración' });
    }
});

router.post('/whatsapps/:id/reconectar', async (req, res) => {
    try {
        const { id } = req.params;
        try {
            const response = await fetch(`${INSTANCE_MANAGER_URL}/internal/reconnect/${id}`, { method: 'POST' });
            if (response.ok) {
                return res.json({ success: true, mensaje: 'Reconexión iniciada' });
            }
        } catch {
            console.log('[Admin] Instance Manager no disponible para reconexión');
        }
        res.json({ success: true, mensaje: 'Reconexión solicitada' });
    } catch (error) {
        console.error('[Admin] Error reconectar:', error);
        res.status(500).json({ error: 'Error al reconectar' });
    }
});

module.exports = router;
