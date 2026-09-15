/**
 * VoiceBot - Bot de Llamadas
 * Integra Twilio + STT + Clonar-voz TTS + Orchestrator (el mismo cerebro que usa WhatsApp)
 *
 * Flujo:
 * 1. Twilio recibe llamada → POST /incoming (resuelve el negocio por el número marcado)
 * 2. Twilio hace STT de lo que dice el cliente y lo manda a POST /process
 * 3. Orchestrator (instance-manager/agents/orchestrator.js) procesa con Gemini,
 *    exactamente igual que un mensaje de WhatsApp: mismo rate limit, mismo límite
 *    mensual, mismo horario, misma creación de pedidos.
 * 4. Clonar-voz genera el audio de la respuesta (TTS)
 * 5. Twilio reproduce ese audio — a través de nuestro propio proxy público,
 *    porque Twilio corre en la nube y nunca podría llegar a un Clonar-voz
 *    corriendo en localhost.
 *
 * Todo el estado de la llamada vive en MySQL (tabla `voice_calls`), no en
 * memoria del proceso — Twilio puede pegarle a /incoming y a /process como
 * peticiones HTTP independientes sin garantía de qué instancia las atiende.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const db = require('../../db/config');
const { hasFeature } = require('../../config/planConfig');
const orchestrator = require('../../instance-manager/agents/orchestrator');

// Twilio manda los webhooks como application/x-www-form-urlencoded — sin este
// middleware req.body siempre llega vacío (bug real que tenía este archivo:
// From/To/CallSid/SpeechResult eran `undefined` en cada llamada).
router.use(express.urlencoded({ extended: false }));

// Config
const CLONAR_VOZ_URL = process.env.CLONAR_VOZ_URL || 'http://127.0.0.1:8080';
const STT_PROVIDER = process.env.STT_PROVIDER || 'whisper_local'; // whisper_local | deepgram | openai
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const WHISPER_API_KEY = process.env.WHISPER_API_KEY || process.env.OPENAI_API_KEY;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
// URL pública por la que Twilio llega a este servidor (dominio real o túnel
// de ngrok). Necesaria para (a) validar la firma de Twilio contra la URL
// exacta que usó, y (b) armar la URL del audio que Twilio va a reproducir.
// Sin esto configurado, la validación de firma se hace en modo "mejor
// esfuerzo" con la URL que reporta Express, y el audio puede no ser
// alcanzable desde afuera si el server no está detrás de un dominio público.
const VOICE_PUBLIC_URL = (process.env.VOICE_PUBLIC_URL || '').replace(/\/$/, '');
const VALIDAR_FIRMA_TWILIO = process.env.TWILIO_VALIDATE_SIGNATURE !== 'false';

let twilioLib = null;
try {
    twilioLib = require('twilio');
} catch (e) {
    console.warn('[VoiceBot] Paquete "twilio" no instalado — la validación de firma de los webhooks queda desactivada. Ejecuta: npm install twilio');
}

const upload = multer({
    dest: path.join(__dirname, '../../voice-bot/temp/'),
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

// Asegurar directorio temporal
const TEMP_DIR = path.join(__dirname, '../../voice-bot/temp');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// =============================================================================
// SEGURIDAD: validar que el webhook realmente viene de Twilio
// =============================================================================

function construirUrlPublica(req) {
    if (VOICE_PUBLIC_URL) return `${VOICE_PUBLIC_URL}${req.originalUrl}`;
    // Best-effort si no configuraron VOICE_PUBLIC_URL — puede no coincidir
    // si el server está detrás de un proxy/túnel que no reescribe host/proto.
    return `${req.protocol}://${req.get('host')}${req.originalUrl}`;
}

function validarFirmaTwilio(req, res, next) {
    if (!VALIDAR_FIRMA_TWILIO) return next();
    if (!twilioLib || !TWILIO_AUTH_TOKEN) {
        // Sin librería o sin auth token no hay forma de validar — se deja
        // pasar para no tumbar el bot, pero queda registrado.
        console.warn('[VoiceBot] Validación de firma omitida (falta el paquete twilio o TWILIO_AUTH_TOKEN)');
        return next();
    }

    const firma = req.headers['x-twilio-signature'];
    const url = construirUrlPublica(req);
    const valido = twilioLib.validateRequest(TWILIO_AUTH_TOKEN, firma, url, req.body);

    if (!valido) {
        console.error(`[VoiceBot] Firma de Twilio inválida para ${url} — request rechazada`);
        return res.status(403).send('Firma inválida');
    }
    next();
}

// =============================================================================
// RESOLUCIÓN DE NEGOCIO Y CLIENTE (multi-tenant)
// =============================================================================

/**
 * Encuentra qué negocio es dueño del número de Twilio que marcaron (`To`).
 * Cada negocio tiene su propia fila en voice_bot_config con su
 * twilio_phone_number — así un mismo backend atiende las llamadas de
 * todos los negocios, igual que instance-manager atiende un WhatsApp
 * distinto por negocio.
 */
