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

---

## 2026-10-13 · Step 3.3：图书详情页

### 新增/变更
- `src/routes/books.js`：新增 `GET /books/:id` —— 按 bookId 联表查询（LEFT JOIN 取分类名、DATE_FORMAT 输出 yyyy-MM-dd）；`?q=` / `?page=` 校验后构造「返回」链接（`URLSearchParams` 自动百分号编码）；id 非正整数或查不到 → 404；**注释标注：`GET /books/new`（3.4）必须注册在本路由之前，否则 "new" 会被当成 :id**
- `views/books/detail.ejs`（新增）：详情页模板 —— 标题「查看图书信息」+ 两栏 × 4 行 8 字段（全部只读灰底）+ 底部居中「返回」
- `views/books/list.ejs`：「查看」链接补来源条件 —— `/books/<id>?q=&page=`（3.2 遗留：不带条件则详情页「返回」无从保留）
- `public/css/style.css`：新增 `.form-actions`（底部居中按钮行，3.4/3.5 表单页复用）

### 为什么
- 试卷 p3 要求：8 字段全只读展示 + 返回时保留查询条件和页码 → 条件必须从列表页带入、再原样带回
- 字段排列照试卷：左列 编号/类型/出版社/入库人，右列 名称/作者/借阅/入库时间（form-grid 双列自然填充即得）
- 「返回」链接在路由层构造好传给模板（模板只管输出），中文经 URLSearchParams 编码，无手工拼接风险
- 详情页全 `readonly`：纯展示页、无任何可提交项；`<%= %>` 转义防注入

### 实测结果
- `GET /books/1` → 200：8 字段值逐项核对与种子数据一致（BK0001 / 三体 / 小说 / 刘慈欣 / 重庆出版社 / 未借阅 / 系统管理员 / 2026-09-20）✅
- 返回链接四态：`?q=三体&page=2` → `/?q=%E4%B8%89%E4%BD%93&page=2` ✅；只带 `?page=2` → `/?page=2` ✅；非法 `?page=abc` → 自动丢弃 ✅；无参 → `/` ✅
- `GET /books/999`、`GET /books/abc` → 404「图书不存在」✅
- 闭环：列表（含查询态）→「查看」→ 详情 →「返回」→ 查询条件与页码原样还在（查询框回填「三体」确认）✅
- 借阅状态逻辑：bookId=9（时间简史，borrowed=1）→ 显示「已借阅」✅
- 回归：`/`、`/?q=三体`、`/styleguide.html`、`/css/style.css`、`/health` 均 200 ✅

---

## 2026-10-13 · Step 3.4 / 3.5 / 3.6：新增 / 修改 / 删除（六大功能齐）

> 说明：三节按大哥指示一次完成；每节仍逐功能实现、逐功能实测。

### 新增/变更
- `src/routes/books.js`：
  - 新增 `GET /books/new`（⚠️ 注册在 `GET /books/:id` 之前）：类型下拉来自 `book_type`；默认值预填（入库人=系统管理员、入库时间=今天、是否借阅=未借阅）
  - 新增 `POST /books`：后端必填校验（6 项）+ 下拉/日期合法性校验 → INSERT（`publishDate` 表单无此字段，默认 `CURDATE()`）→ 成功跳 `/?msg=created`；失败回显 + 红提示（写明缺哪些项）
  - 新增 `GET /books/:id/edit`：预填现有值；入库人/入库时间只读展示（灰底）
  - 新增 `POST /books/:id`（保存修改）：校验 → UPDATE（入库人/入库时间**不更新**；`lastUpdatetime = NOW()`）→ 成功跳 `/?msg=updated`；失败回显 + 红提示
  - 新增 `POST /books/:id/delete`：DELETE → 成功/失败均跳回列表显示结果提示
  - 列表页 `GET /` 支持 `?msg=`（created/updated/deleted/error）→ 顶部提示条（复用 header.ejs 预留的 message 位）
  - 抽出模块内两个小工具：`buildBackUrl()`（返回链接带 q/page，详情/新增/修改共用；详情页同步改用）+ `parsePage()`
