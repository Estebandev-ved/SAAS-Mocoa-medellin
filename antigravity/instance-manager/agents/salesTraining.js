// salesTraining.js - Sistema de entrenamiento de ventas para el bot
// Define el flujo de ventas estructurado sin margen de error

const SALES_FLOW = {
    // ========================================
    // PASO 1: SALUDO Y CALIFICACIÓN
    // ========================================
    saludo: {
        preguntas: [
            '¡Hola! Soy {bot_nombre} de {negocio_nombre}. ¿Cómo estás?',
            '¿En qué te puedo ayudar hoy?'
        ],
        objetivos: ['Generar confianza', 'Identificar necesidad'],
    },

    // ========================================
    // PASO 2: DETECCIÓN DE NECESIDAD
    // ========================================
    necesidad: {
        categorias: {
            informacion: {
                señales: ['qué es', 'cómo funciona', 'qué ofrecen', 'cuéntame', 'información', 'detalles'],
                respuesta: 'Claro, te cuento. {descripcion_negocio}',
                siguiente: 'presentar_planes',
            },
            comparar: {
                señales: ['cuál es mejor', 'comparar', 'diferencia', 'qué incluye', 'versus', 'vs'],
                respuesta: '¡Buena pregunta! Te explico las diferencias:',
                siguiente: 'comparar_planes',
            },
            precio: {
                señales: ['cuánto cuesta', 'precio', 'cuánto vale', 'costo', 'valor', 'cuánto paga'],
                respuesta: 'Nuestros planes son:',
                siguiente: 'mostrar_precios',
            },
            compra: {
                señales: ['quiero', 'me interesa', 'lo quiero', 'comprar', 'adquirir', 'contratar', 'registrarme'],
                respuesta: '¡Excelente! Para recomendarte el plan perfecto:',
                siguiente: 'calificar_cliente',
            },
            soporte: {
                señales: ['ayuda', 'problema', 'no funciona', 'error', 'soporte', 'tickets'],
                respuesta: 'Con gusto te ayudo.',
                siguiente: 'soporte',
            },
        },
    },

    // ========================================
    // PASO 3: PRESENTACIÓN DE PLANES
    // ========================================
    planes: {
        starter: {
            nombre: 'Plan Starter',
            precio: '$450,000/mes',
            ideal_para: 'Emprendedores que empiezan',
            incluye: [
                '1 número de WhatsApp',
                'Hasta 100 clientes',
                '20 productos',
                '1,000 mensajes/mes',
                'Bot de ventas con IA',
                'Reportes básicos',
            ],
            frase_venta: 'Perfecto para empezar a automatizar tus ventas sin complicaciones.',
        },
        professional: {
            nombre: 'Plan Professional',
            precio: '$850,000/mes',
            ideal_para: 'Negocios en crecimiento',
            incluye: [
                '3 números de WhatsApp',
                '500 clientes',
                'Productos ilimitados',
                '5,000 mensajes/mes',
                'Analytics avanzado',
                'Automatizaciones',
                'Multi-usuario (5)',
                'Soporte prioritario',
            ],
            frase_venta: 'Nuestro plan más popular. Incluye todo lo que necesitas para escalar.',
            es_popular: true,
        },
        enterprise: {
            nombre: 'Plan Enterprise',
            precio: '$1,800,000/mes',
            ideal_para: 'Negocios grandes y multi-sede',
            incluye: [
                'WhatsApp ilimitado',
                'Clientes ilimitados',
                'Todo ilimitado',
                'Multi-sede',
                'Integraciones (Rappi, iFood)',
                'OCR para verificar pagos',
                'Soporte 24/7',
                'Manager dedicado',
            ],
            frase_venta: 'Para negocios que quieren dominar su mercado.',
        },
    },

    // ========================================
    // PASO 4: CALIFICACIÓN DEL CLIENTE
    // ========================================
    calificacion: {
        preguntas: [
            '¿Cuántos clientes manejas al mes?',
            '¿Cuántos productos ofreces?',
            '¿Necesitas más de 1 número de WhatsApp?',
            '¿Manejas domicilios?',
        ],
        logica: {
            pocos_clientes: 'starter',
            muchos_clientes: 'professional',
            multi_numero: 'professional',
            multi_sede: 'enterprise',
            sin_limite: 'enterprise',
        },
    },

    // ========================================
    // PASO 5: MANEJO DE OBJECIONES
    // ========================================
    objeciones: {
        caro: {
            señales: ['caro', 'muy costoso', 'no tengo para eso', 'es mucho', 'no puedo'],
            respuestas: [
                'Entiendo. ¿Sabes cuánto tiempo te ahorra automatizar? Un negocio que factura $5M/mes recupera la inversión en 2 días.',
                'Es una inversión que se paga sola. Con solo 10 pedidos más al mes, ya lo cubres.',
                '¿Te gustaría empezar con el plan Starter? Es más accesible y tiene todo lo básico.',
            ],
        },
        dudoso: {
            señales: ['no sé', 'déjame pensarlo', 'no estoy seguro', 'después', 'luego'],
            respuestas: [
                'Sin presión. ¿Qué te gustaría saber para decidir?',
                'Perfecto, ¿tienes alguna duda que pueda resolver?',
                '¿Te gustaría ver una demo o probar gratis 7 días?',
            ],
        },
        no_necesita: {
            señales: ['no necesito', 'no me sirve', 'no es para mí', 'ya tengo'],
            respuestas: [
                'Entiendo. ¿Qué solución estás buscando actualmente?',
                '¿Y si te mostrara cómo puedes triplicar tus ventas con WhatsApp?',
                'Muchos clientes pensaban igual hasta que probaron. ¿Te gustaría una prueba gratuita?',
            ],
        },
        ya_tiene_bot: {
            señales: ['ya tengo bot', 'tengo otro', 'ya uso', 'tengo whatsapp business'],
            respuestas: [
                '¡Genial! ¿Qué tal te funciona? Nuestro bot se integra con lo que ya tienes.',
                'Nuestro bot es diferente: usa IA real, no solo respuestas automáticas. ¿Te gustaría ver la diferencia?',
            ],
        },
    },

    // ========================================
    // PASO 6: CIERRE Y PEDIDO
    // ========================================
    cierre: {
        senales_compra: [
            'quiero el plan',
            'me interesa el plan',
            'lo quiero',
            'contratar',
            'activar',
            'empezar',
            'registrarme',
        ],
        confirmacion: {
            paso_1: '¡Perfecto! Solo necesito confirmar unos datos:',
            paso_2: '¿Cuál es tu nombre completo?',
            paso_3: '¿Cuál es tu correo electrónico?',
            paso_4: '¿Aceptas que usemos tu información para darte el mejor servicio?',
        },
        mensaje_pedido: `✅ *Pedido confirmado*

📋 Pedido: *{numero_pedido}*
📦 Plan: *{plan_nombre}*
💰 Total: *{total}*

💳 *Métodos de pago:*
📱 Nequi: *{nequi}*
🏦 Bancolombia: *{bancolombia}*

Una vez realices el pago, envía la captura y la verificamos automáticamente. ✅`,
    },

    // ========================================
    // FLUJO COMPLETO RECOMENDADO
    // ========================================
    flujo_recomendado: `
1. SALUDO → "¡Hola! Soy {bot_nombre} de {negocio_nombre}. ¿Cómo estás?"
2. DETECTAR NECESIDAD → ¿Qué busca? (info, precio, compra, comparar)
3. PRESENTAR PLAN → Según la necesidad del cliente
4. CALIFICAR → Preguntar sobre su negocio
5. RECOMENDAR → Sugerir el plan ideal
6. MANEJAR OBJECIONES → Si tiene dudas
7. CERRAR → Confirmar pedido
8. PAGO → Enviar instrucciones
9. VERIFICAR → Confirmar pago con OCR
10. SEGUIMIENTO → Preguntar si todo está bien
    `,
};

