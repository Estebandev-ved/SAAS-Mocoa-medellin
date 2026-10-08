require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// Onboarding de catálogo para restaurantes: la tabla productos era genérica
// (nombre/precio/descripción/stock/imagen_url, sin categoría). Un restaurante
// necesita agrupar por Entradas/Platos fuertes/Bebidas — campo de texto libre
// (no un catálogo cerrado de categorías) para que sirva para cualquier tipo
// de negocio, no solo restaurantes.

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
        await agregarColumna('productos', "categoria VARCHAR(80) NULL COMMENT 'Texto libre: Entradas, Bebidas, etc. NULL = sin categoria'");
        console.log('\n✅ Migración categoria_productos completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
