const planFeatures = {
  emprendedor: {
    nombre: 'Emprendedor',
    precio: 25000,
    maxNumerosWhatsApp: 0,
    maxContactos: 0,
    maxAgentesIA: 0,
    maxUsuarios: 1,
    features: {
      // Solo la caja (app aparte de inventario, ventas y plata): no incluye el bot.
      caja: true,

      chatbot: false,
      catalogoProductos: false,
      pedidosBasicos: false,

      respuestaCatalogo: false,
      extraccionPedidos: false,
      notificacionesSeguimiento: false,
      agenteIAGPT: false,
      agentesEspecializados: [],

      domicilios: false,
      multiUsuario: false,
      analyticsAvanzado: false,
      exportarDatos: false,
      apiAcceso: false,

      soporteEmail: true,
      soportePrioritario: false,
      managerDedicado: false,
    },
  },
  starter: {
    nombre: 'Starter',
    precio: 450000,
    maxNumerosWhatsApp: 1,
    maxContactos: 500,
    maxAgentesIA: 1,
    maxUsuarios: 1,
    features: {
      caja: false,

      // Core
      chatbot: true,
      catalogoProductos: true,
      pedidosBasicos: true,

      // Automatizaciones
      respuestaCatalogo: true,
      extraccionPedidos: false,
      notificacionesSeguimiento: false,
      agenteIAGPT: false,
      agentesEspecializados: [], // solo puede tener 1 total

      // Módulos
      domicilios: false,
      multiUsuario: false,
      analyticsAvanzado: false,
      exportarDatos: false,
      apiAcceso: false,

      // Soporte
      soporteEmail: true,
      soportePrioritario: false,
      managerDedicado: false,
    },
  },
  professional: {
    nombre: 'Professional',
    precio: 850000,
    maxNumerosWhatsApp: 3,
    maxContactos: 2000,
    maxAgentesIA: 3,
    maxUsuarios: 5,
    features: {
      caja: false,

      // Core
      chatbot: true,
      catalogoProductos: true,
      pedidosBasicos: true,

      // Automatizaciones
      respuestaCatalogo: true,
      extraccionPedidos: true,
      notificacionesSeguimiento: true,
      agenteIAGPT: true,
      agentesEspecializados: ['ventas', 'pagos', 'pedidos', 'faq'],

      // Módulos
      domicilios: true,
      multiUsuario: true,
      analyticsAvanzado: true,
      exportarDatos: true,
      apiAcceso: false,

      // Soporte
      soporteEmail: true,
      soportePrioritario: true,
      managerDedicado: false,
    },
  },
  enterprise: {
    nombre: 'Enterprise',
    precio: 1800000,
    maxNumerosWhatsApp: -1, // ilimitado
    maxContactos: -1, // ilimitado
    maxAgentesIA: -1, // ilimitado
    maxUsuarios: -1, // ilimitado
    features: {
      caja: false,

      // Core
      chatbot: true,
      catalogoProductos: true,
      pedidosBasicos: true,

      // Automatizaciones
      respuestaCatalogo: true,
      extraccionPedidos: true,
      notificacionesSeguimiento: true,
      agenteIAGPT: true,
      agentesEspecializados: ['ventas', 'pagos', 'pedidos', 'faq', 'reclamos', 'retencion'],

      // Módulos
      domicilios: true,
      multiUsuario: true,
      analyticsAvanzado: true,
      exportarDatos: true,
      apiAcceso: true,

      // Soporte
      soporteEmail: true,
      soportePrioritario: true,
      managerDedicado: true,
    },
  },
};

export function getPlanFeatures(plan) {
  return planFeatures[plan] || planFeatures.starter;
}

export function hasFeature(plan, feature) {
  const p = planFeatures[plan];
  if (!p) return false;

  const parts = feature.split('.');
  let current = p;
  for (const part of parts) {
    current = current?.[part];
    if (current === undefined) return false;
  }
  // For array features (like agentesEspecializados), return true if array has items
  if (Array.isArray(current)) return current.length > 0;
  return !!current;
}

export function hasAgent(plan, agentId) {
  const p = planFeatures[plan];
  if (!p) return false;
  return p.features.agentesEspecializados?.includes(agentId) || false;
}

export function getLimit(plan, limitKey) {
  const p = planFeatures[plan];
  if (!p) return 0;
  const val = p[limitKey];
  return val === -1 ? Infinity : val || 0;
}

export function getPlanUpgradeMessage(plan, feature) {
  const plans = ['emprendedor', 'starter', 'professional', 'enterprise'];
  const currentIndex = plans.indexOf(plan);

  for (let i = currentIndex + 1; i < plans.length; i++) {
    const nextPlan = planFeatures[plans[i]];
    if (nextPlan.features[feature] !== false) {
      return {
        requiredPlan: plans[i],
        planName: nextPlan.nombre,
        precio: nextPlan.precio,
      };
    }
  }
  return null;
}

export const ALL_AGENTS = [
  { id: 'ventas', label: 'Ventas' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'pedidos', label: 'Pedidos' },
  { id: 'faq', label: 'FAQ' },
  { id: 'reclamos', label: 'Reclamos' },
  { id: 'retencion', label: 'Retención' },
];

export default planFeatures;
