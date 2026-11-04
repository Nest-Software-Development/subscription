import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { applyPlatformAttributes, trackVirtualKeyboard } from './lib/platform'
import { closeLayersBeforeNavigation } from './lib/layers'
import { installTransitions } from './lib/transitions'
import { installEdgeSwipe } from './lib/edgeSwipe'
import { initPwaListeners } from './lib/pwa'
import { bootstrapApp, refreshWorkspace, store } from './lib/store'

applyPlatformAttributes()
trackVirtualKeyboard()
initPwaListeners()
closeLayersBeforeNavigation(router)
installTransitions(router)
installEdgeSwipe(router)

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const msg = event.data
    if (!msg) return
    if (msg.type === 'NOTIFICATION_RECEIVED') {
      refreshWorkspace().catch(() => {})
    } else if (msg.type === 'NAVIGATE' && msg.url) {
      const clean = String(msg.url).replace(/^\/subscriptions/, '') || '/'
      router.push(clean).catch(() => {})
    }
  })
}

const app = createApp(App)
app.use(router)

async function start() {
  await bootstrapApp()
  if (!store.authenticated && router.currentRoute.value.name !== 'login') {
    await router.replace({ name: 'login' })
  }
  await router.isReady()
  app.mount('#app')

  // Smoothly fade out the instant HTML launch splash once Vue has painted
  requestAnimationFrame(() => {
    const splash = document.querySelector('[data-splash]')
    if (splash) {
      splash.classList.add('sub-splash-out')
      setTimeout(() => splash.remove(), 480)
    }
  })
}

start()
