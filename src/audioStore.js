// 整集音频离线缓存：整文件存 IndexedDB（Blob），播放时取出生成 objectURL 喂给 <audio>
// 切小节只改 currentTime，区间/拖动由浏览器在本地 Blob 处理，零网络请求
// 缓存标识 = audio_key + 时长（重新上传导致时长变化即视为不同缓存，避免播放陈旧音频）

const DB_NAME = 'kotoba-audio'
const STORE = 'audio'
const VERSION = 1

let dbPromise = null
function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function store(mode) {
  const db = await openDb()
  return db.transaction(STORE, mode).objectStore(STORE)
}

function cacheKey(audioKey, duration) {
  return `${audioKey}|${Math.round(duration || 0)}`
}

// 已缓存的 objectURL（会话内复用，避免重复创建/泄漏）
const urlCache = new Map()

export async function has(audioKey, duration) {
  if (!audioKey) return false
  const s = await store('readonly')
  return new Promise((resolve) => {
    const req = s.count(cacheKey(audioKey, duration))
    req.onsuccess = () => resolve(req.result > 0)
    req.onerror = () => resolve(false)
  })
}

// 下载整文件并存入 IndexedDB；onProgress(frac, loaded, total)
export async function download(audioKey, duration, url, onProgress) {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error('下载失败：' + res.status)
  const total = Number(res.headers.get('Content-Length')) || 0
  const type = res.headers.get('Content-Type') || 'audio/mpeg'
  const reader = res.body.getReader()
  const chunks = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    if (onProgress) onProgress(total ? loaded / total : 0, loaded, total)
  }
  const blob = new Blob(chunks, { type })
  const s = await store('readwrite')
  await new Promise((resolve, reject) => {
    const req = s.put(blob, cacheKey(audioKey, duration))
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// 有缓存返回 objectURL，否则返回 null（调用方回退网络 URL）
export async function getObjectUrl(audioKey, duration) {
  if (!audioKey) return null
  const ck = cacheKey(audioKey, duration)
  if (urlCache.has(ck)) return urlCache.get(ck)
  const s = await store('readonly')
  const blob = await new Promise((resolve) => {
    const req = s.get(ck)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => resolve(null)
  })
  if (!blob) return null
  const objUrl = URL.createObjectURL(blob)
  urlCache.set(ck, objUrl)
  return objUrl
}

export async function remove(audioKey, duration) {
  const ck = cacheKey(audioKey, duration)
  if (urlCache.has(ck)) {
    URL.revokeObjectURL(urlCache.get(ck))
    urlCache.delete(ck)
  }
  const s = await store('readwrite')
  await new Promise((resolve, reject) => {
    const req = s.delete(ck)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
