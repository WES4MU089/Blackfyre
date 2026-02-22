import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import './styles/global.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Navigation guard — check auth + permissions
router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    // Store intended destination and redirect to home (login prompt)
    auth.redirectAfterLogin = to.fullPath
    return '/'
  }

  if (to.meta.requiresSuperAdmin && !auth.isSuperAdmin) {
    return '/'
  }

  if (to.meta.permission && typeof to.meta.permission === 'string') {
    if (!auth.hasPermission(to.meta.permission)) {
      return '/'
    }
  }

  return true
})

app.mount('#app')
