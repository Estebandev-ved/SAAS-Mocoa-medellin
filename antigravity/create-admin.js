require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function crearAdmin() {
  const args = process.argv.slice(2);
  let email = 'admin@antigravity.co';
  let password = 'Admin2024#';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) email = args[i + 1];
    if (args[i] === '--password' && args[i + 1]) password = args[i + 1];
  }

  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Password: ${password}`);
  console.log('');

  try {
    const conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'antigravity'
    });

    const hash = await bcrypt.hash(password, 12);

    const [result] = await conn.execute(
      `INSERT INTO negocios (nombre, email_dueno, password, plan, activo, suscripcion_activa, rol, intentos_login_fallidos, cuenta_bloqueada)
       VALUES (?, ?, ?, 'enterprise', 1, 1, 'admin', 0, 0)
       ON DUPLICATE KEY UPDATE 
         password = ?, 
         rol = 'admin', 
         activo = 1,
         intentos_login_fallidos = 0,
         cuenta_bloqueada = 0`,
      ['Admin Antigravity', email, hash, hash]
    );

    if (result.affectedRows > 0) {
      console.log('✅ Admin creado exitosamente');
    } else {
      console.log('✅ Admin actualizado exitosamente');
    }

    await conn.end();
    console.log('');
    console.log('🔗 Credenciales de acceso:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   URL: http://localhost:3000/login`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

crearAdmin();