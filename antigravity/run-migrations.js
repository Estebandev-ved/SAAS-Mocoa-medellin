require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true
    });

    try {
        await connection.query('CREATE DATABASE IF NOT EXISTS antigravity');
        await connection.query('USE antigravity');

        const migrations = [
            'db/queries/db_modulos.sql',
            'db/queries/db_domicilios.sql'
        ];

        for (const file of migrations) {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
                const sql = fs.readFileSync(filePath, 'utf8');
                const statements = sql
                    .replace(/USE antigravity;/g, '')
                    .split(';')
                    .map(s => s.trim())
                    .filter(s => s.length > 0);

                for (const stmt of statements) {
                    try {
                        await connection.query(stmt);
                        console.log(`[OK] ${stmt.substring(0, 60)}...`);
                    } catch (err) {
                        if (err.code === 'ER_TABLE_EXISTS' || err.code === 'ER_DUP_ENTRY') {
                            console.log(`[SKIP] ${stmt.substring(0, 60)}... (ya existe)`);
                        } else {
                            console.log(`[WARN] ${err.message.substring(0, 80)}`);
                        }
                    }
                }
                console.log(`\n✅ Migración completada: ${file}`);
            } else {
                console.log(`⚠️ Archivo no encontrado: ${file}`);
            }
        }

        const [tables] = await connection.query('SHOW TABLES');
        console.log('\n📋 Tablas en antigravity:');
        tables.forEach(t => console.log(`   - ${Object.values(t)[0]}`));

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await connection.end();
    }
}

runMigrations();
