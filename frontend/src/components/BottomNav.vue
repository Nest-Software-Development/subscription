<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { haptic } from '@/lib/platform'
import { store } from '@/lib/store'
import { openNotifPermissionSheet } from '@/lib/ui'
import { pwa } from '@/lib/pwa'

const route = useRoute()
const router = useRouter()

const tabs = computed(() => [
  {
    key: 'pulse',
    label: 'Pulse',
    to: '/',
    badge: 0,
  },
  {
    key: 'list',
    label: 'Subs',
    to: '/list',
    badge: store.kpis.overdue_count,
  },
  {
    key: 'calendar',
    label: 'Timeline',
    to: '/calendar',
    badge: 0,
  },
  {
    key: 'wallets',
    label: 'Wallets',
    to: '/wallets',
    badge: 0,
  },
  {
    key: 'alerts',
    label: 'Alerts',
    to: '/alerts',
    badge: store.unreadNotifications,
  },
])

function isActive(tab) {
  if (tab.to === '/') return route.path === '/'
  if (tab.to === '/list') {
    return (
      route.path.startsWith('/list') ||
      route.path.startsWith('/client/') ||
      route.path.startsWith('/vendor/')
    )
  }
  return route.path.startsWith(tab.to)
}

function go(tab) {
  haptic(8)
  if (route.path === tab.to) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    router.push(tab.to)
  }
}
</script>

<template>
  <!-- Adaptive Left Sidebar Rail on Tablet & Wide Screens (>= 840px per Apple HIG tab-bars.md) -->
  <aside
    class="fixed inset-y-0 left-0 z-30 hidden w-[236px] flex-col border-r border-line/80 bg-surface px-3.5 py-5 min-[840px]:flex"
    aria-label="Primary navigation"
  >
    <div class="mb-6 flex items-center gap-3 px-2">
      <img
        src="/assets/subscription/images/subscription-logo-512.png"
        alt="Subscription logo"
        class="h-10 w-10 rounded-xl shadow-sm"
      />
      <div class="min-w-0">
        <p class="truncate text-[0.95rem] font-bold tracking-tight text-ink">Subscription</p>
        <p class="truncate text-[0.72rem] text-ink-mute">nsdLabs · ERPNext v16</p>
      </div>
    </div>

    <nav class="flex flex-1 flex-col gap-1">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="flex min-h-[44px] items-center justify-between rounded-xl px-3 text-left text-[0.9rem] font-semibold transition"
        :class="
          isActive(tab)
            ? 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400'
            : 'text-ink-soft hover:bg-surface-sunk'
        "
        :aria-current="isActive(tab) ? 'page' : undefined"
        @click="go(tab)"
      >
        <span class="flex items-center gap-3">
          <!-- Pulse -->
          <svg
            v-if="tab.key === 'pulse'"
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 12h4l3-8 4 16 3-8h4" />
          </svg>
          <!-- Subs -->
          <svg
            v-else-if="tab.key === 'list'"
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
          <!-- Timeline -->
          <svg
            v-else-if="tab.key === 'calendar'"
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="3" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <!-- Wallets -->
          <svg
            v-else-if="tab.key === 'wallets'"
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75M16 14h.01" />
          </svg>
          <!-- Alerts -->
          <svg
            v-else
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          <span>{{ tab.label }}</span>
        </span>
        <span
          v-if="tab.badge > 0"
          class="tabular rounded-full bg-coral-600 px-2 py-0.5 text-[11px] font-bold text-white"
        >
          {{ tab.badge }}
        </span>
      </button>
    </nav>

    <!-- Quick Push Status Pill in Sidebar -->
    <button
      type="button"
      class="mt-4 flex items-center justify-between rounded-2xl border border-line bg-surface-sunk/70 p-3 text-left transition hover:bg-surface-sunk"
      @click="openNotifPermissionSheet"
    >
      <div class="min-w-0">
        <p class="text-[0.75rem] font-semibold text-ink">Push Renewal Alerts</p>
        <p class="truncate text-[0.7rem] text-ink-mute">
          {{ pwa.pushSubscribed ? 'Active on this device' : 'Tap to enable alerts' }}
        </p>
      </div>
      <span
        class="h-2.5 w-2.5 shrink-0 rounded-full"
        :class="pwa.pushSubscribed ? 'bg-ok' : 'bg-warn'"
      />
    </button>
  </aside>

  <!-- Floating Apple Liquid Glass Pill Tab Bar on Mobile (< 840px) -->
  <div
    class="mobile-tabbar-wrap pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.55rem)] min-[840px]:hidden"
  >
    <nav
      class="glass-tabbar pointer-events-auto flex w-full max-w-[440px] items-center justify-around rounded-full px-1.5 py-1"
      aria-label="Primary navigation"
    >
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="relative flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1 transition active:scale-95"
        :class="
          isActive(tab)
            ? 'bg-coral-500/12 text-coral-600 dark:bg-coral-500/20 dark:text-coral-400'
            : 'text-ink-mute'
        "
        :aria-current="isActive(tab) ? 'page' : undefined"
        @click="go(tab)"
      >
        <span class="relative">
          <svg
            v-if="tab.key === 'pulse'"
            class="h-[21px] w-[21px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            :stroke-width="isActive(tab) ? 2.4 : 1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 12h4l3-8 4 16 3-8h4" />
          </svg>
          <svg
            v-else-if="tab.key === 'list'"
            class="h-[21px] w-[21px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            :stroke-width="isActive(tab) ? 2.4 : 1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
          <svg
            v-else-if="tab.key === 'calendar'"
            class="h-[21px] w-[21px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            :stroke-width="isActive(tab) ? 2.4 : 1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="3" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <svg
            v-else-if="tab.key === 'wallets'"
            class="h-[21px] w-[21px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            :stroke-width="isActive(tab) ? 2.4 : 1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="2" y="6" width="20" height="14" rx="2.5" />
            <path d="M16 13h.01M2 10h20" />
          </svg>
          <svg
            v-else
            class="h-[21px] w-[21px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            :stroke-width="isActive(tab) ? 2.4 : 1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>

          <span
            v-if="tab.badge > 0"
            class="tabular absolute -right-2.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-coral-600 px-1 text-[10px] font-bold text-white"
          >
            {{ tab.badge > 9 ? '9+' : tab.badge }}
          </span>
        </span>
        <span class="text-[11px] font-semibold leading-none tracking-tight">
          {{ tab.label }}
        </span>
      </button>
    </nav>
  </div>
</template>

