-- ============================================================
-- 一次性迁移：旧计分(0-4整数/REAL) → 新计分(平滑小数+连击+闯关)
-- 仅需执行一次。本地：wrangler d1 execute DB --local --file=./migrate_scoring.sql
--                线上：wrangler d1 execute DB --remote --file=./migrate_scoring.sql
-- 迁移规则：
--   表记/拟态：旧4→graduated；旧3→review1(到期随机0~2天)；正分→score×0.5；0→0；负分→score×0.25
--   认读：旧≥4→graduated；旧[3,4)→review1(随机0~2天)；正分→streak=3；0→streak=0；负分→streak=0
--   attempt_count 种子：旧正分→5(过保护)；0→0(真新词)；负分→1(不占新题桶、仍享前期保护)
-- ============================================================

-- ---------- 表记 ----------
ALTER TABLE kanji_words RENAME TO kanji_words_old;
CREATE TABLE kanji_words (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  hyoki         TEXT    NOT NULL,
  kana          TEXT    NOT NULL,
  meaning       TEXT    NOT NULL,
  score         REAL    NOT NULL DEFAULT 0,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  stage         TEXT    NOT NULL DEFAULT 'learning',
  review_due_at TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO kanji_words (id, hyoki, kana, meaning, score, attempt_count, stage, review_due_at, created_at)
SELECT id, hyoki, kana, meaning,
  CASE WHEN score >= 4 THEN 3.0
       WHEN score = 3  THEN 3.0
       WHEN score > 0  THEN score * 0.5
       WHEN score < 0  THEN score * 0.25
       ELSE 0 END,
  CASE WHEN score > 0 THEN 5 WHEN score < 0 THEN 1 ELSE 0 END,
  CASE WHEN score >= 4 THEN 'graduated'
       WHEN score = 3  THEN 'review1'
       ELSE 'learning' END,
  CASE WHEN score = 3 THEN datetime('now', '+' || (abs(random()) % 3) || ' days') ELSE NULL END,
  created_at
FROM kanji_words_old;
DROP TABLE kanji_words_old;

-- ---------- 拟态 ----------
ALTER TABLE onomatopoeia RENAME TO onomatopoeia_old;
CREATE TABLE onomatopoeia (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  body          TEXT    NOT NULL,
  score         REAL    NOT NULL DEFAULT 0,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  stage         TEXT    NOT NULL DEFAULT 'learning',
  review_due_at TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO onomatopoeia (id, body, score, attempt_count, stage, review_due_at, created_at)
SELECT id, body,
  CASE WHEN score >= 4 THEN 3.0
       WHEN score = 3  THEN 3.0
       WHEN score > 0  THEN score * 0.5
       WHEN score < 0  THEN score * 0.25
       ELSE 0 END,
  CASE WHEN score > 0 THEN 5 WHEN score < 0 THEN 1 ELSE 0 END,
  CASE WHEN score >= 4 THEN 'graduated'
       WHEN score = 3  THEN 'review1'
       ELSE 'learning' END,
  CASE WHEN score = 3 THEN datetime('now', '+' || (abs(random()) % 3) || ' days') ELSE NULL END,
  created_at
FROM onomatopoeia_old;
DROP TABLE onomatopoeia_old;

-- ---------- 认读 ----------
ALTER TABLE reading_words RENAME TO reading_words_old;
CREATE TABLE reading_words (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kana          TEXT    NOT NULL,
  kanji         TEXT,
  meanings      TEXT    NOT NULL,
  streak        INTEGER NOT NULL DEFAULT 0,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  stage         TEXT    NOT NULL DEFAULT 'learning',
  review_due_at TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO reading_words (id, kana, kanji, meanings, streak, attempt_count, stage, review_due_at, created_at)
SELECT id, kana, kanji, meanings,
  CASE WHEN score >= 3 THEN 7
       WHEN score > 0  THEN 3
       ELSE 0 END,
  CASE WHEN score > 0 THEN 5 WHEN score < 0 THEN 1 ELSE 0 END,
  CASE WHEN score >= 4 THEN 'graduated'
       WHEN score >= 3 THEN 'review1'
       ELSE 'learning' END,
  CASE WHEN score >= 3 AND score < 4 THEN datetime('now', '+' || (abs(random()) % 3) || ' days') ELSE NULL END,
  created_at
FROM reading_words_old;
DROP TABLE reading_words_old;

-- ---------- 事实表 + 清暂存 ----------
CREATE TABLE IF NOT EXISTS word_attempt (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  word_type      TEXT    NOT NULL,
  word_id        INTEGER NOT NULL,
  attempted_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  total_blanks   INTEGER NOT NULL,
  filled_blanks  INTEGER NOT NULL,
  correct_blanks INTEGER NOT NULL,
  is_review      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_word_attempt_word ON word_attempt(word_type, word_id);
DELETE FROM active_exam;
