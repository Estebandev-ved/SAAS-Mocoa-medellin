require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

async function run() {
    const cols = [
        "ALTER TABLE clientes ADD COLUMN email VARCHAR(150)",
        "ALTER TABLE clientes ADD COLUMN onboarding_estado ENUM('pendiente','nombre','email','completado') DEFAULT 'pendiente'"
    ];

    for (const sql of cols) {
        try {
            await db.execute(sql);
            console.log('OK:', sql.match(/ADD COLUMN (\w+)/)[1]);
        } catch (e) {
            console.log('Skip:', e.code === 'ER_DUP_FIELDNAME' ? 'already exists' : e.message);
        }
    }

    // Mark existing clients as completed
    await db.execute("UPDATE clientes SET onboarding_estado = 'completado' WHERE onboarding_estado IS NULL");

    const [r] = await db.execute('SELECT id, nombre, whatsapp, email, onboarding_estado FROM clientes WHERE negocio_id = 8 LIMIT 5');
    console.log('\nClientes:', JSON.stringify(r, null, 2));
    process.exit(0);
}

run();
