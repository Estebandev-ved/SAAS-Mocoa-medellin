const db = require('../db/config');
const { isAutomationActive, yaSeNotifico, registrarNotificacion, enviarWhatsApp } = require('./services/automationsService');

// Scheduler liviano en proceso (mismo patrón que el setInterval de stats de
// agentes que ya existía en index.js) — sin dependencias nuevas ni un
// servicio de colas aparte. Corre cada INTERVALO_MS y, para cada negocio que
// tenga la automatización correspondiente activa, ejecuta la acción real.
//
// Todo queda detrás de automatizaciones_config.activa (apagado por defecto),
// así que si algo de esto falla o se comporta mal, el radio de impacto es
// "los negocios que explícitamente prendieron ese switch" — no todos.

const INTERVALO_MS = parseInt(process.env.SCHEDULER_INTERVAL_MS) || 5 * 60 * 1000; // 5 min

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

async function revisarRecordatoriosPago() {
    try {
        const [pedidos] = await db.execute(
            `SELECT p.id, p.negocio_id, p.numero_pedido, p.estado, p.created_at, c.whatsapp as cliente_whatsapp
             FROM pedidos p
             JOIN clientes c ON p.cliente_id = c.id
             WHERE p.estado IN ('pendiente_pago', 'pago_enviado')
             AND p.created_at <= DATE_SUB(NOW(), INTERVAL 15 MINUTE)`
        );

        for (const pedido of pedidos) {
            const { activa, config } = await isAutomationActive(pedido.negocio_id, 'recordatorio_pago');
            if (!activa) continue;

            const minutos = config.minutos || 30;
            const minutosTranscurridos = (Date.now() - new Date(pedido.created_at).getTime()) / 60000;
            if (minutosTranscurridos < minutos) continue;

            if (await yaSeNotifico(pedido.negocio_id, 'recordatorio_pago', pedido.id)) continue;

            const mensaje = config.mensaje || `Recuerda que tienes el pedido ${pedido.numero_pedido} pendiente de pago. Cualquier cosa que necesites, aquí estamos.`;
            const enviado = await enviarWhatsApp(pedido.negocio_id, pedido.cliente_whatsapp, mensaje);
            if (enviado) {
                await registrarNotificacion(
                    pedido.negocio_id, 'recordatorio_pago',
                    'Recordatorio de pago enviado',
                    `Se envió recordatorio de pago para el pedido ${pedido.numero_pedido}`,
                    pedido.id
                );
                console.log(`[Scheduler] Recordatorio de pago enviado: negocio ${pedido.negocio_id}, pedido ${pedido.numero_pedido}`);
            }
        }
    } catch (error) {
        console.error('[Scheduler] Error en revisarRecordatoriosPago:', error.code || error.message);
    }
}

async function revisarStockBajo() {
    try {
        const [productos] = await db.execute(
            `SELECT id, negocio_id, nombre, stock FROM productos WHERE activo = 1`
        );

        for (const producto of productos) {
            const { activa, config } = await isAutomationActive(producto.negocio_id, 'stock_bajo');
            if (!activa) continue;

            const umbral = config.umbral ?? 5;
            if (producto.stock > umbral) continue;

            // No repetir la misma alerta del mismo producto más de una vez al día.
            if (await yaSeNotifico(producto.negocio_id, 'stock_bajo', producto.id, 24)) continue;

            const [negocios] = await db.execute('SELECT whatsapp FROM negocios WHERE id = ?', [producto.negocio_id]);
            const numeroDueno = negocios[0]?.whatsapp;
            const mensaje = `📦 Stock bajo: "${producto.nombre}" tiene ${producto.stock} unidad(es) disponibles.`;

            const enviado = numeroDueno ? await enviarWhatsApp(producto.negocio_id, numeroDueno, mensaje) : false;
            // Aunque no haya WhatsApp del dueño configurado, igual queda el
            // registro en `notificaciones` para que se pueda ver en el dashboard.
            await registrarNotificacion(
                producto.negocio_id, 'stock_bajo',
                'Stock bajo',
                mensaje,
                producto.id,
                { enviado_whatsapp: enviado, producto_nombre: producto.nombre, stock: producto.stock }
            );
            if (enviado) {
                console.log(`[Scheduler] Alerta de stock bajo enviada: negocio ${producto.negocio_id}, producto "${producto.nombre}"`);
            }
        }
    } catch (error) {
        console.error('[Scheduler] Error en revisarStockBajo:', error.code || error.message);
    }
}

