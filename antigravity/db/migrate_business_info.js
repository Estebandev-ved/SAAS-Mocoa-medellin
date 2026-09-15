require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

async function run() {
    const cols = [
        "ALTER TABLE negocios ADD COLUMN productos_servicios TEXT",
        "ALTER TABLE negocios ADD COLUMN info_pagos TEXT",
        "ALTER TABLE negocios ADD COLUMN politicas TEXT"
    ];

    for (const sql of cols) {
        try {
            await db.execute(sql);
            console.log('OK:', sql.match(/ADD COLUMN (\w+)/)[1]);
        } catch (e) {
            console.log('Skip:', e.code === 'ER_DUP_FIELDNAME' ? 'already exists' : e.message);
        }
    }

    // Set example data for negocio 8
    await db.execute(`UPDATE negocios SET 
        descripcion_negocio = 'Empresa de gestión administrativa, contable y asesoría tributaria en Colombia.',
        productos_servicios = 'Servicios contables, Declaración de renta, Asesoría tributaria, Gestión de nómina, Consultoría empresarial',
        info_pagos = 'Nequi: 573249704667, Bancolombia: 573249704667. Pago contra entrega o transferencia previa.',
        politicas = 'Servicio disponible en horario laboral 8am-6pm. Respuesta inmediata por WhatsApp. Factura electrónica disponible.'
    WHERE id = 8`);

    const [r] = await db.execute('SELECT nombre, descripcion_negocio, productos_servicios, info_pagos, politicas FROM negocios WHERE id = 8');
    console.log('\nNegocio 8:', JSON.stringify(r[0], null, 2));
    process.exit(0);
}

run();
