const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const { emitQR, emitConnected, emitDisconnected } = require('./socketEmitter');

class BotInstance {
  constructor(negocioId, negocioConfig) {
    this.negocioId = negocioId;
    this.config = {
      nombre: negocioConfig.nombre || 'Asistente',
      bot_nombre: negocioConfig.bot_nombre || 'Asistente',
      bot_tono: negocioConfig.bot_tono || 'amigable',
      bot_bienvenida: negocioConfig.bot_bienvenida || '¡Hola! ¿En qué puedo ayudarte?',
      horario_activo_inicio: negocioConfig.horario_activo_inicio || '08:00:00',
      horario_activo_fin: negocioConfig.horario_activo_fin || '22:00:00',
      mensaje_fuera_horario: negocioConfig.mensaje_fuera_horario || 'Estamos fuera de horario. ¿Te contactamos mañana?',
      numero_whatsapp: negocioConfig.numero_whatsapp,
      metodos_pago_activos: negocioConfig.metodos_pago_activos || []
    };
    this.authPath = path.join(__dirname, '..', 'auth_info', `auth_info_${negocioId}`);
    this.sock = null;
    this.connected = false;
    this.qrCode = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async start() {
    try {
      if (!fs.existsSync(this.authPath)) {
        fs.mkdirSync(this.authPath, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authPath);

      const logger = {
        level: 'info',
        info: (...args) => console.log(`[Bot-${this.negocioId}]`, ...args),
        error: (...args) => console.error(`[Bot-${this.negocioId}]`, ...args),
        warn: (...args) => console.warn(`[Bot-${this.negocioId}]`, ...args),
        debug: () => {},
        trace: () => {},
        child: () => logger
      };

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: logger,
        browser: [`ANTIGRAVITY-${this.negocioId}`, 'Chrome', '120.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrCode = qr;
          emitQR(this.negocioId, qr);
          console.log(`[Bot-${this.negocioId}] QR generado, esperando escaneo`);
        }

        if (connection === 'close') {
          const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
          const shouldReconnect = reason !== DisconnectReason.loggedOut;

          console.log(`[Bot-${this.negocioId}] Conexión cerrada. Razón: ${reason}`);

          if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[Bot-${this.negocioId}] Reconectando (intento ${this.reconnectAttempts})...`);
            setTimeout(() => this.start(), 5000);
          } else {
            this.connected = false;
            emitDisconnected(this.negocioId);
          }
        } else if (connection === 'open') {
          this.connected = true;
          this.reconnectAttempts = 0;
          console.log(`[Bot-${this.negocioId}] ✓ WhatsApp conectado`);
          emitConnected(this.negocioId);
        }
      });

      return this.sock;

    } catch (error) {
      console.error(`[Bot-${this.negocioId}] Error al iniciar:`, error.message);
      throw error;
    }
  }

  async stop() {
    try {
      if (this.sock) {
        this.sock.end(undefined);
        this.sock = null;
      }
      this.connected = false;
      this.qrCode = null;
      console.log(`[Bot-${this.negocioId}] Instancia detenida`);
    } catch (error) {
      console.error(`[Bot-${this.negocioId}] Error al detener:`, error.message);
    }
  }

  async sendMessage(numero, texto) {
    if (!this.sock || !this.connected) {
      throw new Error('Bot no conectado');
    }

    const jid = this.normalizeJid(numero);
    await this.sock.sendMessage(jid, { text: texto });
    console.log(`[Bot-${this.negocioId}] Mensaje enviado a ${numero}`);
  }

  async sendButtons(numero, texto, botones) {
    if (!this.sock || !this.connected) {
      throw new Error('Bot no conectado');
    }

    const jid = this.normalizeJid(numero);
    const buttons = botones.map(btn => ({
      buttonId: btn.id,
      buttonText: { displayText: btn.texto },
      type: 1
    }));

    await this.sock.sendMessage(jid, {
      text: texto,
      footer: this.config.nombre,
      buttons: buttons,
      headerType: 1
    });
  }

  async sendImage(numero, url, caption) {
    if (!this.sock || !this.connected) {
      throw new Error('Bot no conectado');
    }

    const jid = this.normalizeJid(numero);
    await this.sock.sendMessage(jid, {
      image: { url },
      caption: caption
    });
  }

  async sendListMessage(numero, texto, botones, titulo, pie) {
    if (!this.sock || !this.connected) {
      throw new Error('Bot no conectado');
    }

    const jid = this.normalizeJid(numero);
    const sections = [{
      title: titulo,
      rows: botones.map(btn => ({
        title: btn.texto,
        description: btn.descripcion || '',
        rowId: btn.id
      }))
    }];

    await this.sock.sendMessage(jid, {
      text: texto,
      footer: pie,
      title: titulo,
      buttonText: 'Ver opciones',
      sections
    });
  }

  isConnected() {
    return this.connected;
  }

  getQR() {
    return this.qrCode;
  }

  getConfig() {
    return this.config;
  }

  getPhoneNumber() {
    return this.config.numero_whatsapp;
  }

  normalizeJid(number) {
    if (number.includes('@g.us') || number.includes('@s.whatsapp.net')) {
      return number;
    }
    const clean = number.replace(/\D/g, '');
    return `${clean}@s.whatsapp.net`;
  }
}

module.exports = BotInstance;
