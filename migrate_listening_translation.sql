-- 听力文章新增「按段中文翻译」字段（本地与线上 D1 各跑一次）
-- translation：JSON 数组，按段落下标对齐，["第1段译文","",...]，空串=该段不显示译文
ALTER TABLE listening_article ADD COLUMN translation TEXT NOT NULL DEFAULT '[]';
