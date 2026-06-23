-- ========== 计分模型说明（表记/拟态用 score，认读用 streak；闯关复习共用 stage）==========
-- stage：learning(学习中) / review1(复习关1) / review2(复习关2) / graduated(毕业，不再抽)
-- review_due_at：当前复习关的到期时间(UTC)；learning/graduated 时为 null
-- attempt_count：累计作答次数(派生缓存)，用于新手期系数(第1-3次×0.25 / 4-5次×0.75 / 6+×1.0)与「新题桶」判定
-- 以上分数字段均为派生缓存，由 word_attempt(事实层)唯一决定，可随时重算

-- ========== 表记词（题型A：看表记写假名）==========
CREATE TABLE IF NOT EXISTS kanji_words (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  hyoki         TEXT    NOT NULL,                 -- 表记（汉字写法），如「勉強」
  kana          TEXT    NOT NULL,                 -- 假名读音（标准答案），如「べんきょう」
  meaning       TEXT    NOT NULL,                 -- 日文释义（勿写入该词读音以免泄露答案）
  score         REAL    NOT NULL DEFAULT 0,       -- 平滑掌握度；达 3.0 进复习
  attempt_count INTEGER NOT NULL DEFAULT 0,
  stage         TEXT    NOT NULL DEFAULT 'learning',
  review_due_at TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ========== 认读词（题型C：看假名自测认识/不认识）==========
CREATE TABLE IF NOT EXISTS reading_words (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kana          TEXT    NOT NULL,                 -- 假名（必填，题面）
  kanji         TEXT,                             -- 汉字形式（可选）
  meanings      TEXT    NOT NULL,                 -- 多义 JSON：[{cn, sentence, note}]
  streak        INTEGER NOT NULL DEFAULT 0,       -- 连续认识次数；达 7 进复习；答错清 0
  attempt_count INTEGER NOT NULL DEFAULT 0,
  stage         TEXT    NOT NULL DEFAULT 'learning',
  review_due_at TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ========== 拟态词段落（题型B：完形填空配对）==========
CREATE TABLE IF NOT EXISTS onomatopoeia (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  body          TEXT    NOT NULL,                 -- 带 **标记** 的整段原文
  score         REAL    NOT NULL DEFAULT 0,       -- 平滑掌握度；达 3.0 进复习
  attempt_count INTEGER NOT NULL DEFAULT 0,
  stage         TEXT    NOT NULL DEFAULT 'learning',
  review_due_at TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ========== 作答事实表（每答一次追加一行，永不修改；分数由它重放）==========
CREATE TABLE IF NOT EXISTS word_attempt (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  word_type      TEXT    NOT NULL,                -- 'kanji' | 'reading' | 'ono'
  word_id        INTEGER NOT NULL,
  attempted_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  total_blanks   INTEGER NOT NULL,                -- 正确答案的空数（认读=1）
  filled_blanks  INTEGER NOT NULL,                -- 用户实际填入的空数（认读=1；表记可填错数量）
  correct_blanks INTEGER NOT NULL,                -- 答对的空数（认读：认识=1/不认识=0）
  is_review      INTEGER NOT NULL DEFAULT 0       -- 是否复习题
);
CREATE INDEX IF NOT EXISTS idx_word_attempt_word ON word_attempt(word_type, word_id);

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

-- ========== 听力集（一份听力音频，音频本体存 R2）==========
CREATE TABLE IF NOT EXISTS listening_set (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,                  -- 听力集名字，如「2023-12 真题」
  audio_key  TEXT,                              -- R2 中的音频路径；null=未上传
  duration   REAL,                              -- 音频总时长(秒)
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ========== 音频小节（切割结果，靠 seq 与文章配对）==========
CREATE TABLE IF NOT EXISTS listening_segment (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id     INTEGER NOT NULL,                  -- 所属听力集
  seq        INTEGER NOT NULL,                  -- 序号(配对锚点，1起)
  name       TEXT,                              -- 显示名(可改)，null=用「第N段」
  start_sec  REAL    NOT NULL,                  -- 区间起点(秒)
  end_sec    REAL    NOT NULL                   -- 区间终点(秒)
);

-- ========== 听力文章（靠 set_id+seq 与小节配对）==========
CREATE TABLE IF NOT EXISTS listening_article (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id     INTEGER NOT NULL,
  seq        INTEGER NOT NULL,
  text        TEXT    NOT NULL DEFAULT '',      -- 原文
  tokens      TEXT    NOT NULL DEFAULT '[]',    -- 分词结果 JSON：[{w 表层, r 读音(平假名), base 辞书形}]，手动修正后以此为准
  translation TEXT    NOT NULL DEFAULT '[]',    -- 按段对齐的中文翻译 JSON：["第1段译文","",...]，空串=该段不显示译文
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (set_id, seq)
);
