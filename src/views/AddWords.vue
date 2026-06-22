<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { parseMeaning } from '../meaning.js'

const router = useRouter()
const tab = ref('kanji') // 'kanji' | 'reading' | 'ono'

// 表记表单
const hyoki = ref('')
const kana = ref('')
const meanings = ref([{ t: '', b: false }])
const editingKanjiId = ref(null)

// 认读表单
const rkana = ref('')
const rkanji = ref('')
const rmeanings = ref([{ cn: '', sentence: '', note: '' }])
const editingReadingId = ref(null)

// 拟态表单
const body = ref('')
const editingOnoId = ref(null)

// 提示
const msg = ref('')
const msgType = ref('')

const kanjiList = ref([])
const readingList = ref([])
const onoList = ref([])

// 提交锁：防止慢网下连点造成重复录入
const savingKanji = ref(false)
const savingReading = ref(false)
const savingOno = ref(false)

// 检索（按当前 tab 各自过滤）
const kanjiQuery = ref('')
const readingQuery = ref('')
const onoQuery = ref('')
const filteredKanji = computed(() => {
  const q = kanjiQuery.value.trim().toLowerCase()
  if (!q) return kanjiList.value
  return kanjiList.value.filter(
    (w) =>
      (w.hyoki || '').toLowerCase().includes(q) ||
      (w.kana || '').toLowerCase().includes(q) ||
      (w.meaning || '').toLowerCase().includes(q)
  )
})
const filteredReading = computed(() => {
  const q = readingQuery.value.trim().toLowerCase()
  if (!q) return readingList.value
  return readingList.value.filter(
    (w) =>
      (w.kana || '').toLowerCase().includes(q) ||
      (w.kanji || '').toLowerCase().includes(q) ||
      (w.meanings || '').toLowerCase().includes(q)
  )
})
const filteredOno = computed(() => {
  const q = onoQuery.value.trim().toLowerCase()
  if (!q) return onoList.value
  // 只在挖空的答案词（**…**）里匹配，不搜正文其余文字
  return onoList.value.filter((o) =>
    [...(o.body || '').matchAll(/\*\*(.+?)\*\*/g)].some((m) => m[1].toLowerCase().includes(q))
  )
})

// 复习(3≤score<4) / 毕业(≥4)
function statOf(list) {
  let review = 0
  let done = 0
  for (const w of list) {
    if (w.score >= 4) done++
    else if (w.score >= 3) review++
  }
  return { review, done }
}
const kanjiStat = computed(() => statOf(kanjiList.value))
const readingStat = computed(() => statOf(readingList.value))
const onoStat = computed(() => statOf(onoList.value))

function scoreStyle(score) {
  return {
    color: score >= 4 ? 'var(--ok)' : score < 0 ? 'var(--danger)' : 'var(--muted)',
    fontSize: '14px',
  }
}

function readingMeaningSummary(raw) {
  try {
    return JSON.parse(raw || '[]')
      .map((m) => m.cn)
      .filter(Boolean)
      .join(' / ')
  } catch (e) {
    return ''
  }
}

async function loadLists() {
  try {
    const [k, r, o] = await Promise.all([
      fetch('/api/kanji').then((x) => x.json()),
      fetch('/api/reading').then((x) => x.json()),
      fetch('/api/onomatopoeia').then((x) => x.json()),
    ])
    kanjiList.value = Array.isArray(k) ? k : []
    readingList.value = Array.isArray(r) ? r : []
    onoList.value = Array.isArray(o) ? o : []
  } catch (e) {
    flash('读取词库失败，检查本地服务是否在跑', 'err')
  }
}
onMounted(loadLists)

function flash(text, type) {
  msg.value = text
  msgType.value = type
  setTimeout(() => {
    if (msg.value === text) msg.value = ''
  }, 3000)
}

