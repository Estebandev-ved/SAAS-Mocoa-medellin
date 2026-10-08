// Condiciones económicas y de ruta de un domicilio, calculadas una sola vez al
// crearlo (lo usan tanto el bot por WhatsApp como POST /api/domicilios/crear).
//
// - Tarifa: si el negocio configuró `tarifa_por_km` (módulo domicilios) y hay
//   coordenadas de ambos lados, se cobra distancia real de ruta × tarifa por km
//   (con mínimo/máximo opcionales). Si no, queda `valor_fijo` (o $5.000).
// - km_recorridos / tiempo_minutos: distancia y tiempo estimados negocio → cliente.
// - ruta_coords: polilínea negocio → cliente, para dibujarla en los mapas sin
//   volver a llamar al proveedor de ruteo en cada refresco.

const db = require('../../db/config');
const { obtenerOrigenNegocio, obtenerOrigenRestaurante } = require('./geocoding');
const { calcularRuta, calcularTarifa } = require('./routing');

async function calcularCondicionesDomicilio(negocioId, pedidoId, config = {}) {
    const resultado = {
        tarifa: config.valor_fijo || 5000,
        km: 0,
        tiempo: null,
        ruta_coords: null,
    };

    try {
        const [pedidos] = await db.execute(
            'SELECT direccion_lat, direccion_lng, restaurante_id FROM pedidos WHERE id = ?',
            [pedidoId]
        );
        const destino = pedidos[0];
        if (destino?.direccion_lat == null || destino?.direccion_lng == null) return resultado;

        // En una empresa de domicilios con varios restaurantes, el domicilio se
        // recoge en el restaurante que el cliente eligió — no en la dirección
        // del negocio dueño de la cuenta, que puede ni ser un punto de recogida.
        const origen = destino.restaurante_id
            ? await obtenerOrigenRestaurante(destino.restaurante_id)
            : await obtenerOrigenNegocio(negocioId);
        if (!origen) return resultado;

        const ruta = await calcularRuta(origen, { lat: Number(destino.direccion_lat), lng: Number(destino.direccion_lng) });
        if (!ruta) return resultado;

        resultado.km = ruta.distancia_km;
        resultado.tiempo = ruta.tiempo_min;
        resultado.ruta_coords = JSON.stringify(ruta.coords);
        if (Number(config.tarifa_por_km) > 0) {
            resultado.tarifa = calcularTarifa(ruta.distancia_km, config);
        }
    } catch (e) {
        console.error('[DomicilioTarifa] No se pudo calcular distancia/tarifa, se usa tarifa fija:', e.message);
    }

    return resultado;
}

module.exports = { calcularCondicionesDomicilio };
