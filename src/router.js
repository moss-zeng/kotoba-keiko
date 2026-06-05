import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
import AddWords from './views/AddWords.vue'
import Study from './views/Study.vue'
import History from './views/History.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/add', component: AddWords },
  { path: '/study', component: Study },
  { path: '/history', component: History },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
