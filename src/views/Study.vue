<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import WrongItem from '../components/WrongItem.vue'

const router = useRouter()

const phase = ref('loading') // loading | answering | empty | finished
const questions = ref([])
const index = ref(0)
const answered = ref([]) // 本局每题结果（含错题展示所需信息）
const showExit = ref(false)

// 作答状态
const kanjiInput = ref('')
const showMeaning = ref(false)
const filled = ref([]) // 每空 -> choice index | null
const usedChoice = ref([]) // choice index -> 是否已用
const selectedBlank = ref(null)
const result = ref(null) // 当前题结果 { correct, correctAnswer } | null

const current = computed(() => questions.value[index.value] || null)
const total = computed(() => questions.value.length)
const wrongList = computed(() => answered.value.filter((a) => !a.correct))

onMounted(async () => {
  try {
    const data = await fetch('/api/exam/start').then((r) => r.json())
    if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
      phase.value = 'empty'
      return
    }
    questions.value = data.questions
    answered.value = data.answered ?? []
    index.value = answered.value.length // 恢复：从已答数接着考
    if (index.value >= questions.value.length) {
      await finishExam() // 暂存的局其实已答完，直接结算
      return
    }
    phase.value = 'answering'
    initQuestion()
  } catch (e) {
    phase.value = 'empty'
  }
})

function initQuestion() {
  result.value = null
  kanjiInput.value = ''
  showMeaning.value = false
  selectedBlank.value = null
  const q = current.value
  if (q && q.type === 'ono') {
    filled.value = q.parts.filter((p) => p.t === 'blank').map(() => null)
    usedChoice.value = q.choices.map(() => false)
  }
}

// 拟态交互
function pickBlank(i) {
  if (result.value) return
  selectedBlank.value = i
}
function pickChoice(j) {
  if (result.value || usedChoice.value[j] || selectedBlank.value === null) return
  const prev = filled.value[selectedBlank.value]
  if (prev !== null) usedChoice.value[prev] = false
  filled.value[selectedBlank.value] = j
  usedChoice.value[j] = true
  selectedBlank.value = null
}
function clearBlank(i) {
  if (result.value) return
  const j = filled.value[i]
  if (j !== null) {
    usedChoice.value[j] = false
    filled.value[i] = null
  }
  selectedBlank.value = i
}

const canSubmit = computed(() => {
  const q = current.value
  if (!q) return false
  if (q.type === 'kanji') return kanjiInput.value.trim() !== ''
  return filled.value.every((x) => x !== null)
})

async function submit() {
  if (!canSubmit.value || result.value) return
  const q = current.value
  let answer
  if (q.type === 'kanji') answer = kanjiInput.value
  else answer = filled.value.map((j) => q.choices[j])

  const res = await fetch('/api/exam/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: q.type, id: q.id, answer }),
  }).then((r) => r.json())

  result.value = res
  answered.value.push({
    type: q.type,
    id: q.id,
    correct: res.correct,
    hyoki: q.hyoki,
    meaning: q.meaning,
    parts: q.parts,
    correctAnswer: res.correctAnswer,
    yourAnswer: answer,
  })
}

function next() {
  if (index.value + 1 >= total.value) {
    finishExam()
    return
  }
  index.value++
  initQuestion()
}

// 结算：按本局已答结果批量算分 + 清暂存
async function finishExam() {
  await fetch('/api/exam/settle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answered: answered.value }),
  })
  showExit.value = false
  phase.value = 'finished'
}

// 退出：暂存
async function exitSave() {
  await fetch('/api/exam/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questions: questions.value,
      answered: answered.value,
    }),
  })
  router.push('/')
}

// 退出：作废
async function exitDiscard() {
  await fetch('/api/exam/discard', { method: 'POST' })
  router.push('/')
}
</script>

