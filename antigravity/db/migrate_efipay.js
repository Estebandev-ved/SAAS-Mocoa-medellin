require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// Pagos de suscripción por Efipay. Efipay solo sabe de un monto y una referencia,
// así que aquí queda registrado qué negocio y qué plan se pagan: el webhook busca
// el pago en esta tabla y no confía en nada que venga del cliente.
async function run() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS pagos_efipay (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negocio_id INT NOT NULL,
                plan VARCHAR(30) NOT NULL,
                monto DECIMAL(12,2) NOT NULL,
                referencia VARCHAR(80) NOT NULL,
                payment_id VARCHAR(80) NULL,
                estado ENUM('pendiente','aprobado','rechazado') NOT NULL DEFAULT 'pendiente',
                efipay_status VARCHAR(40) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_referencia (referencia),
                INDEX idx_payment_id (payment_id),
                INDEX idx_negocio_estado (negocio_id, estado),
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);
        console.log('[OK] pagos_efipay');
        console.log('\n✅ Migración efipay completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
