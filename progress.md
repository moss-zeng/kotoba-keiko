当前任务：第 1-4 批 + 词库编辑/删除 全部完成（本地功能完整），下一步部署到 Cloudflare（填云端 D1 的 database_id + 把表结构建到云端 + 推 GitHub + Pages 部署）

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
核心规则：单次抽 30（25 表记 + 5 拟态）；仅抽 score<3 且 ORDER BY RANDOM() 随机抽；每题一次机会，对 +1 错 −1；拟态分数挂整段、全部空对才 +1；分数在结算时才落库
