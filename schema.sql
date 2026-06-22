-- ========== 表记词（题型A：看表记写假名）==========
CREATE TABLE IF NOT EXISTS kanji_words (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  hyoki      TEXT    NOT NULL,            -- 表记（汉字写法），如「勉強」
  kana       TEXT    NOT NULL,            -- 假名读音（标准答案），如「べんきょう」
  meaning    TEXT    NOT NULL,            -- 日文释义（勿写入该词读音以免泄露答案），如「勉学にはげむこと」
  score        INTEGER NOT NULL DEFAULT 0,  -- 0-2 常规；3=待复习；4=永久毕业
  graduated_at TEXT,                          -- 升到 3 分的时间(UTC)，满 15 天进复习；null=未到过 3 分
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ========== 认读词（题型C：看假名自测认识/不认识）==========
CREATE TABLE IF NOT EXISTS reading_words (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kana       TEXT    NOT NULL,            -- 假名（必填，题面）
  kanji      TEXT,                        -- 汉字形式（可选）
  meanings   TEXT    NOT NULL,            -- 多义 JSON：[{cn 中文意思, sentence 日语造句, note 中文解释}]
  score        REAL    NOT NULL DEFAULT 0,  -- 认识+0.5/不认识-1.5；3≤score<4 待复习；≥4 毕业
  graduated_at TEXT,                          -- 升入[3,4)的时间(UTC)，满 15 天进复习
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ========== 拟态词段落（题型B：完形填空配对）==========
CREATE TABLE IF NOT EXISTS onomatopoeia (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  body       TEXT    NOT NULL,            -- 带 **标记** 的整段原文
  score        INTEGER NOT NULL DEFAULT 0,  -- 0-2 常规；3=待复习；4=永久毕业
  graduated_at TEXT,                          -- 升到 3 分的时间(UTC)，满 15 天进复习；null=未到过 3 分
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
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
  text       TEXT    NOT NULL DEFAULT '',       -- 原文
  tokens     TEXT    NOT NULL DEFAULT '[]',     -- 分词结果 JSON：[{w 表层, r 读音(平假名), base 辞书形}]，手动修正后以此为准
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (set_id, seq)
);
