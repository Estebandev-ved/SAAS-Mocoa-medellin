require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

async function run() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS campañas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negocio_id INT NOT NULL,
                nombre VARCHAR(100) NOT NULL,
                mensaje TEXT NOT NULL,
                tipo ENUM('individual', 'masivo') DEFAULT 'masivo',
                estado ENUM('borrador', 'programada', 'enviando', 'completada', 'cancelada') DEFAULT 'borrador',
                total_enviados INT DEFAULT 0,
                total_exitosos INT DEFAULT 0,
                total_fallidos INT DEFAULT 0,
                programada_para TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completada_at TIMESTAMP NULL,
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE
            )
        `);
        console.log('Tabla campañas creada');

        await db.execute(`
            CREATE TABLE IF NOT EXISTS plantillas_mensajes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negocio_id INT NOT NULL,
                nombre VARCHAR(100) NOT NULL,
                contenido TEXT NOT NULL,
                categoria ENUM('promocion', 'informacion', 'recordatorio', 'personalizado') DEFAULT 'personalizado',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE
            )
        `);
        console.log('Tabla plantillas_mensajes creada');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
