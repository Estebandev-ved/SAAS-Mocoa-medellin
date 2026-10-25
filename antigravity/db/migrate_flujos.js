require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// Constructor de flujos (docs/constructor-de-flujos.md). Idempotente.
//  - flujos: el grafo completo vive en `definicion` (JSON) para guardarlo y leerlo de una sola vez;
//    `palabra_clave` y `primer_mensaje` se copian aparte para buscar el disparador sin leer el JSON.
//  - flujo_ejecuciones: por dónde va un cliente dentro de un flujo.
//  - etiquetas_cliente: etiquetas que ponen los flujos (segmentos para campañas).
async function run() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS flujos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negocio_id INT NOT NULL,
                nombre VARCHAR(100) NOT NULL,
                activo BOOLEAN NOT NULL DEFAULT FALSE,
                definicion JSON NOT NULL,
                palabra_clave VARCHAR(60) NULL,
                primer_mensaje BOOLEAN NOT NULL DEFAULT FALSE,
                version INT NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
                INDEX idx_flujos_negocio (negocio_id, activo)
            ) ENGINE=InnoDB
        `);
        console.log('[OK] tabla flujos');

        await db.execute(`
            CREATE TABLE IF NOT EXISTS flujo_ejecuciones (
                id INT AUTO_INCREMENT PRIMARY KEY,
                flujo_id INT NOT NULL,
                negocio_id INT NOT NULL,
                cliente_id INT NOT NULL,
                nodo_actual VARCHAR(40) NULL,
                estado ENUM('esperando_respuesta', 'esperando_tiempo', 'terminada', 'error') NOT NULL,
                contexto JSON NULL,
                reanudar_en DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (flujo_id) REFERENCES flujos(id) ON DELETE CASCADE,
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
                INDEX idx_ejec_cliente (negocio_id, cliente_id, estado),
                INDEX idx_ejec_reanudar (estado, reanudar_en)
            ) ENGINE=InnoDB
        `);
        console.log('[OK] tabla flujo_ejecuciones');

        await db.execute(`
            CREATE TABLE IF NOT EXISTS etiquetas_cliente (
                negocio_id INT NOT NULL,
                cliente_id INT NOT NULL,
                etiqueta VARCHAR(40) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (negocio_id, cliente_id, etiqueta),
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
                FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
                INDEX idx_etiqueta (negocio_id, etiqueta)
            ) ENGINE=InnoDB
        `);
        console.log('[OK] tabla etiquetas_cliente');

        // Disparadores por evento (pedido pagado/entregado, cliente inactivo): el flujo arranca solo, sin palabra clave.
        for (const [columna, definicion] of [['evento', 'VARCHAR(30) NULL'], ['evento_dias', 'INT NULL']]) {
            const [existe] = await db.execute(
                "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flujos' AND COLUMN_NAME = ?", [columna]
            );
            if (existe.length) { console.log(`[SKIP] flujos.${columna} ya existe`); continue; }
            await db.execute(`ALTER TABLE flujos ADD COLUMN ${columna} ${definicion}`);
            console.log(`[OK] flujos.${columna} agregada`);
        }

        // Las campañas pueden dirigirse a una etiqueta: se agrega el valor al ENUM de segmento (conserva los datos).
        const [col] = await db.execute(
            "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campañas' AND COLUMN_NAME = 'segmento'"
        );
        if (col.length && /^enum/i.test(col[0].COLUMN_TYPE) && !/'etiqueta'/.test(col[0].COLUMN_TYPE)) {
            await db.execute("ALTER TABLE `campañas` MODIFY COLUMN segmento ENUM('todos','compraron_x','inactivos','nuevos','etiqueta') DEFAULT 'todos'");
            console.log("[OK] campañas.segmento acepta 'etiqueta'");
        } else {
            console.log('[SKIP] campañas.segmento ya acepta etiqueta (o no es ENUM)');
        }

        console.log('\n✅ Migración flujos completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
