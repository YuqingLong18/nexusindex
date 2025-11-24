module.exports = {
  apps: [
    {
      name: 'credential-db',
      script: 'server.js',
      cwd: '/www/wwwroot/index',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/www/wwwroot/index/logs/pm2-error.log',
      out_file: '/www/wwwroot/index/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};

