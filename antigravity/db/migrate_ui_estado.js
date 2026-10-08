require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// Estado de interfaz del negocio: logros celebrados y consejos de los personajes ya vistos.
// JSON en texto ({"vistos": ["producto", "tip:pedidos", ...]}); el servidor lo valida en api/services/uiEstado.js.

async function run() {
    try {
        await db.execute("ALTER TABLE negocios ADD COLUMN ui_estado LONGTEXT NULL COMMENT 'JSON con logros y consejos ya vistos en el panel'");
        console.log('[OK] negocios.ui_estado');
        console.log('\n✅ Migración ui_estado completada');
        process.exit(0);
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('[SKIP] negocios.ui_estado ya existe');
            process.exit(0);
        }
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
