<script setup>
// 文章渲染 + 分词修正，消费端(开始听力)与录入端共用
// read 模式：按段/句展示整篇，默认不标读音，点词才显示振假名（振假名只盖汉字部分）
// edit 模式：按句翻页（上一段/下一段·上一句/下一句），上方悬浮正文高亮当前句
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  tokens: { type: Array, required: true },
  editing: { type: Boolean, default: false },
})
const emit = defineEmits(['update:tokens'])

const SENT_END = /[。．！？!?]$/
const isKana = (c) => /[ぁ-んァ-ヶー]/.test(c)

// 把扁平 token 按 换行→段、句末标点→句 组织成 段[句[token(带扁平下标 i)]]
const groups = computed(() => {
  const paras = []
  let para = []
  let sent = []
  const flushSent = () => {
    if (sent.length) {
      para.push(sent)
      sent = []
    }
  }
  const flushPara = () => {
    flushSent()
    if (para.length) {
      paras.push(para)
      para = []
    }
  }
  props.tokens.forEach((t, i) => {
    if (t.w === '\n') {
      flushPara()
      return
    }
    sent.push({ ...t, i })
    if (SENT_END.test(t.w)) flushSent()
  })
  flushPara()
  return paras
})

// 振假名对齐：裁掉与读音首尾重合的假名，振假名只盖中间汉字核
// 飼い+かい→{pre:'',core:'飼',mid:'か',suf:'い'}；お茶+おちゃ→{pre:'お',core:'茶',mid:'ちゃ',suf:''}
function ruby(w, r) {
  const wa = [...w]
  const ra = [...r]
  let p = 0
  while (p < wa.length && p < ra.length && isKana(wa[p]) && wa[p] === ra[p]) p++
  let s = 0
  while (
    s < wa.length - p &&
    s < ra.length - p &&
    isKana(wa[wa.length - 1 - s]) &&
    wa[wa.length - 1 - s] === ra[ra.length - 1 - s]
  )
    s++
  return {
    pre: wa.slice(0, p).join(''),
    core: wa.slice(p, wa.length - s).join(''),
    mid: ra.slice(p, ra.length - s).join(''),
    suf: wa.slice(wa.length - s).join(''),
  }
}

// ---------- 阅读模式：点词显隐振假名 ----------
const revealed = ref(new Set())
function toggleReveal(i) {
  if (props.editing || !props.tokens[i].r) return
  const set = new Set(revealed.value)
  set.has(i) ? set.delete(i) : set.add(i)
  revealed.value = set
}

// ---------- 编辑模式：按句翻页 ----------
const flatSentences = computed(() => {
  const arr = []
  groups.value.forEach((para, pi) => para.forEach((s) => arr.push({ pi, tokens: s })))
  return arr
})
const curSent = ref(0)
const current = computed(() => flatSentences.value[curSent.value] || { tokens: [], pi: -1 })

watch(flatSentences, (list) => {
  if (curSent.value > list.length - 1) curSent.value = Math.max(0, list.length - 1)
})
watch(() => props.editing, (on) => {
  if (on) curSent.value = 0
  else revealed.value = new Set()
})

function prevSent() {
  if (curSent.value > 0) curSent.value--
}
function nextSent() {
  if (curSent.value < flatSentences.value.length - 1) curSent.value++
}
function prevPara() {
  const list = flatSentences.value
  const pi = current.value.pi
  for (let k = curSent.value - 1; k >= 0; k--) {
    if (list[k].pi < pi) {
      const target = list[k].pi
      let j = k
      while (j > 0 && list[j - 1].pi === target) j--
      curSent.value = j
      return
    }
  }
  curSent.value = 0
}
function nextPara() {
  const list = flatSentences.value
  const pi = current.value.pi
  for (let k = curSent.value + 1; k < list.length; k++) {
    if (list[k].pi > pi) {
      curSent.value = k
      return
    }
  }
}

// 悬浮正文里高亮当前句：用全局句序号判断
function sentGlobalIndex(pi, siWithinPara) {
  let n = 0
  for (let p = 0; p < pi; p++) n += groups.value[p].length
  return n + siWithinPara
}
const activeEl = ref(null)
function setActive(el, active) {
  if (active && el) activeEl.value = el
}
watch(curSent, async () => {
  await nextTick()
  activeEl.value?.scrollIntoView({ block: 'nearest' })
})

