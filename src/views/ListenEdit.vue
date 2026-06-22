<script setup>
// 录入听力编辑器：上传音频 → 切割(纯时间轴) → 逐段录文章并分词
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ArticleText from '../components/ArticleText.vue'
import AudioPlayer from '../components/AudioPlayer.vue'

const route = useRoute()
const router = useRouter()
const id = route.params.id

const set = ref(null)
const name = ref('')
const segments = ref([])
const articles = ref([])
const msg = ref('')
const msgType = ref('')

function flash(text, type) {
  msg.value = text
  msgType.value = type
  setTimeout(() => {
    if (msg.value === text) msg.value = ''
  }, 3000)
}
function fmt(s) {
  s = Math.max(0, s || 0)
  const m = Math.floor(s / 60)
  const ss = (s % 60).toFixed(1).padStart(4, '0')
  return `${m}:${ss}`
}

const audioUrl = computed(() =>
  set.value?.audio_key ? `/api/listen/audio/${set.value.audio_key}` : ''
)

async function load() {
  try {
    const data = await fetch(`/api/listen/sets/${id}`).then((x) => x.json())
    set.value = data
    name.value = data.name
    duration.value = data.duration || 0
    segments.value = data.segments || []
    articles.value = data.articles || []
    cutPoints.value = segments.value.slice(1).map((s) => s.start_sec)
    rebuildArts()
  } catch (e) {
    flash('读取失败', 'err')
  }
}
onMounted(load)

async function saveName() {
  const n = name.value.trim()
  if (!n) return flash('名字不能为空', 'err')
  const res = await fetch(`/api/listen/sets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: n }),
  })
  if (res.ok) flash('名字已保存', 'ok')
}

// ---------- 上传音频 ----------
const uploading = ref(false)
function readDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const a = new Audio()
    a.preload = 'metadata'
    a.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(a.duration || 0)
    }
    a.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0)
    }
    a.src = url
  })
}
async function onFile(e) {
  const file = e.target.files[0]
  if (!file) return
  uploading.value = true
  try {
    const dur = await readDuration(file)
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'mp3'
    const res = await fetch(`/api/listen/sets/${id}/audio?duration=${dur}&ext=${ext}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      flash(d.error || '上传失败', 'err')
    } else {
      flash('音频已上传', 'ok')
      await load()
    }
  } finally {
    uploading.value = false
    e.target.value = ''
  }
}

// ---------- 切割（纯时间轴）----------
const duration = ref(0)
const cutPoints = ref([])
const cur = ref(0) // 来自播放器回调的当前播放位置

function onDuration(d) {
  if (d) duration.value = d
}
function addCut() {
  const t = Math.round(cur.value * 10) / 10
  if (t <= 0 || t >= duration.value) return
  if (cutPoints.value.some((p) => Math.abs(p - t) < 0.2)) return
  cutPoints.value = [...cutPoints.value, t].sort((a, b) => a - b)
}
function nudge(i, delta) {
  const next = [...cutPoints.value]
  next[i] = Math.min(duration.value, Math.max(0, Math.round((next[i] + delta) * 10) / 10))
  cutPoints.value = next.sort((a, b) => a - b)
}
function removeCut(i) {
  cutPoints.value = cutPoints.value.filter((_, idx) => idx !== i)
}
const previewCount = computed(() => cutPoints.value.length + 1)

async function saveCut() {
  if (!duration.value) return flash('请先上传音频', 'err')
  const pts = [...cutPoints.value].sort((a, b) => a - b)
  const bounds = [0, ...pts, duration.value]
  const segs = []
  for (let i = 0; i < bounds.length - 1; i++) {
    const seq = i + 1
    const old = segments.value.find((s) => s.seq === seq)
    segs.push({ seq, name: old?.name || null, start_sec: bounds[i], end_sec: bounds[i + 1] })
  }
  const res = await fetch(`/api/listen/sets/${id}/segments`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segments: segs }),
  })
  if (res.ok) {
    flash(`已切成 ${segs.length} 段`, 'ok')
    await load()
  } else {
    flash('保存切点失败', 'err')
  }
}

// ---------- 文章 + 分词 ----------
const arts = ref([])
function rebuildArts() {
  arts.value = segments.value.map((seg) => {
    const ex = articles.value.find((a) => a.seq === seg.seq)
    return {
      seq: seg.seq,
      label: seg.name || `第${seg.seq}段`,
      text: ex ? ex.text : '',
      tokens: ex ? JSON.parse(ex.tokens || '[]') : [],
      editing: false,
      status: '',
    }
  })
}

