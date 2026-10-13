# 内测 07 · 图书借阅系统后台 —— 变更日志

> 规范：每次改动记「改了什么 / 为什么 / 实测结果」。不记流水账，只记能复盘的结论。

---

## 2026-10-13 · Step 0：环境与项目初始化

### 新增
- `package.json`、`.gitignore`、`README.md`、`QWEN.md`、`DEVLOG.md`

### 环境说明
- 数据库：MySQL 8.0.44（本地服务 MySQL80，端口 3306，账号 zhy/123456）
- git 仓库初始化（main 分支）

### 实测结果
- 首次提交完成（见 git log）

---

## 2026-10-13 · Step 0.2/0.3：GitHub 初始化

### 新增
- 远程仓库：https://github.com/Echo2580/book-backend-manage（public）
- Issue #1 `[后端] 数据库与 Express 后台功能开发`、Issue #2 `[前端] EJS 页面与交互实现`
- main 分支推送完成（含首次提交）

### 实测结果
- `gh` 核验：远程 main 分支 + 6 个文件 + 提交 `b233534`，与本地一致

---

## 2026-10-13 · Step 1：数据库初始化脚本

### 新增
- `sql/init.sql`：建库 `book_manage`（utf8mb4）+ `book_type`（8 种类型种子）+ `book_info`（10 条图书种子，覆盖全部 8 种类型）

### 为什么
- 入库时间错开分布（2026-09-20 ~ 10-13），便于验证「按入库时间降序」与分页（每页 5 条 → 共 2 页）
- `bookType` 加外键约束关联 `book_type.id`，落实「类型关联」
- 脚本可重复执行（先 DROP 再建）

### 实测结果
- 本地 MySQL 8.0.44 导入成功：`book_type` 8 行、`book_info` 10 行；中文写入/查询正常；降序排列符合预期

---

## 2026-10-13 · Step 2：Express 应用骨架

### 新增
- `src/app.js`：Express 应用定义（EJS 引擎 + 表单解析 + public 静态资源 + `GET /health` 探活）
- `src/server.js`：应用入口（读取 `.env`、监听端口、启动日志）
- `src/db.js`：MySQL 连接池（mysql2/promise，字符集 utf8mb4）
- `.env.example`（入库的模板）+ `.env`（本地实际配置，已被 .gitignore 忽略）
- `package.json` 补依赖：express / ejs / mysql2 / dotenv，devDependency：supertest

### 为什么
- 应用（app.js）与启动（server.js）分离：Step 4 的 supertest 回归测试可直接引入 app，不必真的占用端口
- 数据库访问统一走连接池（QWEN.md 编程约定），后续所有路由共用同一入口 `src/db.js`
- 数据库密码等敏感信息只写 `.env`，仓库只提交 `.env.example` 模板

### 实测结果
- 连接池连库：`SELECT 1` ✅；book_info 10 行 ✅；按 creationTime 降序首条「解忧杂货店」✅
- EJS 引擎：中文模板渲染 ✅
- 探活：`GET /health` → HTTP 200 `{"status":"ok","service":"book-backend-manage"}` ✅；启动日志输出端口与数据库目标

### 补充：3000 端口冲突排查（同日晚）

- 现象：终端启动日志一切正常，但浏览器访问 3000 返回的是**另一个程序**的 404（`接口不存在`）
- 原因：本机 3000 端口已被另一个项目（`周测5/book-admin` 的 Express 服务，长期运行）占用；Windows + Node 下端口冲突会出现「先打印启动成功、随后静默退出」的假启动现象（进程死了但日志看不出）
- 处置：① 本项目端口改为 **3001**（`.env` / `.env.example`）；② `src/server.js` 增加 `error` 事件处理，端口被占时打印明确中文报错后再退出
- 实测结果：占住 3002 复测 → 打印「`[server] 端口 3002 已被占用…`」（不再静默）；干净端口 3001 → 稳定运行 8 秒+、`/health` 返回正常
