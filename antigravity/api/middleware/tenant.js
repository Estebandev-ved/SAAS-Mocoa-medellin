const db = require('../../db/config');
const { getPlanFeatures, hasFeature, checkLimit, getPlan } = require('../../config/planConfig');

async function injectTenantId(req, res, next) {
  if (!req.negocioId) {
    return res.status(400).json({
      error: 'Falta ID de negocio',
      codigo: 'SIN_NEGOCIO_ID'
    });
  }

  try {
    const [negocios] = await db.execute(
      `SELECT plan, plan_pendiente, suscripcion_activa, suscripcion_fin, trial_hasta, trial_inicio
       FROM negocios WHERE id = ?`,
      [req.negocioId]
    );

    const negocio = negocios[0];
    const now = new Date();

    // Un ciclo pagado sigue dando acceso aunque el negocio ya haya cancelado la
    // renovación (suscripcion_activa=0): conserva todo hasta suscripcion_fin.
    const cicloVigente = negocio.suscripcion_fin && new Date(negocio.suscripcion_fin) > now;

    // Check trial expiry
    const enTrial = negocio.trial_hasta && new Date(negocio.trial_hasta) > now && !negocio.suscripcion_activa;
    const trialVencido = negocio.trial_hasta && new Date(negocio.trial_hasta) < now && !negocio.suscripcion_activa && !cicloVigente;

    if (trialVencido) {
      return res.status(402).json({
        error: 'Tu período de prueba ha vencido. Activa tu cuenta para continuar.',
        codigo: 'TRIAL_VENCIDO',
        necesitaActivar: true
      });
    }

    // Check subscription expiry
    const subVencida = negocio.suscripcion_fin && new Date(negocio.suscripcion_fin) < now && negocio.suscripcion_activa;
    if (subVencida) {
      // Si había un downgrade programado, entra en vigor al terminar el ciclo.
      await db.execute(
        'UPDATE negocios SET suscripcion_activa = 0, plan = COALESCE(plan_pendiente, plan), plan_pendiente = NULL WHERE id = ?',
        [req.negocioId]
      );
      return res.status(402).json({
        error: 'Tu suscripción ha vencido. Renueva para continuar.',
        codigo: 'SUSCRIPCION_VENCIDA',
        necesitaRenovar: true
      });
    }

    // Canceló y el ciclo que ya había pagado terminó: se acabó el acceso.
    const cancelacionCumplida = !negocio.suscripcion_activa && negocio.suscripcion_fin && new Date(negocio.suscripcion_fin) < now;
    if (cancelacionCumplida) {
      if (negocio.plan_pendiente) {
        await db.execute('UPDATE negocios SET plan = plan_pendiente, plan_pendiente = NULL WHERE id = ?', [req.negocioId]);
      }
      return res.status(402).json({
        error: 'Tu suscripción terminó. Elige un plan para continuar.',
        codigo: 'SUSCRIPCION_VENCIDA',
        necesitaRenovar: true
      });
    }

    // Set plan limits from planConfig. Clonar: getPlanFeatures() devuelve la
    // MISMA referencia al objeto singleton de PLANS (config/planConfig.js no
    // clona). Mutar req.planLimits sin copiar corrompía la config compartida
    // para todo el proceso — p.ej. maxProducts -1 (ilimitado) se convertía en
    // Infinity de forma permanente en cuanto un negocio Professional/Enterprise
    // pasaba por este middleware, rompiendo el límite mostrado a TODOS los
    // negocios (Infinity no es serializable en JSON, llega como null al front).
    req.planLimits = { ...getPlanFeatures(negocio.plan) };
    req.planLimits.maxMessagesPerMonth = req.planLimits.maxMessages;
    req.planLimits.maxProducts = req.planLimits.maxProducts === -1 ? Infinity : req.planLimits.maxProducts;
    req.planLimits.automations = getPlan(negocio.plan).automations;
    req.planLimits.campaigns = req.planLimits.campañasMasivas;
    req.planLimits.visionOCR = req.planLimits.ocrPagos;
    req.planLimits.reports = req.planLimits.reportesBasicos;

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
       FROM mensajes 
       WHERE negocio_id = ? AND DATE(created_at) >= ?`,
      [req.negocioId, `${mesActual}-01`]
    );

    const mensajesMes = stats[0]?.mensajes_enviados || 0;
    const limitCheck = checkLimit(req.negocio?.plan || 'starter', 'maxMessages', mensajesMes);

    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: 'Has alcanzado el límite de mensajes del mes',
        codigo: 'LIMITE_MENSUAL',
        mensajes_usados: mensajesMes,
        limite: limitCheck.limit,
        mensajes_restantes: limitCheck.remaining,
        upgrade_url: '/dashboard/plan'
      });
    }

    req.usage = { mensajes_usados: mensajesMes };
    next();
  } catch (error) {
    console.error('[CheckLimit] Error:', error.message);
    next();
  }
}

async function checkProductLimit(req, res, next) {
  try {
    const limitCheck = checkLimit(req.negocio?.plan || 'starter', 'maxProducts', 0);
    if (limitCheck.limit === -1) return next();

    const [stats] = await db.execute(
      `SELECT COUNT(*) as total FROM productos WHERE negocio_id = ?`,
      [req.negocioId]
    );

    const total = stats[0]?.total || 0;
    const productCheck = checkLimit(req.negocio?.plan || 'starter', 'maxProducts', total);

    if (!productCheck.allowed) {
      return res.status(403).json({
        error: `Has alcanzado el límite de ${productCheck.limit} productos de tu plan actual.`,
        codigo: 'LIMITE_PRODUCTOS',
        limite: productCheck.limit,
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
};
