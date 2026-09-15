require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

async function run() {
    const columns = [
        ["ALTER TABLE negocios ADD COLUMN suspendido BOOLEAN DEFAULT false", 'suspendido'],
        ["ALTER TABLE negocios ADD COLUMN suspendido_razon VARCHAR(255)", 'suspendido_razon'],
        ["ALTER TABLE negocios ADD COLUMN suspended_at TIMESTAMP NULL", 'suspended_at']
    ];

    for (const [sql, name] of columns) {
        try {
            await db.execute(sql);
            console.log(`Columna ${name} agregada`);
        } catch (e) {
            console.log(`${name}:`, e.code === 'ER_DUP_FIELDNAME' ? 'ya existe' : e.message);
        }
    }

    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS platform_config (
                id INT AUTO_INCREMENT PRIMARY KEY,
                seccion VARCHAR(50) NOT NULL UNIQUE,
                datos JSON,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
        `);
        console.log('Tabla platform_config OK');
    } catch (e) {
        console.log('platform_config:', e.message);
    }

    process.exit(0);
}

run();
