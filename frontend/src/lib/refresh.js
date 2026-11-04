// Native-feeling pull-to-refresh with rubber-band resistance & haptic tick.

import { onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive } from 'vue'
import { openLayerCount } from './layers'
import { haptic } from './platform'

const TRIGGER = 66
const MAX = 108

export const pull = reactive({ distance: 0, refreshing: false, armed: false })

let handler = null
let startY = 0
let startX = 0
let tracking = false

const atTop = () => (document.scrollingElement?.scrollTop || 0) <= 0

function insideScroller(target) {
  for (let el = target; el && el !== document.body; el = el.parentElement) {
    const s = getComputedStyle(el)
    if (/(auto|scroll)/.test(s.overflowY) && el.scrollTop > 0) return true
    if (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth) return true
  }
  return false
}

function onStart(e) {
  tracking = false
  if (!handler || pull.refreshing || e.touches.length !== 1) return
  if (!atTop() || openLayerCount() > 0 || document.documentElement.dataset.keyboard === 'open') return
  if (insideScroller(e.target)) return
  startY = e.touches[0].clientY
  startX = e.touches[0].clientX
  tracking = true
}

function onMove(e) {
  if (!tracking) return
  const dy = e.touches[0].clientY - startY
  const dx = e.touches[0].clientX - startX
  if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || !atTop()) {
    if (pull.distance) pull.distance = 0
    if (dy < -4 || Math.abs(dx) > Math.abs(dy)) tracking = false
    return
  }
  const distance = Math.min(MAX, dy * 0.44)
  if (!pull.armed && distance >= TRIGGER) haptic(8)
  pull.armed = distance >= TRIGGER
  pull.distance = distance
}

async function onEnd() {
  if (!tracking) return
  tracking = false
  const run = pull.armed && handler
  pull.armed = false
  if (!run) {
    pull.distance = 0
    return
  }
  pull.refreshing = true
  pull.distance = TRIGGER
  try {
    await Promise.all([Promise.resolve(run()).catch(() => {}), new Promise((r) => setTimeout(r, 420))])
  } finally {
    pull.refreshing = false
    pull.distance = 0
  }
}

let listening = false
export function usePullToRefresh(reloadFn) {
  onMounted(() => {
    if (!listening) {
      listening = true
      addEventListener('touchstart', onStart, { passive: true })
      addEventListener('touchmove', onMove, { passive: true })
      addEventListener('touchend', onEnd, { passive: true })
      addEventListener('touchcancel', onEnd, { passive: true })
    }
    handler = reloadFn
  })
  onActivated(() => (handler = reloadFn))
  const drop = () => {
    if (handler === reloadFn) handler = null
  }
  onDeactivated(drop)
  onBeforeUnmount(drop)
}

