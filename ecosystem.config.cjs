module.exports = {
  apps: [
    {
      name: "dentaltrack-web",
      cwd: "/home/debian/apps/llg",
      script: "npm",
      args: "run preview -- --host 127.0.0.1 --port 3300",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "300M",
    },
    {
      name: "dentaltrack-api",
      cwd: "/home/debian/apps/llg",
      script: "server/dist/index.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
