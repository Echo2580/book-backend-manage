// src/server.js — 应用入口：加载环境变量并启动 HTTP 服务
require('dotenv').config({ quiet: true });
const app = require('./app');

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, () => {
  console.log(`[server] 启动成功：http://localhost:${PORT}`);
  console.log(`[server] 探活接口：http://localhost:${PORT}/health`);
  console.log(`[server] 数据库目标：${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
});

// 启动类错误（如端口被占用）：明确报错退出，避免「看着启动成功、实际不可访问」
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] 端口 ${PORT} 已被占用：请关掉占用该端口的程序，或修改 .env 里的 PORT`);
  } else {
    console.error(`[server] 启动失败：${err.message}`);
  }
  process.exit(1);
});
