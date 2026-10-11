const path = require('path');
const { emitQR, emitConnected, emitDisconnected } = require('./socketEmitter');
const { handleMessage } = require('./handlers/messageHandler');
const { createProvider } = require('./providers');

// Un bot por negocio. La conexión con WhatsApp vive en un "proveedor" intercambiable
// (Baileys por QR, o Cloud API oficial de Meta); esta clase solo coordina estado y eventos.
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
    this.providerKind = negocioConfig.whatsapp_provider || 'baileys';
    this.cloudCredenciales = negocioConfig.cloud_credenciales || null;
    this.authPath = path.join(__dirname, '..', 'auth_info', `auth_${negocioId}`);
    this.provider = null;
    this.connected = false;
    this.phoneNumber = null;
    this.qrCode = null;
    this.stopRequested = false;
  }

  _crearProveedor() {
    const instanceManager = require('./InstanceManager');
    return createProvider(this.providerKind, {
      negocioId: this.negocioId,
      authPath: this.authPath,
      credenciales: this.cloudCredenciales,
      onMessage: (sock, msg) => handleMessage(sock, msg, this.negocioId),
      onQR: (base64) => {
        this.qrCode = base64;
        emitQR(this.negocioId, base64);
      },
      onConnected: (phone) => {
        this.connected = true;
        this.phoneNumber = phone;
        this.qrCode = null;
        instanceManager.markConnected(this.negocioId, phone);
        emitConnected(this.negocioId, phone);
      },
      onDisconnected: (sesionTerminada) => {
        this.connected = false;
        this.qrCode = null;
        instanceManager.markDisconnected(this.negocioId, sesionTerminada);
        emitDisconnected(this.negocioId);
      }
    });
  }

  async start() {
    this.stopRequested = false;
    if (!this.provider) this.provider = this._crearProveedor();
    return this.provider.start();
  }

  async stop() {
    this.stopRequested = true;
    if (this.provider) {
      await this.provider.stop().catch(() => {});
      this.provider = null;
    }
    this.connected = false;
    this.qrCode = null;
    this.phoneNumber = null;
    console.log(`[Bot-${this.negocioId}] Detenido`);
  }

  isConnected() {
    return this.connected && !!this.provider?.isReady();
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
    if (!this.isConnected()) throw new Error('Bot no está conectado');
    return this.provider.sendMessage(numero, texto);
  }

  async sendButtons(numero, texto, botones) {
    if (!this.isConnected()) throw new Error('Bot no está conectado');
    return this.provider.sendButtons(numero, texto, botones);
  }

  async sendImage(numero, url, caption) {
    if (!this.isConnected()) throw new Error('Bot no está conectado');
    return this.provider.sendImage(numero, url, caption);
  }
}

module.exports = BotInstance;
