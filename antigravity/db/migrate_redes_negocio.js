require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// Redes sociales del negocio del cliente (el bot las comparte cuando el cliente las pide).
// Idempotente: solo agrega las columnas que faltan.
const COLUMNAS = ['instagram_url', 'facebook_url', 'tiktok_url'];

async function run() {
    try {
        for (const col of COLUMNAS) {
            const [r] = await db.execute(
                "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'negocios' AND COLUMN_NAME = ?", [col]
            );
            if (r.length) { console.log(`[SKIP] negocios.${col} ya existe`); continue; }
            await db.execute(`ALTER TABLE negocios ADD COLUMN ${col} VARCHAR(300) NULL`);
            console.log(`[OK] negocios.${col} agregada`);
        }
        console.log('\n✅ Migración redes del negocio completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