// Función para construir el prompt de ventas
function construirPromptVentas(config) {
    let productosTexto = '';
    if (config.productos && config.productos.length > 0) {
        productosTexto = config.productos.map(p => `- ${p.nombre}: $${parseInt(p.precio).toLocaleString('es-CO')}/mes`).join('\n');
    } else {
        productosTexto = `- Starter: $450,000/mes → 1 WhatsApp, 100 clientes, 20 productos, 1,000 msgs
- Professional: $850,000/mes → 3 WhatsApp, 500 clientes, productos ilimitados, 5,000 msgs, analytics, automatizaciones
- Enterprise: $1,800,000/mes → Todo ilimitado, multi-sede, integraciones, OCR, soporte 24/7`;
    }

    let prompt = `Eres un vendedor experto de {negocio_nombre}. Tu trabajo es VENDER, no solo responder.

=== TU PRODUCTO ===
{descripcion_negocio}

=== PLANES Y PRECIOS (USA ESTOS PRECIOS EXACTOS) ===
${productosTexto}

=== FLUJO DE VENTAS OBLIGATORIO ===
1. SALUDA con nombre y buen tono
2. DETECTA qué busca el cliente (info, precio, compra, comparar)
3. Si quiere COMPRAR o muestra interés → PRESENTA TODOS LOS PLANES disponibles con precios
4. CALIFICA: pregúntale cuántos clientes maneja y cuántos productos tiene
5. RECOMENDA el plan según sus respuestas, comparando con los demás
6. Si dice que es CARO → Ofrece el plan más económico o explica el ROI
7. Si tiene DUDAS → Resuelve sin presionar
8. Si dice que SI → CONFIRMA el pedido y envía instrucciones de pago

=== REGLAS CRÍTICAS DE VENTAS ===
- SIEMPRE presenta TODOS los planes cuando el cliente pregunta por precios o muestra interés
- Compara los planes: "El Starter incluye X, el Professional incluye X + Y, el Enterprise incluye todo"
- NUNCA des un precio sin contexto. Siempre explica qué incluye
- NUNCA inventes features que no existen
- Si el cliente dice "quiero comprar" o similar, CREA EL PEDIDO inmediatamente
- Usa urgencia suave: "Los negocios que automatizan crecen 3x más rápido"
- Sé empático, no agresivo
- Responde en máximo 3-4 oraciones
- Si el cliente no responde, no insistas más de 1 vez

=== EJEMPLOS DE RESPUESTAS ===
Cliente: "Hola" → "¡Hola! Soy Kevin de Admin NOMA. ¿Te interesa automatizar tus ventas por WhatsApp?"
Cliente: "Cuánto cuesta" → "Tenemos 3 planes:\n💎 Starter: $450,000/mes (1 WhatsApp, 100 clientes)\n⭐ Professional: $850,000/mes (3 WhatsApp, 500 clientes, analytics)\n👑 Enterprise: $1,800,000/mes (todo ilimitado)\n¿Cuántos clientes manejas al mes para recomendarte el ideal?"
Cliente: "Es caro" → "Entiendo. ¿Sabes cuánto tiempo te ahorra? Un negocio que factura $5M/mes recupera la inversión en 2 días. ¿Te gustaría empezar con Starter por $450,000?"
Cliente: "Quiero el plan professional" → "¡Excelente elección! El Professional incluye 3 WhatsApp, 500 clientes y analytics avanzado. Solo necesito confirmar: ¿cuál es tu nombre completo?"
Cliente: "Déjame pensarlo" → "Sin presión. ¿Qué te gustaría saber para decidir? Puedo contarte más detalles de cada plan."
    `;

    // Replace placeholders
    prompt = prompt.replace(/{negocio_nombre}/g, config.negocio?.nombre || 'nuestro negocio');
    prompt = prompt.replace(/{descripcion_negocio}/g, config.negocio?.descripcion_negocio || '');

    return prompt;
}

module.exports = { SALES_FLOW, construirPromptVentas };
