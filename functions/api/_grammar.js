// 解析整篇语法笔记（mdx）→ 结构化，并提供义项标记锚点
// 结构：[{ row, points: [{ title, groups: [{ setsuzoku, items: [{ meaning, nuance, examples:[] }] }] }] }]
// 层级约定：## 假名行 / ### 语法点 / L2=接续(起一个接续组,可缺) /
//          Spoiler 内 L3=意思 / 非 Spoiler 的 L3=语感 / L4=例句

export function parseGrammar(text) {
  const lines = (text || '').split(/\r?\n/)
  const rows = []
  let curRow = null
  let curPoint = null
  let curGroup = null
  let curItem = null

  const ensureRow = (name) => {
    curRow = { row: name, points: [] }
    rows.push(curRow)
    curPoint = curGroup = curItem = null
  }
  const ensurePoint = (title) => {
    if (!curRow) ensureRow('') // 没有 ## 时的兜底行
    curPoint = { title, groups: [] }
    curRow.points.push(curPoint)
    curGroup = curItem = null
  }
  const ensureGroup = (setsuzoku) => {
    if (!curPoint) ensurePoint('')
    curGroup = { setsuzoku: setsuzoku ?? null, items: [] }
    curPoint.groups.push(curGroup)
    curItem = null
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    let m
    if ((m = line.match(/^###\s+(.+)$/))) {
      ensurePoint(m[1].trim())
    } else if ((m = line.match(/^##\s+(.+)$/))) {
      ensureRow(m[1].trim())
    } else if (line.includes('<Spoiler>')) {
      // 意思：Spoiler 内 level=3，取不到就去标签兜底；每个意思起一个新 item
      const mm = line.match(/<L\s+level=\{?3\}?>([\s\S]*?)<\/L>/)
      const meaning = (mm ? mm[1] : line.replace(/<[^>]+>/g, '')).trim()
      if (!curGroup) ensureGroup(null) // 无接续的语法点：意思直接挂空接续组
      curItem = { meaning, nuance: null, examples: [] }
      curGroup.items.push(curItem)
    } else if ((m = line.match(/<L\s+level=\{?2\}?>([\s\S]*?)<\/L>/))) {
      ensureGroup(m[1].trim()) // 接续：起一个新接续组
    } else if ((m = line.match(/<L\s+level=\{?3\}?>([\s\S]*?)<\/L>/))) {
      // 语感：不在 Spoiler 内的 level=3，挂到当前意思（多行则换行拼接）
      if (curItem) {
        const t = m[1].trim()
        curItem.nuance = curItem.nuance ? curItem.nuance + '\n' + t : t
      }
    } else if ((m = line.match(/<L\s+level=\{?4\}?>([\s\S]*?)<\/L>/))) {
      if (curItem) curItem.examples.push(m[1].trim())
    }
  }

  return rows
}

// 义项标记锚点：标题 + 接续 + 意思（同一义项的稳定标识）
export function itemKey(title, setsuzoku, meaning) {
  return [title || '', setsuzoku || '', meaning || ''].join('')
}
