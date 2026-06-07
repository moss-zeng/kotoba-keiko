// 释义解析：兼容旧的纯文本与新的「多条 JSON」结构
// 返回数组：[{ t: 释义文本, b: 是否加粗 }]
export function parseMeaning(raw) {
  if (Array.isArray(raw)) return raw.filter((x) => x && x.t)
  if (typeof raw !== 'string') return []
  const s = raw.trim()
  if (!s) return []
  try {
    const arr = JSON.parse(s)
    if (Array.isArray(arr)) return arr.filter((x) => x && x.t)
  } catch (e) {
    // 不是 JSON，按旧的纯文本单条处理
  }
  return [{ t: s, b: false }]
}
