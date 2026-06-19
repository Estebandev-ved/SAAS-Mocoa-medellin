require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'antigravity',
        multipleStatements: true
    });

    try {
        console.log('Connected to MySQL');
        
        console.log('Dropping existing tables...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        await connection.query('DROP TABLE IF EXISTS items_pedido');
        await connection.query('DROP TABLE IF EXISTS pedidos');
        await connection.query('DROP TABLE IF EXISTS conversaciones');
        await connection.query('DROP TABLE IF EXISTS clientes');
        await connection.query('DROP TABLE IF EXISTS productos');
        await connection.query('DROP TABLE IF EXISTS analytics_diario');
        await connection.query('DROP TABLE IF EXISTS mensajes');
        await connection.query('DROP TABLE IF EXISTS agente_logs');
        await connection.query('DROP TABLE IF EXISTS campañas');
        await connection.query('DROP TABLE IF EXISTS automatizaciones_config');
        await connection.query('DROP TABLE IF EXISTS suscripciones');
        await connection.query('DROP TABLE IF EXISTS onboarding_progress');
        await connection.query('DROP TABLE IF EXISTS sesiones');
        await connection.query('DROP TABLE IF EXISTS notificaciones');
        await connection.query('DROP TABLE IF EXISTS negocios');
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        
        const schemaPath = path.join(__dirname, 'db', 'schema.sql');
        let schemaContent = fs.readFileSync(schemaPath, 'utf8');
        schemaContent = schemaContent.replace(/CREATE DATABASE.*?;/, '').replace(/USE antigravity;/, '');
        schemaContent = schemaContent.replace(/,\s*expires_at TIMESTAMP,/g, ', expires_at TIMESTAMP NULL,');
        schemaContent = schemaContent.replace(/,\s*suscripcion_inicio TIMESTAMP,/g, ', suscripcion_inicio TIMESTAMP NULL,');
        schemaContent = schemaContent.replace(/,\s*suscripcion_fin TIMESTAMP,/g, ', suscripcion_fin TIMESTAMP NULL,');
        schemaContent = schemaContent.replace(/,\s*whatsapp_ultima_conexion TIMESTAMP,/g, ', whatsapp_ultima_conexion TIMESTAMP NULL,');
        schemaContent = schemaContent.replace(/,\s*token_reset_expiry TIMESTAMP,/g, ', token_reset_expiry TIMESTAMP NULL,');
        schemaContent = schemaContent.replace(/,\s*ultimo_login TIMESTAMP,/g, ', ultimo_login TIMESTAMP NULL,');
        schemaContent = schemaContent.replace(/,\s*ultimo_pedido TIMESTAMP,/g, ', ultimo_pedido TIMESTAMP NULL,');
        schemaContent = schemaContent.replace(/,\s*trial_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,/g, ', trial_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP NULL,');
        schemaContent = schemaContent.replace(/,\s*trial_fin TIMESTAMP,/g, ', trial_fin TIMESTAMP NULL,');
        schemaContent = schemaContent.replace(/,\s*pago_inicio TIMESTAMP,/g, ', pago_inicio TIMESTAMP NULL,');
        schemaContent = schemaContent.replace(/,\s*pago_fin TIMESTAMP,/g, ', pago_fin TIMESTAMP NULL,');
        schemaContent = schemaContent.replace(/,\s*ultima_ejecucion TIMESTAMP NULL,/g, ', ultima_ejecucion TIMESTAMP NULL,');
        schemaContent = schemaContent.replace(/,\s*fecha_envio TIMESTAMP,/g, ', fecha_envio TIMESTAMP NULL,');
        schemaContent = schemaContent.replace(/,\s*updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,/g, ', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NULL,');
        
        console.log('Executing schema...');
        await connection.query(schemaContent);
        
        console.log('Schema executed successfully!');
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await connection.end();
    }
}

setupDatabase();