<template>
  <div>
    <button class="ghost" style="padding-left: 0" @click="showExit = true">
      ← 退出
    </button>

    <div v-if="phase === 'loading'" class="subtitle">加载中…</div>

    <div v-else-if="phase === 'empty'" class="center">
      <h1 class="title">没有要学的词了</h1>
      <p class="subtitle">词库里 3 分以下的词都背完了，去录入新词吧。</p>
      <button @click="router.push('/add')">去录入</button>
    </div>

    <div v-else-if="phase === 'finished'">
      <h1 class="title">本次完成</h1>
      <p class="subtitle" v-if="wrongList.length === 0">全对，没有错题 🎉</p>
      <p class="subtitle" v-else>
        本次错题 {{ wrongList.length }} 道（绿色是你答对的，留空处点击看答案）：
      </p>
      <WrongItem v-for="(w, idx) in wrongList" :key="idx" :item="w" />
      <button style="width: 100%; margin-top: 8px" @click="router.push('/')">
        回首页
      </button>
    </div>

    <div v-else-if="current">
      <p class="subtitle">{{ index + 1 }} / {{ total }}</p>

      <!-- 表记题 -->
      <div v-if="current.type === 'kanji'" class="card center">
        <div
          style="font-size: 32px; font-weight: 700; margin: 16px 0; cursor: pointer"
          @click="showMeaning = !showMeaning"
        >
          {{ current.hyoki }}
        </div>
        <p v-if="showMeaning" class="subtitle" style="margin-bottom: 12px">
          {{ current.meaning }}
        </p>
        <p v-else class="subtitle" style="font-size: 13px; margin-bottom: 12px">
          点汉字看释义
        </p>
        <input
          v-model="kanjiInput"
          :disabled="!!result"
          placeholder="输入假名读音"
          @keyup.enter="submit"
        />
      </div>

      <!-- 拟态题 -->
      <div v-else class="card">
        <p style="font-size: 16px; line-height: 2.2; white-space: pre-wrap">
          <template v-for="(p, pi) in current.parts" :key="pi">
            <span v-if="p.t === 'text'">{{ p.v }}</span>
            <span
              v-else
              class="blank"
              :class="{ active: selectedBlank === p.i, done: filled[p.i] !== null }"
              @click="filled[p.i] === null ? pickBlank(p.i) : clearBlank(p.i)"
              >{{ filled[p.i] !== null ? current.choices[filled[p.i]] : '＿＿' }}</span
            >
          </template>
        </p>
        <div class="choices">
          <button
            v-for="(c, j) in current.choices"
            :key="j"
            class="secondary"
            :disabled="usedChoice[j] || !!result"
            style="padding: 8px 14px"
            @click="pickChoice(j)"
          >
            {{ c }}
          </button>
        </div>
      </div>

      <!-- 结果 -->
      <div v-if="result" class="card">
        <strong :class="result.correct ? 'msg-ok' : 'msg-err'">
          {{ result.correct ? '✓ 正确' : '✗ 错误' }}
        </strong>
        <div v-if="!result.correct" style="margin-top: 4px">
          正确答案：{{
            Array.isArray(result.correctAnswer)
              ? result.correctAnswer.join(' / ')
              : result.correctAnswer
          }}
        </div>
      </div>

      <button v-if="!result" style="width: 100%" :disabled="!canSubmit" @click="submit">
        提交
      </button>
      <button v-else style="width: 100%" @click="next">
        {{ index + 1 >= total ? '查看结果' : '下一题' }}
      </button>
    </div>

    <!-- 退出三选项 -->
    <div v-if="showExit" class="overlay" @click.self="showExit = false">
      <div class="dialog">
        <h2 style="font-size: 20px; margin-bottom: 4px">退出本次</h2>
        <p class="subtitle" style="margin-bottom: 16px">已答 {{ answered.length }} 题</p>
        <div class="stack">
          <button @click="finishExam">结算（已答的算分，看错题）</button>
          <button class="secondary" @click="exitSave">暂存（下次接着考）</button>
          <button class="ghost" @click="exitDiscard">作废（都不算分）</button>
          <button class="ghost" @click="showExit = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.blank {
  display: inline-block;
  min-width: 56px;
  padding: 2px 8px;
  margin: 0 2px;
  border-bottom: 2px solid var(--accent);
  text-align: center;
  cursor: pointer;
  color: var(--accent);
  font-weight: 600;
}
.blank.active {
  background: var(--accent-light);
  border-radius: 6px 6px 0 0;
}
.blank.done {
  color: var(--text);
}
.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.dialog {
  background: var(--card);
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 360px;
}
.dialog button {
  width: 100%;
}
</style>