// ---------- token 修改（按扁平下标）----------
function setReading(i, val) {
  emit('update:tokens', props.tokens.map((t, idx) => (idx === i ? { ...t, r: val } : t)))
}
function mergeNext(i) {
  if (i >= props.tokens.length - 1) return
  const a = props.tokens[i]
  const b = props.tokens[i + 1]
  const merged = { w: a.w + b.w, r: (a.r || '') + (b.r || ''), base: a.w + b.w }
  emit('update:tokens', [...props.tokens.slice(0, i), merged, ...props.tokens.slice(i + 2)])
}
function splitChars(i) {
  const t = props.tokens[i]
  const parts = [...t.w].map((ch) => ({ w: ch, r: '', base: ch }))
  emit('update:tokens', [...props.tokens.slice(0, i), ...parts, ...props.tokens.slice(i + 1)])
}
</script>

<template>
  <!-- 阅读模式 -->
  <div v-if="!editing" class="article-read">
    <p v-for="(para, pi) in groups" :key="pi" class="para">
      <template v-for="(sent, si) in para" :key="si">
        <span
          v-for="t in sent"
          :key="t.i"
          :class="{ tappable: !!t.r }"
          @click="toggleReveal(t.i)"
        >
          <template v-if="t.r && revealed.has(t.i)">
            {{ ruby(t.w, t.r).pre
            }}<ruby>{{ ruby(t.w, t.r).core }}<rt>{{ ruby(t.w, t.r).mid }}</rt></ruby
            >{{ ruby(t.w, t.r).suf }}
          </template>
          <template v-else>{{ t.w }}</template>
        </span>
      </template>
    </p>
  </div>

  <!-- 编辑模式 -->
  <div v-else class="article-edit">
    <!-- 悬浮正文 -->
    <div class="floating">
      <p v-for="(para, pi) in groups" :key="pi" class="fpara">
        <span
          v-for="(sent, si) in para"
          :key="si"
          :ref="(el) => setActive(el, sentGlobalIndex(pi, si) === curSent)"
          :class="{ fsent: true, active: sentGlobalIndex(pi, si) === curSent }"
          @click="curSent = sentGlobalIndex(pi, si)"
          ><template v-for="t in sent" :key="t.i">{{ t.w }}</template></span
        >
      </p>
    </div>

    <!-- 翻页 -->
    <div class="row nav">
      <button class="ghost" @click="prevPara">上一段</button>
      <button class="ghost" @click="prevSent">上一句</button>
      <span class="navinfo">{{ curSent + 1 }} / {{ flatSentences.length }}</span>
      <button class="ghost" @click="nextSent">下一句</button>
      <button class="ghost" @click="nextPara">下一段</button>
    </div>

    <!-- 当前句词块 -->
    <div class="chips">
      <div v-for="(t, ci) in current.tokens" :key="t.i" class="tok-chip">
        <div class="tok-w">{{ t.w }}</div>
        <input
          class="tok-r"
          :value="t.r"
          placeholder="読み"
          @input="setReading(t.i, $event.target.value)"
        />
        <div class="tok-ops">
          <button class="ghost" :disabled="ci >= current.tokens.length - 1" @click="mergeNext(t.i)">
            合并→
          </button>
          <button class="ghost" :disabled="[...t.w].length < 2" @click="splitChars(t.i)">拆</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.article-read {
  font-size: 18px;
}
.para {
  line-height: 2.4;
  margin-bottom: 14px;
}
.para:last-child {
  margin-bottom: 0;
}
.article-read .tappable {
  cursor: pointer;
  margin: 0 1.5px; /* 词间留缝，虚线不连成一条 */
  border-bottom: 1.5px dotted var(--muted);
}
.article-read ruby rt {
  font-size: 11px;
  color: var(--accent);
}

/* 悬浮正文 */
.floating {
  position: sticky;
  top: 0;
  z-index: 1;
  max-height: 30vh;
  overflow: auto;
  background: var(--accent-light);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
  font-size: 15px;
  line-height: 1.9;
}
.fpara {
  margin-bottom: 8px;
}
.fsent {
  cursor: pointer;
}
.fsent.active {
  background: var(--accent);
  color: #fff;
  border-radius: 4px;
  padding: 1px 2px;
}

.nav {
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-bottom: 12px;
}
.nav .ghost {
  padding: 6px 8px;
  font-size: 14px;
}
.navinfo {
  font-size: 13px;
  color: var(--muted);
  min-width: 56px;
  text-align: center;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tok-chip {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 6px 8px;
  background: var(--card);
  min-width: 64px;
}
.tok-w {
  font-size: 16px;
  text-align: center;
  margin-bottom: 4px;
}
.tok-r {
  padding: 4px 6px;
  font-size: 13px;
  text-align: center;
  border-radius: 8px;
}
.tok-ops {
  display: flex;
  gap: 2px;
  margin-top: 4px;
}
.tok-ops button {
  flex: 1;
  padding: 4px 2px;
  font-size: 12px;
}
.tok-ops button:disabled {
  opacity: 0.3;
}
</style>
