const BotInstance = require('./BotInstance');
const db = require('../db/config');

class InstanceManager {
  constructor() {
    this.instances = new Map();
  }

  async initialize() {
    console.log('[InstanceManager] Iniciando carga de instancias...');
    try {
      const [negocios] = await db.execute(
        `SELECT * FROM negocios WHERE whatsapp_conectado = true AND activo = true`
      );

      console.log(`[InstanceManager] ${negocios.length} negocios con WhatsApp conectado`);

      for (const negocio of negocios) {
        try {
          await this.startInstance(negocio.id);
        } catch (error) {
          console.error(`[InstanceManager] Error al iniciar instancia ${negocio.id}:`, error.message);
        }
      }

      console.log(`[InstanceManager] Inicialización completada. Instancias activas: ${this.instances.size}`);
    } catch (error) {
      console.error('[InstanceManager] Error al inicializar:', error.message);
    }
  }

  async startInstance(negocioId) {
    if (this.instances.has(negocioId)) {
      console.log(`[InstanceManager] Instancia ${negocioId} ya está activa`);
      return this.getInstance(negocioId);
    }

    console.log(`[InstanceManager] Iniciando instancia para negocio ${negocioId}`);

    const [negocios] = await db.execute(
      `SELECT * FROM negocios WHERE id = ?`,
      [negocioId]
    );

    if (negocios.length === 0) {
      throw new Error(`Negocio ${negocioId} no encontrado`);
    }

    const negocio = negocios[0];
    const instance = new BotInstance(negocioId, negocio);

    await instance.start();

    this.instances.set(negocioId, instance);

    await db.execute(
      `UPDATE negocios SET whatsapp_conectado = true, whatsapp_ultima_conexion = NOW() WHERE id = ?`,
      [negocioId]
    );

    console.log(`[InstanceManager] Instancia ${negocioId} iniciada correctamente`);

    return instance;
  }

  async stopInstance(negocioId) {
    const instance = this.instances.get(negocioId);
    if (!instance) {
      console.log(`[InstanceManager] Instancia ${negocioId} no existe`);
      return false;
    }

    await instance.stop();
    this.instances.delete(negocioId);

    await db.execute(
      `UPDATE negocios SET whatsapp_conectado = false WHERE id = ?`,
      [negocioId]
    );

    console.log(`[InstanceManager] Instancia ${negocioId} detenida`);
    return true;
  }

  getInstance(negocioId) {
    return this.instances.get(negocioId);
  }

  async restartInstance(negocioId) {
    console.log(`[InstanceManager] Reiniciando instancia ${negocioId}`);
    await this.stopInstance(negocioId);
    await this.startInstance(negocioId);
  }

  getAllInstances() {
    const instances = [];
    for (const [negocioId, instance] of this.instances) {
      instances.push({
        negocioId,
        connected: instance.isConnected(),
        phone: instance.getPhoneNumber(),
        config: instance.getConfig()
      });
    }
    return instances;
  }

  getStatus(negocioId) {
    const instance = this.instances.get(negocioId);
    if (!instance) {
      return { exists: false, connected: false };
    }

    return {
      exists: true,
      connected: instance.isConnected(),
      qr: instance.getQR(),
      phone: instance.getPhoneNumber(),
      config: instance.getConfig()
    };
  }

  isConnected(negocioId) {
    const instance = this.instances.get(negocioId);
    return instance ? instance.isConnected() : false;
  }

  async sendMessage(negocioId, numero, texto) {
    const instance = this.instances.get(negocioId);
    if (!instance) {
      throw new Error('Instancia no encontrada');
    }
    return instance.sendMessage(numero, texto);
  }

  async sendButtons(negocioId, numero, texto, botones) {
    const instance = this.instances.get(negocioId);
    if (!instance) {
      throw new Error('Instancia no encontrada');
    }
    return instance.sendButtons(numero, texto, botones);
  }

  async sendImage(negocioId, numero, url, caption) {
    const instance = this.instances.get(negocioId);
    if (!instance) {
      throw new Error('Instancia no encontrada');
    }
    return instance.sendImage(numero, url, caption);
  }

  getInstanceCount() {
    return this.instances.size;
  }
}

const instanceManager = new InstanceManager();

module.exports = instanceManager;
