import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
import AddWords from './views/AddWords.vue'
import Study from './views/Study.vue'
import History from './views/History.vue'
import GrammarAdd from './views/GrammarAdd.vue'
import GrammarStudy from './views/GrammarStudy.vue'
import Listen from './views/Listen.vue'
import ListenSet from './views/ListenSet.vue'
import ListenSegment from './views/ListenSegment.vue'
import ListenManage from './views/ListenManage.vue'
import ListenEdit from './views/ListenEdit.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/add', component: AddWords },
  { path: '/study', component: Study },
  { path: '/history', component: History },
  { path: '/grammar', component: GrammarStudy },
  { path: '/grammar/add', component: GrammarAdd },
  // 听力：录入(manage)路由放在 /listen/:id 之前，避免被动态段吃掉
  { path: '/listen', component: Listen },
  { path: '/listen/manage', component: ListenManage },
  { path: '/listen/manage/:id', component: ListenEdit },
  { path: '/listen/:id', component: ListenSet },
  { path: '/listen/:id/:seq', component: ListenSegment },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
