-- ========== 表记词（题型A：看表记写假名）==========
CREATE TABLE IF NOT EXISTS kanji_words (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  hyoki      TEXT    NOT NULL,            -- 表记（汉字写法），如「勉強」
  kana       TEXT    NOT NULL,            -- 假名读音（标准答案），如「べんきょう」
  meaning    TEXT    NOT NULL,            -- 日文释义（勿写入该词读音以免泄露答案），如「勉学にはげむこと」
  score      INTEGER NOT NULL DEFAULT 0,  -- 当前分数，>=3 视为毕业、不再抽
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ========== 拟态词段落（题型B：完形填空配对）==========
CREATE TABLE IF NOT EXISTS onomatopoeia (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  body       TEXT    NOT NULL,            -- 带 **标记** 的整段原文
  score      INTEGER NOT NULL DEFAULT 0,  -- 当前分数，>=3 视为毕业、不再抽
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ========== 考试记录（错题本，全部保存）==========
CREATE TABLE IF NOT EXISTS exam_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  finished_at TEXT    NOT NULL DEFAULT (datetime('now')),  -- 交卷时间
  total       INTEGER NOT NULL,          -- 本次总题数
  correct     INTEGER NOT NULL,          -- 答对数
  wrong_items TEXT    NOT NULL           -- 错题详情（JSON：题型/题面/正确答案/你的答案）
);

-- ========== 进行中的考试（暂存续接，单用户单行 id=1）==========
CREATE TABLE IF NOT EXISTS active_exam (
  id         INTEGER PRIMARY KEY CHECK (id = 1),  -- 永远只有一行
  questions  TEXT NOT NULL,              -- 抽中的题目与固定顺序（JSON）
  answers    TEXT NOT NULL,              -- 已答情况与累计得分（JSON）
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== 语法笔记原文（单行 id=1，整篇 mdx）==========
CREATE TABLE IF NOT EXISTS grammar_doc (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  text       TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== 语法义项的学习标记（按 标题+词性+意思 的锚点存）==========
CREATE TABLE IF NOT EXISTS grammar_state (
  k         TEXT PRIMARY KEY,  -- 锚点 key
  state     TEXT NOT NULL,     -- 'seen'(已看) / 'key'(重点) / 'known'(熟悉)；未看(new)不存
  collapsed INTEGER NOT NULL DEFAULT 0  -- 1=收起例句（持久）
);
