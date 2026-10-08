// Ruteo por calles vía TravelTime (mismo proveedor y credenciales que geocoding.js).
// Da la distancia real recorrible en moto/carro (no la línea recta), el tiempo
// estimado y la geometría de la ruta para dibujarla en el mapa.

const TRAVELTIME_APP_ID = process.env.TRAVELTIME_APP_ID;
const TRAVELTIME_API_KEY = process.env.TRAVELTIME_API_KEY;

// Distancia en línea recta (km) — fallback cuando el ruteo falla o no hay credenciales.
function distanciaHaversineKm(a, b) {
    const R = 6371;
    const toRad = (g) => (g * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

// Devuelve { distancia_km, tiempo_min, coords: [[lat,lng],...], estimada }.
// `estimada: true` significa que se usó línea recta × 1.3 (factor típico de
// calles vs. recta) porque TravelTime no respondió — nunca devuelve null si
// origen y destino son válidos, para que la tarifa siempre se pueda calcular.
async function calcularRuta(origen, destino) {
    if (!origen || !destino) return null;

    const fallback = () => {
        const km = distanciaHaversineKm(origen, destino) * 1.3;
        return {
            distancia_km: Math.round(km * 100) / 100,
            tiempo_min: Math.max(1, Math.round((km / 25) * 60)),
            coords: [[origen.lat, origen.lng], [destino.lat, destino.lng]],
            estimada: true,
        };
    };

    if (!TRAVELTIME_APP_ID || !TRAVELTIME_API_KEY) return fallback();

    try {
        const body = {
            locations: [
                { id: 'origen', coords: { lat: origen.lat, lng: origen.lng } },
                { id: 'destino', coords: { lat: destino.lat, lng: destino.lng } },
            ],
            departure_searches: [{
                id: 'ruta',
                departure_location_id: 'origen',
                arrival_location_ids: ['destino'],
                transportation: { type: 'driving' },
                departure_time: new Date().toISOString(),
                properties: ['travel_time', 'distance', 'route'],
            }],
        };

        const response = await fetch('https://api.traveltimeapp.com/v4/routes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Application-Id': TRAVELTIME_APP_ID,
                'X-Api-Key': TRAVELTIME_API_KEY,
                'Accept-Language': 'es-CO',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            console.warn(`[Routing] TravelTime respondió ${response.status}, se usa distancia estimada`);
            return fallback();
        }

        const data = await response.json();
        const prop = data.results?.[0]?.locations?.[0]?.properties?.[0];
        if (!prop || typeof prop.distance !== 'number') return fallback();

        const coords = [];
        for (const parte of prop.route?.parts || []) {
            for (const c of parte.coords || []) coords.push([c.lat, c.lng]);
        }

        return {
            distancia_km: Math.round((prop.distance / 1000) * 100) / 100,
            tiempo_min: Math.max(1, Math.round(prop.travel_time / 60)),
            coords: coords.length > 1 ? coords : [[origen.lat, origen.lng], [destino.lat, destino.lng]],
            estimada: false,
        };
    } catch (error) {
        console.error('[Routing] Error calculando ruta:', error.message);
        return fallback();
    }
}

// Tarifa por distancia: km × tarifa_por_km, redondeada a los $100 más cercanos
// (los COP no usan centavos), con mínimo y máximo opcionales del negocio.
function calcularTarifa(distanciaKm, config) {
    const porKm = Number(config.tarifa_por_km);
    let tarifa = distanciaKm * porKm;
    if (config.tarifa_minima) tarifa = Math.max(tarifa, Number(config.tarifa_minima));
    if (config.tarifa_maxima) tarifa = Math.min(tarifa, Number(config.tarifa_maxima));
    return Math.round(tarifa / 100) * 100;
}

module.exports = { calcularRuta, calcularTarifa, distanciaHaversineKm };
