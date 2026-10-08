require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

// Registro de prospectos (posibles clientes de la plataforma) para el panel admin:
// a quién se le hizo/envió un video, en qué va la conversación y cuándo hacer seguimiento.
async function run() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS prospectos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre_negocio VARCHAR(150) NOT NULL,
                contacto VARCHAR(120) NULL,
                whatsapp VARCHAR(20) NULL COMMENT 'Solo dígitos con indicativo, ej. 573001234567',
                email VARCHAR(150) NULL,
                ciudad VARCHAR(80) NULL,
                tipo_negocio VARCHAR(80) NULL,
                fuente VARCHAR(40) NULL COMMENT 'instagram, tiktok, referido, calle, otro',
                redes_url VARCHAR(255) NULL,
                video_url VARCHAR(500) NULL COMMENT 'Enlace al video (del prospecto o hecho para él)',
                video_notas VARCHAR(255) NULL,
                estado ENUM('nuevo','contactado','video_enviado','respondio','demo','cliente','descartado') NOT NULL DEFAULT 'nuevo',
                ultimo_contacto_at DATETIME NULL,
                proximo_seguimiento DATE NULL,
                notas TEXT NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_estado (estado),
                INDEX idx_seguimiento (proximo_seguimiento),
                INDEX idx_whatsapp (whatsapp)
            ) ENGINE=InnoDB
        `);
        console.log('[OK] prospectos');
        console.log('\n✅ Migración prospectos completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
