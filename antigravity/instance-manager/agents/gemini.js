const db = require('../../db/config');
const { construirPromptVentas } = require('./salesTraining');

function getApiKey() {
    return process.env.GEMINI_API_KEY || '';
}
const MODELS = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-2.0-flash'];

const SYSTEM_PROMPT_BASE = `Eres un vendedor experto y asistente virtual para un negocio. Tu trabajo es:
- VENDER los planes del negocio (no solo responder preguntas)
- Detectar la intención del cliente y guiarlo hacia una compra
- Manejar objeciones con empatía y argumentos de valor
- Crear pedidos cuando el cliente decida comprar
- Ser amable, profesional y eficiente

FLUJO DE VENTAS OBLIGATORIO:
1. Saluda con nombre
2. Detecta qué busca (info, precio, compra, comparar)
3. Si quiere comprar → Califica: ¿cuántos clientes? ¿cuántos productos?
4. Recomienda el plan según sus respuestas
5. Si dice que es caro → Ofrece plan más accesible o explica ROI
6. Si tiene dudas → Resuelve sin presionar
7. Si dice que SÍ → Confirma pedido y envía instrucciones de pago

REGLAS CRÍTICAS:
- NUNCA inventes precios. Usa SOLO los precios de la tabla de productos
- NUNCA inventes servicios o productos que no estén listados
- Si el cliente dice "quiero comprar" o similar, CREA EL PEDIDO
- Usa urgencia suave: "Los negocios que automatizan crecen 3x más rápido"
- Sé empático, no agresivo
- Responde en máximo 3-4 oraciones
- Si el cliente no responde, no insistas más de 1 vez`;

async function obtenerConfigNegocio(negocioId) {
    try {
        const [negocios] = await db.execute(
            `SELECT nombre, bot_nombre, bot_tono, bot_bienvenida,
                    numero_nequi, numero_bancolombia,
                    descripcion_negocio, productos_servicios, info_pagos, politicas
             FROM negocios WHERE id = ?`,
            [negocioId]
        );
        const [productos] = await db.execute(
            `SELECT nombre, precio, descripcion, stock
             FROM productos WHERE negocio_id = ? AND activo = 1`,
            [negocioId]
        );
        const moduloDomicilios = await obtenerModuloDomicilios(negocioId);
        return {
            negocio: negocios[0] || {},
            productos,
            moduloDomicilios
        };
    } catch (error) {
        return { negocio: {}, productos: {}, moduloDomicilios: { activo: false } };
    }
}

async function obtenerModuloDomicilios(negocioId) {
    try {
        const [modulos] = await db.execute(
            `SELECT activo, config FROM negocio_modulos WHERE negocio_id = ? AND modulo_name = 'domicilios'`,
            [negocioId]
        );
        if (modulos.length === 0 || !modulos[0].activo) return { activo: false };
        let config = {};
        try {
            config = typeof modulos[0].config === 'string' ? JSON.parse(modulos[0].config) : (modulos[0].config || {});
        } catch (e) { config = {}; }
        return { activo: true, tarifa: config.valor_fijo || 5000, tiempoLimiteMinutos: config.tiempo_limite_minutos || 45 };
    } catch (error) {
        return { activo: false };
    }
}

// Heurística de direcciones colombianas: "Calle 45 #12-30", "Cra 8 # 20-15
// barrio San Pedro", etc. No pretende ser exhaustiva — su único trabajo es
// distinguir "esto probablemente es una dirección" de "esto es una respuesta
// de otro tipo", para no crear el pedido sin dirección ni pedirla dos veces.
function pareceDireccion(mensaje) {
    const msg = mensaje.trim();
    if (msg.length < 6) return false;
    const patrones = [
        /\b(calle|cll|cl|carrera|cra|kra|avenida|av|diagonal|diag|transversal|tv|manzana|mz|autopista)\b\.?\s*\d/i,
        /\b(barrio|apto|apartamento|casa\s*\d|torre|interior|int\.)\b/i,
    ];
    return patrones.some(r => r.test(msg));
}

