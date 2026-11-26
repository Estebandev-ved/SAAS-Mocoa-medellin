// Plan Universitario: la misma Caja que Emprendedor, más barata, para estudiantes. Para comprarlo hay que
// demostrar que se es estudiante con el correo de la universidad: se manda un código de 6 dígitos a ese
// correo y, al escribirlo, la verificación queda vigente un semestre (MESES_VALIDEZ). Después hay que
// volver a verificar para renovar (si ya no es estudiante, pasa a Emprendedor).
//
// Reglas:
//   - Solo correos de universidad: dominios .edu, .edu.co (o .edu.<país>) y .ac.<país>, más los que se
//     agreguen en UNIVERSITARIO_DOMINIOS_EXTRA (separados por coma; p. ej. una universidad con dominio propio).
//     Los correos gratis (gmail, hotmail…) nunca cuentan.
//   - Un correo verificado y vigente sirve a UN solo negocio.
//   - El código vence a los 15 minutos, se guarda solo su HMAC, admite 5 intentos y se pueden pedir
//     5 códigos por día y negocio.
//   - Sin SMTP en desarrollo, el código se devuelve en la respuesta (codigo_dev) para poder probar.
const crypto = require('crypto');
const { requiereCorreoUniversitario } = require('../../config/planConfig');

const MESES_VALIDEZ = 6;
const MINUTOS_CODIGO = 15;
const MAX_INTENTOS = 5;
const MAX_ENVIOS_DIA = 5;
const LARGO_MAXIMO = 190;

const PROVEEDORES_GRATIS = new Set([
    'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'live.com',
    'msn.com', 'yahoo.com', 'yahoo.es', 'icloud.com', 'me.com', 'aol.com', 'protonmail.com', 'proton.me',
]);
const DOMINIO_ACADEMICO = /(^|\.)(edu(\.[a-z]{2})?|ac\.[a-z]{2})$/;
const FORMATO_CORREO = /^[^\s@]+@([a-z0-9-]+\.)+[a-z]{2,}$/;

function normalizarCorreo(correo) {
    const c = String(correo ?? '').trim().toLowerCase();
    if (!c || c.length > LARGO_MAXIMO || !FORMATO_CORREO.test(c)) return null;
    return c;
}

function dominiosExtra(env) {
    return String(env.UNIVERSITARIO_DOMINIOS_EXTRA || '')
        .split(',').map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
}

/** ¿Es un correo de universidad? Acepta subdominios (correo.unal.edu.co, est.udea.edu.co…). */
function esCorreoUniversitario(correo, env = process.env) {
    const c = normalizarCorreo(correo);
    if (!c) return false;
    const dominio = c.split('@')[1];
    if (PROVEEDORES_GRATIS.has(dominio)) return false;
    if (dominiosExtra(env).some((d) => dominio === d || dominio.endsWith(`.${d}`))) return true;
    return DOMINIO_ACADEMICO.test(dominio);
}

function fechaDia(d) {
    return d.toISOString().slice(0, 10);
}

function sumarMeses(d, meses) {
    const r = new Date(d);
    r.setMonth(r.getMonth() + meses);
    return r;
}

