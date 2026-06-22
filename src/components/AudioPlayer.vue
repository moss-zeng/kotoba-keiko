<script setup>
// 自定义音频播放器：自绘进度条(避免原生 range 被 Edge 拖拽搜索误触/拇指偏移)
// 支持区间播放 [start,end]；空格=播放/暂停，←/→=后退/前进(焦点在输入框时不拦截)
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  src: { type: String, required: true },
  start: { type: Number, default: 0 },
  end: { type: Number, default: null }, // null = 到音频结尾
  step: { type: Number, default: 2 }, // ←/→ 每次秒数
})
const emit = defineEmits(['timeupdate', 'duration'])

const audioEl = ref(null)
const bar = ref(null)
const duration = ref(0)
const cur = ref(0)
const playing = ref(false)
const dragging = ref(false)

// 倍速（localStorage 记忆，跨小节/会话保持）
const SPEEDS = [1, 1.25, 1.5, 1.75, 2]
const rate = ref(Number(localStorage.getItem('listen_rate')) || 1)
function setRate(r) {
  rate.value = r
  if (audioEl.value) audioEl.value.playbackRate = r
  localStorage.setItem('listen_rate', String(r))
}

const rEnd = computed(() => (props.end != null ? props.end : duration.value))
const span = computed(() => Math.max(0.0001, rEnd.value - props.start))
const frac = computed(() => Math.min(1, Math.max(0, (cur.value - props.start) / span.value)))

function fmt(s) {
  s = Math.max(0, Math.round(s || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function onMeta() {
  const a = audioEl.value
  duration.value = a?.duration || 0
  if (a) a.playbackRate = rate.value // 新音频元素会重置为 1，重新套用记忆的倍速
  emit('duration', duration.value)
  // 初始定位到区间起点，避免「0:00 进度条已走一点」
  if (a && a.currentTime < props.start) a.currentTime = props.start
  cur.value = a?.currentTime || props.start
}
function onTime() {
  const a = audioEl.value
  cur.value = a.currentTime
  if (playing.value && a.currentTime >= rEnd.value) {
    a.pause()
    a.currentTime = rEnd.value
    cur.value = rEnd.value
    playing.value = false
  }
  emit('timeupdate', cur.value)
}
function play() {
  const a = audioEl.value
  if (!a) return
  if (a.currentTime < props.start || a.currentTime >= rEnd.value) a.currentTime = props.start
  a.play()
  playing.value = true
}
function pause() {
  audioEl.value?.pause()
  playing.value = false
}
function toggle() {
  playing.value ? pause() : play()
}

function seekAbs(t) {
  const a = audioEl.value
  if (!a) return
  a.currentTime = Math.min(rEnd.value, Math.max(props.start, t))
  cur.value = a.currentTime
  emit('timeupdate', cur.value)
}
function seekFrac(f) {
  seekAbs(props.start + Math.min(1, Math.max(0, f)) * span.value)
}
function fracFromEvent(e) {
  const rect = bar.value.getBoundingClientRect()
  return (e.clientX - rect.left) / rect.width
}
function onDown(e) {
  dragging.value = true
  bar.value.setPointerCapture(e.pointerId)
  seekFrac(fracFromEvent(e))
}
function onMove(e) {
  if (dragging.value) seekFrac(fracFromEvent(e))
}
function onUp(e) {
  dragging.value = false
  try {
    bar.value.releasePointerCapture(e.pointerId)
  } catch (err) {
    /* ignore */
  }
}

function onKey(e) {
  const t = e.target
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  if (e.code === 'Space') {
    e.preventDefault()
    toggle()
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault()
    seekAbs(cur.value - props.step)
  } else if (e.code === 'ArrowRight') {
    e.preventDefault()
    seekAbs(cur.value + props.step)
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  pause()
})

defineExpose({ pause, seekAbs })
</script>

<template>
  <div class="player" @dragstart.prevent>
    <audio
      ref="audioEl"
      :src="src"
      preload="metadata"
      @loadedmetadata="onMeta"
      @timeupdate="onTime"
      @ended="playing = false"
    />
    <div class="row" style="align-items: center">
      <button class="play-btn" @click="toggle">{{ playing ? '⏸ 暂停' : '▶ 播放' }}</button>
      <div
        ref="bar"
        class="bar"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
      >
        <div class="bar-track"><div class="bar-fill" :style="{ width: frac * 100 + '%' }" /></div>
        <div class="bar-handle" :style="{ left: frac * 100 + '%' }" />
      </div>
    </div>
    <div class="foot">
      <div class="speeds">
        <button
          v-for="s in SPEEDS"
          :key="s"
          class="spd"
          :class="{ on: rate === s }"
          @click="setRate(s)"
        >
          {{ s }}x
        </button>
      </div>
      <div class="time">{{ fmt(cur - start) }} / {{ fmt(span) }}</div>
    </div>
  </div>
</template>

<style scoped>
.player {
  user-select: none;
}
.play-btn {
  padding: 10px 16px;
  white-space: nowrap;
}
.bar {
  flex: 1;
  position: relative;
  padding: 14px 0;
  cursor: pointer;
  touch-action: none;
}
.bar-track {
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: var(--accent);
}
.bar-handle {
  position: absolute;
  top: 50%;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
.speeds {
  display: flex;
  gap: 4px;
}
.spd {
  min-width: 48px;
  padding: 4px 6px;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  background: var(--accent-light);
  color: var(--accent);
}
.spd.on {
  background: var(--accent);
  color: #fff;
}
.time {
  font-size: 13px;
  color: var(--muted);
}
</style>
