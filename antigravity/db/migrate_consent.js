require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

async function run() {
    const cols = [
        "ALTER TABLE clientes ADD COLUMN acepta_datos TINYINT(1) DEFAULT 0",
        "ALTER TABLE clientes ADD COLUMN acepta_marketing TINYINT(1) DEFAULT 0",
        "ALTER TABLE clientes ADD COLUMN fecha_aceptacion TIMESTAMP NULL",
    ];

    for (const sql of cols) {
        try {
            await db.execute(sql);
            const col = sql.match(/ADD COLUMN (\w+)/)[1];
            console.log(`Columna ${col} agregada`);
        } catch (e) {
            console.log(`${e.code === 'ER_DUP_FIELDNAME' ? 'Ya existe' : 'Error'}: ${e.message.substring(0, 60)}`);
        }
    }

    // Update onboarding_estado enum to include new states
    try {
        await db.execute("ALTER TABLE clientes MODIFY COLUMN onboarding_estado ENUM('pendiente','nombre','email','aceptacion','completado') DEFAULT 'pendiente'");
        console.log('Enum actualizado con estado aceptacion');
    } catch (e) {
        console.log(`Enum: ${e.message.substring(0, 60)}`);
    }

    process.exit(0);
}

run();
