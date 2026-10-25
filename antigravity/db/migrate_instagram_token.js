require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// negocios.instagram_token era VARCHAR(255). Ahora se guarda CIFRADO (api/services/secretos.js) y el texto cifrado
// mide más del doble que el token original, así que la columna pasa a TEXT. Idempotente; los datos se conservan.
async function run() {
    try {
        const [col] = await db.execute(
            "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'negocios' AND COLUMN_NAME = 'instagram_token'"
        );
        if (col.length === 0) {
            console.log('[SKIP] negocios.instagram_token no existe (migrate_multichannel.js aún no corrió)');
        } else if (String(col[0].DATA_TYPE).toLowerCase() === 'text') {
            console.log('[SKIP] negocios.instagram_token ya es TEXT');
        } else {
            await db.execute('ALTER TABLE negocios MODIFY COLUMN instagram_token TEXT NULL');
            console.log('[OK] negocios.instagram_token ahora es TEXT');
        }
        console.log('\n✅ Migración token de Instagram completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
