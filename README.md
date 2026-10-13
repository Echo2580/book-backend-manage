# 图书借阅系统后台管理（BookBackendManage）

基于 2016 年学士后 Java 毕业考试机试试卷「图书借阅系统（后台）」的业务需求，使用 **Express + EJS + MySQL** 实现的服务端渲染版后台管理系统。

## 技术栈

| 层 | 技术 |
|---|---|
| 运行时 | Node.js 22 |
| Web 框架 | Express（服务端渲染） |
| 模板引擎 | EJS |
| 数据库 | MySQL 8.0 |
| 测试 | Node.js 内置 test runner + supertest |
| CI | GitHub Actions |

## 功能清单

- 图书列表：按入库时间降序、日期显示 yyyy-MM-dd、隔行变色、分页（每页 5 条）
- 模糊查询：按图书名称查询，条件记忆/回填
- 查看详情：字段全只读，返回列表时保留查询条件
- 新增图书：必填校验、类型下拉（来自图书类型表）、默认值
- 修改图书：入库人/入库时间只读
- 删除图书：二次确认 + 结果提示

## 快速开始

```bash
npm install              # 安装依赖
cp .env.example .env     # 复制环境变量模板，按实际环境填写数据库账号密码
npm start                # 启动服务 → http://localhost:3001
```

- 数据库初始化（首次/需重灌时执行）：`mysql -u <账号> -p --default-character-set=utf8mb4 < sql/init.sql`
- 探活接口：`GET http://localhost:3001/health` → `{"status":"ok","service":"book-backend-manage"}`

## 项目约定

见 [QWEN.md](QWEN.md)

## 变更日志

见 [DEVLOG.md](DEVLOG.md)