async function resolverNegocioPorNumero(to) {
    if (!to) return null;
    const numeroLimpio = String(to).replace(/\D/g, '');

    const [rows] = await db.execute(
        `SELECT vbc.*, n.nombre AS negocio_nombre, n.plan, n.numero_nequi, n.numero_bancolombia
         FROM voice_bot_config vbc
         JOIN negocios n ON n.id = vbc.negocio_id
         WHERE REPLACE(vbc.twilio_phone_number, '+', '') = ? AND vbc.habilitado = 1
         LIMIT 1`,
        [numeroLimpio]
    );

    return rows[0] || null;
}

/**
 * Busca (o crea) el cliente dueño de este teléfono, en la misma tabla
 * `clientes` que usa WhatsApp — así si alguien ya es cliente por WhatsApp
 * y llama, el bot lo reconoce como la misma persona.
 */
async function resolverOCrearCliente(negocioId, telefono) {
    const numero = String(telefono).startsWith('+') ? telefono : `+${telefono}`;

    const [existentes] = await db.execute(
        'SELECT * FROM clientes WHERE negocio_id = ? AND whatsapp = ? LIMIT 1',
        [negocioId, numero]
    );

    if (existentes.length > 0) return existentes[0];

    const nombre = `Cliente ${numero.slice(-4)}`;
    const [result] = await db.execute(
        'INSERT INTO clientes (negocio_id, nombre, whatsapp) VALUES (?, ?, ?)',
        [negocioId, nombre, numero]
    );

    return { id: result.insertId, nombre, whatsapp: numero };
}

// =============================================================================
// REGISTRO DE LLAMADAS (voice_calls)
// =============================================================================

async function registrarLlamada({ negocioId, callSid, from, to }) {
    try {
        await db.execute(
            `INSERT INTO voice_calls (negocio_id, call_sid, caller_phone, callee_phone, status, direction, start_time)
             VALUES (?, ?, ?, ?, 'in-progress', 'inbound', NOW())
             ON DUPLICATE KEY UPDATE status = 'in-progress'`,
            [negocioId, callSid, from, to]
        );
    } catch (error) {
        console.error('[VoiceBot] Error registrando llamada:', error.message);
    }
}

async function obtenerTranscript(callSid) {
    try {
        const [rows] = await db.execute('SELECT transcript FROM voice_calls WHERE call_sid = ? LIMIT 1', [callSid]);
        if (rows.length === 0 || !rows[0].transcript) return [];
        const t = rows[0].transcript;
        return typeof t === 'string' ? JSON.parse(t) : t;
    } catch (error) {
        console.error('[VoiceBot] Error leyendo transcript:', error.message);
        return [];
    }
}

async function agregarATranscript(callSid, turnos) {
    try {
        const actual = await obtenerTranscript(callSid);
        const nuevo = [...actual, ...turnos];
        await db.execute('UPDATE voice_calls SET transcript = ? WHERE call_sid = ?', [JSON.stringify(nuevo), callSid]);
    } catch (error) {
        console.error('[VoiceBot] Error guardando transcript:', error.message);
    }
}

