# 图书借阅系统后台管理（BookBackendManage）

[![CI](https://github.com/Echo2580/book-backend-manage/actions/workflows/ci.yml/badge.svg)](https://github.com/Echo2580/book-backend-manage/actions/workflows/ci.yml)

基于 2016 年学士后 Java 毕业考试机试试卷「图书借阅系统（后台）」的业务需求，使用 **Express + EJS + MySQL** 实现的服务端渲染版后台管理系统。开发全程走通 **GitHub Issue → PR → 合并删除分支 → Actions 回归测试** 的协作流程（过程记录见 [DEVLOG.md](DEVLOG.md)）。

## 技术栈

| 层 | 技术 |
|---|---|
| 运行时 | Node.js 22 |
| Web 框架 | Express（服务端渲染） |
| 模板引擎 | EJS |
| 数据库 | MySQL 8.0 |
| 测试 | Node.js 内置 test runner（node:test）+ supertest |
| CI | GitHub Actions |

## 功能清单

- 图书列表：按入库时间降序、日期显示 yyyy-MM-dd、隔行变色、分页（每页 5 条）
- 模糊查询：按图书名称查询，条件记忆/回填
- 查看详情：字段全只读，返回列表时保留查询条件
- 新增图书：必填校验、类型下拉（来自图书类型表）、默认值
- 修改图书：入库人/入库时间只读
- 删除图书：二次确认 + 结果提示

## 目录结构

```
src/          后端源码（server.js 入口 / app.js 应用 / db.js 连接池 / routes/books.js 业务路由）
views/        EJS 模板（partials/ 公共片段 + books/ 页面）
public/       静态资源（css/style.css 样式基建 + styleguide.html 组件一览）
sql/          数据库脚本（init.sql：建库建表 + 种子数据，可重复执行）
tests/        回归测试（regression.test.js，node:test + supertest）
.github/      GitHub Actions CI 流水线（workflows/ci.yml）
```

## 快速开始

> 前提：Node.js 22+、MySQL 8.0（本地服务运行中）。`.env` 已加入 .gitignore，不会入库。

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（复制模板后按实际环境填写数据库账号密码）
cp .env.example .env          # PowerShell 环境用：Copy-Item .env.example .env

# 3. 初始化数据库（建 book_manage 库 + 两张表 + 种子数据；可重复执行）
mysql -u <账号> -p --default-character-set=utf8mb4 < sql/init.sql

# 4. 启动服务
npm start                     # → http://localhost:3001
```

- 探活接口：`GET http://localhost:3001/health` → `{"status":"ok","service":"book-backend-manage"}`
- 组件一览（样式验收页）：`http://localhost:3001/styleguide.html`

## 运行测试

```bash
npm test                      # = node --test
```

- **17 个回归用例**：覆盖 `/health`、列表（分页 5 条 / 降序 / 越界收敛）、模糊查询（条件回填 / 通配符转义）、详情（8 字段 / 404 兜底）、新增 / 修改 / 删除（成功与失败路径）
- 测试直接引入 Express 应用（不占端口、无需先起服务）；测试数据自动清理，可对同一数据库反复运行

## 持续集成

[`.github/workflows/ci.yml`](.github/workflows/ci.yml)：每次 PR 与 main 分支推送时自动运行 —— 启动 MySQL 8 服务容器（含健康检查）→ 导入 `sql/init.sql` → `npm ci` → `npm test`。

## 项目约定

见 [QWEN.md](QWEN.md)（数据库设计 / 业务规则 / 路由约定 / Git 工作流约定）

## 变更日志

见 [DEVLOG.md](DEVLOG.md)
