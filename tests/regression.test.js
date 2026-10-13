// tests/regression.test.js — 回归测试（/health + 六大功能）
//
// 运行：npm test（等价于 node --test）
// 设计要点：
//   - supertest 直接引入 src/app（应用与监听已分离），不占用 3001 端口
//   - 数据库配置走环境变量（本地 .env / CI 注入）—— 测试代码不出现硬编码账号密码
//   - 写操作只针对本测试创建的 TEST-* 记录：用例前后均清理，10 条种子数据不受影响
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const pool = require('../src/db');

// 测试记录统一前缀（清理 SQL 只认这个前缀）
const TEST_PREFIX = 'TEST-';

// 新增 → 修改 → 删除 链路共用的测试记录 id
let testBookId = null;

// —— 工具 ——

// 清理本测试创建的记录（幂等：上次中断留下的残留一并清掉）
async function cleanupTestData() {
  await pool.query('DELETE FROM book_info WHERE bookCode LIKE ?', [`${TEST_PREFIX}%`]);
}

// 从列表页 HTML 中按显示顺序提取数据行的图书 id（匹配「查看」链接 /books/<id>?…）
function pickRowIds(html) {
  return [...html.matchAll(/href="\/books\/(\d+)\?/g)].map((m) => Number(m[1]));
}

// 取「列表同款排序」下第 N 页的期望 id 序列（用于与页面渲染逐条比对）
async function expectedPageIds(page, size = 5) {
  const [rows] = await pool.query(
    `SELECT bookId FROM book_info
      ORDER BY creationTime DESC, bookId DESC
      LIMIT ${size} OFFSET ${(page - 1) * size}`,
  );
  return rows.map((r) => r.bookId);
}

// 当前记录总数 / 总页数
async function totals(size = 5) {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM book_info');
  return { total, totalPages: Math.max(1, Math.ceil(total / size)) };
}

// DATETIME 兼容比较（mysql2 默认把 DATETIME 解成 Date 对象）
function timeValue(v) {
  return v instanceof Date ? v.getTime() : String(v);
}

before(async () => {
  await cleanupTestData(); // 保证测试从干净状态开始
});

after(async () => {
  await cleanupTestData();
  await pool.end(); // 不关连接池，node --test 的进程不会退出
});

// =================================================================
// 1. 探活
// =================================================================
test('/health：返回 200 与 ok 状态', async () => {
  const res = await request(app).get('/health').expect(200);
  assert.equal(res.body.status, 'ok');
});

// =================================================================
// 2. 列表页（每页 5 条 + 入库时间降序 + 分页收敛）
// =================================================================
test('列表页：默认第 1 页 5 条 + 降序 + 8 列表头 + 共 N 页', async () => {
  const { totalPages } = await totals();
  const res = await request(app).get('/').expect(200);

  // 8 列表头（试卷硬需求，顺序固定）
  for (const th of ['图书编号', '图书分类', '图书名称', '作者', '出版社', '入库时间', '是否借阅', '操作']) {
    assert.ok(res.text.includes(`<th>${th}</th>`), `缺少表头：${th}`);
  }
  // 降序 + 每页 5 条：与数据库同款排序逐条比对
  assert.deepEqual(pickRowIds(res.text), await expectedPageIds(1), '首页数据应与降序前 5 条一致');
  // 分页条
  assert.ok(res.text.includes(`共 ${totalPages} 页`), '分页条应显示总页数');
});

test('列表页：第 2 页正确 + 越界收敛末页 + 非法页码回落第 1 页', async () => {
  const { totalPages } = await totals();

  const res2 = await request(app).get('/?page=2').expect(200);
  assert.deepEqual(pickRowIds(res2.text), await expectedPageIds(2), '第 2 页数据应正确');

  const res99 = await request(app).get('/?page=99').expect(200);
  assert.deepEqual(pickRowIds(res99.text), await expectedPageIds(totalPages), '越界页码应收敛到末页');
  assert.ok(res99.text.includes(`is-active">${totalPages}<`), '末页页码应高亮');

  const resAbc = await request(app).get('/?page=abc').expect(200);
  assert.deepEqual(pickRowIds(resAbc.text), await expectedPageIds(1), '非法页码应回落到第 1 页');
});

// =================================================================
// 3. 模糊查询（LIKE 过滤 + 条件回填 + 通配符转义）
// =================================================================
test('查询：q=三 过滤生效 + 输入框回填', async () => {
  const [[{ cnt }]] = await pool.query('SELECT COUNT(*) AS cnt FROM book_info WHERE bookName LIKE ?', ['%三%']);
  const res = await request(app).get('/').query({ q: '三' }).expect(200);

  assert.ok(res.text.includes('value="三"'), '查询框应回填关键词');
  assert.equal(pickRowIds(res.text).length, Math.min(cnt, 5), '结果条数应与数据库一致');
});

test('查询：% 作为普通字符（未转义会匹配全部书名）', async () => {
  const res = await request(app).get('/').query({ q: '%' }).expect(200);
  assert.equal(pickRowIds(res.text).length, 0, '% 应被转义，不匹配任何书名');
});

// =================================================================
// 4. 列表提示条（?msg= 映射）
// =================================================================
test('提示条：成功/失败样式与文案正确渲染', async () => {
  const ok = await request(app).get('/?msg=created').expect(200);
  assert.ok(ok.text.includes('alert-success') && ok.text.includes('新增成功'), '成功提示应为绿条');

  const bad = await request(app).get('/?msg=error').expect(200);
  assert.ok(bad.text.includes('alert-error') && bad.text.includes('操作失败'), '失败提示应为红条');
});

test('静态资源：样式表与组件一览页可访问', async () => {
  await request(app).get('/css/style.css').expect(200);
  await request(app).get('/styleguide.html').expect(200);
});

// =================================================================
// 5. 详情页（8 字段只读 + 返回保留条件 + 404 兜底）
// =================================================================
test('详情：正常 id 渲染 8 字段；返回链接带回来源条件', async () => {
  const [[seed]] = await pool.query(
    'SELECT bookId, bookCode, bookName, createdBy FROM book_info ORDER BY bookId LIMIT 1',
  );
  const res = await request(app).get(`/books/${seed.bookId}`).expect(200);

  for (const v of [seed.bookCode, seed.bookName, seed.createdBy]) {
    assert.ok(res.text.includes(v), `详情页应包含：${v}`);
  }
  assert.ok(res.text.includes('href="/"'), '无来源条件时返回链接为 /');

  // 带 q / page 时，返回链接原样带回（中文为百分号编码；EJS 转义后 & 显示为 &amp;）
  const res2 = await request(app).get(`/books/${seed.bookId}`).query({ q: '三', page: 2 }).expect(200);
  assert.ok(res2.text.includes('href="/?q=%E4%B8%89&amp;page=2"'), '返回链接应带回查询条件');
});

test('详情：不存在 id / 非法 id → 404', async () => {
  await request(app).get('/books/999999').expect(404);
  await request(app).get('/books/abc').expect(404);
});

// =================================================================
// 6. 新增（表单渲染 + 校验失败 + 成功入库）
// =================================================================
test('新增页：表单渲染，类型下拉来自 book_type', async () => {
  const [[type]] = await pool.query('SELECT typeName FROM book_type ORDER BY id LIMIT 1');
  const res = await request(app).get('/books/new').expect(200);
  assert.ok(res.text.includes('新增图书信息'));
  assert.ok(res.text.includes(type.typeName), '类型下拉应包含 book_type 数据');
});

test('新增：缺必填项 → 400 + 红提示（不写库）', async () => {
  const res = await request(app)
    .post('/books')
    .type('form')
    .send({ bookCode: '', bookName: '', bookType: '', borrowed: '', createdBy: '', creationTime: '' })
    .expect(400);
  assert.ok(res.text.includes('新增失败'));
  assert.ok(res.text.includes('alert-error'));
});

test('新增：合法数据 → 302 跳回列表（msg=created）+ 记录入库', async () => {
  const res = await request(app)
    .post('/books')
    .type('form')
    .send({
      bookCode: `${TEST_PREFIX}0001`,
      bookName: '回归测试图书',
      bookType: '1',
      bookAuthor: '测试作者',
      publishPress: '测试出版社',
      borrowed: '0',
      createdBy: '回归测试',
      creationTime: '2026-01-01',
    })
    .expect(302);
  assert.equal(res.headers.location, '/?msg=created');

  const [rows] = await pool.query('SELECT bookId, bookName FROM book_info WHERE bookCode = ?', [`${TEST_PREFIX}0001`]);
  assert.equal(rows.length, 1, '新记录应已入库');
  assert.equal(rows[0].bookName, '回归测试图书');
  testBookId = rows[0].bookId; // 供修改 / 删除用例使用
});

// =================================================================
// 7. 修改（预填 + 成功更新 + 只读字段不可改）
// =================================================================
test('修改页：预填现有值', async () => {
  const res = await request(app).get(`/books/${testBookId}/edit`).expect(200);
  assert.ok(res.text.includes('修改图书信息'));
  assert.ok(res.text.includes('回归测试图书'), '表单应预填原值');
});

test('修改：成功 → 302（msg=updated）+ 数据更新 + 只读字段不变', async () => {
  const [[before]] = await pool.query('SELECT createdBy, creationTime FROM book_info WHERE bookId = ?', [testBookId]);

  const res = await request(app)
    .post(`/books/${testBookId}`)
    .type('form')
    .send({
      bookCode: `${TEST_PREFIX}0001`,
      bookName: '回归测试图书（已修改）',
      bookType: '2',
      bookAuthor: '测试作者',
      publishPress: '测试出版社',
      borrowed: '1',
      // 故意夹带只读字段（模拟绕过前端），后端必须忽略
      createdBy: '恶意修改',
      creationTime: '1999-01-01',
    })
    .expect(302);
  assert.equal(res.headers.location, '/?msg=updated');

  const [[after]] = await pool.query(
    'SELECT bookName, bookType, borrowed, createdBy, creationTime, lastUpdatetime FROM book_info WHERE bookId = ?',
    [testBookId],
  );
  assert.equal(after.bookName, '回归测试图书（已修改）', '名称应更新');
  assert.equal(after.bookType, 2);
  assert.equal(after.borrowed, 1);
  assert.equal(after.createdBy, before.createdBy, '入库人不可改');
  assert.equal(timeValue(after.creationTime), timeValue(before.creationTime), '入库时间不可改');
  assert.ok(after.lastUpdatetime, '修改后应记录 lastUpdatetime');
});

test('修改：缺必填项 → 400 + 红提示；不存在 id → 404', async () => {
  const res = await request(app)
    .post(`/books/${testBookId}`)
    .type('form')
    .send({ bookCode: '', bookName: '', bookType: '', borrowed: '' })
    .expect(400);
  assert.ok(res.text.includes('修改失败'));

  await request(app)
    .post('/books/999999')
    .type('form')
    .send({ bookCode: 'X', bookName: 'X', bookType: '1', borrowed: '0' })
    .expect(404);
});

// =================================================================
// 8. 删除（成功移除 + 失败提示）
// =================================================================
test('删除：成功 → 302（msg=deleted）+ 记录移除', async () => {
  const res = await request(app).post(`/books/${testBookId}/delete`).expect(302);
  assert.equal(res.headers.location, '/?msg=deleted');

  const [rows] = await pool.query('SELECT bookId FROM book_info WHERE bookId = ?', [testBookId]);
  assert.equal(rows.length, 0, '记录应已删除');
});

test('删除：不存在的 id → 302 回列表（msg=error）', async () => {
  const res = await request(app).post('/books/999999/delete').expect(302);
  assert.equal(res.headers.location, '/?msg=error');
});
