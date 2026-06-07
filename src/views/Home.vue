<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div>
    <h1 class="title">ことば稽古</h1>
    <p class="subtitle">日语单词默写</p>
    <div class="stack">
      <button @click="router.push('/study')">开始学习</button>
      <button class="secondary" @click="router.push('/add')">录入单词</button>
      <button class="ghost" @click="router.push('/history')">错题本</button>
    </div>
    <div class="stack" style="margin-top: 40px">
      <button @click="router.push('/grammar')">开始语法</button>
      <button class="secondary" @click="router.push('/grammar/add')">录入语法</button>
    </div>
  </div>
</template>
