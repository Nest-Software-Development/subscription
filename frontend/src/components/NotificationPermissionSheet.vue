<script setup>
import { computed, ref } from 'vue'
import Sheet from './Sheet.vue'
import {
  disablePush,
  enablePush,
  promptInstall,
  pushNeedsHomeScreenInstall,
  pwa,
} from '@/lib/pwa'
import { saveSettingsAction, sendTestPushAction, store } from '@/lib/store'
import { closeNotifPermissionSheet, toast, ui } from '@/lib/ui'

const ALL_OFFSETS = [30, 15, 7, 3, 1, 0]
const testing = ref(false)

const activeOffsets = computed(() =>
  String(store.settings.push_reminder_offsets || '30, 15, 7, 3, 1, 0')
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((n) => !Number.isNaN(n)),
)

const statusBadge = computed(() => {
  if (pushNeedsHomeScreenInstall()) {
    return { text: 'Add to Home Screen First', cls: 'bg-warn/15 text-warn' }
  }
  if (pwa.permission === 'denied') {
    return { text: 'Blocked in Browser Settings', cls: 'bg-bad/15 text-bad' }
  }
  if (pwa.pushSubscribed && pwa.permission === 'granted') {
    return { text: 'Push Active on This Device', cls: 'bg-ok/15 text-ok' }
  }
  return { text: 'Permission Required', cls: 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400' }
})

async function handleEnable() {
  try {
    await enablePush(store.pushPublicKey, store.standaloneMode)
    toast('Push renewal notifications enabled on this device!', 'ok')
  } catch (err) {
    toast(err.message || 'Could not enable push notifications.', 'bad')
  }
}

async function handleDisable() {
  try {
    await disablePush(store.standaloneMode)
    toast('Push notifications paused on this device.', 'info')
  } catch (err) {
    toast(err.message || 'Could not update subscription.', 'bad')
  }
}

async function toggleOffset(day) {
  const cur = new Set(activeOffsets.value)
  if (cur.has(day)) {
    if (cur.size === 1) return
    cur.delete(day)
  } else {
    cur.add(day)
  }
  const sorted = [...cur].sort((a, b) => b - a).join(', ')
  await saveSettingsAction({ push_reminder_offsets: sorted })
  toast(`Renewal alert schedule updated (${sorted}d)`, 'info', 2000)
}

async function handleSendTest() {
  testing.value = true
  try {
    if (!pwa.pushSubscribed && pwa.permission !== 'granted') {
      await enablePush(store.pushPublicKey, store.standaloneMode)
    }
    await sendTestPushAction()
    toast('Test renewal alert sent to your device!', 'ok')
  } catch (err) {
    toast(err.message || 'Enable notification permission first.', 'bad')
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <Sheet
    :open="ui.notifPermissionModal"
    title="Renewal Push Notifications"
    subtitle="Get instant mobile alerts before client or vendor subscriptions expire"
    @close="closeNotifPermissionSheet"
  >
    <div class="space-y-4">
      <!-- Hero Consent Card -->
      <div class="rounded-2xl border border-line bg-surface-sunk/60 p-4">
        <div class="flex items-start gap-3.5">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-coral-600 text-white shadow-sm"
          >
            <svg
              class="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.1"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="rounded-full px-2.5 py-0.5 text-[0.72rem] font-bold"
                :class="statusBadge.cls"
              >
                {{ statusBadge.text }}
              </span>
            </div>
            <p class="mt-2 text-[0.875rem] leading-relaxed text-ink-soft">
              Receive native lock-screen notifications when client collections or shared Contabo /
              Verpex server renewals approach their due date.
            </p>
          </div>
        </div>

        <!-- iOS Home Screen Install Guide -->
        <div
          v-if="pushNeedsHomeScreenInstall()"
          class="mt-3.5 rounded-xl border border-warn/30 bg-warn/10 p-3 text-[0.8125rem] text-ink"
        >
          <p class="font-bold text-warn">Install on iPhone Home Screen First</p>
          <p class="mt-1 text-ink-soft">
            iOS delivers Web Push to Home Screen apps. Tap Safari’s
            <strong>Share</strong> button, choose <strong>Add to Home Screen</strong>, then open
            <strong>Subscription</strong> from your Home Screen.
          </p>
        </div>

        <!-- Browser Denied Recovery Guide -->
        <div
          v-else-if="pwa.permission === 'denied'"
          class="mt-3.5 rounded-xl border border-bad/30 bg-bad/10 p-3 text-[0.8125rem]"
        >
          <p class="font-bold text-bad">Notifications Currently Blocked</p>
          <p class="mt-1 text-ink-soft">
            Open your browser or device Site Settings for this domain, change
            <strong>Notifications</strong> to <strong>Allow</strong>, then tap Enable below.
          </p>
        </div>

        <!-- Install App CTA on Android/Desktop if available -->
        <button
          v-if="pwa.canInstall"
          type="button"
          class="btn-obsidian mt-3.5 w-full"
          @click="promptInstall"
        >
          Install Subscription App on Device
        </button>
      </div>

      <!-- Lead-Day Schedule Chips -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="field-label">Notify Me Before Due Date</label>
          <span class="text-[0.75rem] text-ink-mute">Tap to toggle stages</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="d in ALL_OFFSETS"
            :key="d"
            type="button"
            class="chip tabular"
            :class="{ 'chip-active': activeOffsets.includes(d) }"
            @click="toggleOffset(d)"
          >
            {{ d === 0 ? 'On Due Day' : `${d}d before` }}
          </button>
        </div>
      </div>

      <!-- Scope Toggles -->
      <div class="divide-y divide-line/70 rounded-2xl border border-line bg-surface">
        <label class="flex cursor-pointer items-center justify-between p-3.5">
          <div>
            <p class="text-[0.875rem] font-semibold text-ink">Client Collection Renewals</p>
            <p class="text-[0.75rem] text-ink-soft">Alert before client invoices become due</p>
          </div>
          <input
            type="checkbox"
            class="h-5 w-5 accent-coral-600"
            :checked="Boolean(store.settings.notify_client_renewals)"
            @change="
              saveSettingsAction({
                notify_client_renewals: $event.target.checked ? 1 : 0,
              })
            "
          />
        </label>
        <label class="flex cursor-pointer items-center justify-between p-3.5">
          <div>
            <p class="text-[0.875rem] font-semibold text-ink">Vendor Server &amp; Domain Renewals</p>
            <p class="text-[0.75rem] text-ink-soft">
              Prevent multi-client server or domain expiration
            </p>
          </div>
          <input
            type="checkbox"
            class="h-5 w-5 accent-coral-600"
            :checked="Boolean(store.settings.notify_vendor_renewals)"
            @change="
              saveSettingsAction({
                notify_vendor_renewals: $event.target.checked ? 1 : 0,
              })
            "
          />
        </label>
      </div>
    </div>

    <template #footer>
      <div class="flex flex-col gap-2 sm:flex-row">
        <button
          v-if="!pwa.pushSubscribed"
          type="button"
          class="btn-primary flex-1"
          :disabled="pwa.pushBusy"
          @click="handleEnable"
        >
          {{ pwa.pushBusy ? 'Requesting Permission…' : 'Allow & Enable Notifications' }}
        </button>
        <button
          v-else
          type="button"
          class="btn-outline flex-1"
          :disabled="pwa.pushBusy"
          @click="handleDisable"
        >
          Pause on This Device
        </button>

        <button
          type="button"
          class="btn-soft flex-1"
          :disabled="testing"
          @click="handleSendTest"
        >
          {{ testing ? 'Sending…' : 'Send Test Notification' }}
        </button>
      </div>
    </template>
  </Sheet>
</template>

