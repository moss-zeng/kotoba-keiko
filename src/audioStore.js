// 整集音频离线缓存：整文件分块（HTTP Range）逐块下载并存入 IndexedDB
// 断点续传：每下完一块立刻落库，网络中断/失败时已下的块不丢，重试从断点继续
// 播放时把完整 Blob 取出生成 objectURL 喂 <audio>，切小节零网络
// 缓存标识 ck = audio_key + 时长（重新上传时长变 → 视为不同缓存，避免播放陈旧音频）
import { reactive } from 'vue'

const DB_NAME = 'kotoba-audio'
const VERSION = 2
const FULL = 'audio' // ck -> 完整 Blob
const CHUNKS = 'chunks' // `${ck}|${6位序号}` -> 块 ArrayBuffer
const META = 'meta' // ck -> { total, chunkSize, count, type }

const CHUNK_SIZE = 512 * 1024 // 单块 512KB，越小越抗断（弱网下整块更易下完）
const RETRY = 4 // 单块失败重试次数

let dbPromise = null
function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(FULL)) db.createObjectStore(FULL)
      if (!db.objectStoreNames.contains(CHUNKS)) db.createObjectStore(CHUNKS)
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function idb(storeName, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const store = tx.objectStore(storeName)
        const req = fn(store)
        tx.oncomplete = () => resolve(req?.result)
        tx.onerror = () => reject(tx.error)
      })
  )
}

function cacheKey(audioKey, duration) {
  return `${audioKey}|${Math.round(duration || 0)}`
}
function chunkKey(ck, i) {
  return `${ck}|${String(i).padStart(6, '0')}`
}
// 覆盖某 ck 全部分块的 key 区间（上界用 ￿ 兜住所有序号）
function ckRange(ck) {
  return IDBKeyRange.bound(`${ck}|`, `${ck}|￿`)
}

// 已生成的 objectURL（会话内复用，避免重复创建/泄漏）
const urlCache = new Map()

// 进行中的下载（模块级，跨页面存活）：ck -> { downloading, progress }
export const downloads = reactive({})
const tasks = new Map() // ck -> Promise，去重并发下载

export function downloadState(audioKey, duration) {
  return downloads[cacheKey(audioKey, duration)] || null
}

// 已完整缓存？
export async function has(audioKey, duration) {
  if (!audioKey) return false
  const n = await idb(FULL, 'readonly', (s) => s.count(cacheKey(audioKey, duration)))
  return n > 0
}

// 断点续传进度（无 / 未开始返回 null），给「继续下载（已X%）」用
export async function partialProgress(audioKey, duration) {
  if (!audioKey) return null
  const meta = await idb(META, 'readonly', (s) => s.get(cacheKey(audioKey, duration)))
  if (!meta || !meta.total) return null
  const nChunks = Math.ceil(meta.total / meta.chunkSize)
  return Math.min(1, (meta.count || 0) / nChunks)
}

async function requestPersist() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch {
    /* 不支持就算了 */
  }
}

async function fetchChunkWithRetry(url, start, end) {
  let lastErr
  for (let attempt = 0; attempt < RETRY; attempt++) {
    try {
      const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return res
    } catch (e) {
      lastErr = e
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1))) // 退避后再试
    }
  }
  throw lastErr
}

// 下载整文件（分块断点续传）。后台任务：进度写入 downloads[ck]，离开页面不打断
export function download(audioKey, duration, url) {
  const ck = cacheKey(audioKey, duration)
  if (tasks.has(ck)) return tasks.get(ck) // 已在下载，复用

  const task = (async () => {
    downloads[ck] = { downloading: true, progress: (await partialProgress(audioKey, duration)) || 0 }
    try {
      await requestPersist()

      // 取/建续传元数据：首块请求拿总大小与类型
      let meta = await idb(META, 'readonly', (s) => s.get(ck))
      if (!meta) {
        const probe = await fetchChunkWithRetry(url, 0, CHUNK_SIZE - 1)
        const cr = probe.headers.get('Content-Range') // bytes 0-x/total
        const total = cr ? Number(cr.split('/')[1]) : Number(probe.headers.get('Content-Length')) || 0
        if (!total) throw new Error('无法获取音频大小')
        const buf = await probe.arrayBuffer()
        meta = { total, chunkSize: CHUNK_SIZE, count: 1, type: probe.headers.get('Content-Type') || 'audio/mpeg' }
        await idb(CHUNKS, 'readwrite', (s) => s.put(buf, chunkKey(ck, 0)))
        await idb(META, 'readwrite', (s) => s.put(meta, ck))
      }

      const nChunks = Math.ceil(meta.total / meta.chunkSize)
      downloads[ck].progress = meta.count / nChunks

      for (let i = meta.count; i < nChunks; i++) {
        const start = i * meta.chunkSize
        const end = Math.min(meta.total - 1, start + meta.chunkSize - 1)
        const res = await fetchChunkWithRetry(url, start, end)
        const buf = await res.arrayBuffer()
        await idb(CHUNKS, 'readwrite', (s) => s.put(buf, chunkKey(ck, i)))
        meta.count = i + 1
        await idb(META, 'readwrite', (s) => s.put(meta, ck))
        downloads[ck].progress = meta.count / nChunks
      }

      // 全部块齐 → 组装成完整 Blob 落库，清理分块与元数据
      const parts = await idb(CHUNKS, 'readonly', (s) => s.getAll(ckRange(ck)))
      const blob = new Blob(parts, { type: meta.type })
      await idb(FULL, 'readwrite', (s) => s.put(blob, ck))
      await clearPartial(ck)
    } finally {
      delete downloads[ck]
      tasks.delete(ck)
    }
  })()

  tasks.set(ck, task)
  return task
}

async function clearPartial(ck) {
  await idb(CHUNKS, 'readwrite', (s) => s.delete(ckRange(ck)))
  await idb(META, 'readwrite', (s) => s.delete(ck))
}

// 有完整缓存返回 objectURL，否则 null（调用方回退网络 URL）
export async function getObjectUrl(audioKey, duration) {
  if (!audioKey) return null
  const ck = cacheKey(audioKey, duration)
  if (urlCache.has(ck)) return urlCache.get(ck)
  const blob = await idb(FULL, 'readonly', (s) => s.get(ck))
  if (!blob) return null
  const objUrl = URL.createObjectURL(blob)
  urlCache.set(ck, objUrl)
  return objUrl
}

// 删除该集的所有缓存（完整 + 未完成的分块）
export async function remove(audioKey, duration) {
  const ck = cacheKey(audioKey, duration)
  if (urlCache.has(ck)) {
    URL.revokeObjectURL(urlCache.get(ck))
    urlCache.delete(ck)
  }
  await idb(FULL, 'readwrite', (s) => s.delete(ck))
  await clearPartial(ck)
}
