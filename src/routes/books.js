// src/routes/books.js — 图书相关路由
// 进度：3.1 列表 / 3.2 模糊查询 已实现；3.3 详情 / 3.4 新增 / 3.5 修改 / 3.6 删除 逐个接通。
const express = require('express');
const pool = require('../db');   // MySQL 连接池（src/db.js 统一出口）

const router = express.Router();

// 每页条数（试卷要求：每页 5 条）
const PAGE_SIZE = 5;

// ---------------------------------------------------------------
// GET / —— 图书列表页（支持按书名模糊查询）
//   规则：按入库时间（creationTime）降序；每页 5 条；日期显示 yyyy-MM-dd
//   参数：?q=关键词（书名模糊匹配，可空）
//         ?page=N（缺省 / 非法为第 1 页；越界收敛到最后一页）
// ---------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    // 1. 查询条件：去掉首尾空白；空串视为「不加条件」
    const q = String(req.query.q ?? '').trim();

    // 2. 解析页码：非整数或小于 1 时，统一回落到第 1 页
    let page = parseInt(req.query.page, 10);
    if (!Number.isInteger(page) || page < 1) page = 1;

    // 3. 组装 WHERE 条件：有关键词时按书名模糊匹配
    //    转义 LIKE 通配符（\ % _），避免用户输入的 % 被当成「匹配所有」
    let where = '';
    const params = [];
    if (q) {
      const keyword = q.replace(/[\\%_]/g, '\\$&');
      where = 'WHERE b.bookName LIKE ?';
      params.push(`%${keyword}%`);
    }

    // 4. 总条数 → 总页数（必须与列表查询用同一套 WHERE，否则页数会算错）
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM book_info b ${where}`,
      params,
    );
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > totalPages) page = totalPages;

    // 5. 取当前页数据：
    //    - LEFT JOIN book_type 拿到分类名；DATE_FORMAT 输出 yyyy-MM-dd
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
       ${where}
       ORDER BY b.creationTime DESC, b.bookId DESC
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
      params,
    );

    // 6. 渲染列表页模板（q 回传给模板做条件回填）
    res.render('books/list', { title: '图书列表', books, page, totalPages, q });
  } catch (err) {
    next(err);   // 出错交给 Express 统一处理，日志里能看到原因
  }
});

module.exports = router;
