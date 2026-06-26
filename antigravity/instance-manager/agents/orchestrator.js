const db = require('../../db/config');
const instanceManager = require('../InstanceManager');

const crypto = require('crypto');

const BRAIN_URL = process.env.BRAIN_URL || 'http://localhost:8000';
const API_URL = process.env.API_URL || 'http://localhost:3002';
const TRACKING_BASE_URL = process.env.TRACKING_BASE_URL || 'http://localhost:5177/delivery/track';

function generarTrackingToken() {
    return crypto.randomBytes(32).toString('hex');
}

const RESPUESTAS_FALLBACK = {
    'es': "Disculpa, no pude procesar tu mensaje. ¿Podrías intentarlo de nuevo?",
    'en': "Sorry, I couldn't process your request. Please try again."
};

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
            respuesta: RESPUESTAS_FALLBACK['es'],
            intencion: 'rate_limit',
            agente_usado: 'none',
            datos_accion: null,
            tokens_usados: 0,
            tiempo_ms: Date.now() - inicio,
            rate_limited: true
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
        const response = await fetch(`${BRAIN_URL}/procesar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mensaje,
                contexto,
                negocio_id: negocioId,
                cliente_id: clienteId
            })
        });

        if (!response.ok) {
            throw new Error(`Brain API error: ${response.status}`);
        }

        const resultado = await response.json();

        await ejecutarAccion(resultado.datos_accion, negocioId, clienteId);

        let respuestaTexto = resultado.respuesta;
        if (resultado.datos_accion?.tipo === 'crear_pedido' && ultimoTrackingUrl) {
            respuestaTexto += `\n\n📦 Puedes seguir tu pedido en tiempo real aquí:\n${ultimoTrackingUrl}`;
            ultimoTrackingUrl = null;
        }

        await guardarLogAgente(negocioId, clienteId, resultado.intencion, resultado.agente_usado, mensaje, respuestaTexto, resultado.tokens_usados || 0);

        return {
            respuesta: respuestaTexto,
            intencion: resultado.intencion,
            agente_usado: resultado.agente_usado,
            datos_accion: resultado.datos_accion,
            tokens_usados: resultado.tokens_usados || 0,
            tiempo_ms: Date.now() - inicio
        };

    } catch (error) {
        console.error(`[Orchestrator] Error: ${error.message}`);
        return {
            respuesta: RESPUESTAS_FALLBACK['es'],
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
        
        const [inicioH, inicioM] = negocio.horario_activo_inicio.split(':').map(Number);
        const [finH, finM] = negocio.horario_activo_fin.split(':').map(Number);
        
        const inicioMinutos = inicioH * 60 + inicioM;
        const finMinutos = finH * 60 + finM;
        
        const dentroHorario = horaActual >= inicioMinutos && horaActual <= finMinutos;
        
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
    if (!datosAccion) return;

    try {
        switch (datosAccion.tipo) {
            case 'crear_pedido':
                await crearPedido(negocioId, clienteId, datosAccion);
                break;

            case 'confirmar_pago':
                await confirmarPago(negocioId, clienteId, datosAccion);
                break;

            case 'cancelar_pedido':
                await cancelarPedido(negocioId, datosAccion);
                break;

            case 'escalar_humano':
                await escalarAHumano(negocioId, clienteId, datosAccion);
                break;

            default:
                console.log(`[Orchestrator] Acción desconocida: ${datosAccion.tipo}`);
        }
    } catch (error) {
        console.error(`[Orchestrator] Error ejecutando acción ${datosAccion.tipo}:`, error);
    }
}

let ultimoTrackingUrl = null;

async function crearPedido(negocioId, clienteId, datos) {
    if (!datos.productos || datos.productos.length === 0) return;

    try {
        const [productosDb] = await db.execute(
            'SELECT * FROM productos WHERE negocio_id = ? AND activo = 1',
            [negocioId]
        );

        let total = 0;
        const items = [];
        let direccionEntrega = datos.direccion_entrega || datos.direccion || null;

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
                    cantidad,
                    precio: producto.precio,
                    subtotal
                });
            }
        }

        if (items.length === 0) return;

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

        const [modulos] = await db.execute(
            'SELECT activo, config FROM negocio_modulos WHERE negocio_id = ? AND modulo_name = ?',
            [negocioId, 'domicilios']
        );

        const domiciliosActivo = modulos.length > 0 && modulos[0].activo;
        ultimoTrackingUrl = null;

        if (domiciliosActivo && direccionEntrega) {
            const trackingToken = generarTrackingToken();
            const tarifaEnvio = 5000;

            await db.execute(
                `INSERT INTO domicilios (negocio_id, pedido_id, estado, tarifa_envio, tracking_token)
                 VALUES (?, ?, 'pendiente', ?, ?)`,
                [negocioId, result.insertId, tarifaEnvio, trackingToken]
            );

            ultimoTrackingUrl = `${TRACKING_BASE_URL}/${trackingToken}`;
            console.log(`[Orchestrator] Domicilio creado para pedido ${numeroPedido}: ${ultimoTrackingUrl}`);
        }

        console.log(`[Orchestrator] Pedido ${numeroPedido} creado para cliente ${clienteId}`);

    } catch (error) {
        console.error('[Orchestrator] Error creando pedido:', error);
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

async function escalarAHumano(negocioId, clienteId, datos) {
    try {
        const [negocios] = await db.execute(
            'SELECT email_dueno, nombre FROM negocios WHERE id = ?',
            [negocioId]
        );

        if (negocios.length > 0) {
            console.log(`[Orchestrator] ESCALAR A HUMANO - Negocio: ${negocios[0].nombre}, Resumen: ${datos.resumen}`);
        }

        await db.execute(
            `INSERT INTO notificaciones (negocio_id, tipo, titulo, mensaje)
             VALUES (?, 'escala_humano', 'Cliente requiere atención', ?)`,
            [negocioId, datos.resumen]
        );

    } catch (error) {
        console.error('[Orchestrator] Error escalando a humano:', error);
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
    try {
        if (!imagenBase64 || imagenBase64.length < 1000) {
            return { valido: false, error: 'Imagen muy pequeña o inválida' };
        }

        const response = await fetch(`${BRAIN_URL}/verificar-pago`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imagen_base64: imagenBase64,
                negocio_id: negocioId,
                total_esperado: totalEsperado
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Error HTTP: ${response.status}`);
        }

        const result = await response.json();
        return result;

    } catch (error) {
        console.error('[Orchestrator] Error verificando pago:', error.message);
        return { 
            valido: false, 
            error: `Error al verificar: ${error.message}. Intenta de nuevo o contacta al negocio.` 
        };
    }
}

module.exports = {
    procesarMensaje,
    verificarRateLimit,
    verificarHorario,
    ejecutarAccion,
    verificarPagoConImagen
};
