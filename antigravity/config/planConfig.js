// planConfig.js - FUENTE ÚNICA DE VERDAD para planes, precios y features
// Todo el sistema debe importar de aquí, NUNCA hardcodear precios o features

const PLANS = {
    starter: {
        id: 'starter',
        name: 'Starter',
        nameEs: 'Inicial',
        price: 450000,
        priceUSD: 110,
        trialDays: 7,
        features: {
            // Límites
            maxMessages: 1000,
            maxProducts: 20,
            maxClients: 100,
            maxAgents: 2,
            maxUsers: 1,
            maxWhatsAppNumbers: 1,
            maxCampaigns: 0,
            maxCalls: 0,

            // Features
            botVentas: true,
            catalogoProductos: true,
            pedidosWhatsApp: true,
            reportesBasicos: true,
            soporteEmail: true,
            analyticsBasico: true,

            // No incluido
            analyticsAvanzado: false,
            automatizaciones: false,
            personalizacionCompleta: false,
            multiplesMetodosPago: false,
            soportePrioritario: false,
            apiAccess: false,
            multiSede: false,
            integraciones: false,
            ocrPagos: false,
            campañasMasivas: false,
            domicilios: false,
            multiUsuario: false,
            voiceBot: false,
            telegramBot: false,
            instagramBot: false,
        },
        automations: ['recordatorio_pago', 'stock_bajo'],
        color: '#22c55e',
        popular: false,
    },
    professional: {
        id: 'professional',
        name: 'Professional',
        nameEs: 'Profesional',
        price: 850000,
        priceUSD: 210,
        trialDays: 7,
        features: {
            // Límites
            maxMessages: 5000,
            maxProducts: -1, // ilimitado
            maxClients: 500,
            maxAgents: 4,
            maxUsers: 5,
            maxWhatsAppNumbers: 3,
            maxCampaigns: 10,
            maxCalls: 0,

            // Features
            botVentas: true,
            catalogoProductos: true,
            pedidosWhatsApp: true,
            reportesBasicos: true,
            soporteEmail: true,
            analyticsBasico: true,
            analyticsAvanzado: true,
            automatizaciones: true,
            personalizacionCompleta: true,
            multiplesMetodosPago: true,
            soportePrioritario: true,
            apiAccess: true,
            campañasMasivas: true,
            domicilios: true,
            multiUsuario: true,
            telegramBot: true,
            instagramBot: true,

            // No incluido
            multiSede: false,
            integraciones: false,
            ocrPagos: false,
            voiceBot: false,
        },
        automations: ['recordatorio_pago', 'stock_bajo', 'reengagement', 'reporte_semanal', 'campaña_masiva'],
        color: '#3b82f6',
        popular: true,
    },
    enterprise: {
        id: 'enterprise',
        name: 'Enterprise',
        nameEs: 'Empresarial',
        price: 1800000,
        priceUSD: 440,
        trialDays: 7,
        features: {
            // Límites (todo ilimitado)
            maxMessages: -1,
            maxProducts: -1,
            maxClients: -1,
            maxAgents: -1,
            maxUsers: -1,
            maxWhatsAppNumbers: -1,
            maxCampaigns: -1,
            maxCalls: -1,

            // Todo incluido
            botVentas: true,
            catalogoProductos: true,
            pedidosWhatsApp: true,
            reportesBasicos: true,
            soporteEmail: true,
            analyticsBasico: true,
            analyticsAvanzado: true,
            automatizaciones: true,
            personalizacionCompleta: true,
            multiplesMetodosPago: true,
            soportePrioritario: true,
            apiAccess: true,
            campañasMasivas: true,
            domicilios: true,
            multiUsuario: true,
            multiSede: true,
            integraciones: true,
            ocrPagos: true,
            voiceBot: true,
            telegramBot: true,
            instagramBot: true,
        },
        automations: ['recordatorio_pago', 'stock_bajo', 'reengagement', 'reporte_semanal', 'campaña_masiva', 'ocr_pagos'],
        color: '#eab308',
        popular: false,
    },
};

const PLAN_ORDER = ['starter', 'professional', 'enterprise'];

