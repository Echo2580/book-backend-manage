// src/app.js — Express 应用定义（模板引擎 / 中间件 / 路由）
// 说明：应用与「启动监听」分离，便于测试（supertest 直接引入本文件即可）。
const path = require('path');
const express = require('express');

const app = express();

// 模板引擎：EJS，模板目录 = 项目根下的 views/
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// 表单（POST）请求体解析：application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));

// 静态资源（CSS / JS）：项目根下的 public/
app.use(express.static(path.join(__dirname, '..', 'public')));

// 业务路由：图书模块（列表 / 查询 / 详情 / 新增 / 修改 / 删除）
app.use('/', require('./routes/books'));

// 探活接口：GET /health → 200 {"status":"ok"}
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'book-backend-manage' });
});

module.exports = app;
