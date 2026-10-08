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

async function tareasDeArranque() {
    if (String(process.env.RUN_MIGRATIONS_ON_START).toLowerCase() === 'true') await correrMigraciones();
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (email) await promoverAdmin(email);
}

module.exports = { tareasDeArranque };
