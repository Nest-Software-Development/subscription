// Platform detection, virtual keyboard awareness, theme control, and native haptics.

const agent = typeof navigator !== 'undefined' ? navigator.userAgent : ''

export const os =
  /iPad|iPhone|iPod/.test(agent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    ? 'ios'
    : /Android/.test(agent)
      ? 'android'
      : /Windows/.test(agent)
        ? 'windows'
        : /Mac OS X/.test(agent)
          ? 'macos'
          : 'other'

export const isInAppBrowser = /FBAN|FBAV|Instagram|Line\/|TikTok|Snapchat|Twitter|LinkedInApp|GSA\/|; wv\)/i.test(agent)

const DISPLAY_MODES = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay']

export function isStandalone() {
  return DISPLAY_MODES.some((m) => matchMedia(`(display-mode: ${m})`).matches) || navigator.standalone === true
}

export function applyPlatformAttributes(root = document.documentElement) {
  root.dataset.os = os
  const sync = () => {
    root.dataset.standalone = String(isStandalone())
  }
  sync()
  for (const mode of DISPLAY_MODES) {
    matchMedia(`(display-mode: ${mode})`).addEventListener?.('change', sync)
  }
}

export function trackVirtualKeyboard(root = document.documentElement) {
  const viewport = window.visualViewport
  if (!viewport) return
  let frame = 0
  let tallest = viewport.height
  const update = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      tallest = Math.max(tallest, viewport.height)
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      const shrunk = tallest - viewport.height
      const typing =
        /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') ||
        document.activeElement?.isContentEditable
      root.style.setProperty('--kb-inset', `${Math.round(inset)}px`)
      root.dataset.keyboard = typing && (inset > 120 || shrunk > 120) ? 'open' : 'closed'
    })
  }
  viewport.addEventListener('resize', update)
  viewport.addEventListener('scroll', update)
  addEventListener('focusin', update)
  addEventListener('focusout', update)
  addEventListener('orientationchange', () => {
    tallest = 0
    update()
  })
  update()
}

let hapticLabel = null
export function haptic(pattern = 10) {
  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern)
      return
    }
    if (os !== 'ios') return
    if (!hapticLabel) {
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.id = 'sub-haptic-switch'
      input.setAttribute('switch', '')
      input.setAttribute('aria-hidden', 'true')
      input.tabIndex = -1
      input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;inset:0 auto auto 0;width:1px;height:1px'
      hapticLabel = document.createElement('label')
      hapticLabel.htmlFor = 'sub-haptic-switch'
      hapticLabel.style.display = 'none'
      document.body.append(input, hapticLabel)
    }
    hapticLabel.click()
  } catch {
    /* haptics are progressive enhancement */
  }
}

export function setAppearance(mode) {
  // mode: 'system' | 'light' | 'dark'
  try {
    if (mode === 'system') localStorage.removeItem('subscription:theme')
    else localStorage.setItem('subscription:theme', mode)
  } catch {
    /* ignore */
  }
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches
  const dark = mode === 'dark' || (mode === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', dark)
}

export function getAppearance() {
  try {
    return localStorage.getItem('subscription:theme') || 'system'
  } catch {
    return 'system'
  }
}

