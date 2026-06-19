// Cargar las variables de entorno de forma segura
require('dotenv').config();

// 🔒 Importar módulo de seguridad
const security = require('./security');

// Usa variables de entorno para datos sensibles
const apiKey = process.env.API_KEY || '';
const endpoint = process.env.API_ENDPOINT || '';
const pythonApiUrl = process.env.PYTHON_API_URL || 'http://127.0.0.1:5000/responder';
const nequiPhone = process.env.NEQUI_PHONE || '3208303600';

// Validar que las variables críticas estén presentes
if (!pythonApiUrl) {
  console.error('❌ PYTHON_API_URL no está configurada en .env');
  process.exit(1);
}

const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// 🧠 Estado por cada conversación (key = remoteJid)
const conversationStates = {};
const paymentKeywords = ['nequi', 'transferir', 'transferencia', 'pagar', 'cuenta'];

async function startBot() {
  const {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
  } = await import('@whiskeysockets/baileys');
  
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('❌ Se perdió la conexión:', lastDisconnect?.error?.output?.statusCode);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('✅ Bot conectado correctamente a WhatsApp');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const remoteJid = msg.key.remoteJid;
    const texto =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      '';
    const mensaje = texto.trim().toLowerCase();
    if (!mensaje && !msg.message.imageMessage) return;

    // 🔒 Verificación de seguridad (rate limiting, spam, bloqueos)
    const securityResult = security.securityCheck(remoteJid, texto);
    if (!securityResult.allowed) {
      await sock.sendMessage(remoteJid, { text: securityResult.message });
      return;
    }

    // Usar mensaje sanitizado
    const mensajeSeguro = securityResult.sanitizedText.toLowerCase();

    // 1. ¿Estamos esperando el comprobante?
    if (conversationStates[remoteJid] === 'waitingForReceipt') {
      const tieneImagen =
        !!msg.message.imageMessage ||
        !!msg.message.documentWithPreviewMessage ||
        (msg.message.documentMessage &&
          msg.message.documentMessage.mimeType &&
          msg.message.documentMessage.mimeType.startsWith('image/'));

      if (tieneImagen || mensaje.includes('comprobante')) {
        await sock.sendMessage(remoteJid, {
          text: '¡Muchas gracias! Hemos recibido tu comprobante de pago y confirmamos tu pedido. 😊',
        });
        delete conversationStates[remoteJid];
      } else {
        await sock.sendMessage(remoteJid, {
          text: 'Aún no he recibido tu comprobante. Por favor envíalo para completar tu compra. 📸',
        });
      }
      return;
    }

    // 2. Detectar si el usuario quiere pagar (Nequi o transferencia)
    const quierePagar = paymentKeywords.some((palabra) => mensajeSeguro.includes(palabra));
    if (quierePagar) {
      conversationStates[remoteJid] = 'waitingForReceipt';
      await sock.sendMessage(remoteJid, {
        text: `¡Perfecto! Por favor envía una foto del comprobante de tu pago por Nequi al ${nequiPhone} para confirmar tu pedido. 📸`,
      });
      return;
    }

    // 3. Mensajes normales: los enviamos a tu API en Python
    try {
      const respuesta = await axios.post(
        pythonApiUrl,
        { mensaje },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const respuestaBot = respuesta.data.respuesta;
      if (respuestaBot) {
        await sock.sendMessage(remoteJid, { text: respuestaBot });
      } else {
        await sock.sendMessage(remoteJid, { text: 'No se pudo obtener respuesta. Intenta de nuevo más tarde.' });
      }
    } catch (error) {
      console.error('❌ Error al conectar con la API de Python:', error.message);
      await sock.sendMessage(remoteJid, { text: 'Hubo un problema al procesar tu mensaje. Intenta de nuevo más tarde.' });
    }
  });
}

// Inicia el bot y muestra advertencia si falta configuración
startBot();

/**
 * Documentación rápida:
 * - Configura tus variables en un archivo .env (ejemplo: PYTHON_API_URL)
 * - El bot detecta intención de pago y solicita comprobante
 * - Los mensajes normales se envían a la API Python para respuesta automática
 * - Mejora la seguridad usando variables de entorno y nunca subas datos sensibles a GitHub
 */