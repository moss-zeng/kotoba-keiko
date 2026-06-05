<script setup>
import { ref, computed } from 'vue'

// item: { type, hyoki, parts, correctAnswer, yourAnswer }
//  - kanji: correctAnswer/yourAnswer 为字符串
//  - ono:   correctAnswer/yourAnswer 为词数组，parts 为挖空结构
const props = defineProps({ item: Object })

const showMeaning = ref(false)
const revealed = ref([])
function reveal(key) {
  if (!revealed.value.includes(key)) revealed.value.push(key)
}
function isRevealed(key) {
  return revealed.value.includes(key)
}

// 假名标准化（与后端一致：去空格、片假名转平假名），用于逐字符判对错
function normKana(s) {
  return (s ?? '')
    .trim()
    .replace(/[　\s]/g, '')
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

// 表记题：逐假名对比
const kanjiCmp = computed(() => {
  if (props.item.type !== 'kanji') return null
  const correct = props.item.correctAnswer ?? ''
  const cArr = [...correct]
  const yArr = [...normKana(props.item.yourAnswer)]
  if (cArr.length !== yArr.length) {
    return { mismatch: true, correct } // 个数不一致：整体留空
  }
  return {
    mismatch: false,
    units: cArr.map((ch, i) => ({ ch, ok: ch === yArr[i] })),
  }
})
</script>

<template>
  <div class="card">
    <!-- 表记题 -->
    <template v-if="item.type === 'kanji'">
      <strong
        style="margin-right: 8px; cursor: pointer"
        @click="showMeaning = !showMeaning"
        >{{ item.hyoki }}</strong
      >
      <span class="ans">
        <template v-if="kanjiCmp.mismatch">
          <span v-if="!isRevealed('all')" class="cell" @click="reveal('all')"
            >＿＿＿</span
          >
          <span v-else class="wrong">{{ kanjiCmp.correct }}</span>
        </template>
        <template v-else>
          <template v-for="(u, i) in kanjiCmp.units" :key="i">
            <span v-if="u.ok" class="ok">{{ u.ch }}</span>
            <span v-else-if="isRevealed(i)" class="wrong">{{ u.ch }}</span>
            <span v-else class="cell" @click="reveal(i)">＿</span>
          </template>
        </template>
      </span>
      <div v-if="showMeaning" class="meaning">{{ item.meaning }}</div>
    </template>

    <!-- 拟态题 -->
    <template v-else>
      <span class="ono">
        <template v-for="(p, pi) in item.parts" :key="pi">
          <span v-if="p.t === 'text'">{{ p.v }}</span>
          <template v-else>
            <span
              v-if="item.yourAnswer[p.i] === item.correctAnswer[p.i]"
              class="ok"
              >{{ item.correctAnswer[p.i] }}</span
            >
            <span
              v-else-if="isRevealed('b' + p.i)"
              class="wrong"
              >{{ item.correctAnswer[p.i] }}</span
            >
            <span v-else class="cell" @click="reveal('b' + p.i)">＿＿</span>
          </template>
        </template>
      </span>
    </template>
  </div>
</template>

<style scoped>
.ans {
  font-size: 18px;
}
.ono {
  font-size: 16px;
  line-height: 2.2;
}
.ok {
  color: var(--ok);
  font-weight: 700;
}
.wrong {
  color: var(--danger);
  font-weight: 700;
}
.cell {
  color: var(--muted);
  border-bottom: 1px dashed var(--muted);
  cursor: pointer;
  padding: 0 2px;
}
.meaning {
  color: var(--muted);
  font-size: 14px;
  margin-top: 6px;
}
</style>
