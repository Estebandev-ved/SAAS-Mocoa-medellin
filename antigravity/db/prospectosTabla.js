// DDL único de la tabla prospectos: lo usan la migración y la creación automática al primer uso.
const SQL_TABLA_PROSPECTOS = `
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
`;

let lista = null;
// Crea la tabla si no existe (una sola vez por proceso). Evita depender de correr la migración a mano.
function asegurarTablaProspectos(db) {
    if (!lista) lista = db.execute(SQL_TABLA_PROSPECTOS).catch((e) => { lista = null; throw e; });
    return lista;
}

module.exports = { SQL_TABLA_PROSPECTOS, asegurarTablaProspectos };
