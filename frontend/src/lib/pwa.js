import { reactive } from 'vue'
import { post } from './api'
import { isInAppBrowser, isStandalone, os } from './platform'

const LOCK_KEY = 'subscription:app-lock-cred'
const THEME_KEY = 'subscription:theme'

let swRegistration = null
let deferredPrompt = null

export const pwa = reactive({
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  installed: false,
  canInstall: false,
  swReady: false,
  updateAvailable: false,
  permission:
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  pushSupported:
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window,
  pushSubscribed: false,
  pushBusy: false,
  lockSupported:
    typeof window !== 'undefined' &&
    Boolean(window.PublicKeyCredential) &&
    window.isSecureContext,
  lockEnabled: Boolean(
    typeof localStorage !== 'undefined' && localStorage.getItem(LOCK_KEY),
  ),
  locked: false,
  theme:
    (typeof localStorage !== 'undefined' && localStorage.getItem(THEME_KEY)) ||
    'system',
})

export function applyTheme(mode = pwa.theme) {
  pwa.theme = mode
  try {
    if (mode === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, mode)
  } catch {}
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', isDark)
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function initPwaListeners() {
  applyTheme(pwa.theme)

  const mqDark = window.matchMedia('(prefers-color-scheme: dark)')
  mqDark.addEventListener?.('change', () => {
    if (pwa.theme === 'system') applyTheme('system')
  })

  pwa.installed = isStandalone()
  pwa.inAppBrowser = isInAppBrowser
  window.addEventListener('online', () => {
    pwa.online = true
  })
  window.addEventListener('offline', () => {
    pwa.online = false
  })

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    pwa.canInstall = true
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    pwa.canInstall = false
    pwa.installed = true
  })

  // Lock sensitive financial screen after backgrounding if App Lock is enabled
  let hiddenAt = 0
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
    } else if (
      pwa.lockEnabled &&
      hiddenAt > 0 &&
      Date.now() - hiddenAt > 60_000
    ) {
      pwa.locked = true
    }
    if (typeof Notification !== 'undefined') {
      pwa.permission = Notification.permission
    }
  })

  registerServiceWorker()
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    // Try Frappe's zero-config SW endpoint first; fallback to static /sw.js in standalone preview
    let reg = null
    try {
      reg = await navigator.serviceWorker.register(
        '/api/method/subscription.api.pwa.sw',
        { scope: '/subscriptions' },
      )
    } catch {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    }
    swRegistration = reg
    pwa.swReady = true

    if (reg.waiting) pwa.updateAvailable = true
    reg.addEventListener('updatefound', () => {
      const installing = reg.installing
      if (!installing) return
      installing.addEventListener('statechange', () => {
        if (
          installing.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          pwa.updateAvailable = true
        }
      })
    })

    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    if ('pushManager' in reg) {
      const existing = await reg.pushManager.getSubscription()
      pwa.pushSubscribed = Boolean(existing)
    }
    return reg
  } catch {
    return null
  }
}

export function applyUpdate() {
  if (swRegistration?.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
  } else {
    window.location.reload()
  }
}

export async function promptInstall() {
  if (!deferredPrompt) return { outcome: 'unavailable' }
  deferredPrompt.prompt()
  const choice = await deferredPrompt.userChoice
  if (choice?.outcome === 'accepted') {
    deferredPrompt = null
    pwa.canInstall = false
  }
  return choice
}

export function pushNeedsHomeScreenInstall() {
  return os === 'ios' && !isStandalone()
}

export async function requestBrowserPermission() {
  if (typeof Notification === 'undefined') {
    pwa.permission = 'unsupported'
    return 'unsupported'
  }
  // MUST be called directly inside a user tap handler!
  const result = await Notification.requestPermission()
  pwa.permission = result
  return result
}

