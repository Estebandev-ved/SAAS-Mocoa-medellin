const db = require('../db/config');
(async () => {
    try {
        await db.execute("ALTER TABLE pedidos ADD COLUMN imagen_pago TEXT AFTER notas");
        console.log('Columna imagen_pago agregada');
    } catch (e) {
        if (e.message.includes('Duplicate column')) {
            console.log('Columna ya existe');
        } else {
            console.error('Error:', e.message);
        }
    }
    process.exit(0);
})();
