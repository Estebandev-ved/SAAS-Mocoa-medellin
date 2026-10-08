// Estado de interfaz por negocio: ids de logros y consejos que el panel ya mostró.
// Se valida contra un formato estricto y un tope de tamaño antes de guardarlo.
const ID_VALIDO = /^[a-z0-9:_-]{1,40}$/;
const MAX_VISTOS = 100;

function sanitizeVistos(lista) {
    if (!Array.isArray(lista)) return [];
    // slice(-MAX_VISTOS), no slice(0, MAX_VISTOS): en PUT /ui-estado la lista
    // llega como [...ya_guardados, ...nuevos] (ver business.js), así que
    // cortar por el principio botaba los hitos recién marcados cuando ya
    // había 100 guardados — justo lo que este límite debía evitar.
    return [...new Set(lista.filter((x) => typeof x === 'string' && ID_VALIDO.test(x)))].slice(-MAX_VISTOS);
}

function parseVistos(raw) {
    if (!raw) return [];
    try {
        const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return sanitizeVistos(v && v.vistos);
    } catch {
        return [];
    }
}

module.exports = { sanitizeVistos, parseVistos };