async function superoLimiteDuracion(callSid, maxSegundos) {
    if (!maxSegundos) return false;
    try {
        const [rows] = await db.execute('SELECT start_time FROM voice_calls WHERE call_sid = ? LIMIT 1', [callSid]);
        if (rows.length === 0 || !rows[0].start_time) return false;
        const segundosTranscurridos = (Date.now() - new Date(rows[0].start_time).getTime()) / 1000;
        return segundosTranscurridos >= maxSegundos;
    } catch (error) {
        console.error('[VoiceBot] Error verificando duración de llamada:', error.message);
        return false;
    }
}

async function marcarResultadoLlamada(callSid, { pedidoId, clienteId }) {
    try {
        await db.execute(
            `UPDATE voice_calls SET converted_to_order = 1, order_id = ?, client_id = ? WHERE call_sid = ?`,
            [pedidoId, clienteId, callSid]
        );
    } catch (error) {
        console.error('[VoiceBot] Error marcando resultado de llamada:', error.message);
    }
}

// =============================================================================
// TwiML — con escape de texto (una respuesta de la IA con "&" o "<" rompía
// el XML y tumbaba la llamada) y mensajes configurables por negocio
// =============================================================================

function escaparXml(texto = '') {
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function twimlGather(mensaje, { audioUrl, actionUrl = '/api/voice/process' } = {}) {
    const say = `<Say language="es-ES" voice="Polly.Mia">${escaparXml(mensaje)}</Say>`;
    const play = audioUrl ? `<Play>${escaparXml(audioUrl)}</Play>` : '';
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" action="${actionUrl}" method="POST" language="es-CO" speechTimeout="auto">
        ${play}
        ${play ? '' : say}
    </Gather>
    <Redirect method="POST">/api/voice/gather</Redirect>
</Response>`;
}

function twimlDespedida(mensaje) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="es-ES" voice="Polly.Mia">${escaparXml(mensaje)}</Say>
    <Hangup/>
</Response>`;
}

// =============================================================================
// AUDIO — proxy público hacia Clonar-voz
//
// Twilio corre en la nube de Twilio: <Play>URL</Play> tiene que ser una URL
// que Twilio pueda alcanzar por internet. Si CLONAR_VOZ_URL apunta a
// 127.0.0.1 (el valor por defecto, para correrlo en la misma máquina que el
// API), Twilio jamás va a poder reproducir ese audio. Por eso este server
// (que SÍ es público, porque Twilio ya le pega a /incoming) baja el audio de
// Clonar-voz internamente y lo re-sirve bajo su propio dominio público.
// =============================================================================

router.get('/audio/:fileName', async (req, res) => {
    try {
        const response = await axios.get(
            `${CLONAR_VOZ_URL}/api/salidas/${req.params.fileName}`,
            { responseType: 'stream', timeout: 15000 }
        );
        res.setHeader('Content-Type', response.headers['content-type'] || 'audio/wav');
        response.data.pipe(res);
    } catch (error) {
        console.error('[VoiceBot] Error sirviendo audio proxy:', error.message);
        res.status(502).send('Audio no disponible');
    }
});

function urlPublicaDeAudio(fileName) {
    const base = VOICE_PUBLIC_URL || '';
    return `${base}/api/voice/audio/${fileName}`;
}

/**
 * Convierte audio a formato WAV usando ffmpeg
 */
async function convertToWav(inputPath) {
    const outputPath = inputPath.replace(/\.[^.]+$/, '.wav');

    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        exec(`ffmpeg -y -i "${inputPath}" -ac 1 -ar 16000 -c:a pcm_s16le "${outputPath}"`,
            (error, stdout, stderr) => {
                if (error) {
                    console.error('FFmpeg error:', stderr);
                    reject(error);
                } else {
                    resolve(outputPath);
                }
            }
        );
    });
}

/**
 * Transcribe audio - Soporta múltiples proveedores STT
 */
