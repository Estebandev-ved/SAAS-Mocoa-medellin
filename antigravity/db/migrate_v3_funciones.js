require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// Atención humana, cupones, encuestas de satisfacción y fotos de producto.
// Idempotente: se puede correr varias veces.
async function agregarColumna(sql) {
    try {
        await db.execute(sql);
        console.log(`[OK] ${sql.slice(0, 70)}`);
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') console.log(`[ya existe] ${sql.slice(0, 70)}`);
        else throw e;
    }
}

async function run() {
    try {
        // 2. Atención humana: mientras esté en 1, el bot no le responde a ese cliente.
        await agregarColumna('ALTER TABLE clientes ADD COLUMN atencion_humana TINYINT(1) NOT NULL DEFAULT 0');
        await agregarColumna('ALTER TABLE clientes ADD COLUMN humano_desde TIMESTAMP NULL');

        // 5. Cupones de descuento
        await db.execute(`
            CREATE TABLE IF NOT EXISTS cupones (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negocio_id INT NOT NULL,
                codigo VARCHAR(30) NOT NULL,
                tipo ENUM('porcentaje','fijo') NOT NULL DEFAULT 'porcentaje',
                valor DECIMAL(10,2) NOT NULL,
                minimo_compra DECIMAL(10,2) NOT NULL DEFAULT 0,
                usos_max INT NULL,
                usos INT NOT NULL DEFAULT 0,
                vence_el DATE NULL,
                activo TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_negocio_codigo (negocio_id, codigo),
                INDEX idx_negocio_activo (negocio_id, activo),
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);
        console.log('[OK] cupones');
        await agregarColumna('ALTER TABLE pedidos ADD COLUMN cupon_codigo VARCHAR(30) NULL');

        // 8. Encuestas de satisfacción (1 a 5 estrellas tras la entrega)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS encuestas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negocio_id INT NOT NULL,
                pedido_id INT NOT NULL,
                cliente_id INT NULL,
                calificacion TINYINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_pedido (pedido_id),
                INDEX idx_negocio (negocio_id, created_at),
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);
        console.log('[OK] encuestas');

        console.log('\n✅ Migración v3 (funciones) completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