async function revisarReporteSemanal() {
    try {
        const hoy = DIAS_SEMANA[new Date().getDay()];
        const [negocios] = await db.execute(
            `SELECT DISTINCT negocio_id FROM automatizaciones_config WHERE tipo = 'reporte_semanal' AND activa = 1`
        );

        for (const { negocio_id } of negocios) {
            const { config } = await isAutomationActive(negocio_id, 'reporte_semanal');
            const diaConfigurado = config.dia || 'lunes';
            if (hoy !== diaConfigurado) continue;

            // No mandar más de un reporte por semana (usa el número de semana
            // ISO como parte de la referencia para que la comparación sea simple).
            const ahora = new Date();
            const inicioSemana = new Date(ahora);
            inicioSemana.setDate(ahora.getDate() - ahora.getDay());
            const refSemana = `${negocio_id}-${inicioSemana.toISOString().slice(0, 10)}`;

            if (await yaSeNotifico(negocio_id, 'reporte_semanal', refSemana)) continue;

            const [[resumen]] = await db.execute(
                `SELECT COUNT(*) as pedidos, COALESCE(SUM(total), 0) as ventas
                 FROM pedidos
                 WHERE negocio_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                 AND estado IN ('pago_confirmado', 'en_preparacion', 'enviado', 'entregado')`,
                [negocio_id]
            );

            const [negociosRow] = await db.execute('SELECT whatsapp, nombre FROM negocios WHERE id = ?', [negocio_id]);
            const numeroDueno = negociosRow[0]?.whatsapp;

            const mensaje = `📊 Reporte semanal de ${negociosRow[0]?.nombre || 'tu negocio'}:\n` +
                `• Pedidos: ${resumen.pedidos}\n` +
                `• Ventas: $${Number(resumen.ventas).toLocaleString('es-CO')}`;

            const enviado = numeroDueno ? await enviarWhatsApp(negocio_id, numeroDueno, mensaje) : false;
            await registrarNotificacion(negocio_id, 'reporte_semanal', 'Reporte semanal enviado', mensaje, refSemana, { enviado_whatsapp: enviado });
            if (enviado) {
                console.log(`[Scheduler] Reporte semanal enviado: negocio ${negocio_id}`);
            }
        }
    } catch (error) {
        console.error('[Scheduler] Error en revisarReporteSemanal:', error.code || error.message);
    }
}

async function revisarReengagement() {
    try {
        const [negocios] = await db.execute(
            `SELECT DISTINCT negocio_id FROM automatizaciones_config WHERE tipo = 'reengagement' AND activa = 1`
        );

        for (const { negocio_id } of negocios) {
            const { config } = await isAutomationActive(negocio_id, 'reengagement');
            const dias = config.dias || 15;

            const [clientes] = await db.execute(
                `SELECT id, whatsapp, nombre FROM clientes
                 WHERE negocio_id = ? AND ultimo_pedido IS NOT NULL
                 AND DATEDIFF(NOW(), ultimo_pedido) >= ?`,
                [negocio_id, dias]
            );

            for (const cliente of clientes) {
                // No repetir el mismo mensaje al mismo cliente más de una vez
                // por ciclo de "dias" (si sigue inactivo, vuelve a calificar
                // recién cuando pasen otros `dias` días desde el último envío).
                if (await yaSeNotifico(negocio_id, 'reengagement', cliente.id, dias * 24)) continue;

                const base = config.mensaje || '¡Te extrañamos! Hace tiempo no sabemos de ti.';
                const oferta = config.oferta ? `\n\n${config.oferta}` : '';
                const mensaje = `${base}${oferta}`;

                const enviado = await enviarWhatsApp(negocio_id, cliente.whatsapp, mensaje);
                if (enviado) {
                    await registrarNotificacion(
                        negocio_id, 'reengagement',
                        'Mensaje de reengagement enviado',
                        `Se contactó a ${cliente.nombre || cliente.whatsapp} (inactivo hace ${dias}+ días)`,
                        cliente.id
                    );
                    console.log(`[Scheduler] Reengagement enviado: negocio ${negocio_id}, cliente ${cliente.id}`);
                }
            }
        }
    } catch (error) {
        console.error('[Scheduler] Error en revisarReengagement:', error.code || error.message);
    }
}

async function tick() {
    await revisarRecordatoriosPago();
    await revisarStockBajo();
    await revisarReporteSemanal();
    await revisarReengagement();
}

function iniciarScheduler() {
    console.log(`[Scheduler] Iniciado, revisando automatizaciones cada ${INTERVALO_MS / 1000}s`);
    tick().catch(err => console.error('[Scheduler] Error en tick inicial:', err.code || err.message));
    setInterval(() => {
        tick().catch(err => console.error('[Scheduler] Error en tick:', err.code || err.message));
    }, INTERVALO_MS);
}

module.exports = { iniciarScheduler };
