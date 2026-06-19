require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const config = require('../config');

const SYSTEM_PROMPT = `Eres un asistente de ventas amigable y profesional para una tienda en Colombia. 
Tu nombre es "Asistente ANTIGRAVITY". 
Siempre responde de manera amable, concisa y en español colombiano.
Ayudas a los clientes con:
- Consultas sobre productos y precios
- Información sobre el estado de sus pedidos
- Proceso de pago
- Dudas generales

Si no entiendes algo, pide clarificación.`;

async function obtenerRespuestaIA(mensaje, contexto = []) {
    const openaiConfig = config.openai;
    
    const mensajes = [
        { role: 'system', content: SYSTEM_PROMPT }
    ];
    
    contexto.forEach(msg => {
        mensajes.push({ role: msg.role || 'user', content: msg.contenido || msg });
    });
    
    mensajes.push({ role: 'user', content: mensaje });

    // Verificar si es Azure OpenAI
    if (openaiConfig.azure && openaiConfig.azure.apiKey && openaiConfig.azure.endpoint) {
        try {
            const response = await axios.post(
                `${openaiConfig.azure.endpoint}openai/deployments/${openaiConfig.azure.deploymentName}/chat/completions?api-version=${openaiConfig.azure.apiVersion}`,
                {
                    messages: mensajes,
                    max_tokens: 500,
                    temperature: 0.7
                },
                {
                    headers: {
                        'api-key': openaiConfig.azure.apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('[Brain] Error con Azure OpenAI:', error.response?.data || error.message);
            return null;
        }
    }
    
    // Si no hay Azure, intentar con OpenAI estándar
    if (openaiConfig.apiKey) {
        try {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-3.5-turbo',
                messages: mensajes,
                max_tokens: 500,
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${openaiConfig.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('[Brain] Error con OpenAI:', error.response?.data || error.message);
            return null;
        }
    }
    
    return null;
}

function detectarIntencion(mensaje) {
    const msg = mensaje.toLowerCase();
    
    if (msg.match(/hola|buenos|buenas|saludos|qué más|cómo estás|hi|hello/i)) {
        return 'saludo';
    }
    if (msg.match(/precio|cuánto|cuesta|valor|i'm interested|me interesa|cuál es el precio/i)) {
        return 'consulta_precio';
    }
    if (msg.match(/tienen|disponible|hay|producto|inventory|catalog/i)) {
        return 'consulta_producto';
    }
    if (msg.match(/pedido|orden|comprar|quiero|ordenar|comprar|pedir|order|buy/i)) {
        return 'pedido';
    }
    if (msg.match(/pago|pagar|transferencia|nequi|bancolombia|efectivo|payment/i)) {
        return 'pago';
    }
    if (msg.match(/estado|seguimiento|dónde está|cuando llega|tracking/i)) {
        return 'consulta_estado';
    }
    
    return 'otro';
}

app.post('/procesar', async (req, res) => {
    try {
        const { mensaje, contexto, negocio_id, cliente_id } = req.body;
        
        if (!mensaje) {
            return res.status(400).json({ error: 'Mensaje requerido' });
        }
        
        const intencion = detectarIntencion(mensaje);
        
        let respuesta = await obtenerRespuestaIA(mensaje, contexto);
        
        if (!respuesta) {
            respuesta = 'Disculpa, en este momento tengo problemas técnicos. Por favor intenta más tarde o contacta directamente al negocio.';
        }
        
        // Respuestas específicas por intención si la IA no responde bien
        if (intencion === 'saludo') {
            respuesta = '¡Hola! 👋 ¡Bienvenido a nuestra tienda! ¿En qué puedo ayudarte hoy?';
        } else if (intencion === 'consulta_precio') {
            respuesta = respuesta || 'Con gusto te informo sobre nuestros precios. ¿Qué producto te interesa?';
        } else if (intencion === 'consulta_producto') {
            respuesta = respuesta || 'Tenemos muchos productos disponibles. ¿Qué estás buscando específicamente?';
        }
        
        res.json({
            intencion,
            respuesta,
            datos_pedido: null,
            confianza: 0.9
        });
        
    } catch (error) {
        console.error('[Brain] Error:', error.message);
        res.status(500).json({
            intencion: 'otro',
            respuesta: 'Disculpa, tuve un problema al procesar tu mensaje. ¿Podrías intentar de nuevo?',
            datos_pedido: null,
            confianza: 0
        });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'ANTIGRAVITY Brain' });
});

const PORT = process.env.PORT_BRAIN || 8000;

app.listen(PORT, () => {
    console.log(`[Brain] Servicio de IA corriendo en puerto ${PORT}`);
    console.log('[Brain] Listo para procesar mensajes con IA');
});

module.exports = app;
