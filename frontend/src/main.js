import { nextTick } from 'vue'
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { applyPlatformAttributes, trackVirtualKeyboard } from './lib/platform'
import { closeLayersBeforeNavigation } from './lib/layers'
import { installTransitions } from './lib/transitions'
import { installEdgeSwipe } from './lib/edgeSwipe'
import { applyTheme, initPwaListeners } from './lib/pwa'
import { dismissSplash } from './lib/splash'
import { bootstrapApp, refreshWorkspace, store } from './lib/store'

applyPlatformAttributes()
trackVirtualKeyboard()
initPwaListeners()
closeLayersBeforeNavigation(router)
installTransitions(router)
installEdgeSwipe(router)
router.afterEach(() => {
  nextTick(() => applyTheme())
})

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
  try {
    await bootstrapApp()
    if (!store.authenticated && router.currentRoute.value.name !== 'login') {
      await router.replace({ name: 'login' })
    }
    await router.isReady()
    app.mount('#app')
  } finally {
    dismissSplash()
  }
}

start()
