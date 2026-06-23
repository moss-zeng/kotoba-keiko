// 会话内缓存听力集详情（含全部小节+文章+翻译），切小节/进出页面不重复请求
// 录入侧改动后调用 invalidate(id)，让消费侧下次重新拉取

const cache = new Map() // id -> set 详情

export async function getSet(id, { force = false } = {}) {
  if (!force && cache.has(id)) return cache.get(id)
  const data = await fetch(`/api/listen/sets/${id}`).then((x) => x.json())
  cache.set(id, data)
  return data
}

export function invalidate(id) {
  cache.delete(id)
}
