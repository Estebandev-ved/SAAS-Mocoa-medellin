require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// Venta de mostrador (caja del negocio) — docs/ecosistema-inventario-facturacion.md, módulo C. Idempotente.
//  - caja_turnos: apertura/cierre con arqueo (plata contada vs. la que debería haber).
//  - ventas_mostrador (+ items): ventas hechas en el local; descuentan el mismo inventario que el bot.
//  - caja_gastos: salidas de plata del turno (compras menores, propinas, etc.).
// Costo por producto (lo que le cuesta al dueño cada unidad) y su copia en cada venta: así "¿cuánto gané?"
// no cambia hacia atrás cuando el dueño actualiza el costo después. NULL = costo desconocido.
async function agregarColumna(tabla, columna, definicion) {
    const [r] = await db.execute(
        'SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        [tabla, columna]
    );
    if (r.length) { console.log(`[SKIP] ${tabla}.${columna} ya existe`); return; }
    await db.execute(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
    console.log(`[OK] ${tabla}.${columna} agregada`);
}

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
        // Fiado: clientes que deben y sus movimientos. El saldo se calcula (cargos − abonos), no se guarda.
        await db.execute(`
            CREATE TABLE IF NOT EXISTS fiado_clientes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negocio_id INT NOT NULL,
                nombre VARCHAR(80) NOT NULL,
                telefono VARCHAR(20) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
                UNIQUE KEY uk_fiado_cliente (negocio_id, nombre)
            ) ENGINE=InnoDB
        `);
        await db.execute(`
            CREATE TABLE IF NOT EXISTS fiado_movimientos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negocio_id INT NOT NULL,
                cliente_id INT NOT NULL,
                tipo ENUM('cargo', 'abono') NOT NULL,
                monto DECIMAL(12,2) NOT NULL,
                venta_id INT NULL,
                turno_id INT NULL,
                metodo_pago VARCHAR(20) NULL,
                nota VARCHAR(200) NULL,
                anulado TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
                FOREIGN KEY (cliente_id) REFERENCES fiado_clientes(id) ON DELETE CASCADE,
                INDEX idx_fiado_cliente (cliente_id, anulado),
                INDEX idx_fiado_venta (venta_id),
                INDEX idx_fiado_turno (negocio_id, turno_id)
            ) ENGINE=InnoDB
        `);
        console.log('[OK] tablas de fiado (fiado_clientes, fiado_movimientos)');
        await agregarColumna('productos', 'costo', 'DECIMAL(12,2) NULL');
        await agregarColumna('ventas_mostrador_items', 'costo_unitario', 'DECIMAL(12,2) NULL');
        console.log('\n✅ Migración mostrador completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
