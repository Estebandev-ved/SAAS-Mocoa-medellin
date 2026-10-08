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
            `SELECT id, nombre, precio, descripcion, stock, categoria, restaurante_id
             FROM productos WHERE negocio_id = ? AND activo = 1`,
            [negocioId]
        );
        const moduloDomicilios = await obtenerModuloDomicilios(negocioId);

        // Empresa de domicilios con varios restaurantes (db/migrate_marketplace.js):
        // el modo "elige tu restaurante" se activa solo con tener filas acá, sin
        // bandera aparte que se pueda desincronizar de la realidad.
        const [restaurantes] = await db.execute(
            `SELECT id, nombre, descripcion, categoria FROM restaurantes WHERE negocio_id = ? AND activo = 1 ORDER BY nombre`,
            [negocioId]
        );

        return {
            negocio: negocios[0] || {},
            productos,
            moduloDomicilios,
            restaurantes,
        };
    } catch (error) {
        return { negocio: {}, productos: {}, moduloDomicilios: { activo: false }, restaurantes: [] };
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
    if (config.restauranteActual) {
        prompt += `\n\nEl cliente ya eligió el restaurante *${config.restauranteActual.nombre}*: todo lo que recomiendes y vendas es de ese restaurante, no de otro.`;
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

async function procesarMensaje(mensaje, negocioId, clienteId, contexto = [], conversacionId = null) {
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

        // Bloqueo suave: un negocio recién registrado que todavía no cargó su
        // catálogo (ni tiene el texto libre de "Productos y Servicios" en
        // Ajustes → Bot como respaldo) no tiene nada real que el bot pueda
        // vender. Antes el bot igual intentaba conversar con la IA sin saber
        // qué ofrecer, arriesgando inventarse productos o precios. No aplica a
        // una empresa de domicilios con restaurantes (cada uno trae su propia
        // carta, se valida más abajo en manejarFlujoRestaurante).
        const sinNadaQueVender = config.productos.length === 0
            && config.restaurantes.length === 0
            && !config.negocio.productos_servicios?.trim();
        if (sinNadaQueVender) {
            return {
                respuesta: '¡Hola! Gracias por escribirnos 🙂 Estamos terminando de configurar nuestro catálogo, muy pronto podremos atenderte por acá. Mientras tanto, contáctanos directamente si es urgente.',
                intencion: 'sin_catalogo', agente_usado: 'none', datos_accion: null, tokens_usados: 0,
                tiempo_ms: Date.now() - inicio
            };
        }

        // Empresa de domicilios con varios restaurantes: hay que saber cuál antes
        // de poder recomendar nada de su carta. Si config.restaurantes está vacío
        // (negocio de un solo local, el caso normal) esto no hace nada.
        const flujoRestaurante = await manejarFlujoRestaurante(mensaje, config, contexto, conversacionId);
        if (flujoRestaurante) return { ...flujoRestaurante, tiempo_ms: Date.now() - inicio };

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

// ===== Selección de restaurante (empresa de domicilios con varios locales) =====
// Mismo patrón que manejarFlujoDireccion: un flujo determinista, sin gastar
// tokens de IA, que resuelve el mensaje directamente o devuelve null para que
// siga el flujo normal. El restaurante elegido se guarda en la propia
// conversación (conversaciones.restaurante_id) — dura mientras esa conversación
// siga activa, igual que el resto del contexto de venta.
const CAMBIAR_RESTAURANTE_KEYWORDS = ['cambiar restaurante', 'otro restaurante', 'ver restaurantes', 'ver locales', 'menu de otro'];

function listaRestaurantesTexto(restaurantes) {
    return restaurantes
        .map((r, i) => `${i + 1}. *${r.nombre}*${r.categoria ? ` (${r.categoria})` : ''}${r.descripcion ? `\n   ${r.descripcion}` : ''}`)
        .join('\n');
}

function resolverRestauranteElegido(mensaje, restaurantes) {
    const msg = mensaje.toLowerCase().trim();

    // Por número: "2", "el 2", "opcion 2"
    const numMatch = msg.match(/\b(\d{1,2})\b/);
    if (numMatch) {
        const idx = parseInt(numMatch[1], 10) - 1;
        if (restaurantes[idx]) return restaurantes[idx];
    }

    // Por nombre, exacto o parcial
    for (const r of restaurantes) {
        if (msg.includes(r.nombre.toLowerCase())) return r;
    }
    for (const r of restaurantes) {
        const palabras = r.nombre.toLowerCase().split(' ').filter(p => p.length > 3);
        if (palabras.some(p => msg.includes(p))) return r;
    }

    return null;
}

async function manejarFlujoRestaurante(mensaje, config, contexto, conversacionId) {
    if (!config.restaurantes || config.restaurantes.length === 0) return null;

    const base = { intencion: 'consulta', agente_usado: 'ventas', tokens_usados: 0, datos_accion: null };
    const msg = mensaje.toLowerCase().trim();

    let restauranteIdActual = null;
    if (conversacionId) {
        try {
            const [rows] = await db.execute('SELECT restaurante_id FROM conversaciones WHERE id = ?', [conversacionId]);
            restauranteIdActual = rows[0]?.restaurante_id || null;
        } catch (e) { /* si falla la lectura, se trata como si no hubiera elegido todavía */ }
    }

    if (restauranteIdActual && CAMBIAR_RESTAURANTE_KEYWORDS.some(k => msg.includes(k))) {
        if (conversacionId) {
            await db.execute('UPDATE conversaciones SET restaurante_id = NULL WHERE id = ?', [conversacionId]);
        }
        restauranteIdActual = null;
    }

    if (restauranteIdActual) {
        // Ya eligió: se limita el catálogo a ese restaurante y sigue el flujo normal
        // (esta función no resuelve el mensaje, solo deja config lista).
        config.productos = config.productos.filter(p => p.restaurante_id === restauranteIdActual);
        config.restauranteActual = config.restaurantes.find(r => r.id === restauranteIdActual) || null;
        return null;
    }

    // Todavía no eligió: si el mensaje ya nombra un restaurante de la lista, se
    // guarda y se confirma sin gastar una llamada a la IA en este turno.
    const elegido = resolverRestauranteElegido(mensaje, config.restaurantes);
    if (elegido) {
        if (conversacionId) {
            await db.execute('UPDATE conversaciones SET restaurante_id = ? WHERE id = ?', [elegido.id, conversacionId]);
        }
        config.productos = config.productos.filter(p => p.restaurante_id === elegido.id);
        config.restauranteActual = elegido;
        return {
            ...base,
            respuesta: `¡Perfecto! Estás pidiendo en *${elegido.nombre}* 🍽️. Cuéntame qué se te antoja, o escribe *ver carta* para que te muestre todo.`,
        };
    }

    // No eligió todavía y no se entendió cuál: se le muestra la lista (primer
    // mensaje de la conversación, o cualquier intento que no coincidió con nada).
    return {
        ...base,
        respuesta: `¡Hola! 👋 Estos son los restaurantes disponibles hoy:\n\n${listaRestaurantesTexto(config.restaurantes)}\n\nEscríbeme el número o el nombre del que quieras.`,
    };
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

    return {
        tipo: 'crear_pedido',
        productos: productosEncontrados,
        cliente_id: clienteId,
        direccion_entrega: direccionEntrega,
        restaurante_id: config.restauranteActual?.id || null,
    };
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

// Carga rápida de catálogo: el dueño manda una foto de su carta/menú físico (o
// una lista de precios) y la IA la convierte en productos listos para revisar
// y guardar — evita tener que escribir cada plato a mano. El dueño siempre ve
// y confirma la lista extraída antes de que se guarde nada (ver
// POST /productos/importar-foto), porque la IA puede leer mal un precio o un
// nombre borroso.
async function extraerCatalogoDeImagen(imagenBase64) {
    const apiKey = getApiKey();
    if (!apiKey) {
        return { items: [], error: 'Servicio de IA no configurado' };
    }

    try {
        const instrucciones = `Esta imagen es la carta o el menú de precios de un negocio colombiano. `
            + `Identifica cada producto o servicio con su precio. Ignora textos que no sean productos `
            + `(horarios, teléfonos, promociones sin precio claro, decoración). Si un ítem tiene varias `
            + `presentaciones o tamaños con precios distintos, sepáralos en productos distintos con el `
            + `tamaño en el nombre. Agrupa por categoría usando los títulos de sección que ya traiga la `
            + `carta (Entradas, Platos fuertes, Bebidas, Postres, etc.); si no hay secciones, usa "Otros". `
            + `El precio debe ser el número final en pesos colombianos, sin puntos ni símbolo de moneda. `
            + `Responde SOLO con JSON, sin explicación ni texto adicional: `
            + `{"items": [{"nombre": "", "descripcion": "", "precio": 0, "categoria": ""}]}`;

        const body = {
            contents: [{
                parts: [
                    { text: instrucciones },
                    { inlineData: { mimeType: 'image/jpeg', data: imagenBase64 } }
                ]
            }]
        };

        const controller = new AbortController();
        // Leer una carta entera (varias secciones, muchos ítems) tarda más que
        // verificar un solo comprobante de pago — con 20-30s se cortaba antes
        // de que el modelo terminara.
        const timeout = setTimeout(() => controller.abort(), 55000);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!response.ok) return { items: [], error: 'No se pudo leer la imagen' };

        const data = await response.json();
        const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = texto.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return { items: [], error: 'No se encontraron productos en la imagen' };

        const parsed = JSON.parse(jsonMatch[0]);
        const items = Array.isArray(parsed.items) ? parsed.items : [];

        // La IA puede alucinar campos o tipos raros: se sanea acá, no se confía
        // el string crudo hasta la base de datos.
        const limpios = items
            .map((it) => ({
                nombre: (it?.nombre || '').toString().trim().slice(0, 150),
                descripcion: (it?.descripcion || '').toString().trim().slice(0, 500),
                precio: Math.max(0, Math.round(Number(it?.precio) || 0)),
                categoria: (it?.categoria || 'Otros').toString().trim().slice(0, 80),
            }))
            .filter((it) => it.nombre && it.precio > 0)
            .slice(0, 60); // una carta real no debería superar esto; evita respuestas desbordadas

        if (limpios.length === 0) return { items: [], error: 'No se encontraron productos con precio en la imagen' };
        return { items: limpios };
    } catch (error) {
        return { items: [], error: 'Error: ' + error.message };
    }
}

module.exports = { procesarMensaje, verificarPagoConImagen, extraerCatalogoDeImagen };
