require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// Suscripciones Web Push (PWA fase 2): un navegador/celular del dueño que aceptó
// recibir avisos de pedido nuevo. endpoint_hash (SHA-256) existe solo para poder
// tener una llave única — el endpoint real es demasiado largo para un índice.
async function run() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negocio_id INT NOT NULL,
                endpoint TEXT NOT NULL,
                endpoint_hash CHAR(64) NOT NULL,
                p256dh VARCHAR(255) NOT NULL,
                auth VARCHAR(255) NOT NULL,
                user_agent VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_endpoint (endpoint_hash),
                INDEX idx_negocio (negocio_id),
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);
        console.log('[OK] push_subscriptions');
        console.log('\n✅ Migración push completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
