require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// Empresa de domicilios con varios restaurantes bajo un solo WhatsApp (a pedido
// del socio, 23 sept): hasta ahora una cuenta de Antigravity = un negocio = una
// carta. Este cambio NO toca ese caso — todas las columnas nuevas son NULL por
// defecto, así que un negocio sin filas en `restaurantes` sigue funcionando
// exactamente igual que antes (bot, catálogo y domicilios sin ningún cambio de
// comportamiento). El modo "empresa de domicilios" se activa solo con que el
// negocio tenga al menos un restaurante registrado — no hay una bandera aparte
// que se pueda desincronizar de la realidad.

async function agregarColumna(tabla, definicion) {
    try {
        await db.execute(`ALTER TABLE ${tabla} ADD COLUMN ${definicion}`);
        console.log(`[OK] ${tabla}: ${definicion}`);
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log(`[SKIP] ${tabla}: la columna ya existe (${definicion.split(' ')[0]})`);
        } else {
            console.error(`[WARN] ${tabla}: ${error.message}`);
        }
    }
}

async function run() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS restaurantes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negocio_id INT NOT NULL,
                nombre VARCHAR(150) NOT NULL,
                descripcion VARCHAR(255) NULL,
                categoria VARCHAR(80) NULL COMMENT 'Tipo de cocina, para mostrar en el listado: Comida rapida, Italiana, etc.',
                direccion VARCHAR(255) NULL COMMENT 'Punto de recogida del domicilio, distinto de la direccion del negocio duenio',
                ciudad VARCHAR(100) NULL,
                lat DECIMAL(10, 8) NULL COMMENT 'Se geocodifica solo, igual que negocios.lat',
                lng DECIMAL(11, 8) NULL,
                logo_url VARCHAR(500) NULL,
                activo BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
                INDEX idx_negocio_restaurante (negocio_id, activo)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('[OK] tabla restaurantes');

        await agregarColumna('productos', "restaurante_id INT NULL COMMENT 'NULL = catalogo del negocio directo, sin marketplace'");
        await agregarColumna('pedidos', "restaurante_id INT NULL COMMENT 'De cual restaurante es este pedido, si el negocio es una empresa de domicilios'");
        await agregarColumna('conversaciones', "restaurante_id INT NULL COMMENT 'Restaurante que el cliente eligio en esta conversacion (empresa de domicilios)'");
        await agregarColumna('domicilios', "restaurante_id INT NULL COMMENT 'Punto de recogida: el restaurante, no el negocio duenio de la cuenta'");

        // FKs por separado: si la tabla ya tenía la columna de una corrida previa
        // sin la constraint (por ejemplo, ALTER a medias), esto reintenta solo la FK.
        const fks = [
            ['productos', 'fk_productos_restaurante', 'restaurante_id', 'restaurantes(id)', 'SET NULL'],
            ['pedidos', 'fk_pedidos_restaurante', 'restaurante_id', 'restaurantes(id)', 'SET NULL'],
            ['conversaciones', 'fk_conversaciones_restaurante', 'restaurante_id', 'restaurantes(id)', 'SET NULL'],
            ['domicilios', 'fk_domicilios_restaurante', 'restaurante_id', 'restaurantes(id)', 'SET NULL'],
        ];
        for (const [tabla, nombreFk, columna, referencia, onDelete] of fks) {
            try {
                await db.execute(`ALTER TABLE ${tabla} ADD CONSTRAINT ${nombreFk} FOREIGN KEY (${columna}) REFERENCES ${referencia} ON DELETE ${onDelete}`);
                console.log(`[OK] FK ${nombreFk}`);
            } catch (error) {
                if (error.code === 'ER_DUP_KEYNAME' || error.code === 'ER_FK_DUP_NAME') {
                    console.log(`[SKIP] FK ${nombreFk} ya existe`);
                } else {
                    console.error(`[WARN] FK ${nombreFk}: ${error.message}`);
                }
            }
        }

        console.log('\n✅ Migración marketplace completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
