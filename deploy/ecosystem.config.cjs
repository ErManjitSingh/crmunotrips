module.exports = {
  apps: [
    {
      name: 'testing-unotrips-api',
      script: 'src/server.js',
      cwd: '/var/www/testing-unotrips-crm/backend',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '768M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        REDIS_URL: 'redis://127.0.0.1:6379',
      },
      error_file: '/var/www/testing-unotrips-crm/logs/pm2-error.log',
      out_file: '/var/www/testing-unotrips-crm/logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
