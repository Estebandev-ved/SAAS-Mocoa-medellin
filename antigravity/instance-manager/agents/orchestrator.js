const db = require('../../db/config');
const crypto = require('crypto');
const gemini = require('./gemini');
const { checkLimit } = require('../../config/planConfig');
const { geocodificarDireccion } = require('../services/geocoding');
const { calcularCondicionesDomicilio } = require('../services/domicilioTarifa');

const LIMITES_POR_PLAN = {
    starter: { mensajes_por_minuto: 10, mensajes_por_hora: 100, tokens_por_dia: 50000 },
    professional: { mensajes_por_minuto: 20, mensajes_por_hora: 500, tokens_por_dia: 250000 },
    enterprise: { mensajes_por_minuto: 50, mensajes_por_hora: 1000, tokens_por_dia: Infinity }
};

async function procesarMensaje(mensaje, negocioId, clienteId, contexto = []) {
    const inicio = Date.now();
    
    const rateLimit = await verificarRateLimit(negocioId);
    if (!rateLimit.permitido) {
        return {
            respuesta: "Disculpa, has alcanzado el límite de mensajes. Intenta de nuevo más tarde.",
            intencion: 'rate_limit',
            agente_usado: 'none',
            datos_accion: null,
            tokens_usados: 0,
            tiempo_ms: Date.now() - inicio,
            rate_limited: true
        };
    }

    const limiteMensual = await verificarLimiteMensual(negocioId);
    if (!limiteMensual.permitido) {
        console.log(`[Orchestrator] Límite mensual excedido: ${limiteMensual.uso}/${limiteMensual.limite} (${limiteMensual.porcentaje}%)`);
        return {
            respuesta: limiteMensual.mensaje,
            intencion: 'limite_mensual',
            agente_usado: 'none',
            datos_accion: null,
            tokens_usados: 0,
            tiempo_ms: Date.now() - inicio,
            limit_exceeded: true
        };
    }
    
    const horarioValido = await verificarHorario(negocioId);
    if (!horarioValido.dentro_horario) {
        return {
            respuesta: horarioValido.mensaje_fuera_horario,
            intencion: 'fuera_horario',
            agente_usado: 'none',
            datos_accion: null,
            tokens_usados: 0,
            tiempo_ms: Date.now() - inicio
        };
    }
    
    try {
        console.log(`[Orchestrator] Llamando Gemini...`);
        const resultado = await gemini.procesarMensaje(mensaje, negocioId, clienteId, contexto);
        console.log(`[Orchestrator] Gemini respondió: ${resultado.intencion} | ${resultado.agente_usado} | tokens: ${resultado.tokens_usados}`);

        let pedidoCreado = null;
        if (resultado.datos_accion) {
            pedidoCreado = await ejecutarAccion(resultado.datos_accion, negocioId, clienteId);
        }

        await guardarLogAgente(negocioId, clienteId, resultado.intencion, resultado.agente_usado, mensaje, resultado.respuesta, resultado.tokens_usados || 0);

        // Add warning footer if usage is high
        let respuestaFinal = resultado.respuesta;
        if (limiteMensual.advertencia && limiteMensual.porcentaje >= 100) {
            respuestaFinal += `\n\n---\n_*Has alcanzado el ${limiteMensual.porcentaje}% de tu límite mensual. Actualiza tu plan para continuar sin interrupciones.*_`;
        }

        return {
            ...resultado,
            respuesta: respuestaFinal,
            pedido_creado: pedidoCreado,
            limite_mensual: limiteMensual,
        };

    } catch (error) {
        console.error(`[Orchestrator] Error: ${error.message}`);
        return {
            respuesta: 'Disculpa, tuve un problema. ¿Podrías intentarlo de nuevo?',
            intencion: 'error',
            agente_usado: 'none',
            datos_accion: null,
            tokens_usados: 0,
            tiempo_ms: Date.now() - inicio
        };
    }
}

async function verificarRateLimit(negocioId) {
    try {
        const [negocios] = await db.execute(
            'SELECT plan FROM negocios WHERE id = ?',
            [negocioId]
        );
        
        const plan = negocios[0]?.plan || 'starter';
        const limites = LIMITES_POR_PLAN[plan] || LIMITES_POR_PLAN.starter;
        
        const hoy = new Date().toISOString().split('T')[0];
        
        const [stats] = await db.execute(
            `SELECT COUNT(*) as count FROM agente_logs 
             WHERE negocio_id = ? AND DATE(created_at) = ?`,
            [negocioId, hoy]
        );
        
        const tokensHoy = stats[0]?.count || 0;
        
        if (tokensHoy >= limites.tokens_por_dia) {
            return { permitido: false, razon: 'limite_tokens_diario' };
        }
        
        return { permitido: true };

    } catch (error) {
        console.error('[Orchestrator] Error verificando rate limit:', error);
        return { permitido: true };
    }
}

