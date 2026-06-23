<script setup>
// 开始听力 Level2：某听力集的小节列表（可改显示名）
// 命名为「旁白」的小节默认不在列表显示（可展开管理，便于改回来）
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getSet, invalidate } from '../listenCache.js'
import * as audioStore from '../audioStore.js'

const route = useRoute()
const router = useRouter()
const id = route.params.id

const ASIDE = '旁白'
const set = ref(null)
const segments = ref([])
const editingId = ref(null)
const editName = ref('')
const showAside = ref(false)
const msg = ref('')

// ---------- 整集音频离线缓存 ----------
const cached = ref(false)
const downloading = ref(false)
const progress = ref(0)
const durationMin = computed(() => Math.round((set.value?.duration || 0) / 60))

async function refreshCache() {
  cached.value = set.value?.audio_key
    ? await audioStore.has(set.value.audio_key, set.value.duration)
    : false
}
async function downloadAudio() {
  if (!set.value?.audio_key || downloading.value) return
  downloading.value = true
  progress.value = 0
  try {
    await audioStore.download(
      set.value.audio_key,
      set.value.duration,
      `/api/listen/audio/${set.value.audio_key}`,
      (frac) => (progress.value = frac)
    )
    cached.value = true
  } catch (e) {
    msg.value = '下载失败，请重试'
  } finally {
    downloading.value = false
  }
}
async function removeCache() {
  await audioStore.remove(set.value.audio_key, set.value.duration)
  cached.value = false
}

const isAside = (seg) => (seg.name || '').trim() === ASIDE
const visibleSegments = computed(() => segments.value.filter((s) => !isAside(s)))
const asideSegments = computed(() => segments.value.filter(isAside))

function fmt(s) {
  s = Math.max(0, Math.round(s || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

async function load() {
  try {
    const data = await getSet(id)
    set.value = data
    segments.value = data.segments || []
    refreshCache()
  } catch (e) {
    msg.value = '读取失败'
  }
}
onMounted(load)

function startEdit(seg) {
  editingId.value = seg.id
  editName.value = seg.name || ''
}
async function saveName() {
  const payload = {
    segments: segments.value.map((s) => ({
      seq: s.seq,
      name: s.id === editingId.value ? editName.value : s.name,
      start_sec: s.start_sec,
      end_sec: s.end_sec,
    })),
  }
  const res = await fetch(`/api/listen/sets/${id}/segments`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (res.ok) {
    editingId.value = null
    invalidate(id) // 改名后让缓存失效再重载
    load()
  } else {
    msg.value = '改名失败'
  }
}
</script>

<template>
  <div>
    <button class="ghost" style="padding-left: 0" @click="router.push('/listen')">← 返回</button>
    <h1 v-if="set" class="title">{{ set.name }}</h1>
    <p class="subtitle">共 {{ visibleSegments.length }} 个小节</p>
    <p v-if="msg" class="msg-err" style="margin-bottom: 12px">{{ msg }}</p>

    <!-- 整集音频离线缓存：下载一次后切小节直接从本机播放，不再每段回源 -->
    <div v-if="set?.audio_key" class="card">
      <template v-if="cached">
        <div class="row" style="align-items: center; justify-content: space-between">
          <span style="color: var(--accent); font-weight: 600">已缓存到本机 ✓</span>
          <button class="ghost" style="padding: 6px 10px; font-size: 14px" @click="removeCache">
            删除缓存
          </button>
        </div>
      </template>
      <template v-else-if="downloading">
        <p class="subtitle" style="margin-bottom: 8px">下载中… {{ Math.round(progress * 100) }}%</p>
        <div class="dl-track"><div class="dl-fill" :style="{ width: progress * 100 + '%' }" /></div>
      </template>
      <template v-else>
        <button class="secondary" style="width: 100%; padding: 10px" @click="downloadAudio">
          ⬇ 下载到本机（约 {{ durationMin }} 分，可离线 · 切小节秒开）
        </button>
      </template>
    </div>
    <p v-if="!segments.length" class="subtitle">还没有切分小节，去「录入听力」切割音频。</p>

    <!-- 正常小节 -->
    <div v-for="seg in visibleSegments" :key="seg.id" class="card">
      <div v-if="editingId === seg.id" class="row" style="align-items: center">
        <input v-model="editName" :placeholder="`第${seg.seq}段`" style="flex: 1" />
        <button style="padding: 10px 14px" @click="saveName">保存</button>
        <button class="ghost" style="padding: 10px" @click="editingId = null">取消</button>
      </div>
      <div v-else>
        <div
          style="display: flex; justify-content: space-between; align-items: center; cursor: pointer"
          @click="router.push(`/listen/${id}/${seg.seq}`)"
        >
          <strong>{{ seg.name || `第${seg.seq}段` }}</strong>
          <span style="font-size: 14px; color: var(--muted)"
            >{{ fmt(seg.start_sec) }} – {{ fmt(seg.end_sec) }}</span
          >
        </div>
        <button class="ghost" style="padding: 6px 0; font-size: 14px" @click="startEdit(seg)">改名</button>
      </div>
    </div>

    <!-- 旁白（默认折叠） -->
    <button
      v-if="asideSegments.length"
      class="ghost"
      style="width: 100%; padding: 8px; font-size: 14px"
      @click="showAside = !showAside"
    >
      {{ showAside ? '收起' : '展开' }}旁白（{{ asideSegments.length }} 段）
    </button>
    <template v-if="showAside">
    <div v-for="seg in asideSegments" :key="seg.id" class="card" style="opacity: 0.7">
      <div v-if="editingId === seg.id" class="row" style="align-items: center">
        <input v-model="editName" :placeholder="`第${seg.seq}段`" style="flex: 1" />
        <button style="padding: 10px 14px" @click="saveName">保存</button>
        <button class="ghost" style="padding: 10px" @click="editingId = null">取消</button>
      </div>
      <div v-else>
        <div
          style="display: flex; justify-content: space-between; align-items: center; cursor: pointer"
          @click="router.push(`/listen/${id}/${seg.seq}`)"
        >
          <strong>{{ seg.name || `第${seg.seq}段` }}</strong>
          <span style="font-size: 14px; color: var(--muted)"
            >{{ fmt(seg.start_sec) }} – {{ fmt(seg.end_sec) }}</span
          >
        </div>
        <button class="ghost" style="padding: 6px 0; font-size: 14px" @click="startEdit(seg)">改名</button>
      </div>
    </div>
    </template>
  </div>
</template>

<style scoped>
.dl-track {
  height: 8px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
}
.dl-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.15s linear;
}
</style>