// ---------- 表记 ----------
function addMeaning() {
  meanings.value.push({ t: '', b: false })
}
function removeMeaning(i) {
  meanings.value.splice(i, 1)
  if (meanings.value.length === 0) meanings.value.push({ t: '', b: false })
}
function resetKanjiForm() {
  hyoki.value = ''
  kana.value = ''
  meanings.value = [{ t: '', b: false }]
  editingKanjiId.value = null
}
async function saveKanji() {
  if (savingKanji.value) return
  const ms = meanings.value.map((m) => ({ t: m.t.trim(), b: !!m.b })).filter((m) => m.t)
  if (!hyoki.value.trim() || !kana.value.trim() || ms.length === 0) {
    flash('表记、假名、至少一条释义都不能为空', 'err')
    return
  }
  savingKanji.value = true
  try {
    const payload = { hyoki: hyoki.value, kana: kana.value, meaning: JSON.stringify(ms) }
    const editing = editingKanjiId.value
    const res = editing
      ? await fetch(`/api/kanji/${editing}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/kanji', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (!res.ok) {
      flash(data.error || '操作失败', 'err')
      return
    }
    flash(editing ? '已保存修改' : '已添加：' + hyoki.value, 'ok')
    resetKanjiForm()
    loadLists()
  } catch (e) {
    flash('网络错误，请重试', 'err')
  } finally {
    savingKanji.value = false
  }
}
function editKanji(w) {
  hyoki.value = w.hyoki
  kana.value = w.kana
  const ms = parseMeaning(w.meaning)
  meanings.value = ms.length ? ms.map((m) => ({ t: m.t, b: !!m.b })) : [{ t: '', b: false }]
  editingKanjiId.value = w.id
  window.scrollTo(0, 0)
}
async function delKanji(w) {
  if (!confirm(`删除「${w.hyoki}」？`)) return
  const res = await fetch(`/api/kanji/${w.id}`, { method: 'DELETE' })
  if (res.ok) {
    flash('已删除', 'ok')
    if (editingKanjiId.value === w.id) resetKanjiForm()
    loadLists()
  }
}

// ---------- 认读 ----------
function addRMeaning() {
  rmeanings.value.push({ cn: '', sentence: '', note: '' })
}
function removeRMeaning(i) {
  rmeanings.value.splice(i, 1)
  if (rmeanings.value.length === 0) rmeanings.value.push({ cn: '', sentence: '', note: '' })
}
function resetReadingForm() {
  rkana.value = ''
  rkanji.value = ''
  rmeanings.value = [{ cn: '', sentence: '', note: '' }]
  editingReadingId.value = null
}
async function saveReading() {
  if (savingReading.value) return
  const ms = rmeanings.value
    .map((m) => ({ cn: m.cn.trim(), sentence: m.sentence.trim(), note: m.note.trim() }))
    .filter((m) => m.cn)
  if (!rkana.value.trim() || ms.length === 0) {
    flash('假名、至少一条中文意思不能为空', 'err')
    return
  }
  savingReading.value = true
  try {
    const payload = { kana: rkana.value, kanji: rkanji.value, meanings: ms }
    const editing = editingReadingId.value
    const res = editing
      ? await fetch(`/api/reading/${editing}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/reading', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (!res.ok) {
      flash(data.error || '操作失败', 'err')
      return
    }
    flash(editing ? '已保存修改' : '已添加：' + rkana.value, 'ok')
    resetReadingForm()
    loadLists()
  } catch (e) {
    flash('网络错误，请重试', 'err')
  } finally {
    savingReading.value = false
  }
}
function editReading(w) {
  rkana.value = w.kana
  rkanji.value = w.kanji || ''
  let ms = []
  try {
    ms = JSON.parse(w.meanings || '[]')
  } catch (e) {
    ms = []
  }
  rmeanings.value = ms.length
    ? ms.map((m) => ({ cn: m.cn || '', sentence: m.sentence || '', note: m.note || '' }))
    : [{ cn: '', sentence: '', note: '' }]
  editingReadingId.value = w.id
  window.scrollTo(0, 0)
}
async function delReading(w) {
  if (!confirm(`删除「${w.kana}」？`)) return
  const res = await fetch(`/api/reading/${w.id}`, { method: 'DELETE' })
  if (res.ok) {
    flash('已删除', 'ok')
    if (editingReadingId.value === w.id) resetReadingForm()
    loadLists()
  }
}

