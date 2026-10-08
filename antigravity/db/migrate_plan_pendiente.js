// Downgrade programado: el plan al que cambiará el negocio cuando termine el
// período ya pagado (antes el downgrade se aplicaba al instante aunque el
// mensaje dijera "efectivo en el próximo ciclo").
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

async function run() {
    try {
        await db.execute("ALTER TABLE negocios ADD COLUMN plan_pendiente VARCHAR(20) NULL DEFAULT NULL");
        console.log('negocios.plan_pendiente agregada');
    } catch (e) {
        console.log('negocios.plan_pendiente:', e.code === 'ER_DUP_FIELDNAME' ? 'ya existe' : e.message);
    }
    process.exit(0);
}

run();