async function verificarLimiteMensual(negocioId) {
    try {
        const periodo = new Date().toISOString().substring(0, 7);

        const [negocios] = await db.execute(
            'SELECT plan FROM negocios WHERE id = ?',
            [negocioId]
        );
        const plan = negocios[0]?.plan || 'starter';

        const [stats] = await db.execute(
            `SELECT COUNT(*) as mensajes
             FROM agente_logs
             WHERE negocio_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
            [negocioId, periodo]
        );
        const mensajesUsados = stats[0]?.mensajes || 0;

        const limite = checkLimit(plan, 'maxMessages', mensajesUsados);

        if (limite.limit === -1) {
            return { permitido: true, uso: 0, limite: -1, porcentaje: 0 };
        }

        const porcentaje = limite.percentage;

        // 120%+ → Bloqueado
        if (porcentaje >= 120) {
            return {
                permitido: false,
                razon: 'limite_mensual_excedido',
                uso: mensajesUsados,
                limite: limite.limit,
                porcentaje,
                mensaje: `Has alcanzado el ${porcentaje}% de tu límite mensual (${mensajesUsados}/${limite.limit} mensajes). Actualiza tu plan para continuar.`
            };
        }

        // 100-119% → Advertencia,bot sigue
        if (porcentaje >= 100) {
            return {
                permitido: true,
                advertencia: true,
                uso: mensajesUsados,
                limite: limite.limit,
                porcentaje,
                mensaje: `Has alcanzado el ${porcentaje}% de tu límite mensual. El bot funciona pero algunos mensajes pueden no ser procesados.`
            };
        }

        return {
            permitido: true,
            uso: mensajesUsados,
            limite: limite.limit,
            porcentaje
        };

    } catch (error) {
        console.error('[Orchestrator] Error verificando límite mensual:', error);
        return { permitido: true };
    }
}

async function verificarHorario(negoId) {
    try {
        const [negocios] = await db.execute(
            `SELECT horario_activo_inicio, horario_activo_fin, mensaje_fuera_horario 
             FROM negocios WHERE id = ?`,
            [negoId]
        );
        
        if (negocios.length === 0) {
            return { dentro_horario: true };
        }
        
        const negocio = negocios[0];
        
        if (!negocio.horario_activo_inicio || !negocio.horario_activo_fin) {
            return { dentro_horario: true };
        }
        
        const ahora = new Date();
        const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
        
        // Parse time strings - handle both HH:MM and HH:MM:SS formats
        const inicioStr = String(negocio.horario_activo_inicio).slice(0, 5);
        const finStr = String(negocio.horario_activo_fin).slice(0, 5);
        
        const [inicioH, inicioM] = inicioStr.split(':').map(Number);
        const [finH, finM] = finStr.split(':').map(Number);
        
        const inicioMinutos = inicioH * 60 + inicioM;
        const finMinutos = finH * 60 + finM;
        
        // Handle times that cross midnight (e.g., 8am to 12am)
        let dentroHorario;
        if (inicioMinutos <= finMinutos) {
            // Normal: e.g., 8:00 to 22:00
            dentroHorario = horaActual >= inicioMinutos && horaActual <= finMinutos;
        } else {
            // Crosses midnight: e.g., 22:00 to 8:00
            dentroHorario = horaActual >= inicioMinutos || horaActual <= finMinutos;
        }
        
        console.log(`[Orchestrator] Horario: actual=${horaActual}min, inicio=${inicioMinutos}min, fin=${finMinutos}min, dentro=${dentroHorario}`);
        
        return {
            dentro_horario: dentroHorario,
            mensaje_fuera_horario: negocio.mensaje_fuera_horario || 'Estamos fuera de horario. ¿Te contactamos mañana?'
        };

    } catch (error) {
        console.error('[Orchestrator] Error verificando horario:', error);
        return { dentro_horario: true };
    }
}

async function ejecutarAccion(datosAccion, negocioId, clienteId) {
    if (!datosAccion) return null;

    try {
        switch (datosAccion.tipo) {
            case 'crear_pedido':
                return await crearPedido(negocioId, clienteId, datosAccion);
            case 'confirmar_pago':
                return await confirmarPago(negocioId, clienteId, datosAccion);
            case 'cancelar_pedido':
                return await cancelarPedido(negocioId, datosAccion);
            default:
                console.log(`[Orchestrator] Acción: ${datosAccion.tipo}`);
                return null;
        }
    } catch (error) {
        console.error(`[Orchestrator] Error ejecutando acción ${datosAccion.tipo}:`, error);
        return null;
    }
}

async function crearPedido(negocioId, clienteId, datos) {
    if (!datos.productos || datos.productos.length === 0) return null;

    try {
        const [productosDb] = await db.execute(
            'SELECT * FROM productos WHERE negocio_id = ? AND activo = 1',
            [negocioId]
        );

        // Get payment info
        const [negocios] = await db.execute(
            'SELECT numero_nequi, numero_bancolombia, nombre, ciudad FROM negocios WHERE id = ?',
            [negocioId]
        );
        const negocio = negocios[0] || {};

        let total = 0;
        const items = [];
        let direccionEntrega = datos.direccion_entrega || null;

        for (const item of datos.productos) {
            const producto = productosDb.find(p => 
                p.id === item.producto_id || 
                p.nombre.toLowerCase().includes(item.nombre?.toLowerCase() || '')
            );
            
            if (producto) {
                const cantidad = item.cantidad || 1;
                const subtotal = producto.precio * cantidad;
                total += subtotal;
                items.push({
                    producto_id: producto.id,
                    nombre: producto.nombre,
                    cantidad,
                    precio: producto.precio,
                    subtotal
                });
            }
        }

        if (items.length === 0) return null;

        const numeroPedido = `AG-${String(negocioId).padStart(3, '0')}-${Date.now().toString().slice(-6)}`;

        const [result] = await db.execute(
            `INSERT INTO pedidos (negocio_id, cliente_id, numero_pedido, estado, subtotal, total, direccion_entrega)
             VALUES (?, ?, ?, 'pendiente_pago', ?, ?, ?)`,
            [negocioId, clienteId, numeroPedido, total, total, direccionEntrega]
        );

        for (const item of items) {
            await db.execute(
                `INSERT INTO items_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
                 VALUES (?, ?, ?, ?, ?)`,
                [result.insertId, item.producto_id, item.cantidad, item.precio, item.subtotal]
            );
        }

        await db.execute(
            'UPDATE clientes SET total_pedidos = total_pedidos + 1 WHERE id = ?',
            [clienteId]
        );

        console.log(`[Orchestrator] Pedido ${numeroPedido} creado para cliente ${clienteId}`);

        let domicilio = null;
        if (direccionEntrega) {
            // Geocodificar no debe bloquear ni tumbar la creación del pedido —
            // si falla o no hay coordenadas, el domicilio se crea igual, solo
            // sin lat/lng (la calculadora de tarifa por km y el trazado de ruta
            // simplemente no van a poder usar este pedido hasta que se resuelva
            // manualmente o el cliente reintente con una dirección más clara).
            try {
                const coords = await geocodificarDireccion(direccionEntrega, negocio.ciudad);
                if (coords) {
                    await db.execute(
                        'UPDATE pedidos SET direccion_lat = ?, direccion_lng = ? WHERE id = ?',
                        [coords.lat, coords.lng, result.insertId]
                    );
                    console.log(`[Orchestrator] Dirección geocodificada para pedido ${numeroPedido}: ${coords.lat}, ${coords.lng}`);
                } else {
                    console.warn(`[Orchestrator] No se pudo geocodificar la dirección del pedido ${numeroPedido}: "${direccionEntrega}"`);
                }
            } catch (e) {
                console.error('[Orchestrator] Error geocodificando dirección:', e.message);
            }

            domicilio = await crearDomicilioAutomatico(negocioId, result.insertId);
        }

        return {
            pedido_id: result.insertId,
            numero_pedido: numeroPedido,
            items,
            total,
            direccion_entrega: direccionEntrega,
            nequi: negocio.numero_nequi || null,
            bancolombia: negocio.numero_bancolombia || null,
            negocio_nombre: negocio.nombre || '',
            codigo_confirmacion: domicilio?.codigo_confirmacion || null,
            tracking_url: domicilio?.tracking_url || null,
        };

    } catch (error) {
        console.error('[Orchestrator] Error creando pedido:', error);
        return null;
    }
}

// Convierte el pedido recién creado en un domicilio "pendiente" listo para
// que un domiciliario lo acepte, sin que nadie del dashboard tenga que
// crearlo a mano. Se genera acá (y no solo en /domicilios/crear) porque el
// dueño del negocio nunca ve ese endpoint — el pedido nace por WhatsApp.
async function crearDomicilioAutomatico(negocioId, pedidoId) {
    try {
        const [modulos] = await db.execute(
            `SELECT config FROM negocio_modulos WHERE negocio_id = ? AND modulo_name = 'domicilios' AND activo = 1`,
            [negocioId]
        );
        if (modulos.length === 0) return null;

        let config = {};
        try {
            config = typeof modulos[0].config === 'string' ? JSON.parse(modulos[0].config) : (modulos[0].config || {});
        } catch (e) { config = {}; }

        const trackingToken = crypto.randomBytes(32).toString('hex');
        const codigoConfirmacion = String(Math.floor(1000 + Math.random() * 9000));
        const cond = await calcularCondicionesDomicilio(negocioId, pedidoId, config);

        const [result] = await db.execute(
            `INSERT INTO domicilios (negocio_id, pedido_id, estado, tarifa_envio, km_recorridos, tiempo_minutos, ruta_coords, tracking_token, codigo_confirmacion)
             VALUES (?, ?, 'pendiente', ?, ?, ?, ?, ?, ?)`,
            [negocioId, pedidoId, cond.tarifa, cond.km, cond.tiempo, cond.ruta_coords, trackingToken, codigoConfirmacion]
        );

        const trackingBase = process.env.TRACKING_BASE_URL || 'http://localhost:5177/delivery/track';

        try {
            const { emitDomicilioNuevo } = require('../socketEmitter');
            emitDomicilioNuevo(negocioId, { id: result.insertId, pedido_id: pedidoId });
        } catch (e) { /* si el bridge de sockets no está listo, no bloquea la creación */ }

        return {
            id: result.insertId,
            codigo_confirmacion: codigoConfirmacion,
            tracking_url: `${trackingBase}/${trackingToken}`,
        };
    } catch (error) {
        console.error('[Orchestrator] Error creando domicilio automático:', error.message);
        return null;
    }
}

async function confirmarPago(negocioId, clienteId, datos) {
    try {
        const [pedidos] = await db.execute(
            `SELECT id, total FROM pedidos 
             WHERE negocio_id = ? AND cliente_id = ? AND estado = 'pago_enviado'
             ORDER BY created_at DESC LIMIT 1`,
            [negocioId, clienteId]
        );

        if (pedidos.length > 0) {
            await db.execute(
                `UPDATE pedidos SET estado = 'pago_confirmado' WHERE id = ?`,
                [pedidos[0].id]
            );

            await db.execute(
                'UPDATE clientes SET total_gastado = total_gastado + ? WHERE id = ?',
                [pedidos[0].total, clienteId]
            );

            console.log(`[Orchestrator] Pago confirmado para pedido ${pedidos[0].id}`);
        }
    } catch (error) {
        console.error('[Orchestrator] Error confirmando pago:', error);
    }
}

async function cancelarPedido(negocioId, datos) {
    if (!datos.numero_pedido) return;

    try {
        await db.execute(
            `UPDATE pedidos SET estado = 'cancelado' 
             WHERE numero_pedido = ? AND negocio_id = ? AND estado NOT IN ('entregado', 'cancelado')`,
            [datos.numero_pedido, negocioId]
        );

        console.log(`[Orchestrator] Pedido ${datos.numero_pedido} cancelado`);
    } catch (error) {
        console.error('[Orchestrator] Error cancelando pedido:', error);
    }
}

async function guardarLogAgente(negocioId, clienteId, intencion, agente, mensajeEntrada, respuesta, tokens) {
    try {
        await db.execute(
            `INSERT INTO agente_logs (negocio_id, cliente_id, intencion_detectada, agente_utilizado, mensaje_entrada, respuesta_texto, tokens_usados, tiempo_respuesta_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [negocioId, clienteId, intencion, agente, mensajeEntrada, respuesta, tokens, 0]
        );
    } catch (error) {
        console.error('[Orchestrator] Error guardando log:', error);
    }
}

async function verificarPagoConImagen(imagenBase64, negocioId, totalEsperado) {
    return gemini.verificarPagoConImagen(imagenBase64, negocioId, totalEsperado);
}

module.exports = {
    procesarMensaje,
    verificarRateLimit,
    verificarHorario,
    ejecutarAccion,
    verificarPagoConImagen
};
