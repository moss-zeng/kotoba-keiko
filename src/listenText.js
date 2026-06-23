// 把分词 token 数组按换行切成段落（与 ArticleText 的 groups 段落划分一致：
// 以 \n 为分隔，含 ≥1 个非换行 token 的才算一段），翻译按段下标对齐用

export function splitParagraphs(tokens) {
  const paras = []
  let cur = ''
  let n = 0
  for (const t of tokens || []) {
    if (t.w === '\n') {
      if (n) paras.push(cur)
      cur = ''
      n = 0
    } else {
      cur += t.w
      n++
    }
  }
  if (n) paras.push(cur)
  return paras
}
