当前任务：「听力」板块完成并推送，云端 D1 三张表已建；待 Cloudflare 创建 R2 桶 kotoba-keiko-audio 并确认绑定 AUDIO（否则线上音频上传/播放不可用）

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
认读词（新题型，自测）：新表 reading_words(kana / kanji可选 / meanings JSON[{cn,sentence,note}] / score REAL / graduated_at)；后端 reading.js(增查)、reading/[id].js(改删)、start.js 加抽认读(常规25 + 复习)、settle.js 认读评分(认识+0.5 / 不认识−1.5；升入[3,4)记时间、掉回<3清时间；3→4 需两轮各 15 天)；前端 AddWords 加认读 tab(表记|认读|拟态)、Study 加认读翻卡题(显示假名→翻开看汉字+意思→认识/不认识，前端自测不调判分)、WrongItem 加认读错题展示
时间：2026-06-22
听力板块（新增整块功能）：音频存 R2（绑定 AUDIO），文本与元数据存 D1。schema.sql 加 3 表 listening_set / listening_segment / listening_article(UNIQUE set_id+seq)；wrangler.jsonc 加 r2_buckets(binding=AUDIO,桶名 kotoba-keiko-audio)。
后端 functions/api/listen/：sets.js(列表带小节数/新建)、sets/[id].js(单集含小节+文章/改名/删除连带清 R2)、sets/[id]/audio.js(文件直传 R2，duration/ext 走 query)、sets/[id]/segments.js(整体替换切点)、sets/[id]/articles.js(按 set_id+seq upsert)、audio/[[path]].js(读 R2，支持 HTTP Range 用于区间播放/拖动)。
分词：kuromoji(@sglkc/kuromoji)，词典 18MB 自托管在 public/dict（构建复制进 dist），只在录入页 dynamic import 加载一次；src/tokenizer.js 封装(加载/分词/片假名转平假名/仅含汉字且读音不同才给振假名)；分词结果 {w,r,base} 存 D1，消费端零词典。
前端：Home 加「开始听力/录入听力」(错题本与开始语法间)；router 加 5 路由(/listen·/listen/manage·/listen/manage/:id·/listen/:id·/listen/:id/:seq，manage 在动态段前)。开始听力三级抽屉 Listen(集列表)→ListenSet(小节列表+改名)→ListenSegment(区间播放器+可点词读音+即时修正)；录入 ListenManage(建集/删)→ListenEdit(上传音频/纯时间轴切割±0.5微调/逐段分词录入)；共用组件 ArticleText.vue(读模式点词显振假名 / 编辑模式改读音·合并·拆字)。
关键设计：音频打时间戳标记(单文件+区间)不物理切割；音频与文章靠「同一集+seq」自动配对，各自独立录入；切点保存即整体替换(重切按 seq 保留旧名)；读音默认隐藏点词才显。
时间：2026-06-23
听力板块联调修复 + 体验改造：①分词卡死根因——@sglkc/kuromoji 的 BrowserDictionaryLoader 无条件 gunzip 且 gunzip 抛错落在未捕获内层 promise（服务器给 .gz 加 Content-Encoding 时浏览器已自动解压再 gunzip 必抛）→ 回调永不触发卡死。改为不走 builder，tokenizer.js 直接用内部类 DynamicDictionaries/Tokenizer 自组装，fetch 后按 gzip 魔数判断是否解压（dev/prod 通吃）。②音频条重做成自定义组件 AudioPlayer.vue 替换原生 range（原生被 Edge「拖拽搜索」误触弹必应）：pointer 事件自绘进度条 + 禁拖拽/选中、空格播放暂停·←→快进退(全局监听、输入框内不拦截)、起点对齐。③ArticleText.vue 改造：阅读端按换行分段、词间留缝(虚线分开)、振假名只盖汉字(首尾假名对齐裁剪)；编辑端按句翻页(上一段/下一段·上一句/下一句)+ sticky 悬浮正文高亮当前句。④振假名改用辞书形读音(飼い→かう)便于认词——靠把辞书形再丢分词器跑一遍取读音(来る→くる、不规则也准)，非活用词不变。
核心规则：score 0–2 常规 / 3 待复习（满 15 天进复习） / 4 永久毕业；单次抽 25 表记 + 25 认读 + 5 拟态（score<3、RANDOM）+ 到期复习题（额外、不占名额）；表记/拟态对 +1 错 −1，认读认识 +0.5 不认识 −1.5；拟态分数挂整段；分数结算时落库
