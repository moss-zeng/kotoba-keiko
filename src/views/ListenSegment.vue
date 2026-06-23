<script setup>
// 开始听力 Level3：单个小节 = 区间音频 + 原文(可点词+读音) + 即时修正
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ArticleText from '../components/ArticleText.vue'
import AudioPlayer from '../components/AudioPlayer.vue'
import { getSet, invalidate } from '../listenCache.js'
import { getObjectUrl } from '../audioStore.js'

const route = useRoute()
const router = useRouter()
const id = route.params.id
const seq = Number(route.params.seq)

const set = ref(null)
const segment = ref(null)
const tokens = ref([])
const translations = ref([])
const audioSrc = ref('') // 有本机缓存用 objectURL（切段秒开），否则回退网络 URL
const msg = ref('')
const editing = ref(false)

async function load() {
  try {
    const data = await getSet(id)
    set.value = data
    segment.value = (data.segments || []).find((s) => s.seq === seq) || null
    const art = (data.articles || []).find((a) => a.seq === seq)
    tokens.value = art ? JSON.parse(art.tokens || '[]') : []
    translations.value = art ? JSON.parse(art.translation || '[]') : []
    if (data.audio_key) {
      const cached = await getObjectUrl(data.audio_key, data.duration)
      audioSrc.value = cached || `/api/listen/audio/${data.audio_key}`
    } else {
      audioSrc.value = ''
    }
  } catch (e) {
    msg.value = '读取失败'
  }
}
onMounted(load)

async function saveFix() {
  const text = tokens.value.map((t) => t.w).join('')
  const res = await fetch(`/api/listen/sets/${id}/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seq, text, tokens: tokens.value }),
  })
  if (res.ok) {
    editing.value = false
    invalidate(id) // 修正了读音，让缓存失效以便下次取到新值
    msg.value = '已保存修正'
    setTimeout(() => (msg.value = ''), 2000)
  } else {
    msg.value = '保存失败'
  }
}
</script>

<template>
  <div>
    <button class="ghost" style="padding-left: 0" @click="router.push(`/listen/${id}`)">← 返回</button>
    <h1 v-if="segment" class="title">{{ segment.name || `第${seq}段` }}</h1>
    <p v-if="msg" :class="msg.includes('失败') ? 'msg-err' : 'msg-ok'" style="margin-bottom: 12px">
      {{ msg }}
    </p>

    <!-- 区间播放器 -->
    <div v-if="segment && audioSrc" class="card">
      <AudioPlayer :src="audioSrc" :start="segment.start_sec" :end="segment.end_sec" />
      <p style="font-size: 13px; color: var(--muted); margin-top: 8px">
        空格 播放/暂停 · ← → 快退/快进
      </p>
    </div>
    <p v-else-if="segment && !audioSrc" class="subtitle">这一集还没上传音频。</p>

    <!-- 原文 -->
    <div v-if="tokens.length" class="card">
      <div class="row" style="justify-content: space-between; margin-bottom: 12px">
        <span class="subtitle" style="margin: 0">{{
          editing ? '点词改读音 / 合并 / 拆字' : '点汉字看读音'
        }}</span>
        <button v-if="!editing" class="ghost" style="padding: 4px 8px" @click="editing = true">修正</button>
        <button v-else style="padding: 6px 12px" @click="saveFix">保存修正</button>
      </div>
      <ArticleText v-model:tokens="tokens" :editing="editing" :translations="translations" />
    </div>
    <p v-else class="subtitle">这一段还没有文章，去「录入听力」录入并分词。</p>
  </div>
</template>
