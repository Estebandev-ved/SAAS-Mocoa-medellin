const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { emitQR, emitConnected, emitDisconnected } = require('./socketEmitter');
const { handleMessage } = require('./handlers/messageHandler');

class BotInstance {
  constructor(negocioId, negocioConfig) {
    this.negocioId = negocioId;
    this.config = {
      nombre: negocioConfig.nombre || 'Negocio',
      bot_nombre: negocioConfig.bot_nombre || 'Asistente',
      bot_tono: negocioConfig.bot_tono || 'amigable',
      bot_bienvenida: negocioConfig.bot_bienvenida || '',
      horario_activo_inicio: negocioConfig.horario_activo_inicio || '08:00:00',
      horario_activo_fin: negocioConfig.horario_activo_fin || '22:00:00',
      mensaje_fuera_horario: negocioConfig.mensaje_fuera_horario || 'Estamos fuera de horario.',
      numero_whatsapp: negocioConfig.numero_whatsapp,
      metodos_pago_activos: negocioConfig.metodos_pago_activos || []
    };
    this.authPath = path.join(__dirname, '..', 'auth_info', `auth_${negocioId}`);
    this.sock = null;
    this.connected = false;
    this.phoneNumber = null;
    this.qrCode = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.stopRequested = false;
    this.credSaveInterval = null;
  }

  async start() {
    if (this.sock) {
      this.stopRequested = true;
      try { this.sock.end(undefined); } catch {}
      // Wait for socket to fully close
      await new Promise(r => setTimeout(r, 500));
      this.sock = null;
    }

    this.stopRequested = false;

    if (!fs.existsSync(this.authPath)) {
      fs.mkdirSync(this.authPath, { recursive: true });
    }

    console.log(`[Bot-${this.negocioId}] Iniciando...`);

    const { state, saveCreds } = await useMultiFileAuthState(this.authPath);

    const logger = {
      level: 'silent',
      info: () => {},
      error: (...args) => console.error(`[Bot-${this.negocioId}] ERR:`, ...args),
      warn: (...args) => console.warn(`[Bot-${this.negocioId}] WARN:`, ...args),
      debug: () => {},
      trace: () => {},
      child: () => logger
    };

    this.sock = makeWASocket({
      auth: state,
      logger,
      browser: [`Negocio-${this.negocioId}`, 'Chrome', '120.0.0'],
      printQRInTerminal: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      maxMsgCache: 50
    });

    this.credSaveInterval = setInterval(() => {
      if (this.sock) saveCreds().catch(() => {});
    }, 10_000);

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('messages.upsert', async (upsert) => {
      if (this.stopRequested) return;
      for (const msg of upsert.messages) {
        try {
          await handleMessage(this.sock, msg, this.negocioId);
        } catch (error) {
          console.error(`[Bot-${this.negocioId}] Error handleMessage:`, error.message);
        }
      }
    });

    this.sock.ev.on('connection.update', async (update) => {
      if (this.stopRequested) return;

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`[Bot-${this.negocioId}] QR generado`);
        try {
          const base64 = await QRCode.toDataURL(qr, { width: 400, margin: 2 });
          this.qrCode = base64.replace(/^data:image\/png;base64,/, '');
          emitQR(this.negocioId, this.qrCode);
        } catch (err) {
          console.error(`[Bot-${this.negocioId}] Error QR:`, err.message);
        }
      }

      if (connection === 'open') {
        const phone = this.sock?.user?.id?.split(':')[0] || null;
        this.connected = true;
        this.phoneNumber = phone;
        this.qrCode = null;
        this.reconnectAttempts = 0;

        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        console.log(`[Bot-${this.negocioId}] ✓ CONECTADO. Teléfono: ${phone}`);

        const instanceManager = require('./InstanceManager');
        instanceManager.markConnected(this.negocioId, phone);

        emitConnected(this.negocioId, phone);
      }

      if (connection === 'close') {
        this.connected = false;
        this.qrCode = null;

        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        console.log(`[Bot-${this.negocioId}] Desconectado. Razón: ${reason}`);

        const instanceManager = require('./InstanceManager');
        instanceManager.markDisconnected(this.negocioId);

        emitDisconnected(this.negocioId);

        if (reason === DisconnectReason.loggedOut) {
          console.log(`[Bot-${this.negocioId}] Logout - eliminando auth`);
          this.limpiarAuth();
        } else if (reason === 440) {
          console.log(`[Bot-${this.negocioId}] Conflicto (reemplazado). Limpiando auth y esperando reconnect desde dashboard.`);
          this.limpiarAuth();
        } else if (!this.stopRequested) {
          this.reconnectAttempts++;
          const delayMs = Math.min(5000 * this.reconnectAttempts, 60000);
          console.log(`[Bot-${this.negocioId}] Reconectando en ${delayMs / 1000}s (intento ${this.reconnectAttempts})`);
          this.reconnectTimer = setTimeout(() => {
            if (!this.stopRequested) this.start();
          }, delayMs);
        }
      }
    });

    console.log(`[Bot-${this.negocioId}] Socket creado, esperando conexión...`);
    return this.sock;
  }

  async stop() {
    this.stopRequested = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.credSaveInterval) {
      clearInterval(this.credSaveInterval);
      this.credSaveInterval = null;
    }

    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch (e) {}
      this.sock = null;
    }

    this.connected = false;
    this.qrCode = null;
    this.phoneNumber = null;

    console.log(`[Bot-${this.negocioId}] Detenido`);
  }

  limpiarAuth() {
    try {
      if (fs.existsSync(this.authPath)) {
        fs.rmSync(this.authPath, { recursive: true, force: true });
        console.log(`[Bot-${this.negocioId}] Auth eliminado`);
      }
    } catch (error) {
      console.error(`[Bot-${this.negocioId}] Error limpiando auth:`, error.message);
    }
  }

  isConnected() {
    return this.connected && this.sock?.user;
  }

  getPhoneNumber() {
    return this.phoneNumber;
  }

  getQR() {
    return this.qrCode;
  }

  getConfig() {
    return this.config;
  }

  async sendMessage(numero, texto) {
    if (!this.isConnected()) {
      throw new Error('Bot no está conectado');
    }
    const jid = numero.includes('@') ? numero : `${numero.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    return this.sock.sendMessage(jid, { text: texto });
  }

  async sendButtons(numero, texto, botones) {
    if (!this.isConnected()) throw new Error('Bot no está conectado');
    const jid = numero.includes('@') ? numero : `${numero.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    return this.sock.sendMessage(jid, {
      text: texto,
      buttons: botones.map((b, i) => ({ buttonId: b.id || `btn_${i}`, buttonText: { displayText: b.text }, type: 1 }))
    });
  }

  async sendImage(numero, url, caption) {
    if (!this.isConnected()) throw new Error('Bot no está conectado');
    const jid = numero.includes('@') ? numero : `${numero.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    const { default: got } = require('got');
    const buffer = await got(url, { responseType: 'buffer' }).buffer();
    return this.sock.sendMessage(jid, { image: buffer, caption: caption || '' });
  }
}

module.exports = BotInstance;
