require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// Avatar personalizable del dueño (personaje de marca). Se guarda como JSON en texto
// (LONGTEXT) para no depender del tipo JSON de la versión de MySQL; el servidor lo valida
// contra una lista blanca en api/services/avatar.js antes de escribirlo.

async function run() {
    try {
        await db.execute("ALTER TABLE negocios ADD COLUMN avatar_config LONGTEXT NULL COMMENT 'JSON del avatar del dueño (genero, piel, pelo, barba, gafas, tatuajes, ropa)'");
        console.log('[OK] negocios.avatar_config');
        console.log('\n✅ Migración avatar completada');
        process.exit(0);
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('[SKIP] negocios.avatar_config ya existe');
            process.exit(0);
        }
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