export async function enablePush(vapidPublicKey = '', standaloneMode = false) {
  pwa.pushBusy = true
  try {
    if (pushNeedsHomeScreenInstall()) {
      throw new Error(
        'On iPhone & iPad, add Subscription to your Home Screen first to enable Push Notifications.',
      )
    }
    const perm = await requestBrowserPermission()
    if (perm !== 'granted') {
      throw new Error(
        perm === 'denied'
          ? 'Notifications are blocked in browser settings. Enable Notifications for this site and try again.'
          : 'Notification permission was not granted.',
      )
    }

    if (standaloneMode || !vapidPublicKey) {
      // Browser Notification permission granted in standalone preview or local dev before VAPID key generation
      pwa.pushSubscribed = true
      localStorage.setItem('subscription:local-push-enabled', '1')
      return { subscribed: true, mode: 'browser' }
    }

    const reg = swRegistration || (await registerServiceWorker())
    if (!reg || !('pushManager' in reg)) {
      pwa.pushSubscribed = true
      return { subscribed: true, mode: 'browser' }
    }

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
    }

    await post('subscription.push.subscribe', {
      subscription_json: JSON.stringify(sub.toJSON()),
      device_label: `${os.toUpperCase()} · ${isStandalone() ? 'Installed PWA' : 'Browser'}`,
    })
    pwa.pushSubscribed = true
    return { subscribed: true, mode: 'webpush' }
  } finally {
    pwa.pushBusy = false
  }
}

export async function disablePush(standaloneMode = false) {
  pwa.pushBusy = true
  try {
    localStorage.removeItem('subscription:local-push-enabled')
    if (!standaloneMode && swRegistration && 'pushManager' in swRegistration) {
      const sub = await swRegistration.pushManager.getSubscription()
      if (sub) {
        try {
          await post('subscription.push.unsubscribe', { endpoint: sub.endpoint })
        } catch {}
        await sub.unsubscribe()
      }
    }
    pwa.pushSubscribed = false
    return { unsubscribed: true }
  } finally {
    pwa.pushBusy = false
  }
}

export async function triggerLocalNotification({
  title = 'Subscription Renewal Alert',
  body = 'Cwater — Cloud server (ERP) ($450.00) renews soon.',
  url = '/subscriptions/alerts',
  badgeCount = 1,
} = {}) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false
  }
  syncBadge(badgeCount)
  try {
    const reg = swRegistration || (await navigator.serviceWorker?.getRegistration?.())
    if (reg?.showNotification) {
      await reg.showNotification(title, {
        body,
        icon: '/assets/subscription/manifest/icon-192.png',
        badge: '/assets/subscription/manifest/badge-96.png',
        tag: `sub-preview-${Date.now()}`,
        vibrate: [80, 40, 120],
        data: { url, badge: badgeCount },
      })
      return true
    }
  } catch {}
  try {
    const n = new Notification(title, {
      body,
      icon: '/assets/subscription/manifest/icon-192.png',
    })
    n.onclick = () => {
      window.focus()
      n.close()
    }
    return true
  } catch {
    return false
  }
}

export function syncBadge(count = 0) {
  const n = Math.max(0, Number(count || 0))
  try {
    if (n > 0 && 'setAppBadge' in navigator) navigator.setAppBadge(n)
    else if ('clearAppBadge' in navigator) navigator.clearAppBadge()
  } catch {}
}

export async function enableAppLock(userName = 'Subscription User') {
  if (!pwa.lockSupported) {
    throw new Error('Biometric App Lock requires Face ID / Touch ID / Fingerprint over HTTPS.')
  }
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId = crypto.getRandomValues(new Uint8Array(16))
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Subscription · nsdLabs' },
      user: {
        id: userId,
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
      timeout: 60_000,
    },
  })
  if (cred?.rawId) {
    const b64 = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)))
    localStorage.setItem(LOCK_KEY, b64)
    pwa.lockEnabled = true
    pwa.locked = false
    return true
  }
  return false
}

export function disableAppLock() {
  localStorage.removeItem(LOCK_KEY)
  pwa.lockEnabled = false
  pwa.locked = false
}

export async function unlockAppLock() {
  const rawB64 = localStorage.getItem(LOCK_KEY)
  if (!rawB64) {
    pwa.locked = false
    return true
  }
  const credBytes = Uint8Array.from(atob(rawB64), (c) => c.charCodeAt(0))
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: 'public-key', id: credBytes }],
      userVerification: 'required',
      timeout: 60_000,
    },
  })
  pwa.locked = false
  return true
}