async function transcribeAudio(audioPath, language = 'es') {
    const provider = STT_PROVIDER;

    console.log(`🎤 STT Provider: ${provider}`);

    switch (provider) {
        case 'deepgram':
            return await transcribeWithDeepgram(audioPath, language);
        case 'openai':
            return await transcribeWithOpenAI(audioPath, language);
        case 'whisper_local':
        default:
            return await transcribeWithWhisperLocal(audioPath, language);
    }
}

/**
 * Deepgram STT - $200 crédito gratis
 * https://deepgram.com
 */
async function transcribeWithDeepgram(audioPath, language) {
    if (!DEEPGRAM_API_KEY) {
        throw new Error('DEEPGRAM_API_KEY no configurada');
    }

    const audioBuffer = fs.readFileSync(audioPath);

    const response = await axios.post(
        'https://api.deepgram.com/v1/listen',
        audioBuffer,
        {
            headers: {
                'Authorization': `Token ${DEEPGRAM_API_KEY}`,
                'Content-Type': 'audio/wav'
            },
            params: {
                language: language,
                model: 'nova-2',
                smart_format: true,
                diarize: false
            },
            timeout: 30000
        }
    );

    const result = response.data.results?.channels?.[0]?.alternatives?.[0];

    return {
        text: result?.transcript || '',
        language: language,
        confidence: result?.confidence || 0.8,
        provider: 'deepgram'
    };
}

/**
 * OpenAI Whisper API
 */
async function transcribeWithOpenAI(audioPath, language) {
    if (!WHISPER_API_KEY) {
        throw new Error('OPENAI_API_KEY no configurada');
    }

    // form-data (paquete npm), no el FormData global — necesitamos
    // .getHeaders() para el multipart boundary, que el FormData del
    // navegador/Node no tiene.
    const FormData = require('form-data');
    const formData = new FormData();
    const audioBuffer = fs.readFileSync(audioPath);
    formData.append('file', audioBuffer, {
        filename: path.basename(audioPath),
        contentType: 'audio/wav'
    });
    formData.append('model', 'whisper-1');
    formData.append('language', language);
    formData.append('response_format', 'verbose_json');

    const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
            headers: {
                'Authorization': `Bearer ${WHISPER_API_KEY}`,
                ...formData.getHeaders()
            },
            timeout: 30000
        }
    );

    return {
        text: response.data.text,
        language: response.data.language,
        confidence: response.data.segments?.[0]?.avg_logprob || 0.8,
        provider: 'openai'
    };
}

/**
 * Whisper Local - 100% gratuito, offline
 * Requiere: pip install openai-whisper
 */
async function transcribeWithWhisperLocal(audioPath, language) {
    const { execSync } = require('child_process');

    try {
        const tempDir = path.dirname(audioPath);

        const cmd = `whisper "${audioPath}" --language ${language} --model base --output_format txt --output_dir "${tempDir}"`;

        execSync(cmd, {
            timeout: 30000,
            encoding: 'utf-8',
            stdio: 'pipe'
        });

        const baseName = path.basename(audioPath, path.extname(audioPath));
        const resultFile = path.join(tempDir, `${baseName}.txt`);

        if (fs.existsSync(resultFile)) {
            const text = fs.readFileSync(resultFile, 'utf-8').trim();
            fs.unlinkSync(resultFile);

            return {
                text: text,
                language: language,
                confidence: 0.85,
                provider: 'whisper_local'
            };
        }

        throw new Error('No se generó archivo de resultado');

    } catch (error) {
        console.error('Whisper local error:', error.message);

        try {
            const pythonScript = `
import whisper
import sys
model = whisper.load_model("base")
result = model.transcribe("${audioPath}", language="${language}")
print(result["text"])
`;
            const result = execSync(`python -c "${pythonScript}"`, {
                timeout: 45000,
                encoding: 'utf-8',
                stdio: 'pipe'
            });

            return {
                text: result.trim(),
                language: language,
                confidence: 0.85,
                provider: 'whisper_local_python'
            };
        } catch (pyError) {
            throw new Error('No se pudo transcribir. Instala whisper: pip install openai-whisper');
        }
    }
}

