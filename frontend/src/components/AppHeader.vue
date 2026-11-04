<script setup>
import { useRouter } from 'vue-router'
import { os } from '@/lib/platform'
import { store, toggleDisplayCurrency } from '@/lib/store'
import { openNotifPermissionSheet } from '@/lib/ui'
import { pwa } from '@/lib/pwa'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  backTo: { type: String, default: '' },
  showCurrencyToggle: { type: Boolean, default: true },
})

const router = useRouter()

function goBack() {
  if (window.history.length > 2) router.back()
  else router.push(props.backTo || '/')
}

function onBellTap() {
  if (pwa.permission !== 'granted' && !pwa.pushSubscribed) {
    openNotifPermissionSheet()
  } else {
    router.push('/alerts')
  }
}
</script>

<template>
  <header class="glass-nav sticky top-0 z-30 pt-safe">
    <div class="mx-auto flex min-h-[56px] max-w-5xl items-center justify-between gap-2 px-4 py-2">
      <!-- Left: Back button on detail screens OR Brand + Title on root tabs -->
      <div class="flex min-w-0 items-center gap-2.5">
        <button
          v-if="backTo"
          type="button"
          class="inline-flex min-h-[44px] items-center gap-1 rounded-full pr-3 text-[0.9375rem] font-semibold text-coral-600 transition active:opacity-65 dark:text-coral-400"
          aria-label="Go back"
          @click="goBack"
        >
          <svg
            v-if="os === 'ios'"
            class="h-5 w-5 -ml-1"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <svg
            v-else
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span v-if="os === 'ios'">Back</span>
        </button>

        <img
          v-else
          src="/assets/subscription/images/subscription-logo-512.png"
          alt=""
          class="h-8 w-8 shrink-0 rounded-[9px] shadow-sm md:hidden"
        />

        <div class="min-w-0">
          <h1
            tabindex="-1"
            class="truncate text-[1.0625rem] font-bold tracking-tight text-ink outline-none"
          >
            {{ title }}
          </h1>
          <p v-if="subtitle" class="truncate text-[0.75rem] text-ink-mute">
            {{ subtitle }}
          </p>
        </div>
      </div>

      <!-- Right actions: Currency Switcher + Bell + Custom Action Slot -->
      <div class="flex shrink-0 items-center gap-1.5">
        <button
          v-if="showCurrencyToggle"
          type="button"
          class="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-line bg-surface px-3 text-[0.75rem] font-bold tracking-wide text-ink shadow-xs transition active:scale-95"
          :aria-label="`Display currency ${store.displayCurrency}. Tap to switch.`"
          @click="toggleDisplayCurrency"
        >
          <span
            class="h-1.5 w-1.5 rounded-full"
            :class="store.displayCurrency === 'USD' ? 'bg-coral-500' : 'bg-ok'"
          />
          <span class="tabular">{{ store.displayCurrency }}</span>
        </button>

        <button
          type="button"
          class="icon-btn relative"
          aria-label="Renewal notifications and permissions"
          @click="onBellTap"
        >
          <svg
            class="h-[21px] w-[21px]"
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
          <span
            v-if="store.unreadNotifications > 0"
            class="tabular absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-coral-600 px-1 text-[10px] font-bold text-white shadow-xs"
          >
            {{ store.unreadNotifications > 9 ? '9+' : store.unreadNotifications }}
          </span>
          <span
            v-else-if="pwa.permission !== 'granted' && !pwa.pushSubscribed"
            class="absolute right-2 top-2 h-2 w-2 rounded-full bg-warn ring-2 ring-surface-page"
          />
        </button>

        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

