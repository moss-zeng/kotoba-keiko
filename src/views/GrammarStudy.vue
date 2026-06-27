<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const rows = ref([])
const selectedKana = ref(null)
const expandedPoints = ref(new Set()) // 展开的语法点（按对象引用）
const expandedGroups = ref(new Set()) // 已展开的接续组（默认收起，局部状态，不入库）
const revealed = ref(new Set()) // 已点开（去模糊）的意思（按对象引用）

// 五十音图（含浊音/半浊音行；null=该位置无假名，仅占位对齐）
const GOJUON = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['が', 'ぎ', 'ぐ', 'げ', 'ご'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['だ', 'ぢ', 'づ', 'で', 'ど'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ば', 'び', 'ぶ', 'べ', 'ぼ'],
  ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', null, 'ゆ', null, 'よ'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['わ', null, null, null, 'を'],
  ['ん', null, null, null, null],
]

onMounted(async () => {
  try {
    const data = await fetch('/api/grammar').then((r) => r.json())
    rows.value = Array.isArray(data) ? data : []
  } catch (e) {
    rows.value = []
  }
})

// 假名 → 该行数据（用于判断按钮亮/暗，以及选中进入）
const rowMap = computed(() => {
  const m = {}
  for (const r of rows.value) m[r.row] = r
  return m
})

const currentRow = computed(() =>
  selectedKana.value ? rowMap.value[selectedKana.value] : null
)

const stat = computed(() => {
  const r = currentRow.value
  if (!r) return null
  let points = 0
  let items = 0
  let keys = 0
  for (const p of r.points) {
    points++
    for (const g of p.groups)
      for (const it of g.items) {
        items++
        if (it.state === 'key') keys++
      }
  }
  return { points, items, keys }
})

function openRow(kana) {
  if (!rowMap.value[kana]) return // 没收录的暗按钮不可进入
  selectedKana.value = kana
  expandedPoints.value = new Set()
  expandedGroups.value = new Set()
  revealed.value = new Set()
}
function backToRows() {
  selectedKana.value = null
}

function toggleSet(refSet, obj) {
  const s = new Set(refSet.value)
  if (s.has(obj)) s.delete(obj)
  else s.add(obj)
  refSet.value = s
}
function togglePoint(p) {
  toggleSet(expandedPoints, p)
}
function isPointExpanded(p) {
  return expandedPoints.value.has(p)
}
function toggleGroup(g) {
  toggleSet(expandedGroups, g)
}
function isGroupCollapsed(g) {
  // 接续组默认收起，点击展开；无接续的义项组没有可点的接续行，恒展开
  return !!g.setsuzoku && !expandedGroups.value.has(g)
}
function reveal(it) {
  const s = new Set(revealed.value)
  s.add(it)
  revealed.value = s
}
function isRevealed(it) {
  return revealed.value.has(it)
}

// 重点红色传导：有接续 → 接续行红；无接续 → ### 标题红
function groupHasKey(g) {
  return g.items.some((it) => it.state === 'key')
}
function pointHasNakedKey(p) {
  return p.groups.some((g) => !g.setsuzoku && groupHasKey(g))
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
function toggleKey(it) {
  if (it.collapsed) return // 收起时重点不可点
  it.state = it.state === 'key' ? 'new' : 'key'
  postState(it)
}
function toggleItemCollapse(it) {
  it.collapsed = !it.collapsed
  postState(it)
}
</script>

<template>
  <div>
    <!-- 五十音网格 -->
    <template v-if="!currentRow">
      <button class="ghost" style="padding-left: 0" @click="router.push('/')">
        ← 返回
      </button>
      <h1 class="title">开始语法</h1>
      <p v-if="!rows.length" class="subtitle">
        还没有语法笔记，去「录入语法」粘贴整篇笔记。
      </p>
      <div class="gojuon">
        <div v-for="(rowArr, ri) in GOJUON" :key="ri" class="gjrow">
          <template v-for="(kana, ci) in rowArr" :key="ci">
            <button
              v-if="kana"
              class="gjcell"
              :class="rowMap[kana] ? 'active' : 'dim'"
              :disabled="!rowMap[kana]"
              @click="openRow(kana)"
            >
              {{ kana }}
            </button>
            <span v-else class="gjcell gjempty"></span>
          </template>
        </div>
      </div>
    </template>

    <!-- 行内：统计 + 语法点 -->
    <template v-else>
      <button class="ghost" style="padding-left: 0" @click="backToRows">
        ← 五十音
      </button>
      <h1 class="title">{{ currentRow.row || '（未分组）' }}</h1>
      <p class="subtitle">
        共 {{ stat.points }} 语法点 · {{ stat.items }} 义项 · {{ stat.keys }} 重点
      </p>

      <div v-for="(p, pi) in currentRow.points" :key="pi" class="card">
        <div
          class="point-title"
          :class="{ hot: pointHasNakedKey(p) }"
          @click="togglePoint(p)"
        >
          {{ isPointExpanded(p) ? '▾' : '▸' }} {{ p.title }}
        </div>

        <div v-if="isPointExpanded(p)" style="margin-top: 10px">
          <template v-for="(g, gi) in p.groups" :key="gi">
            <!-- L2 接续行（可空·可收放·有重点义项则整行红） -->
            <div
              v-if="g.setsuzoku"
              class="setsuzoku"
              :class="{ hot: groupHasKey(g) }"
              @click="toggleGroup(g)"
            >
              {{ isGroupCollapsed(g) ? '▸' : '▾' }} {{ g.setsuzoku }}
            </div>

            <!-- 意思义项 -->
            <template v-if="!isGroupCollapsed(g)">
              <div
                v-for="(it, ii) in g.items"
                :key="ii"
                class="item"
                :class="{ indent: g.setsuzoku }"
              >
                <template v-if="!it.collapsed">
                  <div
                    class="meaning"
                    :class="{ blurred: !isRevealed(it), key: it.state === 'key' }"
                    @click="reveal(it)"
                  >
                    {{ it.meaning }}
                  </div>
                  <div v-if="it.nuance" class="nuance">{{ it.nuance }}</div>
                  <div v-for="(ex, ei) in it.examples" :key="ei" class="ex">
                    {{ ex }}
                  </div>
                </template>
                <div class="states">
                  <button
                    :class="it.state === 'key' ? '' : 'ghost'"
                    :disabled="it.collapsed"
                    @click="toggleKey(it)"
                  >
                    重点
                  </button>
                  <button class="ghost" @click="toggleItemCollapse(it)">
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
.gojuon {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.gjrow {
  display: flex;
  gap: 8px;
}
.gjcell {
  flex: 1;
  aspect-ratio: 1 / 1;
  min-width: 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 18px;
  font-weight: 600;
}
.gjcell.active {
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}
.gjcell.dim {
  background: var(--card);
  color: var(--border);
  border: 1px solid var(--border);
  cursor: default;
}
.gjempty {
  background: transparent;
  border: none;
  pointer-events: none;
}
.point-title {
  cursor: pointer;
  font-weight: 600;
  font-size: 17px;
}
.point-title.hot {
  color: var(--danger);
}
.setsuzoku {
  cursor: pointer;
  color: var(--accent);
  font-size: 15px;
  font-weight: 600;
  margin: 12px 0 4px;
}
.setsuzoku.hot {
  color: var(--danger);
}
.item {
  padding: 12px 0;
  border-top: 1px solid var(--border);
}
.item:first-child {
  border-top: none;
}
.item.indent {
  padding-left: 12px;
  border-left: 2px solid var(--border);
  margin-left: 2px;
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
.meaning.key {
  color: var(--danger);
  font-weight: 700;
}
.nuance {
  font-size: 14px;
  color: var(--muted);
  margin: 6px 0;
  line-height: 1.6;
  white-space: pre-wrap;
}
.ex {
  font-size: 15px;
  margin: 6px 0;
  line-height: 1.7;
  white-space: pre-wrap;
}
.states {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
}
.states button {
  padding: 4px 14px;
  font-size: 13px;
}
.states button:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