/**
 * Genera audio usando Clonar-voz API
 */
async function generateSpeech(text, options = {}) {
    try {
        const config = {
            texto: text,
            idioma: options.language || 'es',
            dispositivo: options.device || 'auto'
        };

        if (options.voiceId) {
            config.voz = options.voiceId;
        }

        if (options.temperature) config.temp = options.temperature;
        if (options.speed) config.max_frames = Math.floor(1200 * options.speed);

        const generateResponse = await axios.post(
            `${CLONAR_VOZ_URL}/api/generar`,
            config,
            { timeout: 5000 }
        );

        const taskId = generateResponse.data.id;
        const archivo = generateResponse.data.archivo;

        return await waitForTask(taskId, archivo);

    } catch (error) {
        console.error('TTS error:', error.message);
        throw new Error('No se pudo generar el audio');
    }
}

/**
 * Espera a que termine una tarea de generación
 */
async function waitForTask(taskId, defaultFile, maxWaitMs = 30000) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(async () => {
            try {
                const response = await axios.get(
                    `${CLONAR_VOZ_URL}/api/salidas`,
                    { timeout: 5000 }
                );

                const file = response.data.find(f => f.archivo.includes(taskId));

                if (file) {
                    clearInterval(checkInterval);
                    resolve({
                        audioPath: urlPublicaDeAudio(file.archivo),
                        duration: file.duracion,
                        fileName: file.archivo
                    });
                }

                if (Date.now() - startTime > maxWaitMs) {
                    clearInterval(checkInterval);
                    reject(new Error('Timeout esperando generación de audio'));
                }

            } catch (error) {
                // Ignorar errores de polling
            }
        }, 500);
    });
}

// =============================================================================
// RUTAS
// =============================================================================

/**
 * POST /api/voice/incoming
 * Webhook de Twilio cuando entra una llamada
 */
router.post('/incoming', validarFirmaTwilio, async (req, res) => {
    try {
        const { From, To, CallSid } = req.body;
        console.log(`📞 Llamada entrante: ${From} → ${To} (${CallSid})`);

        const negocio = await resolverNegocioPorNumero(To);
        if (!negocio) {
            console.warn(`[VoiceBot] Nadie tiene configurado el número ${To} — colgando`);
            return res.type('text/xml').send(twimlDespedida('Este número no tiene un asistente configurado. Hasta pronto.'));
        }

        if (!hasFeature(negocio.plan, 'voiceBot')) {
            console.warn(`[VoiceBot] Negocio ${negocio.negocio_id} llamó pero su plan (${negocio.plan}) no incluye bot de llamadas`);
            return res.type('text/xml').send(twimlDespedida('Este servicio de asistente por voz no está disponible en este momento.'));
        }

        const horario = await orchestrator.verificarHorario(negocio.negocio_id);
        if (!horario.dentro_horario) {
            return res.type('text/xml').send(twimlDespedida(horario.mensaje_fuera_horario));
        }

        await registrarLlamada({ negocioId: negocio.negocio_id, callSid: CallSid, from: From, to: To });

        const saludo = negocio.greeting_message || '¡Hola! Soy tu asistente virtual. ¿Qué desea ordenar?';
        res.type('text/xml').send(twimlGather(saludo));

    } catch (error) {
        console.error('Error en incoming webhook:', error);
        res.type('text/xml').send(twimlDespedida('Disculpa, tuvimos un problema técnico.'));
    }
});

/**
 * POST /api/voice/process
 * Procesa la voz del usuario (recibida de Twilio Gather) usando el mismo
 * orchestrator que procesa los mensajes de WhatsApp.
 */
