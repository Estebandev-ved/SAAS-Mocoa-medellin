// Agrega el plan 'emprendedor' (la "caja") al ENUM de plan (ver agregarPlanEnum.js). Idempotente.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { agregarPlanAlEnum } = require('./agregarPlanEnum');

agregarPlanAlEnum('emprendedor')
    .then(() => process.exit(0))
    .catch((e) => { console.error('migrate_plan_emprendedor falló:', e.message); process.exit(1); });