function escaparHtml(t) {
    return String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function crearServicio({ db = null, env = process.env, enviarCorreo = null, ahora = () => new Date() } = {}) {
    // Carga perezosa: los tests inyectan la base y el correo sin tocar la configuración real.
    const base = () => db || require('../../db/config');
    const correo = () => enviarCorreo || require('./correo').enviarCorreo;

    const hashCodigo = (negocioId, codigo) =>
        crypto.createHmac('sha256', String(env.JWT_SECRET || 'solo-desarrollo')).update(`${negocioId}:${codigo}`).digest('hex');

    async function fila(negocioId) {
        const [rows] = await base().execute(
            `SELECT correo, codigo_hash, codigo_expira, intentos, envios_hoy, envios_fecha, verificado_en, valido_hasta
             FROM verificaciones_universitarias WHERE negocio_id = ?`,
            [negocioId]
        );
        return rows[0] || null;
    }

    function vigenteEn(f, now) {
        return !!(f && f.verificado_en && f.valido_hasta && new Date(f.valido_hasta) > now);
    }

    async function correoEnUsoPorOtro(negocioId, c) {
        const [rows] = await base().execute(
            `SELECT negocio_id FROM verificaciones_universitarias
             WHERE correo = ? AND negocio_id <> ? AND verificado_en IS NOT NULL AND valido_hasta > ?`,
            [c, negocioId, ahora()]
        );
        return rows.length > 0;
    }

    /** Estado para la pantalla de Mi plan. */
    async function estado(negocioId) {
        const f = await fila(negocioId);
        const now = ahora();
        const verificado = vigenteEn(f, now);
        return {
            verificado,
            correo: f?.correo || null,
            valido_hasta: verificado ? new Date(f.valido_hasta).toISOString() : null,
            codigo_pendiente: !!(f?.codigo_hash && f.codigo_expira && new Date(f.codigo_expira) > now),
            meses_validez: MESES_VALIDEZ,
        };
    }

    async function vigente(negocioId) {
        return vigenteEn(await fila(negocioId), ahora());
    }

    async function solicitarCodigo(negocioId, correoCrudo, { nombreNegocio = '' } = {}) {
        const c = normalizarCorreo(correoCrudo);
        if (!c) return { ok: false, status: 400, codigo: 'CORREO_INVALIDO', error: 'Escribe un correo válido.' };
        if (!esCorreoUniversitario(c, env)) {
            return {
                ok: false, status: 400, codigo: 'CORREO_NO_UNIVERSITARIO',
                error: 'Usa el correo que te dio tu universidad (termina en .edu.co o parecido). Gmail u Hotmail no sirven.',
            };
        }
        if (await correoEnUsoPorOtro(negocioId, c)) {
            return { ok: false, status: 409, codigo: 'CORREO_EN_USO', error: 'Ese correo ya está verificado en otro negocio.' };
        }

        const now = ahora();
        const hoy = fechaDia(now);
        const f = await fila(negocioId);
        const enviosHoy = f && f.envios_fecha && fechaDia(new Date(f.envios_fecha)) === hoy ? Number(f.envios_hoy) || 0 : 0;
        if (enviosHoy >= MAX_ENVIOS_DIA) {
            return { ok: false, status: 429, codigo: 'DEMASIADOS_CODIGOS', error: 'Ya pediste varios códigos hoy. Intenta de nuevo mañana.' };
        }

        const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        const expira = new Date(now.getTime() + MINUTOS_CODIGO * 60000);
        // Si cambia el correo, la verificación anterior deja de valer (era de otro correo). Las asignaciones de
        // MySQL van de izquierda a derecha: verificado_en y valido_hasta se comparan con el correo viejo.
        await base().execute(
            `INSERT INTO verificaciones_universitarias
                (negocio_id, correo, codigo_hash, codigo_expira, intentos, envios_hoy, envios_fecha)
             VALUES (?, ?, ?, ?, 0, ?, ?)
             ON DUPLICATE KEY UPDATE
                verificado_en = IF(correo = VALUES(correo), verificado_en, NULL),
                valido_hasta = IF(correo = VALUES(correo), valido_hasta, NULL),
                correo = VALUES(correo),
                codigo_hash = VALUES(codigo_hash),
                codigo_expira = VALUES(codigo_expira),
                intentos = 0,
                envios_hoy = VALUES(envios_hoy),
                envios_fecha = VALUES(envios_fecha)`,
            [negocioId, c, hashCodigo(negocioId, codigo), expira, enviosHoy + 1, hoy]
        );

        const negocio = escaparHtml(nombreNegocio || 'tu negocio');
        const envio = await correo()({
            para: c,
            asunto: `Tu código para el plan Universitario: ${codigo}`,
            texto: `Tu código es ${codigo}. Escríbelo en Mi plan para activar el plan Universitario de ${nombreNegocio || 'tu negocio'}. Vence en ${MINUTOS_CODIGO} minutos. Si no lo pediste, ignora este correo.`,
            html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1a1a1a">
                <h2 style="margin:0 0 12px">Verifica tu correo de estudiante</h2>
                <p>Escribe este código en <strong>Mi plan</strong> para activar el plan Universitario de <strong>${negocio}</strong>:</p>
                <p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:16px 0">${codigo}</p>
                <p style="color:#666;font-size:13px">Vence en ${MINUTOS_CODIGO} minutos. Si no lo pediste, ignora este correo.</p>
            </div>`,
        });

        if (envio.ok) return { ok: true, enviado: true, correo: c, expira_en_min: MINUTOS_CODIGO };
        if (envio.motivo === 'sin_smtp' && env.NODE_ENV !== 'production') {
            console.warn('[Universitario] Sin SMTP: el código se devuelve en la respuesta (solo desarrollo)');
            return { ok: true, enviado: false, correo: c, expira_en_min: MINUTOS_CODIGO, codigo_dev: codigo };
        }
        return { ok: false, status: 503, codigo: 'CORREO_NO_ENVIADO', error: 'No pudimos enviar el correo ahora. Intenta en unos minutos.' };
    }

    async function verificarCodigo(negocioId, codigoCrudo) {
        const codigo = String(codigoCrudo ?? '').replace(/\s+/g, '');
        if (!/^\d{6}$/.test(codigo)) return { ok: false, status: 400, codigo: 'CODIGO_INVALIDO', error: 'El código tiene 6 números.' };

        const f = await fila(negocioId);
        const now = ahora();
        if (!f || !f.codigo_hash) return { ok: false, status: 400, codigo: 'SIN_CODIGO', error: 'Primero pide un código a tu correo.' };
        if (!f.codigo_expira || new Date(f.codigo_expira) <= now) {
            return { ok: false, status: 400, codigo: 'CODIGO_VENCIDO', error: 'El código venció. Pide uno nuevo.' };
        }
        if (Number(f.intentos) >= MAX_INTENTOS) {
            return { ok: false, status: 429, codigo: 'DEMASIADOS_INTENTOS', error: 'Demasiados intentos. Pide un código nuevo.' };
        }

        const esperado = Buffer.from(f.codigo_hash, 'hex');
        const recibido = Buffer.from(hashCodigo(negocioId, codigo), 'hex');
        if (esperado.length !== recibido.length || !crypto.timingSafeEqual(esperado, recibido)) {
            await base().execute('UPDATE verificaciones_universitarias SET intentos = intentos + 1 WHERE negocio_id = ?', [negocioId]);
            const quedan = Math.max(0, MAX_INTENTOS - Number(f.intentos) - 1);
            return { ok: false, status: 400, codigo: 'CODIGO_INCORRECTO', error: `Ese código no es. Te quedan ${quedan} intentos.`, intentos_restantes: quedan };
        }

        // Otro negocio pudo verificar el mismo correo mientras tanto.
        if (await correoEnUsoPorOtro(negocioId, f.correo)) {
            return { ok: false, status: 409, codigo: 'CORREO_EN_USO', error: 'Ese correo ya está verificado en otro negocio.' };
        }

        const hasta = sumarMeses(now, MESES_VALIDEZ);
        await base().execute(
            `UPDATE verificaciones_universitarias
             SET verificado_en = ?, valido_hasta = ?, codigo_hash = NULL, codigo_expira = NULL, intentos = 0
             WHERE negocio_id = ?`,
            [now, hasta, negocioId]
        );
        return { ok: true, correo: f.correo, valido_hasta: hasta.toISOString() };
    }

    /** Mensaje que impide pasar a `plan` (o null). Hoy solo el Universitario pide algo además de pagar. */
    async function motivoBloqueoPlan(negocioId, plan) {
        if (!requiereCorreoUniversitario(plan)) return null;
        if (await vigente(negocioId)) return null;
        return 'Para el plan Universitario primero verifica tu correo de la universidad (te llega un código).';
    }

    return { estado, vigente, solicitarCodigo, verificarCodigo, motivoBloqueoPlan };
}

module.exports = {
    ...crearServicio(),
    crearServicio,
    esCorreoUniversitario,
    normalizarCorreo,
    MESES_VALIDEZ,
    MAX_INTENTOS,
    MAX_ENVIOS_DIA,
};
