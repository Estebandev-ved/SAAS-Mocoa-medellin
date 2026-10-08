// Crea el esquema completo y corre todas las migraciones, en orden, una sola vez.
// Es idempotente: guarda en la tabla _migraciones cada archivo ya aplicado y lo
// salta la próxima vez, así que se puede ejecutar en cada deploy sin riesgo.
//
//   npm run migrate
//
// Usa las mismas variables que la API (MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD,
// MYSQL_DATABASE, y opcionalmente MYSQL_PORT). La base de datos debe existir ya
// (en Railway la crea el servicio MySQL).
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');

// El orden importa: primero el esquema base, luego lo que se le fue agregando.
const MIGRACIONES = [
    'schema.sql',
    'queries/db_modulos.sql',
    'queries/db_domicilios.sql',
    'migrate_usuarios.js',
    'migrate_admin_panel.js',
    'migrate_business_info.js',
    'migrate_clientes_extra.js',
    'migrate_consent.js',
    'migrate_whitelist.js',
    'migrate_horarios.js',
    'migrate_multichannel.js',
    'migrate_voice_bot.sql', // necesita instagram_token, que agrega multichannel
    'migrate_pago_imagen.js',
    'migrate_avatar.js',
    'migrate_campanas.js',
    'migrate_billing.js',
    'migrate_domicilios_v2.js',
    'migrate_geocoding.js',
    'migrate_categoria_productos.js',
    'migrate_plan_emprendedor.js',
    'migrate_plan_pendiente.js',
    'migrate_efipay.js',
    'migrate_marketplace.js',
    'migrate_incidentes_v2.js',
    'migrate_ui_estado.js',
];

const BASE = process.env.MYSQL_DATABASE || 'antigravity';

function conexion() {
    return mysql.createConnection({
        host: process.env.MYSQL_HOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT || '3306', 10),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: BASE,
        multipleStatements: true,
    });
}

// Los .sql traen CREATE DATABASE / USE antigravity fijos; la base real la manda
// MYSQL_DATABASE (en Railway se llama distinto), así que se quitan.
function limpiarSql(sql) {
    // schema.sql termina con datos de prueba, entre ellos un usuario admin con
    // contraseña conocida (está escrita en el propio archivo). Eso no puede
    // llegar a producción: se corta todo desde ese encabezado.
    const corte = sql.indexOf('-- DATOS DE PRUEBA');
    if (corte !== -1) sql = sql.slice(0, corte);
    return sql
        .replace(/CREATE DATABASE[^;]*;/gi, '')
        .replace(/^\s*USE\s+`?\w+`?\s*;/gim, '');
}

// Errores que solo dicen "esto ya estaba": se ignoran para poder reintentar una
// migración que quedó a medias.
const YA_EXISTE = new Set(['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME', 'ER_TABLE_EXISTS_ERROR']);

async function aplicarSql(con, archivo) {
    const sql = limpiarSql(fs.readFileSync(path.join(__dirname, archivo), 'utf8'))
        .replace(/^\s*--.*$/gm, '')
        // "ADD COLUMN IF NOT EXISTS" es solo de MariaDB; MySQL 8 no lo acepta.
        .replace(/ADD COLUMN IF NOT EXISTS/gi, 'ADD COLUMN');
    for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) {
        try {
            await con.query(stmt);
        } catch (err) {
            if (!YA_EXISTE.has(err.code)) throw err;
        }
    }
}

function aplicarJs(archivo) {
    // Cada migrate_*.js se ejecuta solo y termina el proceso, por eso va aparte.
    const r = spawnSync(process.execPath, [path.join(__dirname, archivo)], {
        stdio: 'inherit',
        env: process.env,
    });
    if (r.status !== 0) throw new Error(`${archivo} terminó con código ${r.status}`);
}

async function main() {
    const con = await conexion();
    try {
        // MySQL 8 ya lo trae activo; en MariaDB un TIMESTAMP sin NULL explícito
        // se vuelve NOT NULL y el esquema falla.
        await con.query('SET SESSION explicit_defaults_for_timestamp = 1').catch(() => {});
        await con.query(`CREATE TABLE IF NOT EXISTS _migraciones (
            archivo VARCHAR(120) PRIMARY KEY,
            aplicada_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        const [filas] = await con.query('SELECT archivo FROM _migraciones');
        const hechas = new Set(filas.map(f => f.archivo));

        for (const archivo of MIGRACIONES) {
            if (hechas.has(archivo)) {
                console.log(`[SKIP] ${archivo} (ya aplicada)`);
                continue;
            }
            console.log(`[RUN ] ${archivo}`);
            if (archivo.endsWith('.sql')) await aplicarSql(con, archivo);
            else aplicarJs(archivo);
            await con.query('INSERT INTO _migraciones (archivo) VALUES (?)', [archivo]);
            console.log(`[OK  ] ${archivo}`);
        }
        console.log('Migraciones al día.');
    } finally {
        await con.end();
    }
}

main().catch(err => {
    console.error('Falló la migración:', err.message);
    process.exit(1);
});