// ---------- 拟态 ----------
function resetOnoForm() {
  body.value = ''
  editingOnoId.value = null
}
async function saveOno() {
  if (savingOno.value) return
  savingOno.value = true
  try {
    const payload = { body: body.value }
    const editing = editingOnoId.value
    const res = editing
      ? await fetch(`/api/onomatopoeia/${editing}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/onomatopoeia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (!res.ok) {
      flash(data.error || '操作失败', 'err')
      return
    }
    flash(editing ? '已保存修改' : '已添加段落' + (data.blanks ? `（${data.blanks} 个空）` : ''), 'ok')
    resetOnoForm()
    loadLists()
  } catch (e) {
    flash('网络错误，请重试', 'err')
  } finally {
    savingOno.value = false
  }
}
function editOno(o) {
  body.value = o.body
  editingOnoId.value = o.id
  window.scrollTo(0, 0)
}
async function delOno(o) {
  if (!confirm('删除这一段？')) return
  const res = await fetch(`/api/onomatopoeia/${o.id}`, { method: 'DELETE' })
  if (res.ok) {
    flash('已删除', 'ok')
    if (editingOnoId.value === o.id) resetOnoForm()
    loadLists()
  }
}
</script>

<template>
  <div>
    <button class="ghost" style="padding-left: 0" @click="router.push('/')">← 返回</button>
    <h1 class="title">录入单词</h1>

    <div class="row" style="margin-bottom: 20px">
      <button :class="tab === 'kanji' ? '' : 'secondary'" style="flex: 1" @click="tab = 'kanji'">表记词</button>
      <button :class="tab === 'reading' ? '' : 'secondary'" style="flex: 1" @click="tab = 'reading'">认读词</button>
      <button :class="tab === 'ono' ? '' : 'secondary'" style="flex: 1" @click="tab = 'ono'">拟态词</button>
    </div>

    <p v-if="msg" :class="msgType === 'ok' ? 'msg-ok' : 'msg-err'" style="margin-bottom: 12px">{{ msg }}</p>

    <!-- 表记 -->
    <div v-if="tab === 'kanji'">
      <div class="card">
        <p v-if="editingKanjiId" class="subtitle" style="margin-bottom: 12px">正在编辑（分数保留）</p>
        <div class="field">
          <label>表记（汉字写法）</label>
          <input v-model="hyoki" placeholder="勉強" />
        </div>
        <div class="field">
          <label>假名读音（答案）</label>
          <input v-model="kana" placeholder="べんきょう" />
        </div>
        <div class="field">
          <label>日文释义（可多条，「粗」标加粗主要释义）</label>
          <div v-for="(m, mi) in meanings" :key="mi" class="row" style="margin-bottom: 8px; align-items: center">
            <input v-model="m.t" placeholder="勉学にはげむこと" style="flex: 1" />
            <button class="ghost" :style="m.b ? 'color:var(--accent);font-weight:700' : ''" style="padding: 8px 12px" @click="m.b = !m.b">粗</button>
            <button v-if="meanings.length > 1" class="ghost" style="padding: 8px 10px" @click="removeMeaning(mi)">×</button>
          </div>
          <button class="secondary" style="width: 100%; padding: 8px" @click="addMeaning">+ 添加释义</button>
        </div>
        <div class="row">
          <button style="flex: 1" :disabled="savingKanji" @click="saveKanji">
            {{ savingKanji ? '提交中…' : editingKanjiId ? '保存修改' : '添加' }}
          </button>
          <button v-if="editingKanjiId" class="ghost" @click="resetKanjiForm">取消</button>
        </div>
      </div>
      <input v-model="kanjiQuery" placeholder="检索：表记 / 假名 / 释义" style="margin-bottom: 12px" />
      <p class="subtitle">
        已录入 {{ kanjiList.length }} 个表记词（复习 {{ kanjiStat.review }} · 毕业 {{ kanjiStat.done }}）<span
          v-if="kanjiQuery.trim()"
          > · 检索到 {{ filteredKanji.length }}</span
        >
      </p>
      <div v-for="w in filteredKanji" :key="w.id" class="card">
        <div>
          <strong>{{ w.hyoki }}</strong> — {{ w.kana }} —
          <template v-for="(m, mi) in parseMeaning(w.meaning)" :key="mi"
            ><span :style="m.b ? 'font-weight:700' : ''">{{ m.t }}</span
            ><span v-if="mi < parseMeaning(w.meaning).length - 1" style="color: var(--muted)"> / </span></template
          >
          <span :style="scoreStyle(w.score)"> · {{ w.score }} 分</span>
        </div>
        <div class="row" style="margin-top: 10px">
          <button class="secondary" style="flex: 1; padding: 8px" @click="editKanji(w)">编辑</button>
          <button class="ghost" style="padding: 8px 16px" @click="delKanji(w)">删除</button>
        </div>
      </div>
    </div>

    <!-- 认读 -->
    <div v-else-if="tab === 'reading'">
      <div class="card">
        <p v-if="editingReadingId" class="subtitle" style="margin-bottom: 12px">正在编辑（分数保留）</p>
        <div class="field">
          <label>假名（必填，题面）</label>
          <input v-model="rkana" placeholder="あなどる" />
        </div>
        <div class="field">
          <label>汉字形式（可选）</label>
          <input v-model="rkanji" placeholder="侮る" />
        </div>
        <div class="field">
          <label>意思（每条 = 中文意思 + 日语造句 + 中文解释）</label>
          <div v-for="(m, mi) in rmeanings" :key="mi" class="card" style="padding: 12px; margin-bottom: 8px">
            <input v-model="m.cn" placeholder="中文意思：轻视、小看" style="margin-bottom: 6px" />
            <input v-model="m.sentence" placeholder="日语造句（可选）" style="margin-bottom: 6px" />
            <input v-model="m.note" placeholder="中文解释（可选）" />
            <button v-if="rmeanings.length > 1" class="ghost" style="padding: 6px 10px; margin-top: 6px" @click="removeRMeaning(mi)">删除这条意思</button>
          </div>
          <button class="secondary" style="width: 100%; padding: 8px" @click="addRMeaning">+ 添加意思</button>
        </div>
        <div class="row">
          <button style="flex: 1" :disabled="savingReading" @click="saveReading">
            {{ savingReading ? '提交中…' : editingReadingId ? '保存修改' : '添加' }}
          </button>
          <button v-if="editingReadingId" class="ghost" @click="resetReadingForm">取消</button>
        </div>
      </div>
      <input v-model="readingQuery" placeholder="检索：假名 / 汉字 / 意思" style="margin-bottom: 12px" />
      <p class="subtitle">
        已录入 {{ readingList.length }} 个认读词（复习 {{ readingStat.review }} · 毕业 {{ readingStat.done }}）<span
          v-if="readingQuery.trim()"
          > · 检索到 {{ filteredReading.length }}</span
        >
      </p>
      <div v-for="w in filteredReading" :key="w.id" class="card">
        <div>
          <strong>{{ w.kana }}</strong>
          <span v-if="w.kanji" style="margin-left: 8px">{{ w.kanji }}</span>
          <span :style="scoreStyle(w.score)"> · {{ w.score }} 分</span>
        </div>
        <div style="font-size: 14px; color: var(--muted); margin-top: 4px">{{ readingMeaningSummary(w.meanings) }}</div>
        <div class="row" style="margin-top: 10px">
          <button class="secondary" style="flex: 1; padding: 8px" @click="editReading(w)">编辑</button>
          <button class="ghost" style="padding: 8px 16px" @click="delReading(w)">删除</button>
        </div>
      </div>
    </div>

    <!-- 拟态 -->
    <div v-else>
      <div class="card">
        <p v-if="editingOnoId" class="subtitle" style="margin-bottom: 12px">正在编辑（分数保留）</p>
        <div class="field">
          <label>段落（用 **词** 标出要挖的空，至少 2 个）</label>
          <textarea v-model="body" rows="6" placeholder="窓の外では風が吹いて、古い雨戸が**がたがた**と鳴っている。「もっと**ゆっくり**休みたい」。"></textarea>
        </div>
        <div class="row">
          <button style="flex: 1" :disabled="savingOno" @click="saveOno">
            {{ savingOno ? '提交中…' : editingOnoId ? '保存修改' : '添加' }}
          </button>
          <button v-if="editingOnoId" class="ghost" @click="resetOnoForm">取消</button>
        </div>
      </div>
      <input v-model="onoQuery" placeholder="检索挖空的词（**…**）" style="margin-bottom: 12px" />
      <p class="subtitle">
        已录入 {{ onoList.length }} 段（复习 {{ onoStat.review }} · 毕业 {{ onoStat.done }}）<span
          v-if="onoQuery.trim()"
          > · 检索到 {{ filteredOno.length }}</span
        >
      </p>
      <div v-for="o in filteredOno" :key="o.id" class="card">
        <div style="font-size: 15px; line-height: 1.7; white-space: pre-wrap">{{ o.body }}</div>
        <div :style="{ ...scoreStyle(o.score), marginTop: '4px' }">{{ o.score }} 分</div>
        <div class="row" style="margin-top: 10px">
          <button class="secondary" style="flex: 1; padding: 8px" @click="editOno(o)">编辑</button>
          <button class="ghost" style="padding: 8px 16px" @click="delOno(o)">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>
