// Plan Universitario: la Caja más barata para estudiantes que verifican su correo de la universidad.
//  1. Agrega 'universitario' al ENUM de plan (negocios, suscripciones, automatizaciones_config).
//  2. Crea verificaciones_universitarias: un registro por negocio con el correo, el código pendiente
//     (solo su hash) y hasta cuándo vale la verificación. Un correo verificado no puede servir a dos negocios.
// Idempotente: corre en cada arranque (api/arranque.js) y en migrate_all.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');
const { agregarPlanAlEnum } = require('./agregarPlanEnum');

const SQL_TABLA = `
CREATE TABLE IF NOT EXISTS verificaciones_universitarias (
    negocio_id INT NOT NULL PRIMARY KEY,
    correo VARCHAR(190) NOT NULL,
    codigo_hash CHAR(64) NULL,
    codigo_expira DATETIME NULL,
    intentos TINYINT UNSIGNED NOT NULL DEFAULT 0,
    envios_hoy TINYINT UNSIGNED NOT NULL DEFAULT 0,
    envios_fecha DATE NULL,
    verificado_en DATETIME NULL,
    valido_hasta DATETIME NULL,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_verif_univ_correo (correo),
    CONSTRAINT fk_verif_univ_negocio FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

async function run() {
    try {
        await agregarPlanAlEnum('universitario');
        await db.execute(SQL_TABLA);
        console.log('[OK] verificaciones_universitarias');
        process.exit(0);
    } catch (e) {
        console.error('migrate_plan_universitario falló:', e.message);
        process.exit(1);
    }
}

run();
