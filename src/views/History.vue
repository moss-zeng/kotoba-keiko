<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import WrongItem from '../components/WrongItem.vue'

const router = useRouter()
const list = ref([])
const openId = ref(null)

onMounted(async () => {
  try {
    const data = await fetch('/api/history').then((r) => r.json())
    list.value = Array.isArray(data) ? data : []
  } catch (e) {
    list.value = []
  }
})

function toggle(id) {
  openId.value = openId.value === id ? null : id
}

async function delHistory(s) {
  if (!confirm('删除这场记录？')) return
  const res = await fetch(`/api/history/${s.id}`, { method: 'DELETE' })
  if (res.ok) {
    list.value = list.value.filter((x) => x.id !== s.id)
    if (openId.value === s.id) openId.value = null
  }
}

// D1 存的是 UTC（'YYYY-MM-DD HH:MM:SS'），转成本地时间显示
function fmt(t) {
  if (!t) return ''
  const d = new Date(t.replace(' ', 'T') + 'Z')
  return isNaN(d) ? t : d.toLocaleString('zh-CN')
}
</script>

<template>
  <div>
    <button class="ghost" style="padding-left: 0" @click="router.push('/')">
      ← 返回
    </button>
    <h1 class="title">错题本</h1>

    <p v-if="!list.length" class="subtitle">还没有考试记录，去背几道吧。</p>

    <div v-for="s in list" :key="s.id" class="card">
      <div style="display: flex; justify-content: space-between; align-items: center">
        <div style="cursor: pointer; flex: 1" @click="toggle(s.id)">
          <span>{{ fmt(s.finished_at) }}</span>
          <span style="color: var(--muted); font-size: 14px; margin-left: 12px">
            对 {{ s.correct }}/{{ s.total }} · 错 {{ s.total - s.correct }}
          </span>
        </div>
        <button
          class="ghost"
          style="padding: 6px 12px; font-size: 14px"
          @click.stop="delHistory(s)"
        >
          删除
        </button>
      </div>
      <div v-if="openId === s.id" style="margin-top: 12px">
        <p v-if="!s.wrong.length" class="subtitle">这场全对 🎉</p>
        <WrongItem v-for="(w, i) in s.wrong" :key="i" :item="w" />
      </div>
    </div>
  </div>
</template>
