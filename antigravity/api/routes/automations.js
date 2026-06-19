const express = require('express');
const router = express.Router();
const { verificarAuth } = require('../middleware/auth');
const { injectTenantId, checkPlan, checkFeature } = require('../middleware/tenant');
const db = require('../../db/config');

router.use(verificarAuth);
router.use(injectTenantId);

const AUTOMATION_TYPES = {
  recordatorio_pago: {
    name: 'Recordatorio de Pago',
    description: 'Envía recordatorios automáticos cuando hay pedidos pendientes de pago',
    plan_requerido: 'starter',
    config_schema: {
      minutos: { type: 'number', default: 30, min: 5, max: 1440 },
      mensaje: { type: 'string', default: 'Recuerda que tienes un pedido pendiente de pago' }
    }
  },
  reengagement: {
    name: 'Re-engagement',
    description: 'Contacta clientes inactivos para traerlos de vuelta',
    plan_requerido: 'professional',
    config_schema: {
      dias: { type: 'number', default: 15, min: 7, max: 90 },
      mensaje: { type: 'string', default: '¡Te extrañamos!' },
      oferta: { type: 'string', default: '' }
    }
  },
  stock_bajo: {
    name: 'Alerta Stock Bajo',
    description: 'Notifica cuando el inventario está bajo',
    plan_requerido: 'starter',
    config_schema: {
      umbral: { type: 'number', default: 5, min: 1, max: 100 },
      email_alerta: { type: 'boolean', default: true }
    }
  },
  reporte_semanal: {
    name: 'Reporte Semanal',
    description: 'Envía un resumen semanal de métricas',
    plan_requerido: 'professional',
    config_schema: {
      dia: { type: 'string', enum: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'], default: 'lunes' },
      hora: { type: 'string', default: '08:00' },
      metricas: { type: 'array', items: { type: 'string', enum: ['ventas', 'pedidos', 'top_producto', 'nuevos_clientes'] }, default: ['ventas', 'pedidos'] }
    }
  },
  campaña_masiva: {
    name: 'Campañas Masivas',
    description: 'Envía mensajes a segmentos de clientes',
    plan_requerido: 'professional',
    config_schema: {
      segmento: { type: 'string', default: 'todos' },
      mensaje: { type: 'string', default: '' }
    }
  },
  ocr_pagos: {
    name: 'OCR de Pagos',
    description: 'Verifica comprobantes de pago con visión artificial',
    plan_requerido: 'enterprise',
    config_schema: {
      tolerancia: { type: 'number', default: 500, min: 0, max: 5000 }
    }
  }
};

router.get('/automatizaciones', async (req, res) => {
  try {
    const [configs] = await db.execute(
      `SELECT * FROM automatizaciones_config WHERE negocio_id = ?`,
      [req.negocioId]
    );

    const automatizaciones = Object.entries(AUTOMATION_TYPES).map(([tipo, info]) => {
      const configExistente = configs.find(c => c.tipo === tipo);
      const planOrden = { starter: 1, professional: 2, enterprise: 3 };
      const tienePlan = planOrden[req.negocio.plan] >= planOrden[info.plan_requerido];

      return {
        tipo,
        nombre: info.name,
        descripcion: info.description,
        plan_requerido: info.plan_requerido,
        disponible: tienePlan,
        activa: configExistente?.activa || false,
        config: configExistente?.config ? JSON.parse(configExistente.config) : {},
        ultima_ejecucion: configExistente?.ultima_ejecucion
      };
    });

    res.json({ automatizaciones });
  } catch (error) {
    console.error('[Automations] Error:', error.message);
    res.status(500).json({ error: 'Error al obtener automatizaciones' });
  }
});

router.patch('/automatizaciones/:tipo/toggle', async (req, res) => {
  try {
    const { tipo } = req.params;

    if (!AUTOMATION_TYPES[tipo]) {
      return res.status(404).json({ error: 'Tipo de automatización no válido' });
    }

    const info = AUTOMATION_TYPES[tipo];
    const planOrden = { starter: 1, professional: 2, enterprise: 3 };

    if (planOrden[req.negocio.plan] < planOrden[info.plan_requerido]) {
      return res.status(403).json({
        error: `Esta automatización requiere plan ${info.plan_requerido}`,
        plan_requerido: info.plan_requerido,
        upgrade_url: '/dashboard/plan'
      });
    }

    const [existing] = await db.execute(
      `SELECT * FROM automatizaciones_config WHERE negocio_id = ? AND tipo = ?`,
      [req.negocioId, tipo]
    );

    let activa;
    if (existing.length > 0) {
      activa = !existing[0].activa;
      await db.execute(
        `UPDATE automatizaciones_config SET activa = ?, updated_at = NOW() WHERE id = ?`,
        [activa, existing[0].id]
      );
    } else {
      activa = true;
      await db.execute(
        `INSERT INTO automatizaciones_config (negocio_id, tipo, activa, config, plan_requerido) VALUES (?, ?, true, '{}', ?)`,
        [req.negocioId, tipo, info.plan_requerido]
      );
    }

    res.json({
      success: true,
      tipo,
      activa,
      mensaje: activa ? 'Automatización activada' : 'Automatización desactivada'
    });
  } catch (error) {
    console.error('[Automations Toggle] Error:', error.message);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
});

router.put('/automatizaciones/:tipo/config', async (req, res) => {
  try {
    const { tipo } = req.params;
    const config = req.body;

    if (!AUTOMATION_TYPES[tipo]) {
      return res.status(404).json({ error: 'Tipo de automatización no válido' });
    }

    const [existing] = await db.execute(
      `SELECT * FROM automatizaciones_config WHERE negocio_id = ? AND tipo = ?`,
      [req.negocioId, tipo]
    );

    if (existing.length > 0) {
      await db.execute(
        `UPDATE automatizaciones_config SET config = ?, updated_at = NOW() WHERE id = ?`,
        [JSON.stringify(config), existing[0].id]
      );
    } else {
      await db.execute(
        `INSERT INTO automatizaciones_config (negocio_id, tipo, activa, config, plan_requerido) VALUES (?, ?, false, ?, ?)`,
        [req.negocioId, tipo, JSON.stringify(config), AUTOMATION_TYPES[tipo].plan_requerido]
      );
    }

    res.json({ success: true, mensaje: 'Configuración guardada' });
  } catch (error) {
    console.error('[Automations Config] Error:', error.message);
    res.status(500).json({ error: 'Error al guardar configuración' });
  }
});

router.post('/campañas', checkPlan('professional', 'enterprise'), async (req, res) => {
  try {
    const { nombre, mensaje, segmento, segmento_config, fecha_envio } = req.body;

    if (!nombre || !mensaje || !segmento) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const [clientes] = await db.execute(
      `SELECT COUNT(*) as total FROM clientes WHERE negocio_id = ?`,
      [req.negocioId]
    );

    const totalDestinatarios = clientes[0].total;

    const [result] = await db.execute(
      `INSERT INTO campañas (negocio_id, nombre, mensaje, segmento, segmento_config, fecha_envio, estado, total_destinatarios)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.negocioId, nombre, mensaje, segmento, JSON.stringify(segmento_config || {}), fecha_envio || null, fecha_envio ? 'programada' : 'borrador', totalDestinatarios]
    );

    if (fecha_envio) {
      const { enqueueCampaign } = require('../../queue/jobs/sendCampaign');
      await enqueueCampaign(result.insertId, req.negocioId);
    }

    res.status(201).json({
      success: true,
      campaña: {
        id: result.insertId,
        nombre,
        mensaje,
        segmento,
        fecha_envio,
        estado: fecha_envio ? 'programada' : 'borrador',
        total_destinatarios: totalDestinatarios
      }
    });
  } catch (error) {
    console.error('[Campaigns] Error:', error.message);
    res.status(500).json({ error: 'Error al crear campaña' });
  }
});

router.get('/campañas', async (req, res) => {
  try {
    const [campañas] = await db.execute(
      `SELECT * FROM campañas WHERE negocio_id = ? ORDER BY created_at DESC`,
      [req.negocioId]
    );

    res.json({ campañas });
  } catch (error) {
    console.error('[Campaigns List] Error:', error.message);
    res.status(500).json({ error: 'Error al obtener campañas' });
  }
});

router.get('/campañas/:id/progreso', async (req, res) => {
  try {
    const { id } = req.params;

    const [campañas] = await db.execute(
      `SELECT * FROM campañas WHERE id = ? AND negocio_id = ?`,
      [id, req.negocioId]
    );

    if (campañas.length === 0) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }

    const campaña = campañas[0];
    const porcentaje = campaña.total_destinatarios > 0 
      ? Math.round((campaña.total_enviados / campaña.total_destinatarios) * 100) 
      : 0;

    res.json({
      id: campaña.id,
      nombre: campaña.nombre,
      estado: campaña.estado,
      total: campaña.total_destinatarios,
      enviados: campaña.total_enviados,
      fallidos: campaña.total_fallidos,
      porcentaje
    });
  } catch (error) {
    console.error('[Campaign Progress] Error:', error.message);
    res.status(500).json({ error: 'Error al obtener progreso' });
  }
});

router.delete('/campañas/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.execute(
      `DELETE FROM campañas WHERE id = ? AND negocio_id = ?`,
      [id, req.negocioId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }

    res.json({ success: true, mensaje: 'Campaña eliminada' });
  } catch (error) {
    console.error('[Campaign Delete] Error:', error.message);
    res.status(500).json({ error: 'Error al eliminar campaña' });
  }
});

module.exports = router;
