import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
import AddWords from './views/AddWords.vue'
import Study from './views/Study.vue'
import History from './views/History.vue'
import GrammarAdd from './views/GrammarAdd.vue'
import GrammarStudy from './views/GrammarStudy.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/add', component: AddWords },
  { path: '/study', component: Study },
  { path: '/history', component: History },
  { path: '/grammar', component: GrammarStudy },
  { path: '/grammar/add', component: GrammarAdd },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
