// Agrega el plan 'emprendedor' (la "caja") al ENUM de plan en las tres tablas
// que lo definen: negocios.plan, suscripciones.plan y
// automatizaciones_config.plan_requerido. Idempotente: si el valor ya está en
// el ENUM, no toca nada. Se agrega AL FINAL de la lista para que MySQL no tenga
// que reescribir las filas existentes.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

const NUEVO_PLAN = 'emprendedor';

const COLUMNAS = [
    { tabla: 'negocios', columna: 'plan' },
    { tabla: 'suscripciones', columna: 'plan' },
    { tabla: 'automatizaciones_config', columna: 'plan_requerido' },
];

async function agregarValor({ tabla, columna }) {
    const [rows] = await db.execute(
        `SELECT DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [tabla, columna]
    );

    if (rows.length === 0) {
        console.log(`${tabla}.${columna}: no existe (omitida)`);
        return;
    }

    const col = rows[0];
    // Si alguien ya la convirtió a VARCHAR, cualquier valor entra: nada que hacer.
    if (col.DATA_TYPE !== 'enum') {
        console.log(`${tabla}.${columna}: no es ENUM (${col.COLUMN_TYPE}), no requiere cambio`);
        return;
    }

    // COLUMN_TYPE llega como enum('starter','professional','enterprise')
    const valores = [...col.COLUMN_TYPE.matchAll(/'((?:[^']|'')*)'/g)].map(m => m[1]);
    if (valores.includes(NUEVO_PLAN)) {
        console.log(`${tabla}.${columna}: ya incluye '${NUEVO_PLAN}'`);
        return;
    }

    const lista = [...valores, NUEVO_PLAN].map(v => `'${v}'`).join(',');
    // Conserva nulabilidad y default tal como estaban. MariaDB devuelve el default
    // ya entre comillas ('starter'); MySQL lo devuelve pelado: se normaliza.
    const nulabilidad = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
    const defecto = col.COLUMN_DEFAULT !== null
        ? ` DEFAULT '${String(col.COLUMN_DEFAULT).replace(/^'(.*)'$/, '$1').replace(/'/g, "''")}'`
        : '';

    // tabla y columna salen de la lista fija de arriba, no de input externo.
    await db.query(`ALTER TABLE \`${tabla}\` MODIFY COLUMN \`${columna}\` ENUM(${lista}) ${nulabilidad}${defecto}`);
    console.log(`${tabla}.${columna}: agregado '${NUEVO_PLAN}'`);
}

async function run() {
    let codigo = 0;
    try {
        for (const c of COLUMNAS) {
            await agregarValor(c);
        }
    } catch (e) {
        console.error('migrate_plan_emprendedor falló:', e.message);
        codigo = 1;
    }
    process.exit(codigo);
}

run();