// Etiquetas en español para mostrarle al negocio qué gana si sube de plan.
// Única fuente de verdad para esto también — si se agrega una feature nueva
// arriba, se le pone su etiqueta acá y automáticamente aparece en las
// comparaciones de upgrade (GET /api/business/plan) sin tocar nada más.
const FEATURE_LABELS = {
    analyticsAvanzado: 'Analytics avanzado',
    automatizaciones: 'Automatizaciones (recordatorios, reenganche, campañas)',
    personalizacionCompleta: 'Personalización completa del bot',
    multiplesMetodosPago: 'Múltiples métodos de pago',
    soportePrioritario: 'Soporte prioritario',
    apiAccess: 'Acceso a la API',
    multiSede: 'Multi-sede',
    integraciones: 'Integraciones (Rappi/iFood)',
    ocrPagos: 'Verificación de pagos con OCR',
    campañasMasivas: 'Campañas masivas por WhatsApp',
    domicilios: 'Gestión de domicilios propios',
    multiUsuario: 'Múltiples usuarios del equipo',
    voiceBot: 'Bot de llamadas con IA (voz)',
    telegramBot: 'Bot en Telegram',
    instagramBot: 'Bot en Instagram',
};

const LIMIT_LABELS = {
    maxMessages: 'Mensajes de IA al mes',
    maxClients: 'Clientes',
    maxProducts: 'Productos en catálogo',
    maxUsers: 'Usuarios del equipo',
    maxWhatsAppNumbers: 'Números de WhatsApp',
    maxCampaigns: 'Campañas masivas al mes',
    maxCalls: 'Llamadas al mes',
    maxAgents: 'Agentes de IA activos',
};

function getIncludedFeatureLabels(planId) {
    const features = getPlanFeatures(planId);
    return Object.entries(FEATURE_LABELS)
        .filter(([key]) => features[key] === true)
        .map(([, label]) => label);
}

// Compara el plan actual contra el siguiente y arma, en español, qué
// features nuevas desbloquea y qué límites mejoran — para mostrarle al
// negocio "esto es lo que ganas" cuando está en un plan más bajo.
function getUpgradeBenefits(currentPlanId) {
    const next = getNextPlan(currentPlanId);
    if (!next) return null;

    const actuales = getPlanFeatures(currentPlanId);
    const nuevas = next.features;

    const nuevasFeatures = Object.entries(FEATURE_LABELS)
        .filter(([key]) => !actuales[key] && nuevas[key])
        .map(([, label]) => label);

    const limitesMejorados = Object.entries(LIMIT_LABELS)
        .map(([key, label]) => ({ key, label, actual: actuales[key], nuevo: nuevas[key] }))
        .filter(({ actual, nuevo }) => nuevo === -1 ? actual !== -1 : nuevo > actual);

    return {
        plan_id: next.id,
        nombre: next.nameEs,
        precio: next.price,
        nuevas_features: nuevasFeatures,
        limites_mejorados: limitesMejorados,
    };
}

function getPlan(planId) {
    return PLANS[planId] || PLANS.starter;
}

function getPlanPrice(planId) {
    return PLANS[planId]?.price || 0;
}

function getPlanFeatures(planId) {
    return PLANS[planId]?.features || PLANS.starter.features;
}

function hasFeature(planId, feature) {
    const features = getPlanFeatures(planId);
    return features[feature] === true;
}

function checkLimit(planId, metric, currentUsage) {
    const features = getPlanFeatures(planId);
    const limit = features[metric];
    if (limit === -1) return { allowed: true, limit: -1, remaining: -1, usage: currentUsage, percentage: 0 };
    if (limit === undefined) return { allowed: false, limit: 0, remaining: 0, usage: currentUsage, percentage: 0 };
    return {
        allowed: currentUsage < limit,
        limit,
        remaining: Math.max(0, limit - currentUsage),
        usage: currentUsage,
        percentage: Math.round((currentUsage / limit) * 100),
    };
}

function getNextPlan(currentPlan) {
    const idx = PLAN_ORDER.indexOf(currentPlan);
    if (idx < PLAN_ORDER.length - 1) {
        return PLANS[PLAN_ORDER[idx + 1]];
    }
    return null;
}

function getPrevPlan(currentPlan) {
    const idx = PLAN_ORDER.indexOf(currentPlan);
    if (idx > 0) {
        return PLANS[PLAN_ORDER[idx - 1]];
    }
    return null;
}

function getAllPlans() {
    return PLAN_ORDER.map(id => PLANS[id]);
}

module.exports = {
    PLANS,
    PLAN_ORDER,
    FEATURE_LABELS,
    LIMIT_LABELS,
    getPlan,
    getPlanPrice,
    getPlanFeatures,
    hasFeature,
    checkLimit,
    getNextPlan,
    getPrevPlan,
    getAllPlans,
    getIncludedFeatureLabels,
    getUpgradeBenefits,
};
