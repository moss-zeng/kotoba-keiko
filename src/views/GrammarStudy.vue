<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const rows = ref([])
const selectedRowIndex = ref(null)
const expanded = ref(new Set()) // 展开的语法点（按 title）
const revealed = ref(new Set()) // 已点开（去模糊）的义项 key
const showKnown = ref(false)

onMounted(async () => {
  try {
    const data = await fetch('/api/grammar').then((r) => r.json())
    rows.value = Array.isArray(data) ? data : []
  } catch (e) {
    rows.value = []
  }
})

const currentRow = computed(() =>
  selectedRowIndex.value === null ? null : rows.value[selectedRowIndex.value]
)

const stat = computed(() => {
  const r = currentRow.value
  if (!r) return null
  let points = 0
  let n = 0
  let s = 0
  let k = 0
  let kn = 0
  for (const p of r.points) {
    points++
    for (const g of p.groups)
      for (const it of g.items) {
        if (it.state === 'seen') s++
        else if (it.state === 'key') k++
        else if (it.state === 'known') kn++
        else n++
      }
  }
  return { points, items: n + s + k + kn, n, s, k, kn }
})

function openRow(i) {
  selectedRowIndex.value = i
  expanded.value = new Set()
  revealed.value = new Set()
}
function backToRows() {
  selectedRowIndex.value = null
}

function togglePoint(p) {
  const set = new Set(expanded.value)
  if (set.has(p.title)) set.delete(p.title)
  else set.add(p.title)
  expanded.value = set
}
function isExpanded(p) {
  return expanded.value.has(p.title)
}

function reveal(key) {
  const set = new Set(revealed.value)
  set.add(key)
  revealed.value = set
}
function isRevealed(key) {
  return revealed.value.has(key)
}

async function postState(it) {
  try {
    await fetch('/api/grammar/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: it.key, state: it.state, collapsed: it.collapsed }),
    })
  } catch (e) {}
}
function setState(it, state) {
  it.state = state
  postState(it)
}
function toggleCollapse(it) {
  it.collapsed = !it.collapsed
  postState(it)
}
</script>

<template>
  <div>
    <!-- 五十音行列表 -->
    <template v-if="!currentRow">
      <button class="ghost" style="padding-left: 0" @click="router.push('/')">
        ← 返回
      </button>
      <h1 class="title">开始语法</h1>
      <p v-if="!rows.length" class="subtitle">
        还没有语法笔记，去「录入语法」粘贴整篇笔记。
      </p>
      <div class="rows">
        <button
          v-for="(r, i) in rows"
          :key="i"
          class="secondary rowbtn"
          @click="openRow(i)"
        >
          {{ r.row || '（未分组）' }}
        </button>
      </div>
    </template>

    <!-- 行内：统计 + 语法点 -->
    <template v-else>
      <button class="ghost" style="padding-left: 0" @click="backToRows">
        ← 五十音
      </button>
      <h1 class="title">{{ currentRow.row || '（未分组）' }}</h1>
      <p class="subtitle">
        共 {{ stat.points }} 个语法点 · {{ stat.items }} 义项（{{ stat.n }} 未看 ·
        {{ stat.s }} 已看 · {{ stat.k }} 重点 · {{ stat.kn }} 熟悉）
      </p>
      <label class="show-known">
        <input type="checkbox" v-model="showKnown" /> 显示熟悉的
      </label>

      <div v-for="(p, pi) in currentRow.points" :key="pi" class="card">
        <div class="point-title" @click="togglePoint(p)">
          {{ isExpanded(p) ? '▾' : '▸' }} {{ p.title }}
        </div>

        <div v-if="isExpanded(p)" style="margin-top: 10px">
          <template v-for="(g, gi) in p.groups" :key="gi">
            <div v-if="g.pos" class="pos">{{ g.pos }}</div>
            <template v-for="(it, ii) in g.items" :key="ii">
              <div v-if="it.state !== 'known' || showKnown" class="item">
                <div
                  class="meaning"
                  :class="{
                    blurred: !isRevealed(it.key),
                    seen: it.state === 'seen',
                    key: it.state === 'key',
                    known: it.state === 'known',
                  }"
                  @click="reveal(it.key)"
                >
                  {{ it.meaning }}
                </div>
                <template v-if="!it.collapsed">
                  <div v-for="(ex, ei) in it.examples" :key="ei" class="ex">
                    {{ ex }}
                  </div>
                </template>
                <div class="states">
                  <button :class="it.state === 'new' ? '' : 'ghost'" @click="setState(it, 'new')">
                    未看
                  </button>
                  <button :class="it.state === 'seen' ? '' : 'ghost'" @click="setState(it, 'seen')">
                    已看
                  </button>
                  <button :class="it.state === 'key' ? '' : 'ghost'" @click="setState(it, 'key')">
                    重点
                  </button>
                  <button :class="it.state === 'known' ? '' : 'ghost'" @click="setState(it, 'known')">
                    熟悉
                  </button>
                  <button class="ghost" @click="toggleCollapse(it)">
                    {{ it.collapsed ? '展开' : '收起' }}
                  </button>
                </div>
              </div>
            </template>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rows {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.rowbtn {
  padding: 14px 20px;
  min-width: 60px;
}
.show-known {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  color: var(--muted);
  font-size: 14px;
}
.show-known input {
  width: auto;
}
.point-title {
  cursor: pointer;
  font-weight: 600;
  font-size: 17px;
}
.pos {
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  margin: 12px 0 4px;
}
.item {
  padding: 12px 0;
  border-top: 1px solid var(--border);
}
.item:first-child {
  border-top: none;
}
.meaning {
  font-size: 16px;
  cursor: pointer;
  display: inline-block;
}
.meaning.blurred {
  filter: blur(5px);
  user-select: none;
}
.meaning.seen {
  color: #ca8a04;
  font-weight: 600;
}
.meaning.key {
  color: var(--danger);
  font-weight: 700;
}
.meaning.known {
  color: var(--muted);
}
.ex {
  font-size: 15px;
  margin: 6px 0;
  line-height: 1.7;
  white-space: pre-wrap;
}
.states {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.states button {
  padding: 4px 14px;
  font-size: 13px;
}
</style>
