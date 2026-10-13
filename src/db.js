// src/db.js — MySQL 连接池（全项目统一从这里取数据库连接）
// 用法：const pool = require('./db');  const [rows] = await pool.query('SELECT ...');
require('dotenv').config({ quiet: true }); // quiet: 不打印加载提示，保持日志干净
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',         // 中文内容不乱码
  waitForConnections: true,   // 连接被占满时排队等待，而不是立刻报错
  connectionLimit: 10,        // 池内最多同时 10 条连接
  queueLimit: 0,              // 排队数量不设上限
});

module.exports = pool;
