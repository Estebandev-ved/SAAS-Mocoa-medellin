require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');
const { SQL_TABLA_PROSPECTOS } = require('./prospectosTabla');

// Registro de prospectos (posibles clientes de la plataforma) para el panel admin:
// a quién se le hizo/envió un video, en qué va la conversación y cuándo hacer seguimiento.
async function run() {
    try {
        await db.execute(SQL_TABLA_PROSPECTOS);
        console.log('[OK] prospectos');
        console.log('\n✅ Migración prospectos completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