async function llamarGemini(modelName, systemPrompt, historial, mensaje, apiKey) {
    const contents = [];

    for (const msg of historial) {
        contents.push({
            role: msg.rol === 'cliente' ? 'user' : 'model',
            parts: [{ text: msg.contenido }]
        });
    }

    contents.push({ role: 'user', parts: [{ text: mensaje }] });

    const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents
    };

    for (const model of (modelName ? [modelName] : MODELS)) {
        for (let intento = 0; intento < 2; intento++) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 30000);

                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                        signal: controller.signal
                    }
                );

                clearTimeout(timeout);

                if (!response.ok) {
                    const err = await response.text();
                    console.error(`[Gemini] ${model} error ${response.status}: ${err.substring(0, 100)}`);
                    if (response.status === 503 && intento < 1) {
                        console.log(`[Gemini] Reintentando ${model} en 2s...`);
                        await new Promise(r => setTimeout(r, 2000));
                        continue;
                    }
                    break; // Skip to next model
                }

                const data = await response.json();
                const texto = data.candidates?.[0]?.content?.parts?.[0]?.text;
                const tokens = data.usageMetadata?.totalTokenCount || 0;

                if (texto) {
                    return { texto, tokens, model };
                }

            } catch (error) {
                console.error(`[Gemini] ${model} fetch error (intento ${intento + 1}):`, error.message);
                if (intento < 1) {
                    console.log(`[Gemini] Reintentando ${model} en 2s...`);
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
        }
    }

    return null;
}

function construirSystemPrompt(config, contexto) {
    // Use sales training prompt as base
    let prompt = construirPromptVentas(config);

    if (config.negocio.bot_nombre) {
        prompt += `\nTu nombre es: ${config.negocio.bot_nombre}`;
    }
    if (config.negocio.bot_tono) {
        prompt += `\nTono de conversación: ${config.negocio.bot_tono}`;
    }
    if (config.negocio.numero_nequi) {
        prompt += `\n\nMedios de pago: Nequi: ${config.negocio.numero_nequi}`;
    }
    if (config.negocio.numero_bancolombia) {
        prompt += `\nBancolombia: ${config.negocio.numero_bancolombia}`;
    }
    if (config.productos.length > 0) {
        prompt += `\n\n=== PRODUCTOS DISPONIBLES ===`;
        config.productos.forEach(p => {
            prompt += `\n- ${p.nombre}: $${p.precio} COP (${p.descripcion || 'Sin descripción'})`;
        });
    }
    if (config.negocio.politicas) {
        prompt += `\n\nPolíticas: ${config.negocio.politicas}`;
    }

    if (config.moduloDomicilios?.activo) {
        prompt += `\n\n=== DOMICILIOS ===
Este negocio SÍ hace entregas a domicilio. Antes de dar por cerrado un pedido, necesitas la dirección de entrega.
- Si el cliente confirma que quiere comprar y en la conversación TODAVÍA no te ha dado su dirección, pregúntasela: "Perfecto, ¿a qué dirección lo enviamos? (barrio o punto de referencia si puedes)".
- Si el cliente ya te dio una dirección (calle/carrera/barrio) en este mensaje o en uno anterior, no la vuelvas a pedir: agradece y sigue con el resto del proceso (pago, etc).
- No digas que el pedido quedó "confirmado" o "registrado" si aún no tienes la dirección.`;
    }

    return prompt;
}