router.post('/process', validarFirmaTwilio, async (req, res) => {
    const { SpeechResult, Confidence, From, To, CallSid } = req.body;

    try {
        console.log(`🎤 Voz recibida: "${SpeechResult}" (confianza: ${Confidence})`);

        const negocio = await resolverNegocioPorNumero(To);
        if (!negocio) {
            return res.type('text/xml').send(twimlDespedida('Este número no tiene un asistente configurado.'));
        }

        if (await superoLimiteDuracion(CallSid, negocio.max_call_duration)) {
            const despedida = negocio.farewell_message || '¡Gracias por llamar! ¡Hasta pronto!';
            return res.type('text/xml').send(twimlDespedida(despedida));
        }

        if (!SpeechResult || SpeechResult.trim() === '') {
            const mensaje = negocio.no_response_message || 'No te escuché bien, ¿puedes repetir?';
            return res.type('text/xml').send(twimlGather(mensaje));
        }

        const cliente = await resolverOCrearCliente(negocio.negocio_id, From);
        const contextoPrevio = await obtenerTranscript(CallSid);

        // Mismo cerebro que WhatsApp: rate limit, límite mensual, horario,
        // Gemini, creación/confirmación de pedidos — todo reutilizado.
        const resultado = await orchestrator.procesarMensaje(
            SpeechResult,
            negocio.negocio_id,
            cliente.id,
            contextoPrevio
        );

        console.log(`🤖 Respuesta IA: "${resultado.respuesta}"`);

        await agregarATranscript(CallSid, [
            { rol: 'cliente', contenido: SpeechResult },
            { rol: 'negocio', contenido: resultado.respuesta },
        ]);

        if (resultado.pedido_creado) {
            await marcarResultadoLlamada(CallSid, { pedidoId: resultado.pedido_creado.pedido_id, clienteId: cliente.id });
        }

        // Genera el audio con la voz clonada del negocio (si tiene una
        // configurada) y lo sirve por nuestro proxy público.
        let audio = null;
        try {
            audio = await generateSpeech(resultado.respuesta, {
                language: negocio.language || 'es',
                voiceId: negocio.default_voice_id || undefined,
                temperature: negocio.temperature,
                speed: negocio.speed,
            });
        } catch (ttsError) {
            console.error('[VoiceBot] TTS falló, se cae a voz de Twilio:', ttsError.message);
        }

        res.type('text/xml').send(twimlGather(resultado.respuesta, { audioUrl: audio?.audioPath }));

    } catch (error) {
        console.error('Error procesando voz:', error);
        res.type('text/xml').send(twimlGather('Lo siento, hubo un error. Por favor intenta de nuevo.'));
    }
});

/**
 * POST /api/voice/gather
 * Continúa la conversación si Twilio no capturó nada en <Gather>.
 */
router.post('/gather', validarFirmaTwilio, async (req, res) => {
    try {
        const { To } = req.body;
        const negocio = await resolverNegocioPorNumero(To);
        const mensaje = negocio?.no_response_message || '¿Hay algo más en lo que pueda ayudarte?';
        res.type('text/xml').send(twimlGather(mensaje));
    } catch (error) {
        console.error('Error:', error);
        res.type('text/xml').send(twimlDespedida('Disculpa, tuvimos un problema técnico.'));
    }
});

/**
 * POST /api/voice/status-callback
 * Webhook de Twilio con el estado final de la llamada (configúralo como
 * "Status Callback URL" en la configuración del número, con los eventos
 * completed/busy/failed/no-answer). Cierra el registro en voice_calls con
 * la duración real.
 */
router.post('/status-callback', validarFirmaTwilio, async (req, res) => {
    try {
        const { CallSid, CallStatus, CallDuration } = req.body;

        const estadoValido = ['ringing', 'in-progress', 'completed', 'failed', 'busy', 'no-answer'].includes(CallStatus)
            ? CallStatus
            : 'completed';

        await db.execute(
            `UPDATE voice_calls
             SET status = ?, duration_seconds = ?, end_time = NOW()
             WHERE call_sid = ?`,
            [estadoValido, parseInt(CallDuration) || 0, CallSid]
        );

        res.sendStatus(200);
    } catch (error) {
        console.error('[VoiceBot] Error en status-callback:', error.message);
        res.sendStatus(200); // Nunca devolver error a Twilio por esto
    }
});

