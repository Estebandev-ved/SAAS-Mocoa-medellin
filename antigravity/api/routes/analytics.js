const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');

router.use(verificarAuth);

router.get('/resumen', async (req, res) => {
    try {

        const negocioId = req.negocio.id;
        
        const hoy = new Date().toISOString().split('T')[0];
        const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        
        const [hoyData] = await db.execute(
            `SELECT 
                COALESCE(SUM(total), 0) as total_ventas,
                COUNT(*) as total_pedidos,
                SUM(CASE WHEN estado = 'pendiente_pago' THEN 1 ELSE 0 END) as pedidos_pendientes
             FROM pedidos 
             WHERE negocio_id = ? AND DATE(created_at) = ?`,
            [negocioId, hoy]
        );
        
        const [ayerData] = await db.execute(
            `SELECT 
                COALESCE(SUM(total), 0) as total_ventas,
                COUNT(*) as total_pedidos
             FROM pedidos 
             WHERE negocio_id = ? AND DATE(created_at) = ?`,
            [negocioId, ayer]
        );
        
        const [totalMensajes] = await db.execute(
            `SELECT COUNT(*) as total FROM mensajes 
             WHERE negocio_id = ? AND DATE(created_at) = ?`,
            [negocioId, hoy]
        );
        
        const [topProducto] = await db.execute(
            `SELECT pr.nombre, SUM(ip.cantidad) as cantidad_vendida, SUM(ip.subtotal) as ingresos
             FROM items_pedido ip
             JOIN productos pr ON ip.producto_id = pr.id
             JOIN pedidos p ON ip.pedido_id = p.id
             WHERE p.negocio_id = ? AND DATE(p.created_at) = ?
             GROUP BY pr.id
             ORDER BY cantidad_vendida DESC
             LIMIT 1`,
            [negocioId, hoy]
        );
        
        const ventasHoy = parseFloat(hoyData[0].total_ventas) || 0;
        const ventasAyer = parseFloat(ayerData[0].total_ventas) || 0;
        
        let cambioVentas = 0;
        if (ventasAyer > 0) {
            cambioVentas = ((ventasHoy - ventasAyer) / ventasAyer * 100).toFixed(1);
        }
        
        const pedidosHoy = parseInt(hoyData[0].total_pedidos) || 0;
        const pedidosAyer = parseInt(ayerData[0].total_pedidos) || 0;
        
        let tasaConversion = 0;
        const mensajes = parseInt(totalMensajes[0].total) || 0;

        // AI usage today
        const [aiLogs] = await db.execute(
            `SELECT COUNT(*) as total, SUM(tokens_usados) as tokens 
             FROM agente_logs WHERE negocio_id = ? AND DATE(created_at) = ?`,
            [negocioId, hoy]
        );
        const aiHoy = parseInt(aiLogs[0].total) || 0;
        const tokensHoy = parseInt(aiLogs[0].tokens) || 0;

        if (mensajes > 0) {
            tasaConversion = ((pedidosHoy / mensajes) * 100).toFixed(1);
        }

        res.json({
            success: true,
            data: {
                hoy: {
                    total_ventas: ventasHoy,
                    total_pedidos: pedidosHoy,
                    pedidos_pendientes: parseInt(hoyData[0].pedidos_pendientes) || 0,
                    mensajes: mensajes,
                    ai_procesados: aiHoy,
                    tokens_usados: tokensHoy,
                    tasa_conversion: parseFloat(tasaConversion),
                    cambio_ventas: parseFloat(cambioVentas),
                    ventas_ayer: ventasAyer,
                    pedidos_ayer: pedidosAyer
                }
            }
        });
        
    } catch (error) {
        console.error('[Analytics] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener resumen' });
    }
});

