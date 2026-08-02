/**
 * Production PM2 config for app.unotrips.com only.
 * Used when app-unotrips-api is not already registered.
 */
module.exports = {
  apps: [
    {
      name: 'app-unotrips-api',
      script: 'src/server.js',
      cwd: '/var/www/app-unotrips-crm/backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1024M',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
        REDIS_URL: 'redis://127.0.0.1:6379',
      },
      error_file: '/var/www/app-unotrips-crm/logs/pm2-error.log',
      out_file: '/var/www/app-unotrips-crm/logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
