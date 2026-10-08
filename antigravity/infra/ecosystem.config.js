// Alternativa a docker-compose.yml para quien prefiera correr todo con PM2
// directo sobre un VPS, sin Docker. Requiere Node 20+, MySQL y Redis ya
// corriendo aparte, y un `antigravity/.env` real (cada proceso lo carga solo
// con `dotenv`, por eso `cwd` apunta ahí explícitamente — si no, `.env` se
// buscaría desde donde se haya invocado `pm2 start`, no siempre `antigravity/`).
const path = require('path');
const ROOT = path.join(__dirname, '..');
const LOGS = path.join(ROOT, 'logs');

module.exports = {
  apps: [
    {
      name: 'ag-api',
      script: './api/index.js',
      cwd: ROOT,
      // Una sola instancia a propósito: el rate limiting de
      // api/middleware/security.js usa el almacén en memoria por defecto de
      // express-rate-limit. Con exec_mode 'cluster' e instances > 1, cada
      // proceso llevaría su propio contador y el límite real quedaría
      // multiplicado por el número de instancias sin que nadie se diera
      // cuenta. Subir a cluster real requiere primero moverlo a un almacén
      // compartido (Redis, que ya está disponible en este stack).
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: path.join(LOGS, 'api-error.log'),
      out_file: path.join(LOGS, 'api-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '500M',
      watch: false,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'ag-instance-manager',
      script: './instance-manager/index.js',
      cwd: ROOT,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: path.join(LOGS, 'instance-error.log'),
      out_file: path.join(LOGS, 'instance-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '300M',
      watch: false,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'ag-queue',
      script: './queue/index.js',
      cwd: ROOT,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: path.join(LOGS, 'queue-error.log'),
      out_file: path.join(LOGS, 'queue-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '300M',
      watch: false,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