async function doTokenize(art) {
  art.status = '加载词典 / 分词中…'
  try {
    const { tokenize } = await import('../tokenizer.js')
    art.tokens = await tokenize(art.text)
    art.editing = true
    art.status = ''
  } catch (e) {
    art.status = '分词失败：' + (e?.message || e)
  }
}
async function saveArt(art) {
  const text = art.tokens.length ? art.tokens.map((t) => t.w).join('') : art.text
  const res = await fetch(`/api/listen/sets/${id}/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seq: art.seq, text, tokens: art.tokens }),
  })
  if (res.ok) {
    art.status = '已保存'
    setTimeout(() => (art.status = ''), 2000)
  } else {
    art.status = '保存失败'
  }
}
</script>

<template>
  <div>
    <button class="ghost" style="padding-left: 0" @click="router.push('/listen/manage')">
      ← 返回
    </button>
    <h1 class="title">编辑听力集</h1>
    <p v-if="msg" :class="msgType === 'ok' ? 'msg-ok' : 'msg-err'" style="margin-bottom: 12px">
      {{ msg }}
    </p>

    <!-- 名字 -->
    <div class="card">
      <div class="field" style="margin-bottom: 10px">
        <label>听力集名字</label>
        <input v-model="name" />
      </div>
      <button class="secondary" style="width: 100%; padding: 8px" @click="saveName">保存名字</button>
    </div>

    <!-- 音频 -->
    <div class="card">
      <p class="subtitle" style="margin-bottom: 10px">
        音频：{{ set?.audio_key ? '已上传（重新选择可替换）' : '未上传' }}
      </p>
      <input type="file" accept="audio/*" :disabled="uploading" @change="onFile" />
      <p v-if="uploading" class="subtitle" style="margin-top: 8px">上传中…</p>
    </div>

    <!-- 切割 -->
    <div v-if="audioUrl" class="card">
      <p class="subtitle" style="margin-bottom: 10px">
        切割（在分界处加切点，切成 {{ previewCount }} 段）
      </p>
      <AudioPlayer :src="audioUrl" @timeupdate="cur = $event" @duration="onDuration" />
      <button style="width: 100%; padding: 10px; margin-top: 10px" @click="addCut">
        在此加切点（{{ fmt(cur) }}）
      </button>

      <div v-if="cutPoints.length" style="margin-top: 12px">
        <div
          v-for="(p, i) in cutPoints"
          :key="i"
          class="row"
          style="align-items: center; margin-bottom: 6px"
        >
          <span style="flex: 1">切点 {{ i + 1 }}：{{ fmt(p) }}</span>
          <button class="ghost" style="padding: 6px 10px" @click="nudge(i, -0.5)">−0.5</button>
          <button class="ghost" style="padding: 6px 10px" @click="nudge(i, 0.5)">+0.5</button>
          <button class="ghost" style="padding: 6px 10px" @click="removeCut(i)">×</button>
        </div>
      </div>
      <button class="secondary" style="width: 100%; padding: 10px; margin-top: 10px" @click="saveCut">
        保存切点（{{ previewCount }} 段）
      </button>
    </div>

    <!-- 文章 -->
    <div v-if="arts.length">
      <p class="subtitle">逐段录入文章（与小节按序号配对）</p>
      <div v-for="art in arts" :key="art.seq" class="card">
        <strong>{{ art.label }}</strong>
        <textarea
          v-model="art.text"
          rows="4"
          placeholder="粘贴这一段的听力原文"
          style="margin: 8px 0"
        />
        <div class="row">
          <button class="secondary" style="flex: 1; padding: 8px" @click="doTokenize(art)">分词</button>
          <button
            v-if="art.tokens.length"
            class="ghost"
            style="padding: 8px 12px"
            @click="art.editing = !art.editing"
          >
            {{ art.editing ? '预览' : '修正' }}
          </button>
          <button v-if="art.tokens.length" style="padding: 8px 14px" @click="saveArt(art)">保存</button>
        </div>
        <p v-if="art.status" class="subtitle" style="margin: 8px 0 0">{{ art.status }}</p>
        <div v-if="art.tokens.length" style="margin-top: 12px">
          <ArticleText v-model:tokens="art.tokens" :editing="art.editing" />
        </div>
      </div>
    </div>
    <p v-else-if="audioUrl" class="subtitle">保存切点后，这里会按小节出现文章录入框。</p>
  </div>
</template>
