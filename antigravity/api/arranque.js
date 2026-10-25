// Tareas opcionales al arrancar la API, controladas por variables de entorno (se ponen en el
// panel de Railway; no hace falta consola). Nunca impiden que la API arranque.
//   RUN_MIGRATIONS_ON_START=true  -> corre db/migrate_all.js (idempotente) en segundo plano
//   ADMIN_EMAIL=tu@correo.com     -> da rol 'admin' a ese correo (el negocio debe existir)
const path = require('path');
const { spawn } = require('child_process');
const db = require('../db/config');

function correrMigraciones() {
    return new Promise((resolve) => {
        console.log('[Arranque] Corriendo migraciones (RUN_MIGRATIONS_ON_START)...');
        const hijo = spawn(process.execPath, [path.join(__dirname, '../db/migrate_all.js')], { stdio: 'inherit', env: process.env });
        hijo.on('error', (e) => { console.error('[Arranque] No se pudo iniciar la migración:', e.message); resolve(false); });
        hijo.on('exit', (code) => {
            console.log(code === 0 ? '[Arranque] Migraciones OK' : `[Arranque] Las migraciones terminaron con código ${code}; revisa el log de arriba`);
            resolve(code === 0);
        });
    });
}

// Tablas/columnas de las funciones v3 (atención humana, cupones, encuestas). Es idempotente
// y rápida, así que corre en cada arranque: el código nuevo nunca depende de que alguien
// se acuerde de poner RUN_MIGRATIONS_ON_START.
function asegurarEsquemaV3() {
    return new Promise((resolve) => {
        const hijo = spawn(process.execPath, [path.join(__dirname, '../db/migrate_v3_funciones.js')], { stdio: 'inherit', env: process.env });
        hijo.on('error', () => resolve(false));
        hijo.on('exit', (code) => resolve(code === 0));
    });
}

// Columnas de la verificación en dos pasos. Idempotente y rápida: corre en cada arranque
// para que el código nuevo no dependa de que alguien active RUN_MIGRATIONS_ON_START.
function asegurarEsquema2FA() {
    return new Promise((resolve) => {
        const hijo = spawn(process.execPath, [path.join(__dirname, '../db/migrate_2fa.js')], { stdio: 'inherit', env: process.env });
        hijo.on('error', () => resolve(false));
        hijo.on('exit', (code) => resolve(code === 0));
    });
}

// negocios.tipo_negocio pasó de ENUM a VARCHAR para poder elegir entre muchos tipos de negocio.
// Idempotente y rápida: corre en cada arranque para que el código nuevo no dependa de RUN_MIGRATIONS_ON_START.
function asegurarTipoNegocio() {
    return new Promise((resolve) => {
        const hijo = spawn(process.execPath, [path.join(__dirname, '../db/migrate_tipo_negocio.js')], { stdio: 'inherit', env: process.env });
        hijo.on('error', () => resolve(false));
        hijo.on('exit', (code) => resolve(code === 0));
    });
}

// Migraciones recientes de las que depende código que corre en cada petición (redes del negocio, flujos,
// inventario). Idempotentes y rápidas: así el código nuevo no se rompe si nadie activó RUN_MIGRATIONS_ON_START.
function asegurarEsquemaReciente() {
    const archivos = ['migrate_redes_negocio.js', 'migrate_flujos.js', 'migrate_inventario.js', 'migrate_instagram_token.js'];
    return archivos.reduce((cadena, archivo) => cadena.then(() => new Promise((resolve) => {
        const hijo = spawn(process.execPath, [path.join(__dirname, '../db', archivo)], { stdio: 'inherit', env: process.env });
        hijo.on('error', () => resolve(false));
        hijo.on('exit', (code) => resolve(code === 0));
    })), Promise.resolve());
}

async function promoverAdmin(email) {
    try {
        const [r] = await db.execute("UPDATE negocios SET rol = 'admin' WHERE email_dueno = ? AND rol NOT IN ('admin', 'superadmin')", [email]);
        console.log(r.affectedRows
            ? `[Arranque] ${email} ahora es admin`
            : `[Arranque] ADMIN_EMAIL=${email}: ya era admin o no existe un negocio con ese correo`);
    } catch (e) {
        console.error('[Arranque] No se pudo asignar el rol admin:', e.code || e.message);
    }
}

// Con Efipay configurada, avisa en el log si falta la tabla o el token del webhook: sin eso el
// checkout falla (tabla) o los pagos aprobados nunca activan el plan por webhook (token).
async function diagnosticarEfipay() {
    if (!(process.env.EFIPAY_ACCESS_TOKEN && process.env.EFIPAY_OFFICE_ID)) return;
    try {
        const [t] = await db.execute("SHOW TABLES LIKE 'pagos_efipay'");
        if (t.length === 0) console.error('[Arranque] Efipay está configurada pero FALTA la tabla pagos_efipay: el checkout dará error. Pon RUN_MIGRATIONS_ON_START=true y redespliega (o corre node db/migrate_efipay.js).');
        else console.log('[Arranque] Efipay: tabla pagos_efipay OK');
    } catch (e) {
        console.error('[Arranque] No se pudo revisar la tabla pagos_efipay:', e.code || e.message);
    }
    try {
        const d = await require('./services/efipay').diagnosticar();
        console.log(`[Arranque] Efipay: ${d.interpretacion} (HTTP ${d.http_auth}, token de ${d.token_longitud} caracteres, oficina ${d.office_id})`);
    } catch (e) { console.error('[Arranque] No se pudo diagnosticar Efipay:', e.message); }
    if (!process.env.EFIPAY_WEBHOOK_TOKEN) console.error('[Arranque] Falta EFIPAY_WEBHOOK_TOKEN: el webhook de Efipay se rechazará y los pagos solo se activarán al volver al sitio.');
}

async function tareasDeArranque() {
    if (String(process.env.RUN_MIGRATIONS_ON_START).toLowerCase() === 'true') await correrMigraciones();
    await asegurarEsquemaV3();
    await asegurarEsquema2FA();
    await asegurarTipoNegocio();
    await asegurarEsquemaReciente();
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (email) await promoverAdmin(email);
    await diagnosticarEfipay();
}

module.exports = { tareasDeArranque };
