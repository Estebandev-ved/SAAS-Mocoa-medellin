require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// Suma reputación/tiempos límite/código de confirmación sobre las tablas
// de domicilios ya existentes (db/queries/db_domicilios.sql). Usa
// ALTER TABLE por columna individual (no "ADD COLUMN IF NOT EXISTS") para
// no depender de MySQL 8.0.29+; si la columna ya existe, MySQL tira
// ER_DUP_FIELDNAME y simplemente la saltamos, igual que el resto de
// migraciones de esta carpeta.

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
        await agregarColumna('domiciliarios', "score INT NOT NULL DEFAULT 100 COMMENT 'Reputacion 0-100'");
        await agregarColumna('domiciliarios', "strikes INT NOT NULL DEFAULT 0 COMMENT 'Incidentes graves acumulados'");
        await agregarColumna('domiciliarios', "suspendido_hasta DATETIME NULL COMMENT 'Si esta en el futuro no puede aceptar domicilios'");

        await agregarColumna('domicilios', "codigo_confirmacion VARCHAR(6) NULL COMMENT 'Codigo que el cliente le da al domiciliario'");
        await agregarColumna('domicilios', "limite_entrega_at DATETIME NULL COMMENT 'Fecha limite estimada de entrega'");
        await agregarColumna('domicilios', "estado_incidente ENUM('ninguno','retrasado','en_disputa','robo_confirmado','resuelto') NOT NULL DEFAULT 'ninguno'");
        await agregarColumna('domicilios', "calificacion_cliente TINYINT NULL COMMENT '1-5, la pone el cliente'");

        await agregarColumna('clientes', "direccion_guardada VARCHAR(255) NULL COMMENT 'Ultima direccion de entrega usada, para no pedirla de nuevo'");

        console.log('\n✅ Migración domicilios_v2 completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