async function procesarMensaje(mensaje, negocioId, clienteId, contexto = []) {
    const apiKey = getApiKey();
    console.log(`[Gemini] procesarMensaje called. Key exists: ${!!apiKey}, length: ${apiKey.length}`);

    if (!apiKey) {
        return {
            respuesta: 'Lo siento, el servicio de IA no está configurado. Contacta al administrador.',
            intencion: 'error', agente_usado: 'none', datos_accion: null, tokens_usados: 0
        };
    }

    const inicio = Date.now();

    try {
        const config = await obtenerConfigNegocio(negocioId);
        config.contexto = contexto; // Pass conversation context for order matching

        // Flujo determinista de confirmación de dirección (no consume tokens de IA).
        const flujoDireccion = await manejarFlujoDireccion(mensaje, config, contexto, clienteId, inicio);
        if (flujoDireccion) return flujoDireccion;

        const systemPrompt = construirSystemPrompt(config, contexto);

        const result = await llamarGemini(null, systemPrompt, contexto, mensaje, apiKey);

        if (!result) {
            return {
                respuesta: 'Disculpa, el servicio de IA está temporalmente no disponible. Intenta de nuevo en un momento.',
                intencion: 'error', agente_usado: 'none', datos_accion: null, tokens_usados: 0,
                tiempo_ms: Date.now() - inicio
            };
        }

        const intencionDetectada = detectarIntencion(mensaje, result.texto);
        let datos_accion = null;

        // Try to create order if intencion is compra/pedido OR if response mentions order confirmation
        const esCompra = intencionDetectada.tipo === 'compra' || intencionDetectada.tipo === 'pedido';
        const respuestaMencionaPedido = result.texto.toLowerCase().includes('pedido') ||
            result.texto.toLowerCase().includes('registrado') ||
            result.texto.toLowerCase().includes('confirmado');

        if (esCompra || respuestaMencionaPedido) {
            datos_accion = await construirAccionPedido(mensaje, config, clienteId);
        }

        return {
            respuesta: result.texto,
            intencion: intencionDetectada.tipo,
            agente_usado: intencionDetectada.agente || 'gemini',
            datos_accion,
            tokens_usados: result.tokens,
            tiempo_ms: Date.now() - inicio
        };

    } catch (error) {
        console.error('[Gemini] Error:', error.message);
        return {
            respuesta: 'Disculpa, tuve un problema técnico. ¿Podrías intentarlo de nuevo?',
            intencion: 'error', agente_usado: 'none', datos_accion: null, tokens_usados: 0,
            tiempo_ms: Date.now() - inicio
        };
    }
}

function detectarIntencion(mensaje, respuesta) {
    const msg = mensaje.toLowerCase();
    const patrones = {
        'compra': ['quiero comprar', 'lo quiero', 'me lo llevo', 'cuanto cuesta', 'cuánto cuesta', 'precio', 'comprar', 'pedido', 'ordenar'],
        'pago': ['pague', 'pagué', 'pago', 'transferi', 'nequi', 'bancolombia', 'comprobante'],
        'consulta': ['que es', 'qué es', 'como funciona', 'tienen', 'disponibilidad', 'stock'],
        'soporte': ['ayuda', 'problema', 'no funciona', 'error', 'queja']
    };
    for (const [tipo, keywords] of Object.entries(patrones)) {
        if (keywords.some(k => msg.includes(k))) {
            const agente = tipo === 'compra' ? 'ventas' : tipo === 'pago' ? 'pago' : tipo === 'soporte' ? 'soporte' : 'gemini';
            return { tipo, agente };
        }
    }
    return { tipo: 'general', agente: 'gemini' };
}

// Keywords that indicate the customer wants to buy (without naming a specific product)
const CONFIRMACION_KEYWORDS = [
    'si', 'sí', 'dale', 'de una', 'ok', 'perfecto', 'quiero', 'me interesa',
    'contratar', 'activar', 'empezar', 'registrarme', 'lo quiero', 'tomarlo',
    'comprar', 'adquirir', 'pagar', 'confirmo', 'confirmado', 'acepto'
];

function esMensajeConfirmacion(mensaje) {
    const msg = mensaje.toLowerCase().trim();
    return CONFIRMACION_KEYWORDS.some(k => msg === k || msg.startsWith(k + ' ') || msg.endsWith(' ' + k));
}

