require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// negocios.tipo_negocio era un ENUM de 7 valores. Ahora se elige entre un catálogo grande
// (api/services/tiposNegocio.js), así que pasa a VARCHAR. Los valores existentes se conservan.
// Idempotente: si ya es VARCHAR no hace nada.
async function run() {
    try {
        const [cols] = await db.execute(
            "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'negocios' AND COLUMN_NAME = 'tipo_negocio'"
        );
        if (cols.length === 0) {
            console.log('[SKIP] negocios.tipo_negocio no existe');
        } else if (String(cols[0].DATA_TYPE).toLowerCase() === 'varchar') {
            console.log('[SKIP] negocios.tipo_negocio ya es VARCHAR');
        } else {
            await db.execute('ALTER TABLE negocios MODIFY COLUMN tipo_negocio VARCHAR(40) NULL');
            console.log('[OK] negocios.tipo_negocio ahora es VARCHAR(40)');
        }
        console.log('\n✅ Migración tipo_negocio completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
