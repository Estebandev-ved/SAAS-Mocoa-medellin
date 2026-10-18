// Preferencias de visualización del dueño (zona horaria, moneda, formato de fecha).
// Viven dentro de negocios.ui_estado (JSON) junto a los "vistos", sin columna nueva.
// Solo se aceptan valores del catálogo: nada de texto libre en una columna JSON.

const OPCIONES = {
    zona_horaria: ['America/Bogota', 'America/Mexico_City', 'America/Lima', 'America/Santiago', 'America/Argentina/Buenos_Aires', 'Europe/Madrid'],
    moneda: ['COP', 'MXN', 'USD', 'EUR'],
    formato_fecha: ['dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd'],
};
const DEFAULT = { zona_horaria: 'America/Bogota', moneda: 'COP', formato_fecha: 'dd/mm/yyyy' };

function parseUiEstado(raw) {
    if (!raw) return {};
    try {
        const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch {
        return {};
    }
}

/** Devuelve las preferencias completas (con valores por defecto) a partir de lo guardado. */
function leerPreferencias(rawUiEstado) {
    const guardadas = parseUiEstado(rawUiEstado).preferencias || {};
    const out = { ...DEFAULT };
    for (const k of Object.keys(OPCIONES)) {
        if (OPCIONES[k].includes(guardadas[k])) out[k] = guardadas[k];
    }
    return out;
}

/** Valida el body de PUT: { valores } o { error }. Solo claves conocidas y valores del catálogo. */
function sanearPreferencias(body) {
    const valores = {};
    for (const [k, v] of Object.entries(body || {})) {
        if (!(k in OPCIONES)) continue;
        if (typeof v !== 'string' || !OPCIONES[k].includes(v)) return { error: `Valor no válido en ${k}` };
        valores[k] = v;
    }
    if (Object.keys(valores).length === 0) return { error: 'No hay preferencias válidas para guardar' };
    return { valores };
}

module.exports = { OPCIONES, DEFAULT, parseUiEstado, leerPreferencias, sanearPreferencias };
