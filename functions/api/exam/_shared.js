// 抽题/判分共享逻辑（下划线开头不作为路由）

// 假名标准化：去首尾空格、去全角/半角空格、片假名转平假名
export function normalizeKana(s) {
  return (s ?? '')
    .trim()
    .replace(/[　\s]/g, '')
    .replace(/[ァ-ヶ]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0x60)
    )
}

// 解析 **词** 标记，返回挖空结构与正确答案序列
export function parseOno(body) {
  const re = /\*\*([^*]+)\*\*/g
  const parts = []
  const answers = []
  let last = 0
  let m
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) parts.push({ t: 'text', v: body.slice(last, m.index) })
    parts.push({ t: 'blank', i: answers.length })
    answers.push(m[1])
    last = m.index + m[0].length
  }
  if (last < body.length) parts.push({ t: 'text', v: body.slice(last) })
  return { parts, answers }
}

// Fisher–Yates 洗牌（返回新数组）
export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