// Busca qué producto(s) del catálogo está pidiendo el cliente: primero por
// nombre exacto, luego por coincidencia parcial de palabras, y por último —si
// el mensaje es solo una confirmación o una dirección— el último producto
// mencionado en la conversación.
function resolverProductos(mensaje, config, permitirContexto) {
    const msg = mensaje.toLowerCase().trim();
    const productosEncontrados = [];

    for (const prod of config.productos) {
        const prodName = prod.nombre.toLowerCase();
        if (msg.includes(prodName) || msg.includes(prodName.replace('plan ', ''))) {
            productosEncontrados.push({
                producto_id: prod.id, nombre: prod.nombre, cantidad: 1, precio: prod.precio
            });
        }
    }

    if (productosEncontrados.length === 0) {
        for (const prod of config.productos) {
            const palabras = prod.nombre.toLowerCase().split(' ');
            if (palabras.some(p => p.length > 3 && msg.includes(p))) {
                productosEncontrados.push({
                    producto_id: prod.id, nombre: prod.nombre, cantidad: 1, precio: prod.precio
                });
            }
        }
    }

    if (productosEncontrados.length === 0 && permitirContexto && config.productos.length > 0) {
        const contextoStr = (config.contexto || []).map(c => c.contenido || '').join(' ').toLowerCase();
        for (let i = config.productos.length - 1; i >= 0; i--) {
            const prod = config.productos[i];
            if (contextoStr.includes(prod.nombre.toLowerCase()) || contextoStr.includes(prod.nombre.toLowerCase().replace('plan ', ''))) {
                productosEncontrados.push({
                    producto_id: prod.id, nombre: prod.nombre, cantidad: 1, precio: prod.precio
                });
                break;
            }
        }
    }

    return productosEncontrados;
}

// ===== Confirmación de dirección de entrega =====
// Antes el bot tomaba lo primero que parecía dirección y creaba el pedido sin
// repetírsela al cliente. Ahora, con domicilios activos, la dirección se
// repite y hay que confirmarla con un "sí" antes de crear el pedido. El estado
// vive en el propio historial: el mensaje del bot lleva un marcador fijo, y el
// siguiente mensaje del cliente se interpreta contra él (sin columnas extra).
const MARCADOR_CONFIRMAR_DIR = '📍 Entendí esta dirección:';

function esRespuestaAfirmativa(mensaje) {
    return /^\s*(s[ií]|sip|claro|correct[oa]|exact[oa]|confirmo|confirmad[oa]|dale|de una|ok|listo|as[ií] es|perfecto|esa es)(?=$|[\s,.!¡?])/i.test(mensaje);
}

function esRespuestaNegativa(mensaje) {
    return /^\s*(no|nop|nel|incorrect[oa]|esa no|equivocad[oa]|otra)(?=$|[\s,.!¡?])/i.test(mensaje);
}

// Devuelve una respuesta ya resuelta (sin pasar por el LLM) cuando el mensaje
// pertenece al flujo de confirmación de dirección, o null si no aplica y el
// mensaje debe seguir el flujo normal.
async function manejarFlujoDireccion(mensaje, config, contexto, clienteId, inicio) {
    if (!config.moduloDomicilios?.activo) return null;

    const texto = mensaje.trim();
    const ultimoBot = [...contexto].reverse().find(m => m.rol === 'bot');
    const pendiente = ultimoBot?.contenido?.startsWith(MARCADOR_CONFIRMAR_DIR) ? ultimoBot.contenido : null;

    const base = { intencion: 'compra', agente_usado: 'ventas', tokens_usados: 0 };

    if (pendiente && esRespuestaAfirmativa(texto)) {
        const direccion = pendiente.match(/\*([^*]+)\*/)?.[1]?.trim();
        if (direccion) {
            const datos_accion = await construirAccionPedido(mensaje, config, clienteId, { direccionConfirmada: direccion });
            if (datos_accion) {
                return {
                    ...base,
                    respuesta: '¡Listo! Registrando tu pedido… 🛵',
                    datos_accion,
                    tiempo_ms: Date.now() - inicio
                };
            }
        }
        return null;
    }

    if (pendiente && esRespuestaNegativa(texto)) {
        return {
            ...base,
            respuesta: 'Sin problema 🙂 Escríbeme la dirección de nuevo (calle o carrera, número y barrio) y la confirmamos.',
            datos_accion: null,
            tiempo_ms: Date.now() - inicio
        };
    }

    // Dirección nueva (o corregida): solo si el cliente ya está en un proceso
    // de compra, para no interceptar preguntas tipo "¿están en la carrera 8?".
    if (pareceDireccion(texto) && resolverProductos(texto, config, true).length > 0) {
        const direccionLimpia = texto.replace(/\*/g, '');
        return {
            ...base,
            respuesta: `${MARCADOR_CONFIRMAR_DIR} *${direccionLimpia}*\n\n¿Es correcta? Responde *sí* para confirmar tu pedido, o escríbeme la dirección corregida (calle o carrera, número y barrio).`,
            datos_accion: null,
            tiempo_ms: Date.now() - inicio
        };
    }

    return null;
}

