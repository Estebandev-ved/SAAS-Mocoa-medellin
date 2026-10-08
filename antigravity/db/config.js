require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'antigravity',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// MySQL >= 8.0.22 rechaza `LIMIT ?` / `OFFSET ?` en sentencias preparadas cuando el
// parámetro viaja como número (mysql2 lo manda como DOUBLE) y responde "Incorrect
// arguments to mysqld_stmt_execute". Como texto sí lo acepta, así que solo esos
// parámetros se convierten; el resto de la consulta no cambia.
function paramsParaLimit(sql, params) {
  if (!Array.isArray(params) || typeof sql !== 'string') return params;
  const out = params.slice();
  let i = 0;
  for (const m of sql.matchAll(/\?/g)) {
    const antes = sql.slice(Math.max(0, m.index - 24), m.index);
    if (/\b(LIMIT|OFFSET)\s+$/i.test(antes) || /\bLIMIT\s+\?\s*,\s*$/i.test(antes)) {
      if (typeof out[i] === 'number') out[i] = String(Math.trunc(out[i]));
    }
    i++;
  }
  return out;
}

function envolverExecute(obj) {
  const original = obj.execute.bind(obj);
  obj.execute = (sql, params) => (params === undefined ? original(sql) : original(sql, paramsParaLimit(sql, params)));
  return obj;
}

envolverExecute(pool);

const getConnectionOriginal = pool.getConnection.bind(pool);
pool.getConnection = async (...args) => envolverExecute(await getConnectionOriginal(...args));

module.exports = pool;
module.exports.paramsParaLimit = paramsParaLimit;
