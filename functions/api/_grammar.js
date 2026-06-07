// 解析整篇语法笔记（mdx）→ 结构化，并提供义项标记锚点
// 结构：[{ row, points: [{ title, groups: [{ pos, items: [{ meaning, examples:[] }] }] }] }]

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
  const ensureGroup = (pos) => {
    if (!curPoint) ensurePoint('')
    curGroup = { pos: pos ?? null, items: [] }
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
      // 义项意思：取 Spoiler 内 level=2 的文本，取不到就去掉所有标签兜底
      const mm = line.match(/<L\s+level=\{?2\}?>([\s\S]*?)<\/L>/)
      const meaning = (mm ? mm[1] : line.replace(/<[^>]+>/g, '')).trim()
      if (!curGroup) ensureGroup(null)
      curItem = { meaning, examples: [] }
      curGroup.items.push(curItem)
    } else if ((m = line.match(/<L\s+level=\{?1\}?>([\s\S]*?)<\/L>/))) {
      ensureGroup(m[1].trim())
    } else if ((m = line.match(/<L\s+level=\{?[34]\}?>([\s\S]*?)<\/L>/))) {
      if (curItem) curItem.examples.push(m[1].trim())
    }
  }

  return rows
}

// 义项标记锚点：标题 + 词性 + 意思（同一义项的稳定标识）
export function itemKey(title, pos, meaning) {
  return [title || '', pos || '', meaning || ''].join('')
}
