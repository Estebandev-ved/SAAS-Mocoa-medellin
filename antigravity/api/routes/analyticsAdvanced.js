const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const { getPlanFeatures } = require('../../config/planConfig');

router.use(verificarAuth);

// GET /api/analytics/resumen — lo que pinta la página de Analytics del
// dashboard (AnalyticsPage.jsx) en una sola llamada. Antes esta ruta vivía
// duplicada en routes/all.js devolviendo solo {ventas_hoy, pedidos_hoy,
// mensajes_hoy}, que no traía ninguno de los campos que la página realmente
// usa (resumen.total_ventas, ventas_diarias, top_productos, top_clientes) —
// la página de Analytics mostraba ceros y gráficas vacías siempre. También
// existía una tercera versión en routes/analytics.js con otra forma más,
// tampoco compatible, y ese archivo nunca se montaba en index.js. Esta es
// la única implementación real de /api/analytics/resumen ahora.
router.get('/resumen', async (req, res) => {
    try {
        const negocioId = req.negocio.id;
        const ESTADOS_CONFIRMADOS = ['pago_confirmado', 'en_preparacion', 'enviado', 'entregado'];

        const mesActual = new Date().toISOString().substring(0, 7);
        const fechaMesAnterior = new Date();
        fechaMesAnterior.setMonth(fechaMesAnterior.getMonth() - 1);
        const mesAnterior = fechaMesAnterior.toISOString().substring(0, 7);

        async function resumenDelMes(periodo) {
            const [[fila]] = await db.execute(
                `SELECT
                    COUNT(*) as total_pedidos,
                    COALESCE(SUM(CASE WHEN estado IN (?, ?, ?, ?) THEN total ELSE 0 END), 0) as total_ventas,
                    AVG(CASE WHEN estado IN (?, ?, ?, ?) THEN total ELSE NULL END) as ticket_promedio
                 FROM pedidos
                 WHERE negocio_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
                [...ESTADOS_CONFIRMADOS, ...ESTADOS_CONFIRMADOS, negocioId, periodo]
            );
            const [[mensajesFila]] = await db.execute(
                `SELECT COUNT(*) as mensajes, AVG(tiempo_respuesta_ms) as tiempo_respuesta_ms
                 FROM agente_logs WHERE negocio_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
                [negocioId, periodo]
            );
            // "Pedidos perdidos por demora": la tabla `pedidos` sobrescribe el
            // estado en cada cambio (no hay historial), así que no se puede
            // saber con certeza si uno cancelado se perdió por lentitud o por
            // otra razón. Esta es la mejor aproximación con los datos que hay:
            // pedidos cancelados + pedidos que llevan más de 24h sin confirmar
            // el pago (candidatos a abandono).
            const [[perdidosFila]] = await db.execute(
                `SELECT COUNT(*) as total FROM pedidos
                 WHERE negocio_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?
                 AND (estado = 'cancelado' OR (estado IN ('pendiente_pago', 'pago_enviado') AND created_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR)))`,
                [negocioId, periodo]
            );
            const totalPedidos = parseInt(fila.total_pedidos) || 0;
            const mensajes = parseInt(mensajesFila.mensajes) || 0;
            return {
                total_ventas: parseFloat(fila.total_ventas) || 0,
                total_pedidos: totalPedidos,
                ticket_promedio: parseFloat(fila.ticket_promedio) || 0,
                tasa_conversion: mensajes > 0 ? parseFloat(((totalPedidos / mensajes) * 100).toFixed(1)) : 0,
                tiempo_respuesta_ms: parseFloat(mensajesFila.tiempo_respuesta_ms) || 0,
                pedidos_perdidos: parseInt(perdidosFila.total) || 0
            };
        }

        function variacion(actual, anterior) {
            if (!anterior) return actual > 0 ? 100 : 0;
            return parseFloat((((actual - anterior) / anterior) * 100).toFixed(1));
        }

        const [actual, anterior] = await Promise.all([resumenDelMes(mesActual), resumenDelMes(mesAnterior)]);

        // Total histórico (no solo del mes), para el hito "100 mensajes atendidos" del dashboard.
        const [[mensajesTotalesFila]] = await db.execute(
            'SELECT COUNT(*) as total FROM agente_logs WHERE negocio_id = ?',
            [negocioId]
        );
        const mensajes_totales = parseInt(mensajesTotalesFila.total) || 0;

        // Bloque "hoy" que lee el Dashboard (tarjetas Ventas/Pedidos/Mensajes Hoy/IA Procesados).
        // Antes el frontend leía una clave `hoy` que este endpoint nunca devolvía y las tarjetas
        // mostraban siempre cero. `ai_procesados` = respuestas que gastaron tokens de IA (las
        // deterministas, como el flujo de dirección, no cuentan); `cambio_ventas` = % vs ayer.
        const ventasDelDia = async (offsetDias) => {
            const [[f]] = await db.execute(
                `SELECT COUNT(*) as total_pedidos,
                        COALESCE(SUM(CASE WHEN estado IN (?, ?, ?, ?) THEN total ELSE 0 END), 0) as total_ventas
                 FROM pedidos
                 WHERE negocio_id = ? AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
                [...ESTADOS_CONFIRMADOS, negocioId, offsetDias]
            );
            return { total_pedidos: parseInt(f.total_pedidos) || 0, total_ventas: parseFloat(f.total_ventas) || 0 };
        };
        const [hoyVentas, ayerVentas] = await Promise.all([ventasDelDia(0), ventasDelDia(1)]);
        const [[hoyMensajes]] = await db.execute(
            `SELECT COUNT(*) as mensajes, COALESCE(SUM(CASE WHEN tokens_usados > 0 THEN 1 ELSE 0 END), 0) as ai_procesados
             FROM agente_logs WHERE negocio_id = ? AND DATE(created_at) = CURDATE()`,
            [negocioId]
        );
        const mensajesHoy = parseInt(hoyMensajes.mensajes) || 0;
        const hoy = {
            total_ventas: hoyVentas.total_ventas,
            total_pedidos: hoyVentas.total_pedidos,
            mensajes: mensajesHoy,
            ai_procesados: parseInt(hoyMensajes.ai_procesados) || 0,
            tasa_conversion: mensajesHoy > 0 ? parseFloat(((hoyVentas.total_pedidos / mensajesHoy) * 100).toFixed(1)) : 0,
            cambio_ventas: variacion(hoyVentas.total_ventas, ayerVentas.total_ventas)
        };

        // Ventas de los últimos 7 días, con los días sin pedidos en cero.
        const [ventasPorDia] = await db.execute(
            `SELECT DATE(created_at) as fecha, COUNT(*) as pedidos, COALESCE(SUM(total), 0) as ventas
             FROM pedidos
             WHERE negocio_id = ? AND estado IN (?, ?, ?, ?) AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
             GROUP BY DATE(created_at)`,
            [negocioId, ...ESTADOS_CONFIRMADOS]
        );
        const ventas_diarias = [];
        for (let i = 6; i >= 0; i--) {
            const fecha = new Date(Date.now() - i * 86400000);
            const fechaISO = fecha.toISOString().split('T')[0];
            const encontrado = ventasPorDia.find(v => {
                const f = v.fecha instanceof Date ? v.fecha.toISOString().split('T')[0] : String(v.fecha);
                return f === fechaISO;
            });
            ventas_diarias.push({
                dia: fecha.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }),
                ventas: encontrado ? parseFloat(encontrado.ventas) : 0,
                pedidos: encontrado ? parseInt(encontrado.pedidos) : 0
            });
        }

        const [topProductos] = await db.execute(
            `SELECT pr.nombre, SUM(ip.cantidad) as vendidos, SUM(ip.subtotal) as ingresos
             FROM items_pedido ip
             JOIN pedidos p ON ip.pedido_id = p.id
             JOIN productos pr ON ip.producto_id = pr.id
             WHERE p.negocio_id = ? AND p.estado IN (?, ?, ?, ?)
             GROUP BY pr.id, pr.nombre
             ORDER BY vendidos DESC
             LIMIT 5`,
            [negocioId, ...ESTADOS_CONFIRMADOS]
        );

        const [topClientes] = await db.execute(
            `SELECT c.nombre, COUNT(p.id) as pedidos, SUM(p.total) as total
             FROM pedidos p
             JOIN clientes c ON p.cliente_id = c.id
             WHERE p.negocio_id = ? AND p.estado IN (?, ?, ?, ?)
             GROUP BY c.id, c.nombre
             ORDER BY total DESC
             LIMIT 5`,
            [negocioId, ...ESTADOS_CONFIRMADOS]
        );

        res.json({
            hoy,
            resumen: {
                total_ventas: actual.total_ventas,
                ventas_variacion: variacion(actual.total_ventas, anterior.total_ventas),
                total_pedidos: actual.total_pedidos,
                pedidos_variacion: variacion(actual.total_pedidos, anterior.total_pedidos),
                ticket_promedio: actual.ticket_promedio,
                ticket_variacion: variacion(actual.ticket_promedio, anterior.ticket_promedio),
                tasa_conversion: actual.tasa_conversion,
                conversion_variacion: variacion(actual.tasa_conversion, anterior.tasa_conversion),
                tiempo_respuesta_ms: actual.tiempo_respuesta_ms,
                tiempo_respuesta_variacion: variacion(actual.tiempo_respuesta_ms, anterior.tiempo_respuesta_ms),
                pedidos_perdidos: actual.pedidos_perdidos,
                pedidos_perdidos_variacion: variacion(actual.pedidos_perdidos, anterior.pedidos_perdidos),
                mensajes_totales
            },
            ventas_diarias,
            top_productos: topProductos.map(p => ({
                nombre: p.nombre,
                vendidos: parseInt(p.vendidos) || 0,
                ingresos: parseFloat(p.ingresos) || 0
            })),
            top_clientes: topClientes.map(c => ({
                nombre: c.nombre,
                pedidos: parseInt(c.pedidos) || 0,
                total: parseFloat(c.total) || 0
            }))
        });
    } catch (error) {
        console.error('[Analytics] Error resumen:', error.message);
        res.status(500).json({ error: 'Error al obtener resumen' });
    }
});

// GET /api/analytics/ventas — serie diaria para un período (semana/mes/año).
// El frontend hoy no manda el parámetro `periodo` en la llamada (otra
// inconsistencia previa entre el selector de período de la UI y la llamada
// real), así que por ahora esta ruta también sirve como endpoint standalone
// para quien la use con el query param.
router.get('/ventas', async (req, res) => {
    try {
        const negocioId = req.negocio.id;
        const { periodo = 'semana' } = req.query;
        const dias = periodo === 'año' ? 365 : periodo === 'mes' ? 30 : 7;

        const [ventas] = await db.execute(
            `SELECT DATE(created_at) as fecha, COALESCE(SUM(total), 0) as ventas, COUNT(*) as pedidos
             FROM pedidos
             WHERE negocio_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             GROUP BY DATE(created_at)
             ORDER BY fecha ASC`,
            [negocioId, dias]
        );

        res.json({ ventas, periodo });
    } catch (error) {
        console.error('[Analytics] Error ventas:', error.message);
        res.status(500).json({ error: 'Error al obtener ventas' });
    }
});

// GET /api/analytics/advanced - Analytics completo
router.get('/advanced', async (req, res) => {
    try {
        const negocioId = req.negocio.id;
        const periodo = new Date().toISOString().substring(0, 7);
        const hoy = new Date().toISOString().split('T')[0];

        // 1. Ventas por día (últimos 30 días)
        const [ventasPorDia] = await db.execute(
            `SELECT DATE(created_at) as fecha, COUNT(*) as pedidos, SUM(total) as ventas
             FROM pedidos 
             WHERE negocio_id = ? AND estado IN ('pago_confirmado', 'en_preparacion', 'enviado', 'entregado')
               AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
             GROUP BY DATE(created_at)
             ORDER BY fecha`,
            [negocioId]
        );

        // 2. Top productos más vendidos
        const [topProductos] = await db.execute(
            `SELECT pr.nombre, SUM(ip.cantidad) as vendidos, SUM(ip.subtotal) as ingresos
             FROM items_pedido ip
             JOIN pedidos p ON ip.pedido_id = p.id
             JOIN productos pr ON ip.producto_id = pr.id
             WHERE p.negocio_id = ? AND p.estado IN ('pago_confirmado', 'en_preparacion', 'enviado', 'entregado')
             GROUP BY pr.id, pr.nombre
             ORDER BY vendidos DESC
             LIMIT 10`,
            [negocioId]
        );

        // 3. Métodos de pago más usados
        const [metodosPago] = await db.execute(
            `SELECT metodo_pago, COUNT(*) as usados, SUM(total) as monto
             FROM pedidos
             WHERE negocio_id = ? AND metodo_pago IS NOT NULL AND metodo_pago != ''
             GROUP BY metodo_pago
             ORDER BY usados DESC`,
            [negocioId]
        );

        // 4. Clientes que más compran
        const [topClientes] = await db.execute(
            `SELECT c.nombre, c.whatsapp, COUNT(p.id) as pedidos, SUM(p.total) as gastado
             FROM pedidos p
             JOIN clientes c ON p.cliente_id = c.id
             WHERE p.negocio_id = ? AND p.estado IN ('pago_confirmado', 'en_preparacion', 'enviado', 'entregado')
             GROUP BY c.id, c.nombre, c.whatsapp
             ORDER BY gastado DESC
             LIMIT 10`,
            [negocioId]
        );

        // 5. Conversaciones por agente (IA)
        const [agentesStats] = await db.execute(
            `SELECT agente_usado, COUNT(*) as mensajes, intencion_detectada
             FROM agente_logs
             WHERE negocio_id = ? AND DATE(created_at) = ?
             GROUP BY agente_usado, intencion_detectada
             ORDER BY mensajes DESC`,
            [negocioId, hoy]
        );

        // 6. Resumen del mes
        const [resumenMes] = await db.execute(
            `SELECT 
                COUNT(*) as total_pedidos,
                SUM(CASE WHEN estado IN ('pago_confirmado', 'en_preparacion', 'enviado', 'entregado') THEN total ELSE 0 END) as ventas_confirmadas,
                SUM(CASE WHEN estado = 'pendiente_pago' THEN total ELSE 0 END) as pendientes_pago,
                AVG(CASE WHEN estado IN ('pago_confirmado', 'en_preparacion', 'enviado', 'entregado') THEN total ELSE NULL END) as ticket_promedio
             FROM pedidos
             WHERE negocio_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
            [negocioId, periodo]
        );

        // 7. Conversaciones activas
        const [conversacionesActivas] = await db.execute(
            `SELECT COUNT(DISTINCT numero_cliente) as activas
             FROM mensajes
             WHERE negocio_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
            [negocioId]
        );

        // 8. Tasa de conversión (pedidos / mensajes)
        const [tasaConversion] = await db.execute(
            `SELECT 
                (SELECT COUNT(*) FROM pedidos WHERE negocio_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ? AND estado != 'cancelado') as pedidos,
                (SELECT COUNT(*) FROM agente_logs WHERE negocio_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?) as mensajes`,
            [negocioId, periodo, negocioId, periodo]
        );

        const pedidosCount = tasaConversion[0]?.pedidos || 0;
        const mensajesCount = tasaConversion[0]?.mensajes || 0;
        const conversionRate = mensajesCount > 0 ? ((pedidosCount / mensajesCount) * 100).toFixed(1) : 0;

        // 9. Horarios más activos
        const [horariosActivos] = await db.execute(
            `SELECT HOUR(created_at) as hora, COUNT(*) as mensajes
             FROM agente_logs
             WHERE negocio_id = ? AND DATE(created_at) = ?
             GROUP BY HOUR(created_at)
             ORDER BY hora`,
            [negocioId, hoy]
        );

        res.json({
            ventas_por_dia: ventasPorDia,
            top_productos: topProductos,
            metodos_pago: metodosPago,
            top_clientes: topClientes,
            agentes_stats: agentesStats,
            resumen_mes: resumenMes[0] || {},
            conversaciones_activas: conversacionesActivas[0]?.activas || 0,
            tasa_conversion: parseFloat(conversionRate),
            horarios_activos: horariosActivos
        });

    } catch (error) {
        console.error('[Analytics] Error advanced:', error.message);
        res.status(500).json({ error: 'Error obteniendo analytics avanzados' });
    }
});

// GET /api/analytics/alertas — alertas y advertencias para el dashboard.
// Portado desde routes/analytics.js (archivo que nunca se montaba en
// index.js — dead code) porque agency-platform-react ya lo llamaba y
// dependía de él. Se reusa el pool y el middleware de auth compartidos de
// este router (igual que /resumen arriba), y el límite de mensajes sale de
// planConfig.js (fuente única de verdad) en vez del mapa hardcodeado que
// tenía la versión original.
router.get('/alertas', async (req, res) => {
    try {
        const negocioId = req.negocio.id;
        const alertas = [];
        const periodo = new Date().toISOString().substring(0, 7);

        const [logsStats] = await db.execute(
            `SELECT COUNT(*) as mensajes, COALESCE(SUM(tokens_usados), 0) as tokens
             FROM agente_logs
             WHERE negocio_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
            [negocioId, periodo]
        );
        const mensajesUsados = logsStats[0]?.mensajes || 0;

        const [negocios] = await db.execute(
            'SELECT plan, suscripcion_fin, trial_hasta, suscripcion_activa FROM negocios WHERE id = ?',
            [negocioId]
        );
        const negocio = negocios[0];
        const plan = negocio?.plan || 'starter';
        const limite = getPlanFeatures(plan).maxMessages;

        if (limite !== -1 && mensajesUsados > 0) {
            const porcentaje = Math.round((mensajesUsados / limite) * 100);
            if (porcentaje >= 120) {
                alertas.push({
                    tipo: 'limite_mensajes_bloqueado',
                    severidad: 'critica',
                    titulo: 'Bot bloqueado por límite excedido',
                    mensaje: `Has alcanzado el ${porcentaje}% de tu límite (${mensajesUsados}/${limite}). El bot ha dejado de responder. Actualiza tu plan para reactivarlo.`,
                    accion: 'actualizar_plan',
                    accion_texto: 'Reactivar bot',
                });
            } else if (porcentaje >= 100) {
                alertas.push({
                    tipo: 'limite_mensajes',
                    severidad: 'critica',
                    titulo: 'Límite de mensajes alcanzado',
                    mensaje: `Has usado ${mensajesUsados.toLocaleString()} de ${limite.toLocaleString()} mensajes (${porcentaje}%). Algunos mensajes pueden no ser procesados.`,
                    accion: 'actualizar_plan',
                    accion_texto: 'Mejorar plan',
                });
            } else if (porcentaje >= 80) {
                alertas.push({
                    tipo: 'limite_mensajes',
                    severidad: 'advertencia',
                    titulo: 'Mensajes casi agotados',
                    mensaje: `Has usado ${mensajesUsados.toLocaleString()} de ${limite.toLocaleString()} mensajes (${porcentaje}%).`,
                    accion: 'actualizar_plan',
                    accion_texto: 'Ver planes',
                });
            }
        }

        if (negocio?.suscripcion_fin) {
            const diasRestantes = Math.ceil((new Date(negocio.suscripcion_fin) - new Date()) / (1000 * 60 * 60 * 24));
            if (diasRestantes <= 3 && diasRestantes > 0) {
                alertas.push({
                    tipo: 'suscripcion_vence',
                    severidad: 'advertencia',
                    titulo: 'Suscripción por vencer',
                    mensaje: `Tu plan vence en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''}. Renueva para mantener tu servicio.`,
                    accion: 'renovar',
                    accion_texto: 'Renovar ahora',
                });
            } else if (diasRestantes <= 0) {
                alertas.push({
                    tipo: 'suscripcion_vencida',
                    severidad: 'critica',
                    titulo: 'Suscripción vencida',
                    mensaje: 'Tu suscripción ha vencido. El bot puede dejar de funcionar.',
                    accion: 'renovar',
                    accion_texto: 'Reactivar ahora',
                });
            }
        }

        if (negocio?.trial_hasta && !negocio.suscripcion_activa) {
            const diasTrial = Math.ceil((new Date(negocio.trial_hasta) - new Date()) / (1000 * 60 * 60 * 24));
            if (diasTrial <= 3 && diasTrial > 0) {
                alertas.push({
                    tipo: 'trial_vence',
                    severidad: 'advertencia',
                    titulo: 'Prueba gratuita por vencer',
                    mensaje: `Tu prueba termina en ${diasTrial} día${diasTrial > 1 ? 's' : ''}. Activa tu plan para continuar.`,
                    accion: 'actualizar_plan',
                    accion_texto: 'Ver planes',
                });
            } else if (diasTrial <= 0) {
                alertas.push({
                    tipo: 'trial_vencido',
                    severidad: 'critica',
                    titulo: 'Prueba gratuita vencida',
                    mensaje: 'Tu período de prueba ha terminado. Activa tu cuenta para que el bot siga funcionando.',
                    accion: 'actualizar_plan',
                    accion_texto: 'Activar cuenta',
                });
            }
        }

        const [errores] = await db.execute(
            `SELECT COUNT(*) as total_errores
             FROM agente_logs
             WHERE negocio_id = ? AND DATE(created_at) = CURDATE() AND intencion_detectada = 'error'`,
            [negocioId]
        );
        const [totalLogs] = await db.execute(
            `SELECT COUNT(*) as total
             FROM agente_logs
             WHERE negocio_id = ? AND DATE(created_at) = CURDATE()`,
            [negocioId]
        );
        const totalHoy = totalLogs[0]?.total || 0;
        const erroresHoy = errores[0]?.total_errores || 0;
        if (totalHoy > 5) {
            const tasaError = Math.round((erroresHoy / totalHoy) * 100);
            if (tasaError >= 40) {
                alertas.push({
                    tipo: 'alta_tasa_errores',
                    severidad: 'advertencia',
                    titulo: 'Alta tasa de errores',
                    mensaje: `${tasaError}% de respuestas con error hoy (${erroresHoy}/${totalHoy}). Puede indicar problemas con la IA.`,
                    accion: null,
                });
            }
        }

        if (plan === 'starter' && mensajesUsados >= 500) {
            alertas.push({
                tipo: 'upgrade_sugerido',
                severidad: 'info',
                titulo: '¿Necesitas más mensajes?',
                mensaje: `Llevas ${mensajesUsados} mensajes este mes. Con Professional tendrías 5,000/mes y automatizaciones avanzadas.`,
                accion: 'actualizar_plan',
                accion_texto: 'Mejorar a Professional',
            });
        }

        res.json({ alertas, total: alertas.length });
    } catch (error) {
        console.error('[Analytics] Error alertas:', error.message);
        res.status(500).json({ error: 'Error obteniendo alertas', alertas: [] });
    }
});

module.exports = router;
