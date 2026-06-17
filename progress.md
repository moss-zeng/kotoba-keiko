当前任务：全部功能 + 背词优化（复制 / 进度实时存 / 3→4 升级复习）完成并推送，待云端 D1 执行「graduated_at 加字段 + 现有 3 分词迁移」SQL

历史记录
时间：2026-06-06
项目初始化：Vue 3 + Vite。技术栈 Vue3 + Vite + Cloudflare Pages/Functions + D1
schema.sql：建 4 表 kanji_words / onomatopoeia / exam_history / active_exam
wrangler.jsonc：配置 Pages + D1 绑定(binding=DB)。本地端口固定 5180，启动命令 npm run cf（concurrently 同跑 vite + wrangler，vite 代理 /api 到 8788）
第 1 批 录词：functions/api/kanji.js、onomatopoeia.js（增/查）；前端 Home / AddWords + vue-router + 极简 UI（浅色靛蓝）
第 2 批 背词：functions/api/exam/start.js（抽题）、answer.js（判分）、_shared.js（normalize/解析/洗牌）；前端 Study.vue
增补：kanji_words 的 meaning 改为「日文释义」，答题/错题点表记弹释义（拟态不加）；错题清单升级为逐字符/逐空对比组件 WrongItem.vue（答对绿色加粗、答错留空点击翻红色答案，错题本第 4 批复用）
第 3 批 退出三选项（方案 B：结算才算分）：answer.js 去掉即时算分（只判对错）；新增 settle.js（结算→批量算分+清暂存）/ save.js（暂存）/ discard.js（作废）；start.js 改为先查 active_exam 有则恢复进度、无则抽新题；Study.vue 加退出三选项弹层（结算/暂存/作废/取消）、answered 累积本局结果、答完自动结算、错题清单从 answered 筛
词库管理补全：新增 functions/api/kanji/[id].js、onomatopoeia/[id].js（PUT 编辑 / DELETE 删除，编辑保留 score）；AddWords.vue 列表每条加 编辑/删除（删除二次确认，编辑载入顶部表单、分数保留）
第 4 批 错题本：settle.js 结算时写入 exam_history（total/correct/wrong_items，全部场次保留）；新增 functions/api/history.js（GET 列全部场次）、History.vue（按时间倒序列场次、点开看该场错题、复用 WrongItem、UTC 时间转本地显示）；Home「错题本」按钮接入、路由 /history
功能迭代（部署后）：表记词支持多条释义 + 每条可加粗（meaning 改存 JSON，新增 src/meaning.js 解析、兼容旧纯文本）；拟态候选词去重、一个词可重复填多个空（解决重复词无法定位）；拟态显示保留换行（white-space: pre-wrap）；错题本每场可删除（functions/api/history/[id].js）
背词优化（部署后）：拟态题加复制按钮（挖空原文 + 「我的答案：」/「正确答案：」带标签）；进度实时存（每答一题 PUT active_exam，刷新可恢复）；提交锁防重复提交、失败可重试；3→4 升级与半月复习 —— kanji_words/onomatopoeia 加 graduated_at 字段，start.js 额外抽「score=3 且满 15 天」的复习题（不占 25+5 名额、标 review），settle.js 复习对→4 永久/错→2 清时间、常规升到 3 记 graduated_at；现有 3 分词均匀铺到 0–5 天到期（窗口函数 ROW_NUMBER%6）
UI 优化：录入页分数 4 分标绿 / 负分标红，列表头加「复习(3分)/毕业(4分)」统计；语法「开始语法」改为完整五十音图网格（あ–ん 含浊/半浊、真实布局，有笔记亮 / 无收录暗，や/わ/ん 用空位对齐）；背词答完后顶部按钮直接返回（不再弹三选项）
核心规则：score 0–2 常规 / 3 待复习（满 15 天进复习） / 4 永久毕业；单次抽 25 表记 + 5 拟态（score<3、RANDOM）+ 到期复习题（额外、不占名额）；每题一次机会，对 +1 错 −1；拟态分数挂整段；分数结算时落库
