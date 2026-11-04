// Directional View Transitions for push/pop detail screens and tab crossfades.

import { nextTick } from 'vue'
import { hasTabBar } from '@/router'

const reduced = matchMedia('(prefers-reduced-motion: reduce)')

export function installTransitions(router) {
  const root = document.documentElement
  let lastPosition = history.state?.position ?? 0
  let release = null
  let first = true

  const finish = () => {
    const done = release
    release = null
    done?.()
  }

  router.beforeResolve((to, from) => {
    if (!document.startViewTransition || reduced.matches) return
    if (!from.matched.length || to.fullPath === from.fullPath || document.visibilityState !== 'visible') return

    const pos = history.state?.position ?? lastPosition
    const type = hasTabBar(to) && hasTabBar(from) ? 'tab' : pos < lastPosition ? 'back' : 'forward'

    return new Promise((resolve) => {
      const update = () =>
        new Promise((done) => {
          release = done
          resolve()
          setTimeout(() => release === done && finish(), 1200)
        })
      root.dataset.vt = type
      let transition
      try {
        transition = document.startViewTransition({ update, types: [type] })
      } catch {
        transition = document.startViewTransition(update)
      }
      transition.finished.finally(() => delete root.dataset.vt)
    })
  })

  router.afterEach((to) => {
    lastPosition = history.state?.position ?? lastPosition
    document.title = to.meta?.title ? `${to.meta.title} — Subscription` : 'Subscription'
    nextTick(() => {
      finish()
      if (!first) document.querySelector('main h1, header h1')?.focus?.({ preventScroll: true })
      first = false
    })
  })
  router.onError(finish)
}

