<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from './components/BottomNav.vue'
import PullIndicator from './components/PullIndicator.vue'
import PaymentSheet from './components/PaymentSheet.vue'
import SubscriptionFormSheet from './components/SubscriptionFormSheet.vue'
import NotificationPermissionSheet from './components/NotificationPermissionSheet.vue'
import EmailPreviewSheet from './components/EmailPreviewSheet.vue'
import { applyUpdate, pwa, unlockAppLock } from './lib/pwa'
import { store } from './lib/store'
import { dismissToast, toast, ui } from './lib/ui'
import { hasTabBar } from './router'

const route = useRoute()
const showChrome = computed(
  () => store.authenticated && route.name !== 'login' && hasTabBar(route),
)
const hasDesktopRail = computed(() => store.authenticated && route.name !== 'login')

async function handleUnlock() {
  try {
    await unlockAppLock()
    toast('Unlocked', 'ok', 1500)
  } catch {
    toast('Verification cancelled.', 'bad')
  }
}
</script>

<template>
  <div class="min-h-[100dvh] bg-surface-page text-ink">
    <!-- Offline Status Pill -->
    <div
      v-if="!pwa.online"
      class="bg-warn px-4 py-1.5 text-center text-xs font-bold text-white pt-safe"
      role="status"
    >
      Offline mode · Viewing cached subscription snapshot
    </div>

    <!-- Safe Prompt-Driven Service Worker Update Banner -->
    <div
      v-if="pwa.updateAvailable"
      class="flex items-center justify-between gap-3 bg-obsidian-900 px-4 py-2 text-xs text-white"
    >
      <span>A new version of Subscription is ready.</span>
      <button
        type="button"
        class="rounded-full bg-coral-500 px-3 py-1 font-bold text-white"
        @click="applyUpdate"
      >
        Reload
      </button>
    </div>

    <!-- Adaptive Desktop Left Rail + Main Viewport -->
    <BottomNav v-if="showChrome" />
    <PullIndicator />

    <div :class="hasDesktopRail && showChrome ? 'min-[840px]:pl-[236px]' : ''">
      <RouterView />
    </div>

    <!-- Global Sheets -->
    <PaymentSheet />
    <SubscriptionFormSheet />
    <NotificationPermissionSheet />
    <EmailPreviewSheet />

    <!-- Accessible Confirmation Alert Dialog -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="ui.confirm"
          class="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-5 backdrop-blur-[2px]"
          role="alertdialog"
          aria-modal="true"
        >
          <div class="w-full max-w-sm rounded-3xl border border-line bg-surface p-5 shadow-sheet">
            <h3 class="text-[1.0625rem] font-extrabold text-ink">{{ ui.confirm.title }}</h3>
            <p class="mt-1.5 text-[0.875rem] leading-relaxed text-ink-soft">
              {{ ui.confirm.body }}
            </p>
            <div class="mt-5 flex gap-2.5">
              <button
                type="button"
                class="btn-outline flex-1"
                @click="ui.confirm.done(false)"
              >
                {{ ui.confirm.cancelText }}
              </button>
              <button
                type="button"
                class="flex-1"
                :class="ui.confirm.danger ? 'btn-danger bg-bad text-white' : 'btn-primary'"
                @click="ui.confirm.done(true)"
              >
                {{ ui.confirm.okText }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Biometric App Lock Shield -->
    <Teleport to="body">
      <div
        v-if="pwa.locked"
        class="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-obsidian-950 p-6 text-center text-white"
      >
        <img
          src="/assets/subscription/images/subscription-logo-512.png"
          alt=""
          class="mb-4 h-20 w-20 rounded-3xl shadow-lg"
        />
        <h2 class="text-xl font-bold">Subscription Locked</h2>
        <p class="mt-1 max-w-xs text-sm text-white/65">
          Authenticate with Face ID, Touch ID, or device biometrics to view financial records.
        </p>
        <button type="button" class="btn-primary mt-6 px-8" @click="handleUnlock">
          Unlock Subscription
        </button>
      </div>
    </Teleport>

    <!-- Toast Notifications Stack -->
    <div
      class="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-[90] flex flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      <div
        v-for="t in ui.toasts"
        :key="t.id"
        class="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full border px-4 py-2.5 text-[0.84rem] font-semibold shadow-lg backdrop-blur-md"
        :class="
          t.tone === 'ok'
            ? 'border-ok/30 bg-obsidian-900/95 text-emerald-300'
            : t.tone === 'bad'
              ? 'border-bad/40 bg-obsidian-900/95 text-coral-300'
              : 'border-white/15 bg-obsidian-900/95 text-white'
        "
        @click="dismissToast(t.id)"
      >
        <span>{{ t.message }}</span>
      </div>
    </div>
  </div>
</template>

