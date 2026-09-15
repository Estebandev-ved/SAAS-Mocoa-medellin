require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../backups');

async function createBackup() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.sql`);

    try {
        const tables = [
            'negocios', 'clientes', 'productos', 'conversaciones',
            'mensajes', 'pedidos', 'items_pedido', 'automatizaciones_config',
            'agente_logs', 'domicilios', 'domiciliarios', 'usuarios'
        ];

        let sql = `-- Backup: ${new Date().toISOString()}\n\n`;

        for (const table of tables) {
            try {
                const [rows] = await db.execute(`SELECT * FROM ${table}`);
                if (rows.length === 0) continue;

                sql += `-- Table: ${table}\n`;
                sql += `TRUNCATE TABLE ${table};\n`;

                for (const row of rows) {
                    const columns = Object.keys(row);
                    const values = columns.map(col => {
                        const val = row[col];
                        if (val === null) return 'NULL';
                        if (typeof val === 'string') return `'${val.replace(/'/g, "\\'")}'`;
                        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "\\'")}'`;
                        return val;
                    });
                    sql += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
                }
                sql += '\n';
            } catch (err) {
                console.log(`Skip ${table}: ${err.message}`);
            }
        }

        fs.writeFileSync(backupFile, sql);

        // Cleanup old backups (keep last 7)
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('backup-') && f.endsWith('.sql'))
            .sort()
            .reverse();
        files.slice(7).forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));

        console.log(`[Backup] Creado: ${backupFile} (${Math.round(sql.length / 1024)}KB)`);
        return { file: backupFile, size: sql.length };
    } catch (error) {
        console.error('[Backup] Error:', error.message);
        throw error;
    }
}

async function exportCSV(table, negocioId) {
    let query = `SELECT * FROM ${table}`;
    const params = [];

    if (negocioId && ['clientes', 'pedidos', 'conversaciones', 'mensajes'].includes(table)) {
        query += ' WHERE negocio_id = ?';
        params.push(negocioId);
    }

    const [rows] = await db.execute(query, params);
    if (rows.length === 0) return '';

    const headers = Object.keys(rows[0]);
    let csv = headers.join(',') + '\n';

    for (const row of rows) {
        const values = headers.map(h => {
            const val = row[h];
            if (val === null) return '';
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        });
        csv += values.join(',') + '\n';
    }

    return csv;
}

// Run backup if called directly
if (require.main === module) {
    createBackup().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { createBackup, exportCSV };
