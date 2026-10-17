// Validación de PUT /api/business/perfil. Antes cualquier valor (objetos, textos de MB) iba
// directo al UPDATE y la respuesta devolvía `SELECT *`, que incluye el hash de la contraseña,
// el secreto del 2FA y los tokens de recuperación.

const LIMITES = {
    nombre: 120, color_principal: 20, logo_url: 500, whatsapp: 30, nit: 30, razon_social: 160,
    tipo_negocio: 80, ciudad: 80, departamento: 80, direccion: 200, telefono: 30,
    sitio_web: 300, descripcion_negocio: 1000, numero_nequi: 30, numero_bancolombia: 40,
};
const { esTipoValido } = require('./tiposNegocio');
const NUMERICOS =['numero_empleados', 'volumen_pedidos_dia'];
const CAMPOS_PERMITIDOS = [...Object.keys(LIMITES), ...NUMERICOS, 'metodos_pago_activos'];

// Columnas que sí puede ver el dueño (mismas de GET /perfil).
const COLUMNAS_PERFIL = `id, nombre, color_principal, logo_url, whatsapp, email_dueno,
    nit, razon_social, tipo_negocio, ciudad, departamento, direccion,
    telefono, sitio_web, descripcion_negocio, numero_empleados,
    volumen_pedidos_dia, metodos_pago_activos, numero_nequi,
    numero_bancolombia, plan, onboarding_completado, onboarding_paso,
    trial_hasta, suscripcion_activa, suscripcion_inicio, suscripcion_fin,
    ultimo_login, created_at`;

/** Devuelve { valores: {campo: valor}, error } con solo campos permitidos y saneados. */
function sanearPerfil(body) {
    const valores = {};
    for (const [key, raw] of Object.entries(body || {})) {
        if (!CAMPOS_PERMITIDOS.includes(key) || raw === undefined) continue;
        if (key === 'metodos_pago_activos') {
            if (!Array.isArray(raw) || raw.length > 20 || raw.some((m) => typeof m !== 'string' || m.length > 40)) {
                return { error: 'Métodos de pago no válidos' };
            }
            valores[key] = JSON.stringify(raw);
        } else if (NUMERICOS.includes(key)) {
            if (raw === null || raw === '') { valores[key] = null; continue; }
            const n = Number(raw);
            if (!Number.isInteger(n) || n < 0 || n > 1000000) return { error: `Valor no válido en ${key}` };
            valores[key] = n;
        } else {
            if (raw !== null && typeof raw !== 'string') return { error: `Valor no válido en ${key}` };
            const texto = raw === null ? null : raw.trim();
            if (texto !== null && texto.length > LIMITES[key]) return { error: `El campo ${key} es demasiado largo (máx. ${LIMITES[key]})` };
            if (key === 'sitio_web' && texto && !/^https?:\/\//i.test(texto)) return { error: 'El sitio web debe empezar por http:// o https://' };
            if (key === 'tipo_negocio') {
                // Solo tipos del catálogo (api/services/tiposNegocio.js); vacío = sin elegir.
                if (!texto) { valores[key] = null; continue; }
                if (!esTipoValido(texto)) return { error: 'Tipo de negocio no válido' };
            }
            valores[key] = texto;
        }
    }
    return { valores };
}

module.exports = { sanearPerfil, COLUMNAS_PERFIL, CAMPOS_PERMITIDOS };
