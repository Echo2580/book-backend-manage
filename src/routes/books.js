// src/routes/books.js — 图书相关路由
// 进度：3.1 列表 / 3.2 模糊查询 / 3.3 详情 / 3.4 新增 / 3.5 修改 / 3.6 删除 已实现（六大功能齐）
const express = require('express');
const pool = require('../db');   // MySQL 连接池（src/db.js 统一出口）

const router = express.Router();

// 每页条数（试卷要求：每页 5 条）
const PAGE_SIZE = 5;

// 列表页顶部提示文案：跳转参数 ?msg=xxx 的映射（成功绿条 / 失败红条）
const MESSAGES = {
  created: '新增成功！',
  updated: '修改成功！',
  deleted: '删除成功！',
  error:   '操作失败，请重试！',
};

// 构造「返回列表」链接：带回来源查询条件（q / page）
// 供详情 / 新增 / 修改等页面使用；中文经 URLSearchParams 自动百分号编码
function buildBackUrl(query) {
  const back = new URLSearchParams();
  const q = String(query.q ?? '').trim();
  const page = parseInt(query.page, 10);
  if (q) back.set('q', q);
  if (Number.isInteger(page) && page >= 1) back.set('page', String(page));
  const s = back.toString();
  return s ? `/?${s}` : '/';
}

// 解析来源页码：非整数或小于 1 → 1（供表单 hidden 回传用）
function parsePage(value) {
  const page = parseInt(value, 10);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

// ---------------------------------------------------------------
// GET / —— 图书列表页（支持按书名模糊查询）
//   规则：按入库时间（creationTime）降序；每页 5 条；日期显示 yyyy-MM-dd
//   参数：?q=关键词（书名模糊匹配，可空）
//         ?page=N（缺省 / 非法为第 1 页；越界收敛到最后一页）
//         ?msg=created/updated/deleted/error（跳转提示，见上方 MESSAGES）
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

    // 6. 渲染列表页（q 回填；msg 映射为顶部提示条）
    const msgKey = String(req.query.msg ?? '');
    res.render('books/list', {
      title: '图书列表',
      books, page, totalPages, q,
      message: MESSAGES[msgKey] || '',
      messageType: msgKey === 'error' ? 'error' : 'success',
    });
  } catch (err) {
    next(err);   // 出错交给 Express 统一处理，日志里能看到原因
  }
});

