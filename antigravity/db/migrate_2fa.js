require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// Verificación en dos pasos (TOTP). El secreto se guarda cifrado (AES-GCM, ver api/services/totp.js);
// los códigos de respaldo se guardan como hash SHA-256. totp_ultimo_paso evita reusar un código.
const COLUMNAS = [
    ['totp_secret', 'VARCHAR(255) NULL'],
    ['totp_activo', 'BOOLEAN NOT NULL DEFAULT false'],
    ['totp_backup_codes', 'TEXT NULL'],
    ['totp_ultimo_paso', 'BIGINT NULL'],
];

async function run() {
    try {
        for (const [nombre, def] of COLUMNAS) {
            try {
                await db.execute(`ALTER TABLE negocios ADD COLUMN ${nombre} ${def}`);
                console.log(`[OK] negocios.${nombre}`);
            } catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME') console.log(`[SKIP] negocios.${nombre} ya existe`);
                else throw e;
            }
        }
        console.log('\n✅ Migración 2FA completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
