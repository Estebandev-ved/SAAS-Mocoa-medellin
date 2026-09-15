require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

async function run() {
    const tables = [
        `CREATE TABLE IF NOT EXISTS invoices (
            id INT AUTO_INCREMENT PRIMARY KEY,
            negocio_id INT NOT NULL,
            numero VARCHAR(50) NOT NULL UNIQUE,
            plan VARCHAR(50) NOT NULL,
            monto DECIMAL(12,2) NOT NULL,
            moneda VARCHAR(10) DEFAULT 'COP',
            estado ENUM('pendiente', 'pagada', 'vencida', 'cancelada') DEFAULT 'pendiente',
            metodo_pago VARCHAR(50),
            stripe_invoice_id VARCHAR(255),
            stripe_payment_intent VARCHAR(255),
            fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            fecha_pago TIMESTAMP NULL,
            fecha_vencimiento TIMESTAMP NULL,
            descripcion TEXT,
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS billing_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            negocio_id INT NOT NULL,
            tipo ENUM('upgrade', 'downgrade', 'renewal', 'trial_start', 'trial_end', 'payment_success', 'payment_failed', 'cancellation', 'reactivation') NOT NULL,
            plan_anterior VARCHAR(50),
            plan_nuevo VARCHAR(50),
            monto DECIMAL(12,2) DEFAULT 0,
            descripcion TEXT,
            stripe_event_id VARCHAR(255),
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS subscription_usage (
            id INT AUTO_INCREMENT PRIMARY KEY,
            negocio_id INT NOT NULL,
            periodo VARCHAR(7) NOT NULL COMMENT 'YYYY-MM',
            mensajes_usados INT DEFAULT 0,
            clientes_nuevos INT DEFAULT 0,
            productos_creados INT DEFAULT 0,
            campañas_enviadas INT DEFAULT 0,
            ai_tokens_usados INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_periodo (negocio_id, periodo),
            FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE
        )`,
    ];

    for (const sql of tables) {
        try {
            const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
            await db.execute(sql);
            console.log(`Tabla ${tableName} OK`);
        } catch (e) {
            console.log(`Error:`, e.message);
        }
    }

    // Add trial_hasta column if missing
    try {
        await db.execute("ALTER TABLE negocios ADD COLUMN trial_inicio TIMESTAMP NULL");
        console.log('Column trial_inicio added');
    } catch (e) {
        console.log('trial_inicio:', e.code === 'ER_DUP_FIELDNAME' ? 'exists' : e.message);
    }

    process.exit(0);
}

run();
