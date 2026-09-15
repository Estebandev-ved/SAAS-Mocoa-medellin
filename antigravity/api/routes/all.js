const express = require('express');
const router = express.Router();

// ============================================================================
// DEPRECADO — este archivo dejó de montarse en index.js.
//
// Contenía implementaciones duplicadas de /pedidos, /productos, /analytics,
// /chat/conversaciones, /business/password, /business/plan/upgrade y
// /automations, cada una con su propio pool de MySQL y su propio
// verificarAuth (con fallback de JWT_SECRET hardcodeado). Como este router
// se montaba primero (`app.use('/api', allRoutes)`), esas rutas
// SIEMPRE ganaban sobre los routers "oficiales" del mismo recurso — incluso
// cuando el router oficial tenía más lógica (ej. business.js) o cuando la
// ruta oficial vivía en otro path que el frontend nunca llamaba
// (ej. conversaciones.js en /api/conversaciones, mientras el frontend
// pega a /api/chat/conversaciones).
//
// Se consolidó cada recurso en UN solo archivo, reusando el pool
// compartido (db/config.js) y el middleware de auth compartido
// (middleware/auth.js):
//   - /api/pedidos            -> routes/orders.js (reescrito acá adentro; antes: acá + una versión más simple)
//   - /api/productos          -> routes/products.js (reescrito; antes existía pero nunca se montaba)
//   - /api/analytics/resumen  -> routes/analyticsAdvanced.js (antes: acá, con otro contrato)
//   - /api/chat/*             -> routes/chatConversaciones.js, nuevo (antes: acá; conversaciones.js quedó sin usar)
//   - /api/business/*         -> routes/business.js, montado en /api/business (antes: /api/negocio, y acá)
//   - /api/automations        -> routes/automations-toggle.js, nuevo (antes: acá)
//
// Se deja este archivo vacío (en vez de borrarlo) para no perder el
// historial/contexto de qué vivía acá. No se monta desde index.js.
// ============================================================================

module.exports = router;
