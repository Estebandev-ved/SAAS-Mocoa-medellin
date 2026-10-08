// Geocodificación de direcciones vía TravelTime (mismo proveedor que ya usan
// los mapas del dashboard/portal/tracking, ver frontend/.env VITE_TRAVELTIME_APP_ID).
// A diferencia de las tiles (solo requieren el App Id), este endpoint exige
// también la Api Key — nunca debe exponerse al frontend, solo vive acá.

const TRAVELTIME_APP_ID = process.env.TRAVELTIME_APP_ID;
const TRAVELTIME_API_KEY = process.env.TRAVELTIME_API_KEY;

// Geocodifica una dirección de texto libre a coordenadas. `ciudad` se
// concatena a la consulta para desambiguar direcciones cortas ("Calle 14 #5-20")
// que sin contexto de ciudad devuelven resultados de cualquier parte del país.
// Devuelve { lat, lng } del resultado con mejor score, o null si no hay
// credenciales, no hay resultados, o la API falla (nunca lanza — el llamador
// no debe bloquear la creación del pedido por esto).
async function geocodificarDireccion(direccion, ciudad) {
    if (!TRAVELTIME_APP_ID || !TRAVELTIME_API_KEY) {
        console.warn('[Geocoding] TRAVELTIME_APP_ID/TRAVELTIME_API_KEY no configurados, se omite geocodificación');
        return null;
    }
    if (!direccion || !direccion.trim()) return null;

    try {
        const query = ciudad ? `${direccion}, ${ciudad}, Colombia` : `${direccion}, Colombia`;
        const url = `https://api.traveltimeapp.com/v4/geocoding/search?query=${encodeURIComponent(query)}&limit=1`;

        const response = await fetch(url, {
            headers: {
                'X-Application-Id': TRAVELTIME_APP_ID,
                'X-Api-Key': TRAVELTIME_API_KEY,
                // Sin esto, el Accept-Language que Node manda por defecto no
                // pasa la validación BCP47 de TravelTime y responde 400.
                'Accept-Language': 'es-CO',
            },
        });

        if (!response.ok) {
            console.warn(`[Geocoding] TravelTime respondió ${response.status} para "${direccion}"`);
            return null;
        }

        const data = await response.json();
        const feature = data.features?.[0];
        if (!feature) return null;

        const [lng, lat] = feature.geometry.coordinates;
        return { lat, lng };
    } catch (error) {
        console.error('[Geocoding] Error geocodificando dirección:', error.message);
        return null;
    }
}

// Ubicación del negocio (origen de los domicilios). Se geocodifica desde
// negocios.direccion + ciudad la primera vez que hace falta y se guarda en
// negocios.lat/lng, para no pagar una llamada a la API en cada pedido.
async function obtenerOrigenNegocio(negocioId) {
    const db = require('../../db/config');
    try {
        const [rows] = await db.execute(
            'SELECT lat, lng, direccion, ciudad FROM negocios WHERE id = ?',
            [negocioId]
        );
        const n = rows[0];
        if (!n) return null;
        if (n.lat != null && n.lng != null) return { lat: Number(n.lat), lng: Number(n.lng) };
        if (!n.direccion) return null;

        const coords = await geocodificarDireccion(n.direccion, n.ciudad);
        if (!coords) return null;

        await db.execute('UPDATE negocios SET lat = ?, lng = ? WHERE id = ?', [coords.lat, coords.lng, negocioId]);
        return coords;
    } catch (error) {
        console.error('[Geocoding] Error obteniendo origen del negocio:', error.message);
        return null;
    }
}

module.exports = { geocodificarDireccion, obtenerOrigenNegocio };
