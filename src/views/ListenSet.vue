<script setup>
// 开始听力 Level2：某听力集的小节列表（可改显示名）
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const id = route.params.id

const set = ref(null)
const segments = ref([])
const editingId = ref(null)
const editName = ref('')
const msg = ref('')

function fmt(s) {
  s = Math.max(0, Math.round(s || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

async function load() {
  try {
    const data = await fetch(`/api/listen/sets/${id}`).then((x) => x.json())
    set.value = data
    segments.value = data.segments || []
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
    <p class="subtitle">共 {{ segments.length }} 个小节</p>
    <p v-if="msg" class="msg-err" style="margin-bottom: 12px">{{ msg }}</p>
    <p v-if="!segments.length" class="subtitle">还没有切分小节，去「录入听力」切割音频。</p>

    <div v-for="seg in segments" :key="seg.id" class="card">
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
        <button class="ghost" style="padding: 6px 0; font-size: 14px" @click="startEdit(seg)">
          改名
        </button>
      </div>
    </div>
  </div>
</template>
