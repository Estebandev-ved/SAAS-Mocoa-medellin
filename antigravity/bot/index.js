const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const messageHandler = require('./handlers/messageHandler');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const AUTH_DIR = path.join(__dirname, 'auth_info');
const RECONNECT_DELAY = 5000;

let sock = null;

async function iniciarBot() {
    try {
        if (!fs.existsSync(AUTH_DIR)) {
            fs.mkdirSync(AUTH_DIR, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

        let version = [2, 3000, 1017531287]; // Fallback version
        try {
            const latest = await fetchLatestBaileysVersion();
            version = latest.version;
            console.log(`[WhatsApp] Versión de WhatsApp Web obtenida: ${version.join('.')}`);
        } catch (err) {
            console.warn('[WhatsApp] No se pudo obtener la última versión, usando fallback:', version.join('.'));
        }

        sock = makeWASocket({
            auth: state,
            version,
            logger: pino({ level: 'silent' }),
            browser: ['ANTIGRAVITY Bot', 'Chrome', '120.0.0'],
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('[WhatsApp] Escanea este QR con tu WhatsApp:');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                let shouldReconnect = reason !== DisconnectReason.loggedOut;

                console.log('[WhatsApp] Conexión cerrada. Razón:', reason);

                if (reason === 405 || reason === DisconnectReason.loggedOut) {
                    console.log('[WhatsApp] Sesión inválida o expirada (405). Limpiando datos antiguos...');
                    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                    shouldReconnect = true;
                }

                if (shouldReconnect) {
                    console.log('[WhatsApp] Reconectando en', RECONNECT_DELAY / 1000, 'segundos...');
                    setTimeout(iniciarBot, RECONNECT_DELAY);
                }
            } else if (connection === 'open') {
                console.log('[WhatsApp] ✓ WhatsApp conectado correctamente');
            }
        });

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            console.log(`[Diagnostic] Recibido messages.upsert. Tipo: ${type}, Cantidad: ${messages.length}`);
            for (const msg of messages) {
                console.log(`[Diagnostic] Detalle msg - JID: ${msg.key.remoteJid}, deMi: ${msg.key.fromMe}, tieneMsg: ${!!msg.message}`);
                try {
                    await messageHandler.procesarMensaje(msg, sock);
                } catch (error) {
                    console.error('[WhatsApp] Error procesando mensaje:', error.message);
                }
            }
        });

        sock.ev.on('messages.update', (updates) => {
            for (const update of updates) {
                if (update.update.status === 'read' || update.update.status === 'played') {
                    console.log('[WhatsApp] Mensaje marcado como', update.update.status);
                }
            }
        });

        return sock;

    } catch (error) {
        console.error('[WhatsApp] Error al iniciar el bot:', error.message);
        setTimeout(iniciarBot, RECONNECT_DELAY);
    }
}

function obtenerSocket() {
    return sock;
}

module.exports = { iniciarBot, obtenerSocket };

if (require.main === module) {
    const port = process.env.PORT_BOT || 3001;
    iniciarBot().then(() => {
        console.log(`[Bot] Corriendo en puerto ${port}`);
    });
}
