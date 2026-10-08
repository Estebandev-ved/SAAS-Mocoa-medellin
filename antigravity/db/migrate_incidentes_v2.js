require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// El reporte de un domiciliario ("Reportar problema") solo quedaba guardado como
// texto suelto dentro de una notificación genérica: el panel de Incidentes del
// dueño (GET /domicilios/incidentes) nunca lo leía, así que mostraba todos los
// reportes con la misma etiqueta "Posible pérdida/robo" sin importar el motivo
// real. Estas dos columnas guardan la categoría y el detalle directamente en
// el domicilio, para que el dueño vea qué pasó de verdad.

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
        await agregarColumna(
            'domicilios',
            "tipo_incidente ENUM('direccion','cliente_ausente','robo_sospecha','accidente','otro') NULL COMMENT 'Categoria que eligio el domiciliario al reportar'"
        );
        await agregarColumna(
            'domicilios',
            "motivo_incidente VARCHAR(255) NULL COMMENT 'Detalle libre que escribio el domiciliario al reportar'"
        );
        console.log('\n✅ Migración incidentes_v2 completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