/**
 * POST /api/voice/text-to-speech
 * API para generar audio de texto (para pruebas o uso manual)
 */
router.post('/text-to-speech', async (req, res) => {
    try {
        const { text, voiceId, language, temperature } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Texto requerido' });
        }

        const audio = await generateSpeech(text, {
            voiceId,
            language,
            temperature
        });

        res.json({
            success: true,
            audio: audio.audioPath,
            duration: audio.duration,
            fileName: audio.fileName
        });

    } catch (error) {
        console.error('TTS error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/voice/transcribe
 * Transcribe audio (STT)
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Audio requerido' });
        }

        let audioPath = req.file.path;
        if (!req.file.originalname.endsWith('.wav')) {
            audioPath = await convertToWav(req.file.path);
        }

        const result = await transcribeAudio(audioPath, req.body.language || 'es');

        fs.unlinkSync(req.file.path);
        if (audioPath !== req.file.path) {
            fs.unlinkSync(audioPath);
        }

        res.json({
            success: true,
            transcription: result.text,
            language: result.language,
            confidence: result.confidence
        });

    } catch (error) {
        console.error('Transcription error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/voice/status
 * Estado del sistema de voz
 */
router.get('/status', async (req, res) => {
    try {
        let clonarVozStatus = { online: false };
        try {
            const response = await axios.get(`${CLONAR_VOZ_URL}/api/estado`, { timeout: 3000 });
            clonarVozStatus = {
                online: true,
                version: response.data.version,
                model: response.data.modelo_ok,
                devices: response.data.dispositivos
            };
        } catch (e) {
            clonarVozStatus = { online: false, error: e.message };
        }

        const twilioStatus = {
            configured: !!(TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER),
            phoneNumber: TWILIO_PHONE_NUMBER || 'No configurado',
            firmaValidada: VALIDAR_FIRMA_TWILIO && !!twilioLib && !!TWILIO_AUTH_TOKEN,
            urlPublicaConfigurada: !!VOICE_PUBLIC_URL,
        };

        let sttStatus = {
            provider: STT_PROVIDER,
            configured: false
        };

        switch (STT_PROVIDER) {
            case 'deepgram':
                sttStatus.configured = !!DEEPGRAM_API_KEY;
                sttStatus.info = sttStatus.configured ? 'API Key configurada' : 'DEEPGRAM_API_KEY requerida';
                break;
            case 'openai':
                sttStatus.configured = !!WHISPER_API_KEY;
                sttStatus.info = sttStatus.configured ? 'API Key configurada' : 'OPENAI_API_KEY requerida';
                break;
            case 'whisper_local':
            default:
                try {
                    const { execSync } = require('child_process');
                    execSync('whisper --help', { stdio: 'pipe', timeout: 5000 });
                    sttStatus.configured = true;
                    sttStatus.info = 'Whisper local instalado';
                } catch (e) {
                    sttStatus.configured = false;
                    sttStatus.info = 'Ejecuta: pip install openai-whisper';
                }
                break;
        }

        res.json({
            clonarVoz: clonarVozStatus,
            twilio: twilioStatus,
            stt: sttStatus
        });

    } catch (error) {
        console.error('Error checking status:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/voice/voices
 */
router.get('/voices', async (req, res) => {
    try {
        const response = await axios.get(`${CLONAR_VOZ_URL}/api/voces`, { timeout: 5000 });
        res.json(response.data);
    } catch (error) {
        res.json([]);
    }
});

/**
 * POST /api/voice/voices
 * Crear nueva voz (subir audio de referencia)
 */
router.post('/voices', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Audio requerido' });
        }

        const FormData = require('form-data');
        const formData = new FormData();
        const audioBuffer = fs.readFileSync(req.file.path);
        formData.append('audio', audioBuffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });
        formData.append('nombre', req.body.name || 'Voz personalizada');
        formData.append('transcripcion', req.body.transcription || '');

        const response = await axios.post(
            `${CLONAR_VOZ_URL}/api/voces`,
            formData,
            {
                headers: formData.getHeaders(),
                timeout: 30000
            }
        );

        fs.unlinkSync(req.file.path);

        res.json(response.data);

    } catch (error) {
        console.error('Error creating voice:', error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================================================
// CONFIGURACIÓN Y ESTADO POR NEGOCIO — para que el dashboard (o Postman,
// mientras no exista una pantalla propia) pueda prender el bot de llamadas
// para un negocio, asignarle su número de Twilio y sus mensajes.
// Requiere auth de negocio (a diferencia de los webhooks de Twilio de
// arriba, que se validan por firma, no por JWT).
// =============================================================================

const { verificarAuth } = require('../middleware/auth');

router.get('/config', verificarAuth, async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM voice_bot_config WHERE negocio_id = ?', [req.negocioId]);
        res.json(rows[0] || { habilitado: false });
    } catch (error) {
        console.error('[VoiceBot] Error obteniendo config:', error.message);
        res.status(500).json({ error: 'Error obteniendo configuración' });
    }
});

router.put('/config', verificarAuth, async (req, res) => {
    try {
        const negocioId = req.negocioId;
        const [negocios] = await db.execute('SELECT plan FROM negocios WHERE id = ?', [negocioId]);
        const plan = negocios[0]?.plan || 'starter';

        if (!hasFeature(plan, 'voiceBot')) {
            return res.status(403).json({ error: 'Tu plan actual no incluye el bot de llamadas. Actualiza a Enterprise para activarlo.' });
        }

        const {
            habilitado, twilio_phone_number, default_voice_id, language,
            temperature, speed, max_call_duration, greeting_message,
            farewell_message, no_response_message,
        } = req.body;

        const [existentes] = await db.execute('SELECT id FROM voice_bot_config WHERE negocio_id = ?', [negocioId]);

        if (existentes.length > 0) {
            await db.execute(
                `UPDATE voice_bot_config SET
                    habilitado = ?, twilio_phone_number = ?, default_voice_id = ?,
                    language = ?, temperature = ?, speed = ?, max_call_duration = ?,
                    greeting_message = ?, farewell_message = ?, no_response_message = ?
                 WHERE negocio_id = ?`,
                [
                    !!habilitado, twilio_phone_number || null, default_voice_id || null,
                    language || 'es', temperature ?? 0.8, speed ?? 1.0, max_call_duration || 300,
                    greeting_message || null, farewell_message || null, no_response_message || null,
                    negocioId,
                ]
            );
        } else {
            await db.execute(
                `INSERT INTO voice_bot_config
                    (negocio_id, habilitado, twilio_phone_number, default_voice_id, language, temperature, speed, max_call_duration, greeting_message, farewell_message, no_response_message)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    negocioId, !!habilitado, twilio_phone_number || null, default_voice_id || null,
                    language || 'es', temperature ?? 0.8, speed ?? 1.0, max_call_duration || 300,
                    greeting_message || null, farewell_message || null, no_response_message || null,
                ]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[VoiceBot] Error guardando config:', error.message);
        res.status(500).json({ error: 'Error guardando configuración' });
    }
});

/**
 * GET /api/voice/calls
 * Historial de llamadas del negocio (para un futuro panel de "Llamadas").
 */
router.get('/calls', verificarAuth, async (req, res) => {
    try {
        const limite = parseInt(req.query.limite) || 50;
        const [calls] = await db.execute(
            `SELECT id, call_sid, caller_phone, status, duration_seconds, converted_to_order, order_id, created_at
             FROM voice_calls WHERE negocio_id = ? ORDER BY created_at DESC LIMIT ?`,
            [req.negocioId, limite]
        );
        res.json(calls);
    } catch (error) {
        console.error('[VoiceBot] Error obteniendo llamadas:', error.message);
        res.status(500).json({ error: 'Error obteniendo llamadas' });
    }
});

module.exports = router;
