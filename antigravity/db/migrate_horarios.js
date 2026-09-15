require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

async function run() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS horarios_avanzados (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negocio_id INT NOT NULL,
                dia_semana TINYINT NOT NULL COMMENT '0=domingo, 1=lunes, ..., 6=sabado',
                hora_inicio TIME NOT NULL,
                hora_fin TIME NOT NULL,
                activo TINYINT(1) DEFAULT 1,
                UNIQUE KEY unique_dia (negocio_id, dia_semana),
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE
            )
        `);
        console.log('Tabla horarios_avanzados creada');

        await db.execute(`
            CREATE TABLE IF NOT EXISTS festivos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negocio_id INT NOT NULL,
                fecha DATE NOT NULL,
                nombre VARCHAR(100) NOT NULL,
                UNIQUE KEY unique_fecha (negocio_id, fecha),
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE
            )
        `);
        console.log('Tabla festivos creada');

        // Default schedule for negocio 8 (Mon-Fri 8am-6pm, Sat 9am-1pm)
        const horarios = [
            [8, 1, '08:00:00', '18:00:00'], // lunes
            [8, 2, '08:00:00', '18:00:00'], // martes
            [8, 3, '08:00:00', '18:00:00'], // miercoles
            [8, 4, '08:00:00', '18:00:00'], // jueves
            [8, 5, '08:00:00', '18:00:00'], // viernes
            [8, 6, '09:00:00', '13:00:00'], // sabado
        ];

        for (const [negId, dia, inicio, fin] of horarios) {
            try {
                await db.execute(
                    'INSERT INTO horarios_avanzados (negocio_id, dia_semana, hora_inicio, hora_fin) VALUES (?, ?, ?, ?)',
                    [negId, dia, inicio, fin]
                );
            } catch (e) {
                if (e.code !== 'ER_DUP_ENTRY') console.log('Error:', e.message);
            }
        }
        console.log('Horarios por defecto creados');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
