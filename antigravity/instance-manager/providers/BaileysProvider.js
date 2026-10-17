// Proveedor WhatsApp no oficial (Baileys): conexión por QR escaneado desde el celular.
// Contrato de proveedor (lo mismo implementa CloudApiProvider):
//   constructor({ negocioId, authPath, onMessage(sock, msg), onQR(base64), onConnected(phone), onDisconnected(sesionTerminada) })
//   start() / stop() / isReady() / getPhoneNumber()
//   sendMessage(numero, texto) / sendButtons(numero, texto, botones) / sendImage(numero, url, caption)
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const QRCode = require('qrcode');

class BaileysProvider {
  constructor({ negocioId, authPath, onMessage, onQR, onConnected, onDisconnected }) {
    this.kind = 'baileys';
    this.negocioId = negocioId;
    this.authPath = authPath;
    this.onMessage = onMessage;
    this.onQR = onQR;
    this.onConnected = onConnected;
    this.onDisconnected = onDisconnected;
    this.sock = null;
    this.phoneNumber = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.stopRequested = false;
    this.credSaveInterval = null;
    this.lids = new Set(); // números que WhatsApp nos mostró como @lid (no son teléfonos)
    this.jidCache = new Map();
  }

  async start() {
    if (this.sock) {
      this.stopRequested = true;
      try { this.sock.end(undefined); } catch {}
      await new Promise(r => setTimeout(r, 500));
      this.sock = null;
    }
    if (this.credSaveInterval) clearInterval(this.credSaveInterval);

    this.stopRequested = false;

    if (!fs.existsSync(this.authPath)) {
      fs.mkdirSync(this.authPath, { recursive: true });
    }

    console.log(`[Bot-${this.negocioId}] Iniciando (baileys)...`);

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

    const sock = makeWASocket({
      auth: state,
      logger,
      browser: [`Negocio-${this.negocioId}`, 'Chrome', '120.0.0'],
      printQRInTerminal: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      maxMsgCache: 50
    });
    this.sock = sock;

    // El socket de Baileys no trae este método: lo exponemos para que el handler
    // descargue comprobantes igual con cualquier proveedor (recibe el mensaje completo).
    sock.downloadMediaMessage = (msg) =>
      downloadMediaMessage(msg, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage });

    this.credSaveInterval = setInterval(() => {
      if (this.sock) saveCreds().catch(() => {});
    }, 10_000);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (upsert) => {
      if (this.stopRequested) return;
      for (const msg of upsert.messages) {
        const rj = msg.key?.remoteJid;
        if (rj?.endsWith('@lid')) this.lids.add(rj.split('@')[0]);
        try {
          await this.onMessage(sock, msg);
        } catch (error) {
          console.error(`[Bot-${this.negocioId}] Error handleMessage:`, error.message);
        }
      }
    });

    sock.ev.on('connection.update', async (update) => {
      if (this.stopRequested) return;

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`[Bot-${this.negocioId}] QR generado`);
        try {
          const base64 = await QRCode.toDataURL(qr, { width: 400, margin: 2 });
          this.onQR(base64.replace(/^data:image\/png;base64,/, ''));
        } catch (err) {
          console.error(`[Bot-${this.negocioId}] Error QR:`, err.message);
        }
      }

      if (connection === 'open') {
        const phone = sock.user?.id?.split(':')[0] || null;
        this.phoneNumber = phone;
        this.reconnectAttempts = 0;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        console.log(`[Bot-${this.negocioId}] ✓ CONECTADO. Teléfono: ${phone}`);
        this.onConnected(phone);
      }

      if (connection === 'close') {
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        console.log(`[Bot-${this.negocioId}] Desconectado. Razón: ${reason}`);

        // Solo se borra el flag "conectado" si la sesión terminó de verdad (logout, conflicto o stop pedido);
        // una caída transitoria deja el flag para que el bot se re-encienda solo al reiniciar el servicio.
        const sesionTerminada = reason === DisconnectReason.loggedOut || reason === 440 || this.stopRequested;
        this.onDisconnected(sesionTerminada);

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
    return sock;
  }

  async stop() {
    this.stopRequested = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.credSaveInterval) { clearInterval(this.credSaveInterval); this.credSaveInterval = null; }
    if (this.sock) {
      try { this.sock.end(undefined); } catch {}
      this.sock = null;
    }
    this.phoneNumber = null;
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

  isReady() { return !!this.sock?.user; }
  getPhoneNumber() { return this.phoneNumber; }

  // El bot guarda como "teléfono" el número de un @lid cuando WhatsApp no revela el real.
  // Enviar a <lid>@s.whatsapp.net no existe y Baileys se queda esperando, así que se resuelve el JID.
  async resolverJid(numero) {
    if (numero.includes('@')) return numero;
    const digitos = numero.replace(/[^0-9]/g, '');
    if (this.lids.has(digitos)) return `${digitos}@lid`;
    if (this.jidCache.has(digitos)) return this.jidCache.get(digitos);
    let jid = `${digitos}@s.whatsapp.net`;
    try {
      const res = await this.sock.onWhatsApp(jid);
      if (res?.[0]?.exists) jid = res[0].jid;
      else if (digitos.length > 13) jid = `${digitos}@lid`; // demasiado largo para ser teléfono
      else throw new Error(`El número +${digitos} no tiene WhatsApp`);
    } catch (e) {
      if (/no tiene WhatsApp/.test(e.message)) throw e;
      // si la consulta falla, se intenta con el JID normal
    }
    this.jidCache.set(digitos, jid);
    return jid;
  }

  // Sin esto un destinatario inválido deja la petición colgada hasta que expira el timeout del API.
  async enviar(numero, contenido) {
    const jid = await this.resolverJid(numero);
    return Promise.race([
      this.sock.sendMessage(jid, contenido),
      new Promise((_, rej) => setTimeout(() => rej(new Error('WhatsApp no respondió al enviar el mensaje')), 12000))
    ]);
  }

  async sendMessage(numero, texto) {
    return this.enviar(numero, { text: texto });
  }

  async sendButtons(numero, texto, botones) {
    return this.enviar(numero, {
      text: texto,
      buttons: botones.map((b, i) => ({ buttonId: b.id || `btn_${i}`, buttonText: { displayText: b.text }, type: 1 }))
    });
  }

  async sendImage(numero, url, caption) {
    const { default: got } = require('got');
    const buffer = await got(url, { responseType: 'buffer' }).buffer();
    return this.enviar(numero, { image: buffer, caption: caption || '' });
  }
}

module.exports = BaileysProvider;
