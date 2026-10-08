require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

async function run() {
    const productos = [
        { nombre: 'Plan Starter', precio: 89000, descripcion: '1 número WhatsApp, hasta 500 contactos, mensajes automáticos, respuestas rápidas, soporte por email', stock: 999 },
        { nombre: 'Plan Professional', precio: 189000, descripcion: '3 números WhatsApp, hasta 2.000 contactos, chatbot con IA, extracción automática de pedidos, agentes especializados, domicilios con tracking, analytics avanzados, multi-usuario (5), soporte prioritario', stock: 999 },
        { nombre: 'Plan Enterprise', precio: 449000, descripcion: 'Números ilimitados, contactos ilimitados, IA avanzada con GPT-4, agentes ilimitados, domicilios ilimitados, API completa, multi-usuario ilimitado, analytics premium, soporte 24/7, manager dedicado', stock: 999 },
    ];

    for (const p of productos) {
        try {
            await db.execute(
                'INSERT INTO productos (negocio_id, nombre, precio, descripcion, stock, activo) VALUES (?, ?, ?, ?, ?, 1)',
                [8, p.nombre, p.precio, p.descripcion, p.stock]
            );
            console.log('Agregado:', p.nombre);
        } catch (e) {
            console.log('Skip:', p.nombre, e.code === 'ER_DUP_ENTRY' ? '(ya existe)' : e.message);
        }
    }

    const [rows] = await db.execute('SELECT id, nombre, precio, descripcion FROM productos WHERE negocio_id = 8');
    console.log('\nProductos en DB:');
    rows.forEach(r => console.log(`  ${r.nombre}: $${r.precio} COP - ${r.descripcion.substring(0, 60)}...`));
    process.exit(0);
}

run();
