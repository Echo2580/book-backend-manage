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

---

## 2026-10-13 · Step 3.0：全局样式基建（色板变量 + 九组件类）

### 新增
- `public/css/style.css`：CSS 变量（色板 / 圆角 / 阴影 / 字体栈）+ 基础排版（容器 / 卡片）+ 九个组件样式（页头 / 工具区 / 表格 / 胶囊 / 按钮 / 分页 / 表单 / 提示条；删除确认用原生 confirm、无样式）
- `public/styleguide.html`：组件一览验收页（8 个样例区块 + 色板速览）

### 为什么
- 3.1 起页面开始渲染，先固化样式层；色板与组件规格全部按设计方案 `handoff/design-review/design-plan-v1.md`（Pixso 参考精确采样）落地，口径一处不改
- 组件一览页不依赖数据库与路由，浏览器直接打开即可整体验收样式；验收后保留作「样式索引」
- 删除确认按试卷要求用浏览器原生 `confirm('确定删除该图书信息？')`（方案 §二 组件 9），不引第三方弹窗

### 实测结果
- 本地起服（3001）：`/styleguide.html` → 200（8.9KB，text/html）；`/css/style.css` → 200（10.4KB，text/css）；`/health` → 200 复测正常
- 结构抽查：页面关键组件类命中 9 处、CSS 关键类命中 32 处；`var()` 引用与变量定义逐一对齐、无笔误
- 浏览器最终验收：`npm start` → `http://localhost:3001/styleguide.html`（大哥过目后提交）

---

## 2026-10-13 · Step 3.1：图书列表页

### 新增
- `views/partials/header.ejs` / `views/partials/footer.ejs`：公共头尾（页头、样式引入、提示位预留）
- `views/books/list.ejs`：列表页模板（工具区 + 8 列表格 + 分页条）
- `src/routes/books.js`：图书路由（已实现 `GET /` 列表；3.2~3.6 逐个补齐）
- `src/app.js`：挂载业务路由 `app.use('/', booksRouter)`

### 为什么
- 列表页核心查询：`book_info` LEFT JOIN `book_type` 取分类名；`ORDER BY creationTime DESC, bookId DESC`；`DATE_FORMAT` 输出 yyyy-MM-dd；`LIMIT 5 OFFSET n` 分页
- 页码健壮性：缺省/非法 → 第 1 页；越界 → 收敛到最后一页（不会出现空页）
- 模板拆分为「公共头尾 + 页面」两级，3.2~3.6 页面复用同一骨架
- 工具区与操作列按最终形态摆位：查询（3.2）、新增（3.4）、查看/修改/删除（3.3/3.5/3.6）逐个接通

### 实测结果
- `GET /` → 200：每页 5 行、共 2 页、降序首条「解忧杂货店 2026-10-13」、胶囊 5 个、「上一页」禁用 ✅
- `GET /?page=2` → 200：当前页 2、「下一页」禁用 ✅；`?page=abc` → 回落第 1 页 ✅；`?page=99` → 收敛第 2 页 ✅
- HTML 抽查：8 列表头顺序、行数据与数据库降序结果一致、跳页表单回填当前页 ✅
- 回归：`/styleguide.html`、`/css/style.css`、`/health` 均 200 ✅

---

## 2026-10-13 · Step 3.2：书名模糊查询 + 条件回填

### 新增/变更
- `src/routes/books.js`：`GET /` 增加 `?q=` 支持 —— 按书名 `LIKE '%关键词%'` 模糊匹配；LIKE 通配符（`\ % _`）转义；**COUNT 与列表查询共用同一套 WHERE**
- `views/books/list.ejs`：查询框回填 `value="<%= q %>"`；分页链接与跳页表单均保留查询条件（`q`）；跳页表单加 hidden 字段

### 为什么
- 试卷要求「按名称模糊查询 + 条件回填保留」——返回列表页时查询条件不能丢
- 总数统计若不带 WHERE，总页数会算错（查询后仍按全量算页数）——两边条件必须一致
- LIKE 通配符转义：避免用户输入 `%` 变成「匹配所有」的意外行为

### 实测结果
- `/?q=三` → 命中 2 条（三体 + 测试图书三）、共 1 页、输入框回填「三」✅
- `/?q=的` → 命中 3 条（卓有成效的管理者 / 艺术的故事 / 平凡的世界）✅
- 临时插入 6 条「测试图书*」造多页场景：`?q=测试` → 共 2 页、每页 5 行、页码链接带 `q=%E6%B5%8B%E8%AF%95` ✅；`?q=测试&page=2` → 第 2 页 1 行、跳页表单隐藏域带 q ✅（测完数据已删，总数回到 10）
- `/?q=xyz不存在` → 「暂无数据」+ 共 1 页 ✅；`/?q=%` → 空结果（转义生效，未返回全量）✅
- 回归：`/` 10 条 2 页、`/styleguide.html`、`/health` 均 200 ✅
