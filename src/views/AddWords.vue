<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const tab = ref('kanji') // 'kanji' | 'ono'

// 表记表单
const hyoki = ref('')
const kana = ref('')
const meaning = ref('')
const editingKanjiId = ref(null)

// 拟态表单
const body = ref('')
const editingOnoId = ref(null)

// 提示
const msg = ref('')
const msgType = ref('')

const kanjiList = ref([])
const onoList = ref([])

async function loadLists() {
  try {
    const [k, o] = await Promise.all([
      fetch('/api/kanji').then((r) => r.json()),
      fetch('/api/onomatopoeia').then((r) => r.json()),
    ])
    kanjiList.value = Array.isArray(k) ? k : []
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
function resetKanjiForm() {
  hyoki.value = ''
  kana.value = ''
  meaning.value = ''
  editingKanjiId.value = null
}
async function saveKanji() {
  const payload = { hyoki: hyoki.value, kana: kana.value, meaning: meaning.value }
  const editing = editingKanjiId.value
  const res = editing
    ? await fetch(`/api/kanji/${editing}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    : await fetch('/api/kanji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
  const data = await res.json()
  if (!res.ok) {
    flash(data.error || '操作失败', 'err')
    return
  }
  flash(editing ? '已保存修改' : '已添加：' + (data.hyoki || hyoki.value), 'ok')
  resetKanjiForm()
  loadLists()
}
function editKanji(w) {
  hyoki.value = w.hyoki
  kana.value = w.kana
  meaning.value = w.meaning
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

// ---------- 拟态 ----------
function resetOnoForm() {
  body.value = ''
  editingOnoId.value = null
}
async function saveOno() {
  const payload = { body: body.value }
  const editing = editingOnoId.value
  const res = editing
    ? await fetch(`/api/onomatopoeia/${editing}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    : await fetch('/api/onomatopoeia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
  const data = await res.json()
  if (!res.ok) {
    flash(data.error || '操作失败', 'err')
    return
  }
  flash(
    editing ? '已保存修改' : '已添加段落' + (data.blanks ? `（${data.blanks} 个空）` : ''),
    'ok'
  )
  resetOnoForm()
  loadLists()
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
    <button class="ghost" style="padding-left: 0" @click="router.push('/')">
      ← 返回
    </button>
    <h1 class="title">录入单词</h1>

    <div class="row" style="margin-bottom: 20px">
      <button :class="tab === 'kanji' ? '' : 'secondary'" style="flex: 1" @click="tab = 'kanji'">
        表记词
      </button>
      <button :class="tab === 'ono' ? '' : 'secondary'" style="flex: 1" @click="tab = 'ono'">
        拟态词
      </button>
    </div>

    <p v-if="msg" :class="msgType === 'ok' ? 'msg-ok' : 'msg-err'" style="margin-bottom: 12px">
      {{ msg }}
    </p>

    <!-- 表记 -->
    <div v-if="tab === 'kanji'">
      <div class="card">
        <p v-if="editingKanjiId" class="subtitle" style="margin-bottom: 12px">
          正在编辑（分数保留）
        </p>
        <div class="field">
          <label>表记（汉字写法）</label>
          <input v-model="hyoki" placeholder="勉強" />
        </div>
        <div class="field">
          <label>假名读音（答案）</label>
          <input v-model="kana" placeholder="べんきょう" />
        </div>
        <div class="field">
          <label>日文释义（别写进该词读音，避免泄露答案）</label>
          <input v-model="meaning" placeholder="勉学にはげむこと" />
        </div>
        <div class="row">
          <button style="flex: 1" @click="saveKanji">
            {{ editingKanjiId ? '保存修改' : '添加' }}
          </button>
          <button v-if="editingKanjiId" class="ghost" @click="resetKanjiForm">取消</button>
        </div>
      </div>
      <p class="subtitle">已录入 {{ kanjiList.length }} 个表记词</p>
      <div v-for="w in kanjiList" :key="w.id" class="card">
        <div>
          <strong>{{ w.hyoki }}</strong> — {{ w.kana }} — {{ w.meaning }}
          <span style="color: var(--muted); font-size: 14px"> · {{ w.score }} 分</span>
        </div>
        <div class="row" style="margin-top: 10px">
          <button class="secondary" style="flex: 1; padding: 8px" @click="editKanji(w)">
            编辑
          </button>
          <button class="ghost" style="padding: 8px 16px" @click="delKanji(w)">删除</button>
        </div>
      </div>
    </div>

    <!-- 拟态 -->
    <div v-else>
      <div class="card">
        <p v-if="editingOnoId" class="subtitle" style="margin-bottom: 12px">
          正在编辑（分数保留）
        </p>
        <div class="field">
          <label>段落（用 **词** 标出要挖的空，至少 2 个）</label>
          <textarea
            v-model="body"
            rows="6"
            placeholder="窓の外では風が吹いて、古い雨戸が**がたがた**と鳴っている。「もっと**ゆっくり**休みたい」。"
          ></textarea>
        </div>
        <div class="row">
          <button style="flex: 1" @click="saveOno">
            {{ editingOnoId ? '保存修改' : '添加' }}
          </button>
          <button v-if="editingOnoId" class="ghost" @click="resetOnoForm">取消</button>
        </div>
      </div>
      <p class="subtitle">已录入 {{ onoList.length }} 段</p>
      <div v-for="o in onoList" :key="o.id" class="card">
        <div style="font-size: 15px; line-height: 1.7">{{ o.body }}</div>
        <div style="color: var(--muted); font-size: 14px; margin-top: 4px">
          {{ o.score }} 分
        </div>
        <div class="row" style="margin-top: 10px">
          <button class="secondary" style="flex: 1; padding: 8px" @click="editOno(o)">
            编辑
          </button>
          <button class="ghost" style="padding: 8px 16px" @click="delOno(o)">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>