async function construirAccionPedido(mensaje, config, clienteId, opts = {}) {
    const requiereDomicilio = !!config.moduloDomicilios?.activo;
    // Con domicilios activos la dirección solo cuenta si el cliente ya la
    // confirmó (ver manejarFlujoDireccion); sin domicilios se conserva el
    // comportamiento anterior de tomarla del propio mensaje.
    let direccionEntrega = opts.direccionConfirmada
        || (!requiereDomicilio && pareceDireccion(mensaje) ? mensaje.trim() : null);

    const esConfirmacion = esMensajeConfirmacion(mensaje);
    const productosEncontrados = resolverProductos(mensaje, config, esConfirmacion || !!direccionEntrega);

    if (productosEncontrados.length === 0) return null;

    let direccionYaGuardada = false;
    if (requiereDomicilio && !direccionEntrega) {
        // Cliente ya recurrente: reusa la última dirección que dio, así no
        // se le vuelve a preguntar en cada pedido.
        try {
            const [clientes] = await db.execute('SELECT direccion_guardada FROM clientes WHERE id = ?', [clienteId]);
            if (clientes[0]?.direccion_guardada) {
                direccionEntrega = clientes[0].direccion_guardada;
                direccionYaGuardada = true;
            }
        } catch (e) { /* si falla, simplemente se le pregunta la dirección */ }
    }

    if (requiereDomicilio && !direccionEntrega) {
        // No creamos el pedido todavía: el prompt de ventas ya le está
        // pidiendo la dirección al cliente en su respuesta de texto. Se
        // completará en el siguiente turno cuando el cliente la mande.
        return null;
    }

    if (direccionEntrega && !direccionYaGuardada) {
        try {
            await db.execute('UPDATE clientes SET direccion_guardada = ? WHERE id = ?', [direccionEntrega, clienteId]);
        } catch (e) { /* no bloquea la creación del pedido si esto falla */ }
    }

    return { tipo: 'crear_pedido', productos: productosEncontrados, cliente_id: clienteId, direccion_entrega: direccionEntrega };
}

async function verificarPagoConImagen(imagenBase64, negocioId, totalEsperado) {
    const apiKey = getApiKey();
    if (!apiKey) {
        return { valido: false, error: 'Servicio de IA no configurado' };
    }

    try {
        const body = {
            contents: [{
                parts: [
                    { text: `Verifica si esta imagen es un comprobante de pago válido de $${totalEsperado} pesos colombianos. Responde SOLO con JSON: {"valido": true/false, "monto": 0, "banco": "nombre"}` },
                    { inlineData: { mimeType: 'image/jpeg', data: imagenBase64 } }
                ]
            }]
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!response.ok) return { valido: false, error: 'Error al verificar' };

        const data = await response.json();
        const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = texto.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { valido: false, error: 'No se pudo verificar' };

    } catch (error) {
        return { valido: false, error: 'Error: ' + error.message };
    }
}

module.exports = { procesarMensaje, verificarPagoConImagen };
