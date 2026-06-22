// 日语分词封装（kuromoji）
// 词典约 18MB，只在「录入听力」时加载一次；分词结果存进 D1，消费端不依赖本模块。
//
// 不走 kuromoji.builder：它的 BrowserDictionaryLoader 在 gunzip 抛错时落在未捕获的
// 内层 promise 里，回调永不触发 → 卡死在「加载中」；且 Vite 预打包下补丁可能打不到
// builder 实际用的实例。这里直接用内部类自行组装：fetch 后按 gzip 魔数判断是否解压
// （兼容某些服务器给 .gz 自动加 Content-Encoding 的情况），健壮且与服务器行为无关。

import DynamicDictionaries from '@sglkc/kuromoji/src/dict/DynamicDictionaries'
import Tokenizer from '@sglkc/kuromoji/src/Tokenizer'
import { gunzipSync } from 'fflate'

const DIC_PATH = '/dict'

async function fetchDict(name) {
  const res = await fetch(`${DIC_PATH}/${name}`)
  if (!res.ok) throw new Error(`加载词典失败 ${res.status}：${name}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  const out = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes
  // 归一化成独立 ArrayBuffer，避免 fflate 返回带 byteOffset 的视图导致类型化数组越界
  return out.byteOffset === 0 && out.byteLength === out.buffer.byteLength
    ? out.buffer
    : out.slice().buffer
}

async function buildTokenizer() {
  const [base, check, tid, tidPos, tidMap, cc, unk, unkPos, unkMap, unkChar, unkCompat, unkInvoke] =
    await Promise.all(
      [
        'base.dat.gz',
        'check.dat.gz',
        'tid.dat.gz',
        'tid_pos.dat.gz',
        'tid_map.dat.gz',
        'cc.dat.gz',
        'unk.dat.gz',
        'unk_pos.dat.gz',
        'unk_map.dat.gz',
        'unk_char.dat.gz',
        'unk_compat.dat.gz',
        'unk_invoke.dat.gz',
      ].map(fetchDict)
    )

  const dic = new DynamicDictionaries()
  dic.loadTrie(new Int32Array(base), new Int32Array(check))
  dic.loadTokenInfoDictionaries(new Uint8Array(tid), new Uint8Array(tidPos), new Uint8Array(tidMap))
  dic.loadConnectionCosts(new Int16Array(cc))
  dic.loadUnknownDictionaries(
    new Uint8Array(unk),
    new Uint8Array(unkPos),
    new Uint8Array(unkMap),
    new Uint8Array(unkChar),
    new Uint32Array(unkCompat),
    new Uint8Array(unkInvoke)
  )
  return new Tokenizer(dic)
}

let tokenizerPromise = null

// 懒加载：首次调用时构建分词器（词典放在 public/dict/）
export function loadTokenizer() {
  if (!tokenizerPromise) {
    tokenizerPromise = buildTokenizer().catch((err) => {
      tokenizerPromise = null // 失败可重试
      throw err
    })
  }
  return tokenizerPromise
}

// 片假名 → 平假名
const KATAKANA = /[ァ-ヶ]/g
function kataToHira(str) {
  return str.replace(KATAKANA, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

const HAS_KANJI = /[一-鿿㐀-䶿]/

// 取辞书形的读音：把辞书形再丢给分词器跑一遍拿读音（来る→くる、する→する 都准），按辞书形缓存
const baseReadingCache = new Map()
function baseReading(tk, basicForm) {
  if (baseReadingCache.has(basicForm)) return baseReadingCache.get(basicForm)
  let r = ''
  try {
    r = tk
      .tokenize(basicForm)
      .map((x) => (x.reading && x.reading !== '*' ? kataToHira(x.reading) : x.surface_form))
      .join('')
  } catch (e) {
    r = ''
  }
  baseReadingCache.set(basicForm, r)
  return r
}

// 把文本切成 token：{ w 表层, r 振假名(平假名), base 辞书形 }
// 活用词的 r = 辞书形读音(飼い→かう，便于认词)；非活用词 r = 表层读音。
// r 存完整读音，振假名「只盖汉字、裁掉首尾重合假名」的活由渲染端做。
// 保留换行：行与行之间插入 {w:'\n'} 标记，供阅读/编辑端分段
export async function tokenize(text) {
  const tk = await loadTokenizer()
  const lines = (text || '').split('\n')
  const out = []
  lines.forEach((line, li) => {
    if (li > 0) out.push({ w: '\n', r: '', base: '\n' })
    for (const t of tk.tokenize(line)) {
      const w = t.surface_form
      const base = t.basic_form && t.basic_form !== '*' ? t.basic_form : w
      const surfaceHira = t.reading && t.reading !== '*' ? kataToHira(t.reading) : ''
      let r = ''
      if (HAS_KANJI.test(w)) {
        // 活用词(辞书形≠表层)显示辞书形读音；否则用表层读音
        r = base !== w ? baseReading(tk, base) || surfaceHira : surfaceHira
        if (r === w) r = '' // 读音与表层完全相同则不必标
      }
      out.push({ w, r, base })
    }
  })
  return out
}
