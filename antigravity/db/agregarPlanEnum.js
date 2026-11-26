// Agrega un plan nuevo al ENUM de plan en las tres tablas que lo definen: negocios.plan,
// suscripciones.plan y automatizaciones_config.plan_requerido. Idempotente: si el valor ya está en
// el ENUM, no toca nada. Se agrega AL FINAL de la lista para que MySQL no reescriba las filas existentes.
const db = require('./config');

const COLUMNAS = [
    { tabla: 'negocios', columna: 'plan' },
    { tabla: 'suscripciones', columna: 'plan' },
    { tabla: 'automatizaciones_config', columna: 'plan_requerido' },
];

async function agregarValor(nuevoPlan, { tabla, columna }) {
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
    if (valores.includes(nuevoPlan)) {
        console.log(`${tabla}.${columna}: ya incluye '${nuevoPlan}'`);
        return;
    }

    const lista = [...valores, nuevoPlan].map(v => `'${v}'`).join(',');
    // Conserva nulabilidad y default tal como estaban. MariaDB devuelve el default
    // ya entre comillas ('starter'); MySQL lo devuelve pelado: se normaliza.
    const nulabilidad = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
    const defecto = col.COLUMN_DEFAULT !== null
        ? ` DEFAULT '${String(col.COLUMN_DEFAULT).replace(/^'(.*)'$/, '$1').replace(/'/g, "''")}'`
        : '';

    // tabla, columna y plan salen de listas fijas del código, no de input externo.
    await db.query(`ALTER TABLE \`${tabla}\` MODIFY COLUMN \`${columna}\` ENUM(${lista}) ${nulabilidad}${defecto}`);
    console.log(`${tabla}.${columna}: agregado '${nuevoPlan}'`);
}

async function agregarPlanAlEnum(nuevoPlan) {
    if (!/^[a-z_]+$/.test(nuevoPlan)) throw new Error(`Nombre de plan no válido: ${nuevoPlan}`);
    for (const c of COLUMNAS) await agregarValor(nuevoPlan, c);
}

module.exports = { agregarPlanAlEnum };
