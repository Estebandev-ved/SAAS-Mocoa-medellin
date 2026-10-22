// Tiempo estimado de llegada de un domicilio. Misma regla que el seguimiento del cliente en el
// frontend (TrackingCliente.jsx): distancia en línea recta x 1,3 (rodeo por calles) a 22 km/h en moto.

const VELOCIDAD_KMH = 22;
const FACTOR_RODEO = 1.3;
// A menos de esta distancia del destino se avisa "ya casi llega".
const RADIO_CERCA_KM = 0.25;

function aNumero(v) {
    const n = Number(v);
    return v !== null && v !== undefined && v !== '' && Number.isFinite(n) ? n : null;
}

/** Distancia en km entre dos puntos { lat, lng } (haversine). Devuelve null si falta algún dato. */
function distanciaKm(a, b) {
    if (!a || !b) return null;
    const lat1 = aNumero(a.lat), lng1 = aNumero(a.lng), lat2 = aNumero(b.lat), lng2 = aNumero(b.lng);
    if ([lat1, lng1, lat2, lng2].some((x) => x === null)) return null;
    const rad = (g) => (g * Math.PI) / 180;
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Minutos estimados para recorrer `km` en línea recta (mínimo 1). */
function minutosEstimados(km) {
    if (km === null || km === undefined || !Number.isFinite(km)) return null;
    return Math.max(1, Math.round(((km * FACTOR_RODEO) / VELOCIDAD_KMH) * 60));
}

/**
 * ETA en minutos: desde la posición actual del domiciliario si la hay; si no, desde el negocio;
 * si tampoco, el `tiempo_minutos` que se calculó al crear el domicilio. null si no hay nada.
 */
function calcularEta({ domiciliario, negocio, destino, tiempoMinutosGuardado }) {
    for (const origen of [domiciliario, negocio]) {
        const m = minutosEstimados(distanciaKm(origen, destino));
        if (m !== null) return m;
    }
    const g = aNumero(tiempoMinutosGuardado);
    return g && g > 0 ? Math.round(g) : null;
}

function estaCerca(posicion, destino) {
    const d = distanciaKm(posicion, destino);
    return d !== null && d <= RADIO_CERCA_KM;
}

/** Texto para el cliente: "Llega en ~12 min" o '' si no se pudo estimar. */
function textoEta(minutos) {
    if (!minutos) return '';
    return minutos >= 60 ? `Llega en ~${Math.floor(minutos / 60)} h ${minutos % 60} min` : `Llega en ~${minutos} min`;
}

module.exports = { distanciaKm, minutosEstimados, calcularEta, estaCerca, textoEta, RADIO_CERCA_KM };
