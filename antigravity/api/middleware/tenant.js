const db = require('../../db/config');

const PLAN_LIMITS = {
  starter: {
    maxMessagesPerMonth: 1000,
    automations: ['recordatorio_pago', 'stock_bajo'],
    campaigns: false,
    visionOCR: false,
    reports: false,
    maxProducts: 20
  },
  professional: {
    maxMessagesPerMonth: 5000,
    automations: ['recordatorio_pago', 'stock_bajo', 'reengagement', 'reporte_semanal', 'campaña_masiva'],
    campaigns: true,
    visionOCR: false,
    reports: true,
    maxProducts: Infinity
  },
  enterprise: {
    maxMessagesPerMonth: Infinity,
    automations: ['recordatorio_pago', 'stock_bajo', 'reengagement', 'reporte_semanal', 'campaña_masiva', 'ocr_pagos'],
    campaigns: true,
    visionOCR: true,
    reports: true,
    maxProducts: Infinity
  }
};

async function injectTenantId(req, res, next) {
  if (!req.negocioId) {
    return res.status(400).json({
      error: 'Falta ID de negocio',
      codigo: 'SIN_NEGOCIO_ID'
    });
  }

  try {
    const [suscripciones] = await db.execute(
      `SELECT * FROM suscripciones WHERE negocio_id = ? ORDER BY created_at DESC LIMIT 1`,
      [req.negocioId]
    );

    const suscripcion = suscripciones[0];
    const estaEnTrial = suscripcion?.estado === 'trial';
    const trialVencido = estaEnTrial && suscripcion?.trial_fin && new Date(suscripcion.trial_fin) < new Date();

    if (!req.negocio.suscripcion_activa && estaEnTrial && trialVencido) {
      return res.status(402).json({
        error: 'Tu período de prueba ha vencido. Activa tu cuenta para continuar.',
        codigo: 'TRIAL_VENCIDO',
        necesitaActivar: true
      });
    }

    req.planLimits = PLAN_LIMITS[req.negocio.plan] || PLAN_LIMITS.starter;

    next();
  } catch (error) {
    console.error('[Tenant] Error:', error.message);
    return res.status(500).json({
      error: 'Error al verificar suscripción',
      codigo: 'ERROR_SUSCRIPCION'
    });
  }
}

function checkPlan(...planesPermitidos) {
  return (req, res, next) => {
    if (!req.negocio) {
      return res.status(403).json({
        error: 'No autorizado',
        codigo: 'SIN_AUTORIZACION'
      });
    }

    const planOrden = { starter: 1, professional: 2, enterprise: 3 };
    const planActual = req.negocio.plan;

    const tienePermiso = planesPermitidos.some(plan => {
      return planOrden[plan] <= planOrden[planActual];
    });

    if (!tienePermiso) {
      const planMinimo = planesPermitidos.reduce((min, plan) => {
        return (planOrden[plan] || 0) < (planOrden[min] || 0) ? plan : min;
      }, planesPermitidos[0]);

      return res.status(403).json({
        error: `Esta función requiere plan ${planMinimo} o superior`,
        codigo: 'PLAN_INSUFICIENTE',
        plan_actual: planActual,
        plan_requerido: planMinimo,
        upgrade_url: '/dashboard/plan'
      });
    }

    next();
  };
}

function checkFeature(feature) {
  return (req, res, next) => {
    if (!req.planLimits) {
      return res.status(500).json({
        error: 'Límites no cargados',
        codigo: 'SIN_LIMITS'
      });
    }

    if (req.planLimits[feature] === undefined) {
      return res.status(403).json({
        error: `Feature no disponible en tu plan`,
        codigo: 'FEATURE_NO_DISPONIBLE',
        plan_actual: req.negocio.plan
      });
    }

    if (req.planLimits[feature] === false) {
      return res.status(403).json({
        error: `Esta función requiere upgrade de plan`,
        codigo: 'PLAN_INSUFICIENTE',
        plan_actual: req.negocio.plan,
        upgrade_url: '/dashboard/plan'
      });
    }

    next();
  };
}

async function checkMessageLimit(req, res, next) {
  try {
    const mesActual = new Date().toISOString().slice(0, 7);
    const [stats] = await db.execute(
      `SELECT COUNT(*) as mensajes_enviados 
       FROM analytics_diario 
       WHERE negocio_id = ? AND fecha >= ?`,
      [req.negocioId, `${mesActual}-01`]
    );

    const mensajesMes = stats[0]?.mensajes_enviados || 0;
    const limite = req.planLimits?.maxMessagesPerMonth || 1000;

    if (mensajesMes >= limite) {
      return res.status(429).json({
        error: 'Has alcanzado el límite de mensajes del mes',
        codigo: 'LIMITE_MENSUAL',
        mensajes_usados: mensajesMes,
        limite: limite,
        upgrade_url: '/dashboard/plan'
      });
    }

    next();
  } catch (error) {
    console.error('[CheckLimit] Error:', error.message);
    next();
  }
}

async function checkProductLimit(req, res, next) {
  try {
    const limite = req.planLimits?.maxProducts || 20;
    if (limite === Infinity) return next();

    const [stats] = await db.execute(
      `SELECT COUNT(*) as total FROM productos WHERE negocio_id = ?`,
      [req.negocioId]
    );

    const total = stats[0]?.total || 0;
    if (total >= limite) {
      return res.status(403).json({
        error: `Has alcanzado el límite de ${limite} productos de tu plan actual.`,
        codigo: 'LIMITE_PRODUCTOS',
        limite: limite,
        upgrade_url: '/dashboard/plan'
      });
    }

    next();
  } catch (error) {
    console.error('[ProductLimit] Error:', error.message);
    res.status(500).json({ error: 'Error verificando límites' });
  }
}

module.exports = {
  injectTenantId,
  checkPlan,
  checkFeature,
  checkMessageLimit,
  checkProductLimit,
  PLAN_LIMITS
};
