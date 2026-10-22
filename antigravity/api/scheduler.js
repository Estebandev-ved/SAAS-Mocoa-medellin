const db = require('../db/config');
const { procesarCampanasPendientes, cerrarCampanasHuerfanas } = require('./services/campaignSender');
const { procesarEsperas } = require('./services/flujosEjecucion');
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

// Segundo empujón para pedidos que siguen sin pagarse tras `horas` (distinto del
// recordatorio de pago, que es el primer aviso a los pocos minutos). Si el dueño
// configuró un cupón válido, el mensaje lo incluye.
async function revisarRecuperacionPedidos() {
    try {
        const [negocios] = await db.execute(
            `SELECT DISTINCT negocio_id FROM automatizaciones_config WHERE tipo = 'recuperacion_pedido' AND activa = 1`
        );
        for (const { negocio_id } of negocios) {
            const { config } = await isAutomationActive(negocio_id, 'recuperacion_pedido');
            const horas = Number(config.horas) || 24;

            const [pedidos] = await db.execute(
                `SELECT p.id, p.numero_pedido, c.whatsapp AS cliente_whatsapp
                 FROM pedidos p JOIN clientes c ON p.cliente_id = c.id
                 WHERE p.negocio_id = ? AND p.estado = 'pendiente_pago'
                 AND p.created_at <= DATE_SUB(NOW(), INTERVAL ? HOUR)
                 AND p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
                [negocio_id, horas]
            );

            let lineaCupon = '';
            if (config.cupon) {
                try {
                    const { validarCupon, normalizarCodigo } = require('./services/cupones');
                    const [cp] = await db.execute('SELECT * FROM cupones WHERE negocio_id = ? AND codigo = ?', [negocio_id, normalizarCodigo(config.cupon)]);
                    if (cp.length > 0 && validarCupon(cp[0], Infinity).ok) {
                        lineaCupon = `

🏷️ Usa el código *${cp[0].codigo}* y te damos ${cp[0].tipo === 'porcentaje' ? `${Number(cp[0].valor)}%` : `$${Number(cp[0].valor).toLocaleString('es-CO')}`} de descuento.`;
                    }
                } catch (e) { /* sin cupones: se envía solo el mensaje */ }
            }

            for (const pedido of pedidos) {
                if (await yaSeNotifico(negocio_id, 'recuperacion_pedido', pedido.id)) continue;
                const base = config.mensaje || 'Vimos que tu pedido quedó pendiente. ¿Quieres que te ayudemos a completarlo?';
                const enviado = await enviarWhatsApp(negocio_id, pedido.cliente_whatsapp, `${base}${lineaCupon}`);
                if (enviado) {
                    await registrarNotificacion(negocio_id, 'recuperacion_pedido', 'Mensaje de recuperación enviado',
                        `Se escribió al cliente del pedido ${pedido.numero_pedido} (sin pagar hace ${horas}+ h)`, pedido.id);
                    console.log(`[Scheduler] Recuperación enviada: negocio ${negocio_id}, pedido ${pedido.numero_pedido}`);
                }
            }
        }
    } catch (error) {
        console.error('[Scheduler] Error en revisarRecuperacionPedidos:', error.code || error.message);
    }
}

// Avisa al dueño (WhatsApp + notificación del panel) 3 días y 1 día antes de que
// venza su plan o su prueba, ya que el pago es único por ciclo (sin cobro recurrente).
async function revisarRenovaciones() {
    try {
        const [negocios] = await db.execute(
            `SELECT id, nombre, whatsapp, plan, suscripcion_activa, suscripcion_inicio, suscripcion_fin, trial_hasta
             FROM negocios WHERE activo = 1 AND rol = 'negocio'`
        );
        for (const n of negocios) {
            const enTrial = !!n.trial_hasta && !n.suscripcion_inicio;
            const fin = enTrial ? n.trial_hasta : (n.suscripcion_activa ? n.suscripcion_fin : null);
            if (!fin) continue;
            const dias = Math.ceil((new Date(fin).getTime() - Date.now()) / 86400000);
            if (dias < 1 || dias > 3) continue;
            const umbral = dias === 1 ? 1 : 3;
            const ref = `${n.id}-${new Date(fin).toISOString().slice(0, 10)}-${umbral}`;
            if (await yaSeNotifico(n.id, 'renovacion_plan', ref)) continue;

            const que = enTrial ? 'tu prueba gratuita' : 'tu plan';
            const mensaje = `⏰ ${que} de ${n.nombre} vence en ${dias} día${dias === 1 ? '' : 's'}. Renuévalo desde Suscripción para que tu bot no se detenga.`;
            const enviado = n.whatsapp ? await enviarWhatsApp(n.id, n.whatsapp, mensaje) : false;
            await registrarNotificacion(n.id, 'renovacion_plan', 'Tu plan está por vencer', mensaje, ref, { dias, enviado_whatsapp: enviado });
            console.log(`[Scheduler] Aviso de renovación: negocio ${n.id}, vence en ${dias} día(s)`);
        }
    } catch (error) {
        console.error('[Scheduler] Error en revisarRenovaciones:', error.code || error.message);
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
                // `clientes.ultimo_pedido` nunca se actualizaba al crear pedidos
                // (solo lo llenaba el seed), así que se calcula desde `pedidos`.
                // Solo se contacta a quien aceptó marketing (Ley 1581).
                `SELECT c.id, c.whatsapp, c.nombre FROM clientes c
                 JOIN (SELECT cliente_id, MAX(created_at) AS ultimo
                       FROM pedidos WHERE negocio_id = ? GROUP BY cliente_id) u ON u.cliente_id = c.id
                 WHERE c.negocio_id = ? AND c.acepta_marketing = 1
                 AND DATEDIFF(NOW(), u.ultimo) >= ?`,
                [negocio_id, negocio_id, dias]
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

// No depende de que ninguna automatización esté prendida (a diferencia de
// las otras funciones de este archivo): la seguridad de los domicilios no
// es opcional una vez el módulo está activo. Dos escalones:
// 1) se pasó del tiempo límite → "retrasado" (aviso al negocio, todavía puede llegar bien)
// 2) se pasó del doble del tiempo límite y sigue sin entregarse → "en_disputa"
//    (posible pérdida/robo: bloquea al domiciliario para nuevos domicilios
//    hasta que el dueño lo revise en el panel de incidentes)
async function revisarDomiciliosVencidos() {
    try {
        const [retrasados] = await db.execute(
            `SELECT dom.id, dom.negocio_id, dom.domiciliario_id, dom.limite_entrega_at, p.numero_pedido
             FROM domicilios dom
             JOIN pedidos p ON dom.pedido_id = p.id
             WHERE dom.estado IN ('aceptado', 'en_ruta')
             AND dom.estado_incidente = 'ninguno'
             AND dom.limite_entrega_at IS NOT NULL
             AND dom.limite_entrega_at < NOW()`
        );

        for (const dom of retrasados) {
            await db.execute(`UPDATE domicilios SET estado_incidente = 'retrasado' WHERE id = ?`, [dom.id]);
            await registrarNotificacion(
                dom.negocio_id, 'domicilio_retrasado',
                'Domicilio retrasado',
                `El pedido ${dom.numero_pedido} superó el tiempo estimado de entrega.`,
                dom.id
            );
            console.log(`[Scheduler] Domicilio ${dom.id} marcado como retrasado (pedido ${dom.numero_pedido})`);
        }

        const [posiblesRobos] = await db.execute(
            `SELECT dom.id, dom.negocio_id, dom.domiciliario_id, p.numero_pedido
             FROM domicilios dom
             JOIN pedidos p ON dom.pedido_id = p.id
             WHERE dom.estado IN ('aceptado', 'en_ruta')
             AND dom.estado_incidente = 'retrasado'
             AND dom.limite_entrega_at IS NOT NULL
             AND dom.limite_entrega_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)`
        );

        for (const dom of posiblesRobos) {
            await db.execute(`UPDATE domicilios SET estado_incidente = 'en_disputa' WHERE id = ?`, [dom.id]);
            await registrarNotificacion(
                dom.negocio_id, 'domicilio_incidente',
                'Posible pérdida de domicilio',
                `El pedido ${dom.numero_pedido} lleva mucho más del tiempo estimado sin entregarse. Revísalo en el panel de incidentes.`,
                dom.id
            );
            console.log(`[Scheduler] Domicilio ${dom.id} escalado a en_disputa (pedido ${dom.numero_pedido})`);
        }
    } catch (error) {
        console.error('[Scheduler] Error en revisarDomiciliosVencidos:', error.code || error.message);
    }
}

async function tick() {
    await revisarRecordatoriosPago();
    await revisarStockBajo();
    await revisarReporteSemanal();
    await revisarReengagement();
    await revisarRecuperacionPedidos();
    await revisarRenovaciones();
    await revisarDomiciliosVencidos();
}

function iniciarScheduler() {
    console.log(`[Scheduler] Iniciado, revisando automatizaciones cada ${INTERVALO_MS / 1000}s`);
    // Campañas masivas: revisión más frecuente que el resto (cada 30 s) para
    // que "enviar ahora" y las programadas salgan casi a tiempo.
    cerrarCampanasHuerfanas().then(() => {
        procesarCampanasPendientes();
        setInterval(procesarCampanasPendientes, 30 * 1000);
        // Flujos: reanuda los pasos "espera" que ya vencieron.
        const reanudarFlujos = () => procesarEsperas(enviarWhatsApp).catch((e) => console.error('[Flujos] Error en esperas:', e.message));
        reanudarFlujos();
        setInterval(reanudarFlujos, 30 * 1000);
    });
    tick().catch(err => console.error('[Scheduler] Error en tick inicial:', err.code || err.message));
    setInterval(() => {
        tick().catch(err => console.error('[Scheduler] Error en tick:', err.code || err.message));
    }, INTERVALO_MS);
}

module.exports = { iniciarScheduler };