- `views/books/new.ejs`（新增）：两栏 × 4 行表单；必填 6 项红星 + HTML5 `required`（浏览器原生拦截）；类型下拉 8 项 +「——请选择——」；底部 [保存][返回]
- `views/books/edit.ejs`（新增）：字段同新增；入库人/入库时间为 readonly 灰底、不提交（连 name 都不带）
- `views/books/list.ejs`：「＋ 新增图书」「修改」链接补来源条件（`?q=&page=`）；「删除」改为 `POST` 表单提交（`onsubmit` confirm 保留「确定删除该图书信息？」）
- `public/css/style.css`：`.ops form` 内联化（删除按钮包了表单后仍与链接同排）

### 为什么
- 试卷 p4–p6：新增/修改必填校验 + 成功失败都提示 + 保存后跳回列表；删除先确认再提交、结果提示
- 提示走设计方案组件 8（页顶提示条）而非试卷的 IE alert 弹窗——方案已拍板；成功经 `?msg=created/updated/deleted` 跳转显示（刷新页面不会重复提交表单）
- `?q=&page=` 在新增/修改表单里走 hidden 回传：校验失败重渲染时「返回」仍能回到原查询态
- 删除改 POST：QWEN.md 路由表定的是 `POST /books/:id/delete`，语义规范（链接 GET 删除可能被预取误触）

### 实测结果
- `GET /books/new` → 200：6 颗红星、下拉「——请选择——」+ 8 类、预填（系统管理员 / 2026-10-13 / 未借阅选中）✅
- 新增正常流：POST → 302 `/?msg=created` → 列表绿条「新增成功！」；DB 核对（测试记录：字段全对、`creationTime` 2026-10-13、`publishDate` 默认当天、`lastUpdatetime` NULL）✅
- 新增校验流：缺名称+类型 → 400 + 红条「新增失败！请检查：图书名称、图书类型」+ 回显 ✅
- `GET /books/1/edit` → 200：预填全对（BK0001/三体/小说选中/刘慈欣/重庆出版社/未借阅）、入库人/入库时间 readonly 且无 name ✅
- 修改正常流：POST → 302 `/?msg=updated` → 绿条「修改成功！」；DB 核对：name/type/borrowed 已更新，**createdBy/creationTime 未变**，`lastUpdatetime` 记录修改时间 ✅
- 修改校验流：缺名称 → 400 + 红条「修改失败！请检查：图书名称」✅
- 删除正常流：POST → 302 `/?msg=deleted` → 绿条「删除成功！」；DB：记录已删、总数回 10（测试数据清理干净）✅
- 删除失败流：重复删除 → `/?msg=error` + 红条「操作失败，请重试！」✅
- 列表页链接：新增/查看/修改均带 `?q=&page=`；删除为 POST 表单 + confirm ✅
- 回归：`/`、`/?q=三体`、`/books/1`、`/books/new`、`/books/1/edit`、styleguide、health、css 全 200；`/books/999`、`/books/999/edit` → 404 ✅
- **里程碑：六大功能（列表 / 查询 / 详情 / 新增 / 修改 / 删除）全部完成**

---

## 2026-10-13 · 首次 PR 流程：后端线收口（PR #3）

### 流程
- `gh pr create`：**PR #3「[后端] 数据库与 Express 后台功能开发」**（base `main` ← head `feature/backend-dev`）
  - 因 Issue #1 清单中「功能逻辑 + 回归测试」将在后续 PR 完成，本 PR 用 `Part of #1` 关联、**不写 Closes**（防提前关闭 Issue）
- `gh pr merge 3 --merge --delete-branch`：**已合并**（merge commit `67d6717`）+ 远程分支已删
- 清理：本地 `feature/backend-dev` 已删（was `e4caa24`）；本地 main 同步至 `67d6717`；工作区干净

### 为什么
- 作业要求第 5 条「完成任务，提交 PR，合并后删除分支」——本 PR 为流程首跑；**自此每次改动均走：新分支 → PR → 合并 → 删分支**
- 顺序依据：`feature/frontend-dev` 基于 `feature/backend-dev`（merge-base = `e4caa24`）→ 后端 PR 必须先行，前端 PR 后发

### 结果
- 远程现状：`main @ 67d6717`（含 PR #3 合并提交）；`feature/frontend-dev @ c4f4948` 保留（待发前端 PR，Closes #2）
- 本地：frontend-dev（工作线）+ main（`67d6717`）双分支，工作干净