// ---------------------------------------------------------------
// GET /books/new —— 新增图书页（表单）
//   ⚠️ 必须注册在 GET /books/:id 【之前】，否则 "new" 会被当成 :id
//   默认值：入库人 = 系统管理员；入库时间 = 今天；是否借阅 = 未借阅
// ---------------------------------------------------------------
router.get('/books/new', async (req, res, next) => {
  try {
    // 类型下拉数据（试卷要求：必须来自 book_type 表）
    const [types] = await pool.query('SELECT id, typeName FROM book_type ORDER BY id');

    // 表单默认值（入库时间 = 今天，本地时区）
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const form = {
      bookCode: '', bookName: '', bookType: '', bookAuthor: '', publishPress: '',
      borrowed: '0', createdBy: '系统管理员', creationTime: today,
    };

    res.render('books/new', {
      title: '新增图书信息',
      types, form,
      q: String(req.query.q ?? '').trim(),
      page: parsePage(req.query.page),
      backUrl: buildBackUrl(req.query),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// POST /books —— 保存新增图书
//   校验：必填 6 项（编号 / 名称 / 类型 / 借阅 / 入库人 / 入库时间）
//   通过 → INSERT（publishDate 不在表单内，默认取当天）→ 跳回列表 ?msg=created
//   失败 → 回显表单 + 红提示（写明缺哪些项）；前端另有 HTML5 required 拦截
// ---------------------------------------------------------------
router.post('/books', async (req, res, next) => {
  try {
    // 1. 类型表（下拉回显 + 合法性校验用）
    const [types] = await pool.query('SELECT id, typeName FROM book_type ORDER BY id');
    const typeIds = types.map((t) => t.id);

    // 2. 取出表单字段（去空白）
    const form = {
      bookCode: String(req.body.bookCode ?? '').trim(),
      bookName: String(req.body.bookName ?? '').trim(),
      bookType: String(req.body.bookType ?? '').trim(),
      bookAuthor: String(req.body.bookAuthor ?? '').trim(),
      publishPress: String(req.body.publishPress ?? '').trim(),
      borrowed: String(req.body.borrowed ?? '').trim(),
      createdBy: String(req.body.createdBy ?? '').trim(),
      creationTime: String(req.body.creationTime ?? '').trim(),
    };

    // 3. 必填校验（后端兜底；前端 required 已拦一道）
    const missing = [];
    if (!form.bookCode) missing.push('图书编号');
    if (!form.bookName) missing.push('图书名称');
    if (!form.bookType) missing.push('图书类型');
    if (!form.borrowed) missing.push('是否借阅');
    if (!form.createdBy) missing.push('入库人');
    if (!form.creationTime) missing.push('入库时间');
    if (form.bookType && !typeIds.includes(parseInt(form.bookType, 10))) missing.push('图书类型（无效值）');
    if (form.borrowed && !['0', '1'].includes(form.borrowed)) missing.push('是否借阅（无效值）');
    if (form.creationTime && !/^\d{4}-\d{2}-\d{2}$/.test(form.creationTime)) missing.push('入库时间（格式应为 yyyy-MM-dd）');

    // 4. 校验失败：回显 + 红提示（q / page 原样回传，返回链接不丢条件）
    if (missing.length > 0) {
      return res.status(400).render('books/new', {
        title: '新增图书信息',
        types, form,
        q: String(req.body.q ?? '').trim(),
        page: parsePage(req.body.page),
        backUrl: buildBackUrl(req.body),
        message: `新增失败！请检查：${missing.join('、')}`,
        messageType: 'error',
      });
    }

    // 5. 写入（publishDate 表单无此字段——试卷表单只有 8 项，默认取当天）
    await pool.query(
      `INSERT INTO book_info
         (bookCode, bookName, bookType, bookAuthor, publishPress, publishDate, borrowed, createdBy, creationTime)
       VALUES (?, ?, ?, ?, ?, CURDATE(), ?, ?, ?)`,
      [
        form.bookCode, form.bookName, parseInt(form.bookType, 10),
        form.bookAuthor, form.publishPress,
        parseInt(form.borrowed, 10), form.createdBy, form.creationTime,
      ],
    );

    // 6. 成功 → 跳回列表页显示「新增成功！」
    res.redirect('/?msg=created');
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// GET /books/:id —— 图书详情页（只读 8 字段）
//   参数：?q=关键词 / ?page=N（从列表页带过来，「返回」时原样带回）
//   规则：id 非正整数或查不到 → 404「图书不存在」
//   ⚠️ 注册顺序：GET /books/new（上方已实现）必须注册在本路由【之前】
// ---------------------------------------------------------------
router.get('/books/:id', async (req, res, next) => {
  try {
    // 1. 校验 id：非正整数直接 404
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(404).send('图书不存在');
    }

    // 2. 联表查询（分类名 + 入库时间格式化为 yyyy-MM-dd）
    const [rows] = await pool.query(
      `SELECT
         b.bookId,
         b.bookCode,
         b.bookName,
         t.typeName,
         b.bookAuthor,
         b.publishPress,
         b.borrowed,
         b.createdBy,
         DATE_FORMAT(b.creationTime, '%Y-%m-%d') AS creationDate
       FROM book_info b
       LEFT JOIN book_type t ON b.bookType = t.id
       WHERE b.bookId = ?`,
      [id],
    );
    if (rows.length === 0) {
      return res.status(404).send('图书不存在');
    }

    // 3. 渲染详情页（「返回」链接带回来源查询条件）
    res.render('books/detail', {
      title: '查看图书信息',
      book: rows[0],
      backUrl: buildBackUrl(req.query),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// GET /books/:id/edit —— 修改图书页（预填现有值）
//   入库人 / 入库时间：只读展示、不提交（试卷要求不可修改）
// ---------------------------------------------------------------
router.get('/books/:id/edit', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(404).send('图书不存在');
    }

    // 现记录（可编辑字段 + 只读字段 + 下拉选中用 bookType）
    const [rows] = await pool.query(
      `SELECT bookId, bookCode, bookName, bookType, bookAuthor, publishPress, borrowed, createdBy,
              DATE_FORMAT(creationTime, '%Y-%m-%d') AS creationDate
         FROM book_info WHERE bookId = ?`,
      [id],
    );
    if (rows.length === 0) {
      return res.status(404).send('图书不存在');
    }

    const [types] = await pool.query('SELECT id, typeName FROM book_type ORDER BY id');

    res.render('books/edit', {
      title: '修改图书信息',
      types,
      book: rows[0],
      q: String(req.query.q ?? '').trim(),
      page: parsePage(req.query.page),
      backUrl: buildBackUrl(req.query),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// POST /books/:id —— 保存修改
//   可编辑：编号 / 名称 / 类型 / 作者 / 出版社 / 借阅
//   不可改：入库人 / 入库时间（表单一律不提交这两个字段，这里也不更新）
//   成功 → UPDATE（并记录 lastUpdatetime）→ 跳回列表 ?msg=updated
//   失败 → 回显表单 + 红提示
// ---------------------------------------------------------------
router.post('/books/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(404).send('图书不存在');
    }

    const [types] = await pool.query('SELECT id, typeName FROM book_type ORDER BY id');
    const typeIds = types.map((t) => t.id);

    const form = {
      bookCode: String(req.body.bookCode ?? '').trim(),
      bookName: String(req.body.bookName ?? '').trim(),
      bookType: String(req.body.bookType ?? '').trim(),
      bookAuthor: String(req.body.bookAuthor ?? '').trim(),
      publishPress: String(req.body.publishPress ?? '').trim(),
      borrowed: String(req.body.borrowed ?? '').trim(),
    };

    // 原记录（确认存在 + 失败回显时只读字段取原值）
    const [rows] = await pool.query(
      `SELECT bookId, bookCode, bookName, bookType, bookAuthor, publishPress, borrowed, createdBy,
              DATE_FORMAT(creationTime, '%Y-%m-%d') AS creationDate
         FROM book_info WHERE bookId = ?`,
      [id],
    );
    if (rows.length === 0) {
      return res.status(404).send('图书不存在');
    }

    // 必填校验（编号 / 名称 / 类型 / 借阅）
    const missing = [];
    if (!form.bookCode) missing.push('图书编号');
    if (!form.bookName) missing.push('图书名称');
    if (!form.bookType) missing.push('图书类型');
    if (!form.borrowed) missing.push('是否借阅');
    if (form.bookType && !typeIds.includes(parseInt(form.bookType, 10))) missing.push('图书类型（无效值）');
    if (form.borrowed && !['0', '1'].includes(form.borrowed)) missing.push('是否借阅（无效值）');

    // 失败：回显（可编辑字段用提交值，只读字段用库中原值）+ 红提示
    if (missing.length > 0) {
      return res.status(400).render('books/edit', {
        title: '修改图书信息',
        types,
        book: { ...rows[0], ...form },
        q: String(req.body.q ?? '').trim(),
        page: parsePage(req.body.page),
        backUrl: buildBackUrl(req.body),
        message: `修改失败！请检查：${missing.join('、')}`,
        messageType: 'error',
      });
    }

    // 更新（入库人 / 入库时间不动；lastUpdatetime 记录本次修改时间）
    await pool.query(
      `UPDATE book_info
          SET bookCode = ?, bookName = ?, bookType = ?, bookAuthor = ?, publishPress = ?,
              borrowed = ?, lastUpdatetime = NOW()
        WHERE bookId = ?`,
      [
        form.bookCode, form.bookName, parseInt(form.bookType, 10),
        form.bookAuthor, form.publishPress, parseInt(form.borrowed, 10),
        id,
      ],
    );

    res.redirect('/?msg=updated');
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// POST /books/:id/delete —— 删除图书（列表页 confirm 确认后提交）
//   成功 / 失败都跳回列表页显示结果提示（试卷 p6：删除结果提示）
// ---------------------------------------------------------------
router.post('/books/:id/delete', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(404).send('图书不存在');
    }

    const [result] = await pool.query('DELETE FROM book_info WHERE bookId = ?', [id]);
    if (result.affectedRows === 0) {
      // 记录不存在（如手输 URL）→ 失败提示
      return res.redirect('/?msg=error');
    }

    res.redirect('/?msg=deleted');
  } catch (err) {
    // 数据库层失败 → 跳回列表显示「操作失败，请重试！」
    console.error('[books] 删除失败：', err.message);
    res.redirect('/?msg=error');
  }
});

module.exports = router;
