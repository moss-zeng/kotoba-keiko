<script setup>
// 开始听力 Level1：听力集列表
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const sets = ref([])
const msg = ref('')

async function load() {
  try {
    const r = await fetch('/api/listen/sets').then((x) => x.json())
    sets.value = Array.isArray(r) ? r : []
  } catch (e) {
    msg.value = '读取听力集失败，检查本地服务是否在跑'
  }
}
onMounted(load)
</script>

<template>
  <div>
    <button class="ghost" style="padding-left: 0" @click="router.push('/')">← 返回</button>
    <h1 class="title">开始听力</h1>
    <p class="subtitle">选择一份听力音频</p>
    <p v-if="msg" class="msg-err" style="margin-bottom: 12px">{{ msg }}</p>
    <p v-if="!sets.length && !msg" class="subtitle">还没有听力集，去「录入听力」添加。</p>
    <div
      v-for="s in sets"
      :key="s.id"
      class="card"
      style="cursor: pointer"
      @click="router.push(`/listen/${s.id}`)"
    >
      <strong>{{ s.name }}</strong>
      <div style="font-size: 14px; color: var(--muted); margin-top: 4px">
        {{ s.seg_count }} 个小节 · {{ s.audio_key ? '已上传音频' : '未上传音频' }}
      </div>
    </div>
  </div>
</template>
