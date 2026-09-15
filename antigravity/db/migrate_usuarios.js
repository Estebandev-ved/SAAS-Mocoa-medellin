require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

async function run() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negocio_id INT NOT NULL,
                nombre VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL,
                password VARCHAR(255) NOT NULL,
                rol ENUM('admin', 'editor', 'viewer') DEFAULT 'viewer',
                activo TINYINT(1) DEFAULT 1,
                ultimo_login TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
                UNIQUE KEY unique_email_negocio (email, negocio_id)
            )
        `);
        console.log('Tabla usuarios creada');

        // Add the owner as admin user for negocio 8
        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('admin123', 12);
        try {
            await db.execute(
                'INSERT INTO usuarios (negocio_id, nombre, email, password, rol) VALUES (?, ?, ?, ?, ?)',
                [8, 'Admin NOMA', 'admin@noma.co', hash, 'admin']
            );
            console.log('Usuario admin creado para negocio 8');
        } catch (e) {
            console.log('Admin ya existe:', e.code === 'ER_DUP_ENTRY' ? 'skip' : e.message);
        }

        const [rows] = await db.execute('SELECT id, nombre, email, rol FROM usuarios WHERE negocio_id = 8');
        console.log('\nUsuarios negocio 8:');
        rows.forEach(r => console.log(`  ${r.nombre} (${r.email}) - ${r.rol}`));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

run();
