// Hardware/gesture back stack manager: every open modal sheet or dialog owns one
// history entry so Android back / iOS swipe back closes the sheet instead of leaving the screen.

import { onBeforeUnmount, watch } from 'vue'

const stack = []
let seq = 0
let ignorePop = 0

addEventListener('popstate', (event) => {
  if (ignorePop > 0) {
    ignorePop--
    return
  }
  const top = stack[stack.length - 1]
  const landedOn = event.state?.subLayer
  if (top && landedOn !== top.id) {
    stack.pop()
    top.close()
    return
  }
  if (landedOn && !stack.some((l) => l.id === landedOn)) history.back()
})

function pushLayer(close) {
  const id = `sub-layer-${++seq}`
  history.pushState({ ...(history.state || {}), subLayer: id }, '')
  stack.push({ id, close })
  return id
}

function releaseLayer(id) {
  const idx = stack.findIndex((l) => l.id === id)
  if (idx === -1) return
  stack.splice(idx, 1)
  if (history.state?.subLayer === id) {
    ignorePop++
    history.back()
  }
}

export function useLayer(isOpen, close) {
  let id = null
  const stop = watch(
    isOpen,
    (open) => {
      if (open && !id) id = pushLayer(() => ((id = null), close()))
      else if (!open && id) {
        const closing = id
        id = null
        releaseLayer(closing)
      }
    },
    { immediate: true, flush: 'post' },
  )
  onBeforeUnmount(() => {
    stop()
    if (id) releaseLayer(id)
  })
}

export const openLayerCount = () => stack.length

export function closeAllLayers() {
  if (!stack.length) return Promise.resolve()
  const layers = stack.splice(0)
  const onTop = layers.some((l) => l.id === history.state?.subLayer)
  for (const l of layers.reverse()) l.close()
  if (!onTop) return Promise.resolve()
  return new Promise((resolve) => {
    ignorePop++
    addEventListener('popstate', resolve, { once: true })
    history.go(-layers.length)
    setTimeout(resolve, 450)
  })
}

export function closeLayersBeforeNavigation(router) {
  for (const method of ['push', 'replace']) {
    const nav = router[method].bind(router)
    router[method] = async (to) => {
      await closeAllLayers()
      return nav(to)
    }
  }
}

