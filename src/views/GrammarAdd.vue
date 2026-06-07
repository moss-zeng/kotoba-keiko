<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const text = ref('')
const msg = ref('')
const msgType = ref('')
const stat = ref(null) // { rows, points, items }

async function load() {
  try {
    const d = await fetch('/api/grammar/doc').then((r) => r.json())
    text.value = d.text || ''
  } catch (e) {
    flash('读取失败，检查本地服务是否在跑', 'err')
  }
  refreshStat()
}
onMounted(load)

function flash(t, ty) {
  msg.value = t
  msgType.value = ty
  setTimeout(() => {
    if (msg.value === t) msg.value = ''
  }, 3000)
}

async function refreshStat() {
  try {
    const rows = await fetch('/api/grammar').then((r) => r.json())
    let p = 0
    let i = 0
    for (const r of rows) {
      for (const pt of r.points) {
        p++
        for (const g of pt.groups) i += g.items.length
      }
    }
    stat.value = { rows: rows.length, points: p, items: i }
  } catch (e) {
    stat.value = null
  }
}

async function save() {
  const res = await fetch('/api/grammar/doc', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.value }),
  })
  if (res.ok) {
    flash('已保存', 'ok')
    refreshStat()
  } else {
    flash('保存失败', 'err')
  }
}
</script>

<template>
  <div>
    <button class="ghost" style="padding-left: 0" @click="router.push('/')">
      ← 返回
    </button>
    <h1 class="title">录入语法</h1>
    <p class="subtitle">
      把整篇语法笔记粘进来，保存后自动按 ##/### 切分。以后改动了再粘贴覆盖、保存即可，重点/熟悉标记会按「标题+意思」尽量保留。
    </p>

    <p v-if="msg" :class="msgType === 'ok' ? 'msg-ok' : 'msg-err'" style="margin-bottom: 12px">
      {{ msg }}
    </p>

    <div class="card">
      <textarea v-model="text" rows="18" placeholder="粘贴整篇语法笔记…"></textarea>
      <button style="width: 100%; margin-top: 12px" @click="save">保存</button>
    </div>

    <p v-if="stat" class="subtitle">
      已解析：{{ stat.rows }} 行 · {{ stat.points }} 个语法点 · {{ stat.items }} 个义项
    </p>
  </div>
</template>
