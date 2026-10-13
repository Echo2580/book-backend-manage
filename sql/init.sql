-- =============================================================
-- 内测07 · 图书借阅系统后台（book-backend-manage）
-- 数据库初始化脚本：建库 + 建表 + 种子数据
-- 库名：book_manage    字符集：utf8mb4
--
-- 执行方式（任选其一，在项目根目录下）：
--   命令行：mysql -u zhy -p123456 --default-character-set=utf8mb4 < sql/init.sql
--   客户端内：source sql/init.sql
--
-- 说明：脚本可重复执行，重跑会删除并重建两张表
-- =============================================================

CREATE DATABASE IF NOT EXISTS book_manage
  DEFAULT CHARACTER SET utf8mb4;

USE book_manage;

-- 先删子表，再删父表（外键依赖顺序）
DROP TABLE IF EXISTS book_info;
DROP TABLE IF EXISTS book_type;

-- -------------------------------------------------------------
-- 表 1：book_type（图书类型表）
-- -------------------------------------------------------------
CREATE TABLE book_type (
  id       INT         NOT NULL AUTO_INCREMENT COMMENT '类型ID',
  typeName VARCHAR(50) NOT NULL               COMMENT '图书类型名称',
  PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '图书类型表';

-- 类型种子数据（8 种）
INSERT INTO book_type (id, typeName) VALUES
  (1, '小说'),
  (2, '文学'),
  (3, '传记'),
  (4, '艺术'),
  (5, '少儿'),
  (6, '经济'),
  (7, '管理'),
  (8, '科技');

-- -------------------------------------------------------------
-- 表 2：book_info（图书信息表）
-- -------------------------------------------------------------
CREATE TABLE book_info (
  bookId         INT          NOT NULL AUTO_INCREMENT COMMENT '图书ID',
  bookCode       VARCHAR(50)  NOT NULL                COMMENT '图书编号',
  bookName       VARCHAR(100) NOT NULL                COMMENT '图书名称',
  bookType       INT          NOT NULL                COMMENT '图书类型（关联 book_type.id）',
  bookAuthor     VARCHAR(50)  NOT NULL                COMMENT '图书作者',
  publishPress   VARCHAR(100) NOT NULL                COMMENT '出版社',
  publishDate    DATE         NOT NULL                COMMENT '出版日期',
  borrowed       INT          NOT NULL DEFAULT 0      COMMENT '是否借阅（1=已借阅，0=未借阅）',
  createdBy      VARCHAR(50)  NOT NULL                COMMENT '入库人',
  creationTime   DATETIME     NOT NULL                COMMENT '入库时间',
  lastUpdatetime DATETIME     NULL     DEFAULT NULL   COMMENT '最新更新时间（修改时更新）',
  PRIMARY KEY (bookId),
  CONSTRAINT fk_book_info_type FOREIGN KEY (bookType) REFERENCES book_type (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '图书信息表';

-- 图书种子数据（10 条，覆盖全部 8 种类型；入库时间错开，便于验证降序与分页）
INSERT INTO book_info
  (bookCode, bookName, bookType, bookAuthor, publishPress, publishDate, borrowed, createdBy, creationTime)
VALUES
  ('BK0001', '三体',             1, '刘慈欣',       '重庆出版社',         '2008-01-01', 0, '系统管理员', '2026-09-20 09:15:00'),
  ('BK0002', '活着',             1, '余华',         '作家出版社',         '2012-08-01', 1, '系统管理员', '2026-09-24 14:30:00'),
  ('BK0003', '平凡的世界',       2, '路遥',         '北京十月文艺出版社', '2017-06-01', 0, '系统管理员', '2026-10-01 10:05:00'),
  ('BK0004', '苏东坡传',         3, '林语堂',       '湖南文艺出版社',     '2018-01-01', 0, '系统管理员', '2026-10-02 11:20:00'),
  ('BK0005', '艺术的故事',       4, '贡布里希',     '广西美术出版社',     '2008-04-01', 1, '系统管理员', '2026-10-05 16:40:00'),
  ('BK0006', '小王子',           5, '圣埃克苏佩里', '人民文学出版社',     '2003-08-01', 0, '系统管理员', '2026-10-08 09:50:00'),
  ('BK0007', '经济学原理',       6, '曼昆',         '北京大学出版社',     '2015-05-01', 0, '系统管理员', '2026-10-10 15:10:00'),
  ('BK0008', '卓有成效的管理者', 7, '德鲁克',       '机械工业出版社',     '2009-09-01', 0, '系统管理员', '2026-10-11 10:35:00'),
  ('BK0009', '时间简史',         8, '霍金',         '湖南科学技术出版社', '2010-04-01', 1, '系统管理员', '2026-10-12 14:00:00'),
  ('BK0010', '解忧杂货店',       1, '东野圭吾',     '南海出版公司',       '2014-05-01', 0, '系统管理员', '2026-10-13 09:30:00');

-- 初始化结果自检
SELECT
  (SELECT COUNT(*) FROM book_type) AS type_count,
  (SELECT COUNT(*) FROM book_info) AS book_count;
