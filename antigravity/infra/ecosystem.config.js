module.exports = {
  apps: [
    {
      name: 'ag-api',
      script: './api/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
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
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/instance-error.log',
      out_file: './logs/instance-out.log',
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
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/queue-error.log',
      out_file: './logs/queue-out.log',
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
