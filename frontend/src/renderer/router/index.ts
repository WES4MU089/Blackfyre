import { createRouter, createWebHashHistory } from 'vue-router'
import Login from '@/views/Login.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'login',
      component: Login
    },
    {
      path: '/launcher',
      name: 'launcher',
      component: () => import('@/views/Launcher.vue')
    },
    {
      path: '/hud',
      name: 'hud',
      component: () => import('@/views/Hud.vue')
    }
  ]
})

export default router
