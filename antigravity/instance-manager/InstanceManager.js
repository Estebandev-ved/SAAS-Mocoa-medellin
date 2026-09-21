const BotInstance = require('./BotInstance');
const db = require('../db/config');

class InstanceManager {
  constructor() {
    this.instances = new Map();
    this.startLocks = new Set();
  }

  async initialize() {
    console.log('[InstanceManager] Iniciando...');
    try {
      const [negocios] = await db.execute(
        `SELECT id, nombre FROM negocios WHERE whatsapp_conectado = true AND activo = true`
      );

      console.log(`[InstanceManager] ${negocios.length} negocios con flag conectado`);

      for (const negocio of negocios) {
        try {
          await this.startInstance(negocio.id);
          await new Promise(r => setTimeout(r, 2000));
        } catch (error) {
          console.error(`[InstanceManager] Error negocio ${negocio.id}:`, error.message);
          await db.execute(
            `UPDATE negocios SET whatsapp_conectado = false WHERE id = ?`,
            [negocio.id]
          );
        }
      }

      console.log(`[InstanceManager] Listo. Instancias activas: ${this.instances.size}`);
    } catch (error) {
      console.error('[InstanceManager] Error init:', error.message);
    }
  }

  async startInstance(negocioId) {
    if (this.instances.has(negocioId)) {
      const existing = this.instances.get(negocioId);
      if (existing.connected) {
        console.log(`[InstanceManager] Negocio ${negocioId} ya tiene instancia activa`);
        return existing;
      }
      // Instance exists but not connected — stop old and recreate
      console.log(`[InstanceManager] Negocio ${negocioId} tiene instancia desconectada, recreando...`);
      await this.stopInstance(negocioId);
    }

    if (this.startLocks.has(negocioId)) {
      console.log(`[InstanceManager] Negocio ${negocioId} está iniciando...`);
      return null;
    }

    this.startLocks.add(negocioId);

    try {
      console.log(`[InstanceManager] Iniciando negocio ${negocioId}...`);

      const [negocios] = await db.execute(
        `SELECT id, nombre, bot_nombre, bot_tono, bot_bienvenida,
                horario_activo_inicio, horario_activo_fin, mensaje_fuera_horario,
                numero_whatsapp, metodos_pago_activos
         FROM negocios WHERE id = ? AND activo = 1`,
        [negocioId]
      );

      if (negocios.length === 0) {
        throw new Error(`Negocio ${negocioId} no encontrado o inactivo`);
      }

      const negocio = negocios[0];
      const instance = new BotInstance(negocioId, negocio);

      await instance.start();

      this.instances.set(negocioId, instance);

      console.log(`[InstanceManager] Negocio ${negocioId} (${negocio.nombre}) iniciado`);

      return instance;

    } catch (error) {
      console.error(`[InstanceManager] Error iniciando ${negocioId}:`, error.message);
      throw error;
    } finally {
      this.startLocks.delete(negocioId);
    }
  }

  async stopInstance(negocioId) {
    const instance = this.instances.get(negocioId);
    if (!instance) {
      console.log(`[InstanceManager] Negocio ${negocioId} no tiene instancia`);
      return false;
    }

    try {
      await instance.stop();
    } catch (error) {
      console.error(`[InstanceManager] Error deteniendo ${negocioId}:`, error.message);
    }

    this.instances.delete(negocioId);

    await db.execute(
      `UPDATE negocios SET whatsapp_conectado = false WHERE id = ?`,
      [negocioId]
    ).catch(() => {});

    console.log(`[InstanceManager] Negocio ${negocioId} detenido`);
    return true;
  }

  markConnected(negocioId, phone) {
    const inst = this.instances.get(negocioId);
    if (inst) {
      inst.connected = true;
      inst.phoneNumber = phone;
      inst.qrCode = null;
    }
    db.execute(
      `UPDATE negocios SET whatsapp_conectado = true, whatsapp_ultima_conexion = NOW(), numero_whatsapp = ? WHERE id = ?`,
      [phone, negocioId]
    ).catch(() => {});

    // La prueba gratuita de 7 días empieza en la PRIMERA conexión de WhatsApp (no al registrarse).
    // Solo aplica a negocios (no admins) que aún no tienen fecha de fin ni de prueba: las cuentas pagadas o ya iniciadas no se tocan.
    db.execute(
      `UPDATE negocios
       SET trial_inicio = NOW(),
           trial_hasta = DATE_ADD(NOW(), INTERVAL 7 DAY),
           suscripcion_fin = DATE_ADD(NOW(), INTERVAL 7 DAY)
       WHERE id = ? AND suscripcion_activa = 1 AND suscripcion_fin IS NULL AND trial_hasta IS NULL
         AND (rol IS NULL OR rol = 'negocio')`,
      [negocioId]
    ).then(([r]) => {
      if (r && r.affectedRows) console.log(`[InstanceManager] Prueba de 7 días iniciada para negocio ${negocioId}`);
    }).catch(() => {});
  }

  markDisconnected(negocioId) {
    const inst = this.instances.get(negocioId);
    if (inst) {
      inst.connected = false;
      inst.qrCode = null;
      // Only remove if stop was explicitly requested
      if (inst.stopRequested) {
        this.instances.delete(negocioId);
      }
    }
    db.execute(
      `UPDATE negocios SET whatsapp_conectado = false WHERE id = ?`,
      [negocioId]
    ).catch(() => {});
  }

  getInstance(negocioId) {
    return this.instances.get(negocioId);
  }

  getInstanceCount() {
    return this.instances.size;
  }

  getAllInstances() {
    const result = [];
    for (const [negocioId, instance] of this.instances) {
      result.push({
        negocioId,
        connected: instance.isConnected(),
        phone: instance.getPhoneNumber(),
        qr: instance.getQR() || null,
        config: instance.getConfig()
      });
    }
    return result;
  }

  getStatus(negocioId) {
    const instance = this.instances.get(negocioId);
    if (!instance) {
      return { exists: false, connected: false, qr: null, phone: null };
    }
    return {
      exists: true,
      connected: instance.isConnected(),
      qr: instance.getQR() || null,
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
    if (!instance || !instance.isConnected()) {
      throw new Error(`Negocio ${negocioId} no está conectado`);
    }
    return instance.sendMessage(numero, texto);
  }

  async sendButtons(negocioId, numero, texto, botones) {
    const instance = this.instances.get(negocioId);
    if (!instance || !instance.isConnected()) {
      throw new Error(`Negocio ${negocioId} no está conectado`);
    }
    return instance.sendButtons(numero, texto, botones);
  }

  async sendImage(negocioId, numero, url, caption) {
    const instance = this.instances.get(negocioId);
    if (!instance || !instance.isConnected()) {
      throw new Error(`Negocio ${negocioId} no está conectado`);
    }
    return instance.sendImage(numero, url, caption);
  }
}

const instanceManager = new InstanceManager();

module.exports = instanceManager;
