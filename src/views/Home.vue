<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div>
    <h1 class="title">ことば稽古</h1>
    <div class="stack">
      <button @click="router.push('/study')">开始单词</button>
      <button class="secondary" @click="router.push('/add')">录入单词</button>
      <button class="ghost" @click="router.push('/history')">错题本</button>
    </div>
    <div class="stack" style="margin-top: 40px">
      <button @click="router.push('/listen')">开始听力</button>
      <button class="secondary" @click="router.push('/listen/manage')">录入听力</button>
    </div>
    <div class="stack" style="margin-top: 40px">
      <button @click="router.push('/grammar')">开始语法</button>
      <button class="secondary" @click="router.push('/grammar/add')">录入语法</button>
    </div>
  </div>
</template>
