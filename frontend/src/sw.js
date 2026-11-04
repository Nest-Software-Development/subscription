/* Subscription PWA Service Worker (Workbox injectManifest)
 * Served via `subscription.api.pwa.sw` with `Service-Worker-Allowed: /subscriptions`
 * and `Cache-Control: no-cache`.
 */
import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'

const APP = '/subscriptions'
const SHELL_CACHE = 'subscription-shell-v1'
const SHELL_KEY = '/subscriptions/__shell__'
const ICON = '/assets/subscription/manifest/icon-192.png'
const BADGE = '/assets/subscription/manifest/badge-96.png'
const BASE = '/assets/subscription/frontend/'

precacheAndRoute(
  self.__WB_MANIFEST.map((entry) =>
    typeof entry === 'string' || entry.url.startsWith('/') ? entry : { ...entry, url: BASE + entry.url },
  ),
)
cleanupOutdatedCaches()

const OFFLINE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Subscription</title>
<style>html{background:#0b1220;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}body{margin:0;min-height:100dvh;display:grid;place-items:center;text-align:center;padding:24px}
img{width:88px;height:88px;border-radius:22px}h1{font-size:21px;margin:18px 0 8px}p{margin:0 0 22px;color:rgba(255,255,255,.72);font-size:15px}button{font:inherit;font-weight:600;border:0;border-radius:999px;padding:13px 26px;background:#ff5757;color:#fff}</style></head>
<body><main><img src="${ICON}" alt=""><h1>You are offline</h1><p>Reconnect once to load your Subscription workspace; cached data stays available offline thereafter.</p><button onclick="location.reload()">Try Again</button></main></body></html>`

async function serveShell(request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const response = await fetch(request, { credentials: 'same-origin' })
    if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
      cache.put(SHELL_KEY, response.clone())
    }
    return response
  } catch {
    const cached = await cache.match(SHELL_KEY)
    if (cached) return cached
    return new Response(OFFLINE_PAGE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.mode !== 'navigate') return
  const url = new URL(request.url)
  if (url.origin === self.location.origin && (url.pathname === APP || url.pathname.startsWith(APP + '/'))) {
    event.respondWith(serveShell(request))
  }
})

registerRoute(
  ({ url, request }) => url.pathname.startsWith('/files/') && request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'subscription-files',
    plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 7 * 86400 })],
  }),
)

// Safe prompt-driven update: never yank active JS chunks mid-session
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
clientsClaim()

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch(APP, { credentials: 'same-origin' })
        if (res.ok) await (await caches.open(SHELL_CACHE)).put(SHELL_KEY, res)
      } catch {
        /* cached on next navigation */
      }
    })(),
  )
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data?.text() }
  }

  const notif = data.notification || {}
  const title = data.title || notif.title || 'Subscription Renewal'
  const body = data.body || notif.body || ''
  const targetUrl = data.url || notif.navigate || APP
  const badgeVal = typeof data.badge === 'number' ? data.badge : Number(notif.app_badge || 0)

  event.waitUntil(
    (async () => {
      if (self.navigator?.setAppBadge && !Number.isNaN(badgeVal)) {
        await (badgeVal > 0 ? self.navigator.setAppBadge(badgeVal) : self.navigator.clearAppBadge()).catch(() => {})
      }
      await self.registration.showNotification(title, {
        body,
        icon: ICON,
        badge: BADGE,
        tag: data.tag || undefined,
        data: { url: targetUrl },
      })
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      windows.forEach((client) => client.postMessage({ type: 'NOTIFICATION_RECEIVED', payload: data }))
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || APP, self.location.origin)
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const openWin = windows.find((c) => new URL(c.url).pathname.startsWith(APP))
      if (openWin) {
        await openWin.focus()
        openWin.postMessage({ type: 'NAVIGATE', url: target.pathname + target.search })
      } else {
        await self.clients.openWindow(target.href)
      }
    })(),
  )
})

