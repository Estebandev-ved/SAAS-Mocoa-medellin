require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// Coordenadas para el pedido de "direcciones reales" del socio: geocodificar
// la dirección de entrega del cliente y, más adelante, calcular distancia
// real contra la ubicación del negocio. Se agregan ambas de una vez porque
// las dos hacen falta para la tarea de tarifa por km / ruta en el mapa.

async function agregarColumna(tabla, definicion) {
    try {
        await db.execute(`ALTER TABLE ${tabla} ADD COLUMN ${definicion}`);
        console.log(`[OK] ${tabla}: ${definicion}`);
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log(`[SKIP] ${tabla}: la columna ya existe (${definicion.split(' ')[0]})`);
        } else {
            console.error(`[WARN] ${tabla}: ${error.message}`);
        }
    }
}

async function run() {
    try {
        await agregarColumna('pedidos', "direccion_lat DECIMAL(10,7) NULL COMMENT 'Geocodificada desde direccion_entrega via TravelTime'");
        await agregarColumna('pedidos', "direccion_lng DECIMAL(10,7) NULL COMMENT 'Geocodificada desde direccion_entrega via TravelTime'");

        await agregarColumna('negocios', "lat DECIMAL(10,7) NULL COMMENT 'Ubicacion del negocio, origen para calculo de distancia de domicilios'");
        await agregarColumna('negocios', "lng DECIMAL(10,7) NULL COMMENT 'Ubicacion del negocio, origen para calculo de distancia de domicilios'");

        await agregarColumna('domicilios', "ruta_coords LONGTEXT NULL COMMENT 'JSON [[lat,lng],...] ruta negocio->cliente, para dibujarla en los mapas'");

        console.log('\n✅ Migración geocoding completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
