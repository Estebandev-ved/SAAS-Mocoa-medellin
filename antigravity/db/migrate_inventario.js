require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// Inventario con movimientos (docs/ecosistema-inventario-facturacion.md, Fase 1). Idempotente.
//  - productos.controla_stock: OPT-IN (0 por defecto). Hoy `stock` vale 0 en casi todos los productos
//    (servicios, platos, etc.); si se controlara para todos, el bot dejaría de vender todo de golpe.
//  - productos.stock_minimo: umbral propio para la alerta de stock bajo.
//  - productos.sku: código interno, útil para importar/actualizar desde Excel.
//  - inventario_movimientos: historial de cada cambio de stock (entrada, salida, ajuste, devolución).
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
        await agregarColumna('productos', 'controla_stock', 'TINYINT(1) NOT NULL DEFAULT 0');
        await agregarColumna('productos', 'stock_minimo', 'INT NULL');
        await agregarColumna('productos', 'sku', 'VARCHAR(40) NULL');

        const [idx] = await db.execute(
            "SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'productos' AND INDEX_NAME = 'uk_producto_sku'"
        );
        if (idx.length === 0) {
            // NULL no cuenta como repetido, así que los productos sin SKU no chocan entre sí.
            await db.execute('ALTER TABLE productos ADD UNIQUE KEY uk_producto_sku (negocio_id, sku)');
            console.log('[OK] índice único (negocio_id, sku)');
        }

        await db.execute(`
            CREATE TABLE IF NOT EXISTS inventario_movimientos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negocio_id INT NOT NULL,
                producto_id INT NOT NULL,
                tipo ENUM('entrada', 'salida', 'ajuste', 'devolucion') NOT NULL,
                cantidad INT NOT NULL,
                stock_resultante INT NOT NULL,
                motivo VARCHAR(160) NULL,
                referencia_tipo VARCHAR(20) NULL,
                referencia_id INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
                FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
                INDEX idx_mov_producto (negocio_id, producto_id, created_at),
                INDEX idx_mov_referencia (negocio_id, referencia_tipo, referencia_id)
            ) ENGINE=InnoDB
        `);
        console.log('[OK] tabla inventario_movimientos');

        console.log('\n✅ Migración inventario completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
