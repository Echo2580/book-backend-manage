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
