<script setup>
// 录入听力：听力集列表 + 新建 + 进入编辑 / 删除
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const sets = ref([])
const newName = ref('')
const msg = ref('')
const msgType = ref('')

function flash(text, type) {
  msg.value = text
  msgType.value = type
  setTimeout(() => {
    if (msg.value === text) msg.value = ''
  }, 3000)
}

async function load() {
  try {
    const r = await fetch('/api/listen/sets').then((x) => x.json())
    sets.value = Array.isArray(r) ? r : []
  } catch (e) {
    flash('读取失败，检查本地服务是否在跑', 'err')
  }
}
onMounted(load)

async function create() {
  const name = newName.value.trim()
  if (!name) return flash('名字不能为空', 'err')
  const res = await fetch('/api/listen/sets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const data = await res.json()
  if (!res.ok) return flash(data.error || '新建失败', 'err')
  newName.value = ''
  router.push(`/listen/manage/${data.id}`)
}

async function del(s) {
  if (!confirm(`删除听力集「${s.name}」？音频和所有文章都会删除。`)) return
  const res = await fetch(`/api/listen/sets/${s.id}`, { method: 'DELETE' })
  if (res.ok) {
    flash('已删除', 'ok')
    load()
  }
}
</script>

<template>
  <div>
    <button class="ghost" style="padding-left: 0" @click="router.push('/')">← 返回</button>
    <h1 class="title">录入听力</h1>
    <p class="subtitle">新建听力集后，进入编辑上传音频、切割、录入文章</p>
    <p v-if="msg" :class="msgType === 'ok' ? 'msg-ok' : 'msg-err'" style="margin-bottom: 12px">
      {{ msg }}
    </p>

    <div class="card">
      <div class="field" style="margin-bottom: 12px">
        <label>新建听力集</label>
        <input v-model="newName" placeholder="2023-12 真题" @keyup.enter="create" />
      </div>
      <button style="width: 100%" @click="create">新建</button>
    </div>

    <p class="subtitle">已有 {{ sets.length }} 个听力集</p>
    <div v-for="s in sets" :key="s.id" class="card">
      <strong>{{ s.name }}</strong>
      <div style="font-size: 14px; color: var(--muted); margin-top: 4px">
        {{ s.seg_count }} 个小节 · {{ s.audio_key ? '已上传音频' : '未上传音频' }}
      </div>
      <div class="row" style="margin-top: 10px">
        <button
          class="secondary"
          style="flex: 1; padding: 8px"
          @click="router.push(`/listen/manage/${s.id}`)"
        >
          编辑
        </button>
        <button class="ghost" style="padding: 8px 16px" @click="del(s)">删除</button>
      </div>
    </div>
  </div>
</template>