router.get('/ventas', async (req, res) => {
    try {

        const { periodo = 'semana' } = req.query;
        const negocioId = req.negocio.id;
        
        let dias = 7;
        if (periodo === 'mes') dias = 30;
        if (periodo === 'año') dias = 365;
        
        const fechaInicio = new Date(Date.now() - dias * 86400000).toISOString().split('T')[0];
        
        const [ventas] = await db.execute(
            `SELECT 
                DATE(created_at) as fecha,
                COALESCE(SUM(total), 0) as total_ventas,
                COUNT(*) as total_pedidos
             FROM pedidos 
             WHERE negocio_id = ? AND DATE(created_at) >= ?
             GROUP BY DATE(created_at)
             ORDER BY fecha ASC`,
            [negocioId, fechaInicio]
        );
        
        const resultado = [];
        for (let i = 0; i < dias; i++) {
            const fecha = new Date(Date.now() - (dias - 1 - i) * 86400000).toISOString().split('T')[0];
            const encontrado = ventas.find(v => v.fecha === fecha);
            
            resultado.push({
                fecha,
                total_ventas: encontrado ? parseFloat(encontrado.total_ventas) : 0,
                total_pedidos: encontrado ? parseInt(encontrado.total_pedidos) : 0
            });
        }
        
        res.json({ success: true, data: resultado, periodo });
        
    } catch (error) {
        console.error('[Analytics] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener ventas' });
    }
});

router.get('/productos', async (req, res) => {
    try {

        const negocioId = req.negocio.id;
        
        const [productos] = await db.execute(
            `SELECT 
                pr.id,
                pr.nombre,
                pr.imagen_url,
                SUM(ip.cantidad) as cantidad_vendida,
                SUM(ip.subtotal) as ingresos,
                pr.stock
             FROM items_pedido ip
             JOIN productos pr ON ip.producto_id = pr.id
             JOIN pedidos p ON ip.pedido_id = p.id
             WHERE p.negocio_id = ? AND p.estado NOT IN ('cancelado')
             GROUP BY pr.id
             ORDER BY cantidad_vendida DESC
             LIMIT 5`,
            [negocioId]
        );
        
        const totalVentas = productos.reduce((sum, p) => sum + parseFloat(p.ingresos), 0);
        
        const productosConPorcentaje = productos.map(p => ({
            ...p,
            cantidad_vendida: parseInt(p.cantidad_vendida),
            ingresos: parseFloat(p.ingresos),
            porcentaje: totalVentas > 0 ? ((p.ingresos / totalVentas) * 100).toFixed(1) : 0
        }));
        
        res.json({ success: true, data: productosConPorcentaje });
        
    } catch (error) {
        console.error('[Analytics] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

router.get('/clientes', async (req, res) => {
    try {

        const negocioId = req.negocio.id;
        
        const [clientes] = await db.execute(
            `SELECT 
                id, nombre, whatsapp, total_pedidos, total_gastado, ultimo_pedido, created_at
             FROM clientes 
             WHERE negocio_id = ?
             ORDER BY total_gastado DESC
             LIMIT 10`,
            [negocioId]
        );
        
        const hoy = new Date().toISOString().split('T')[0];
        const hace30dias = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        
        const [nuevos] = await db.execute(
            `SELECT COUNT(*) as total FROM clientes 
             WHERE negocio_id = ? AND DATE(created_at) >= ?`,
            [negocioId, hace30dias]
        );
        
        const recurrentes = clientes.filter(c => c.total_pedidos > 1).length;
        
        const top3 = clientes.slice(0, 3).map(c => ({
            nombre: c.nombre,
            whatsapp: c.whatsapp,
            total_pedidos: c.total_pedidos,
            total_gastado: parseFloat(c.total_gastado)
        }));
        
        res.json({
            success: true,
            data: {
                resumen: {
                    total_clientes: clientes.length,
                    clientes_nuevos_30d: parseInt(nuevos[0].total) || 0,
                    clientes_recurrentes: recurrentes
                },
                top_clientes: top3,
                todos: clientes.map(c => ({
                    ...c,
                    total_gastado: parseFloat(c.total_gastado)
                }))
            }
        });
        
    } catch (error) {
        console.error('[Analytics] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
});

// GET /api/analytics/alertas - Alertas y advertencias para el dashboard
router.get('/alertas', async (req, res) => {
    try {
        const negocioId = req.negocio.id;
        const alertas = [];
        const periodo = new Date().toISOString().substring(0, 7);

        // 1. Check token/message usage from agente_logs (real data)
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

        const limites = { starter: 1000, professional: 5000, enterprise: -1 };
        const limite = limites[plan];

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

        // 2. Check subscription expiry
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

        // 3. Check trial expiry
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

        // 4. Check error rate
        const [errores] = await db.execute(
            `SELECT COUNT(*) as total_errores
             FROM agente_logs
             WHERE negocio_id = ? AND DATE(created_at) = CURDATE() AND intencion = 'error'`,
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

        // 5. Plan upgrade suggestions
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
