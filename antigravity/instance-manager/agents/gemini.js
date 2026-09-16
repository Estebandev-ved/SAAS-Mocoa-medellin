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
        return {
            negocio: negocios[0] || {},
            productos
        };
    } catch (error) {
        return { negocio: {}, productos: {} };
    }
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

async function construirAccionPedido(mensaje, config, clienteId) {
    const msg = mensaje.toLowerCase().trim();
    const productosEncontrados = [];

    // Keywords that indicate the customer wants to buy (without naming a specific product)
    const confirmacionKeywords = [
        'si', 'sí', 'dale', 'de una', 'ok', 'perfecto', 'quiero', 'me interesa',
        'contratar', 'activar', 'empezar', 'registrarme', 'lo quiero', 'tomarlo',
        'comprar', 'adquirir', 'pagar', 'confirmo', 'confirmado', 'acepto'
    ];

    // Check if it's a confirmation without product name
    const esConfirmacion = confirmacionKeywords.some(k => msg === k || msg.startsWith(k + ' ') || msg.endsWith(' ' + k));

    // First: try exact match
    for (const prod of config.productos) {
        const prodName = prod.nombre.toLowerCase();
        if (msg.includes(prodName) || msg.includes(prodName.replace('plan ', ''))) {
            productosEncontrados.push({
                producto_id: prod.id, nombre: prod.nombre, cantidad: 1, precio: prod.precio
            });
        }
    }

    // Second: try partial match (e.g., "professional" matches "Plan Professional")
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

    // Third: if it's a confirmation and no product matched, use the LAST mentioned product from context
    if (productosEncontrados.length === 0 && esConfirmacion && config.productos.length > 0) {
        // Find the last product mentioned in the conversation context
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

    if (productosEncontrados.length > 0) {
        return { tipo: 'crear_pedido', productos: productosEncontrados, cliente_id: clienteId };
    }
    return null;
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
