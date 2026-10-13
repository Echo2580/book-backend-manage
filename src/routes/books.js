// src/routes/books.js — 图书相关路由
// 进度：Step 3.1 已实现「图书列表」；3.2 查询 / 3.3 详情 / 3.4 新增 / 3.5 修改 / 3.6 删除 逐个接通。
const express = require('express');
const pool = require('../db');   // MySQL 连接池（src/db.js 统一出口）

const router = express.Router();

// 每页条数（试卷要求：每页 5 条）
const PAGE_SIZE = 5;

// ---------------------------------------------------------------
// GET / —— 图书列表页
//   规则：按入库时间（creationTime）降序；每页 5 条；日期显示 yyyy-MM-dd
//   参数：?page=N（缺省/非法时为第 1 页；超出范围收敛到最后一页）
// ---------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    // 1. 解析页码：非整数或小于 1 时，统一回落到第 1 页
    let page = parseInt(req.query.page, 10);
    if (!Number.isInteger(page) || page < 1) page = 1;

    // 2. 总条数 → 总页数（至少 1 页，保证页码永远合法）
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM book_info');
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > totalPages) page = totalPages;

    // 3. 取当前页数据：
    //    - LEFT JOIN book_type 拿到分类名（列表显示「图书分类」列）
    //    - DATE_FORMAT 把入库时间格式化成 yyyy-MM-dd（试卷显示格式）
    //    - LIMIT / OFFSET 用内部计算出的整数拼接（无用户输入，安全）
    const offset = (page - 1) * PAGE_SIZE;
    const [books] = await pool.query(
      `SELECT
         b.bookId,
         b.bookCode,
         b.bookName,
         t.typeName,
         b.bookAuthor,
         b.publishPress,
         DATE_FORMAT(b.creationTime, '%Y-%m-%d') AS creationDate,
         b.borrowed
       FROM book_info b
       LEFT JOIN book_type t ON b.bookType = t.id
       ORDER BY b.creationTime DESC, b.bookId DESC
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    );

    // 4. 渲染列表页模板
    res.render('books/list', { title: '图书列表', books, page, totalPages });
  } catch (err) {
    next(err);   // 出错交给 Express 统一处理，日志里能看到原因
  }
});

module.exports = router;
