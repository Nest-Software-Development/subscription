// Left-edge swipe-back gesture on non-tab detail screens (for standalone Android/desktop;
// on iOS Safari > 24px avoids colliding with the OS native edge-back gesture).

import { openLayerCount } from './layers'
import { os } from './platform'
import { hasTabBar } from '@/router'

export function installEdgeSwipe(router) {
  if (os === 'ios') return // iOS WebKit already provides native edge swipe back
  let startX = 0
  let startY = 0
  let active = false

  addEventListener(
    'touchstart',
    (e) => {
      active = false
      if (e.touches.length !== 1 || openLayerCount() > 0) return
      if (hasTabBar(router.currentRoute.value)) return
      const x = e.touches[0].clientX
      if (x <= 26) {
        startX = x
        startY = e.touches[0].clientY
        active = true
      }
    },
    { passive: true },
  )

  addEventListener(
    'touchend',
    (e) => {
      if (!active || !e.changedTouches.length) return
      active = false
      const dx = e.changedTouches[0].clientX - startX
      const dy = Math.abs(e.changedTouches[0].clientY - startY)
      if (dx > 72 && dy < 48) {
        if (window.history.length > 1) router.back()
        else router.push('/')
      }
    },
    { passive: true },
  )
}

