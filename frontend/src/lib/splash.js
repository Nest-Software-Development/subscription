// The launch screen lives as plain HTML + CSS in index.html so it renders on the
// very first frame before JavaScript loads. This module waits for the full launch
// choreography to finish, fades the splash out smoothly, and syncs the status bar.

import { applyTheme } from './pwa'

const FULL_MS = 2800
const BRIEF_MS = 250

export function dismissSplash() {
  const el = document.querySelector('[data-splash]')
  if (!el) {
    document.documentElement.classList.remove('is-splashing')
    applyTheme()
    return Promise.resolve()
  }

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const minimum = reduced ? BRIEF_MS : FULL_MS
  const elapsed = typeof performance !== 'undefined' ? performance.now() : minimum
  const wait = Math.max(0, minimum - elapsed)

  return new Promise((resolve) => {
    setTimeout(() => {
      el.classList.add('sub-splash-out')
      el.setAttribute('aria-hidden', 'true')
      // Switch surface + status bar right as the splash dissolves so there is no flash
      document.documentElement.classList.remove('is-splashing')
      setTimeout(() => {
        el.remove()
        applyTheme()
        resolve()
      }, 620)
    }, wait)
  })
}

