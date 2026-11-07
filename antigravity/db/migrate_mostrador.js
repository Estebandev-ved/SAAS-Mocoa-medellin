require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// Venta de mostrador (caja del negocio) — docs/ecosistema-inventario-facturacion.md, módulo C. Idempotente.
//  - caja_turnos: apertura/cierre con arqueo (plata contada vs. la que debería haber).
//  - ventas_mostrador (+ items): ventas hechas en el local; descuentan el mismo inventario que el bot.
//  - caja_gastos: salidas de plata del turno (compras menores, propinas, etc.).
async function run() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS caja_turnos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negocio_id INT NOT NULL,
                monto_inicial DECIMAL(12,2) NOT NULL DEFAULT 0,
                abierto_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                cerrado_en TIMESTAMP NULL,
                monto_contado DECIMAL(12,2) NULL,
                monto_esperado DECIMAL(12,2) NULL,
                notas VARCHAR(200) NULL,
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
                INDEX idx_turno_negocio (negocio_id, cerrado_en)
            ) ENGINE=InnoDB
        `);
        await db.execute(`
            CREATE TABLE IF NOT EXISTS ventas_mostrador (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negocio_id INT NOT NULL,
                turno_id INT NULL,
                numero VARCHAR(30) NULL,
                total DECIMAL(12,2) NOT NULL,
                metodo_pago VARCHAR(20) NOT NULL DEFAULT 'efectivo',
                recibido DECIMAL(12,2) NULL,
                estado VARCHAR(12) NOT NULL DEFAULT 'pagada',
                nota VARCHAR(200) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                anulada_en TIMESTAMP NULL,
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
                INDEX idx_venta_negocio_fecha (negocio_id, created_at),
                INDEX idx_venta_turno (turno_id)
            ) ENGINE=InnoDB
        `);
        await db.execute(`
            CREATE TABLE IF NOT EXISTS ventas_mostrador_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                venta_id INT NOT NULL,
                producto_id INT NULL,
                nombre VARCHAR(150) NOT NULL,
                cantidad INT NOT NULL,
                precio_unitario DECIMAL(12,2) NOT NULL,
                FOREIGN KEY (venta_id) REFERENCES ventas_mostrador(id) ON DELETE CASCADE,
                INDEX idx_item_venta (venta_id)
            ) ENGINE=InnoDB
        `);
        await db.execute(`
            CREATE TABLE IF NOT EXISTS caja_gastos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negocio_id INT NOT NULL,
                turno_id INT NULL,
                concepto VARCHAR(120) NOT NULL,
                monto DECIMAL(12,2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
                INDEX idx_gasto_turno (negocio_id, turno_id)
            ) ENGINE=InnoDB
        `);
        console.log('[OK] tablas de venta de mostrador (caja_turnos, ventas_mostrador, ventas_mostrador_items, caja_gastos)');
        console.log('\n✅ Migración mostrador completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
