<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import Sheet from '@/components/Sheet.vue'
import {
  applyTheme,
  disableAppLock,
  enableAppLock,
  pwa,
} from '@/lib/pwa'
import { usePullToRefresh } from '@/lib/refresh'
import {
  deleteReminderRuleAction,
  exportWorkspaceAction,
  logoutSession,
  markNotificationsReadAction,
  refreshWorkspace,
  runAllRemindersNowAction,
  saveReminderRuleAction,
  saveSettingsAction,
  sendTestPushAction,
  store,
} from '@/lib/store'
import {
  askConfirm,
  openEmailPreviewSheet,
  openNotifPermissionSheet,
  toast,
} from '@/lib/ui'

const router = useRouter()
usePullToRefresh(refreshWorkspace)

const activeTab = ref('push') // 'push' | 'rules' | 'templates' | 'prefs'
const fxInput = ref(store.settings.usd_egp_rate || 56.25)

const ruleSheetOpen = ref(false)
const ruleForm = reactive({
  name: '',
  client_name: '',
  enabled: true,
  to_emails: '',
  cc_emails: 'khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com',
  days: [30, 15, 7, 1],
})

const emailForm = reactive({
  email_template: store.settings.email_template || 'nest',
  from_name: store.settings.from_name || 'Nest Software Development',
  reply_to: store.settings.reply_to || 'info@nsd-eg.com',
  tx_subject: store.settings.tx_subject || '',
  tx_greeting: store.settings.tx_greeting || '',
  tx_intro: store.settings.tx_intro || '',
  tx_closing: store.settings.tx_closing || '',
  tx_cta: store.settings.tx_cta || '',
  tx_signoff: store.settings.tx_signoff || '',
  email_footer: store.settings.email_footer || '',
})

function openRuleEditor(r = null) {
  ruleForm.name = r?.name || ''
  ruleForm.client_name = r?.client_name || store.clientSubscriptions[0]?.client_name || ''
  ruleForm.enabled = r ? Boolean(r.enabled) : true
  ruleForm.to_emails = r?.to_emails || ''
  ruleForm.cc_emails =
    r?.cc_emails || 'khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com'
  ruleForm.days = r?.offsets
    ? r.offsets.filter((o) => o.enabled).map((o) => Number(o.days_before))
    : [30, 15, 7, 1]
  ruleSheetOpen.value = true
}

function toggleRuleDay(d) {
  const idx = ruleForm.days.indexOf(d)
  if (idx >= 0) ruleForm.days.splice(idx, 1)
  else ruleForm.days.push(d)
}

async function submitRule() {
  if (!ruleForm.client_name.trim() || !ruleForm.to_emails.trim()) {
    toast('Enter client name and recipient email.', 'bad')
    return
  }
  await saveReminderRuleAction({
    name: ruleForm.name || undefined,
    client_name: ruleForm.client_name.trim(),
    enabled: ruleForm.enabled ? 1 : 0,
    to_emails: ruleForm.to_emails,
    cc_emails: ruleForm.cc_emails,
    offsets: [30, 15, 7, 1].map((d) => ({
      days_before: d,
      enabled: ruleForm.days.includes(d) ? 1 : 0,
    })),
  })
  ruleSheetOpen.value = false
  toast('Customer reminder rule saved.', 'ok')
}

async function removeRule(r) {
  const ok = await askConfirm({
    title: `Remove ${r.client_name} Rule?`,
    body: 'Automated renewal emails for this client will stop.',
    okText: 'Delete Rule',
    danger: true,
  })
  if (!ok) return
  await deleteReminderRuleAction(r.name)
  toast('Reminder rule deleted.', 'info')
}

async function saveEmailStudio() {
  await saveSettingsAction({ ...emailForm })
  toast('Email template & wording saved.', 'ok')
}

async function saveFxRate() {
  const r = Number(fxInput.value)
  if (!(r > 0)) {
    toast('Enter a valid USD to EGP exchange rate.', 'bad')
    return
  }
  await saveSettingsAction({ usd_egp_rate: r })
  toast(`FX Rate updated to 1 USD = ${r} EGP`, 'ok')
}

async function toggleLock() {
  try {
    if (pwa.lockEnabled) {
      disableAppLock()
      toast('Biometric App Lock disabled.', 'info')
    } else {
      await enableAppLock(store.user?.full_name || 'nsdLabs User')
      toast('Biometric App Lock enabled!', 'ok')
    }
  } catch (err) {
    toast(err.message || 'Biometric setup cancelled.', 'bad')
  }
}

async function handleSignOut() {
  const ok = await askConfirm({
    title: 'Sign out of Subscription?',
    body: 'Cached offline financial snapshots on this device will be cleared.',
    okText: 'Sign Out',
    danger: true,
  })
  if (!ok) return
  await logoutSession()
  router.replace('/login')
}
</script>

<template>
  <div class="pb-tabbar">
    <AppHeader
      title="Alerts & Settings"
      subtitle="Push permissions, email rules, templates & FX"
    />

    <main class="mx-auto max-w-5xl space-y-4 px-4 pt-3.5">
      <!-- Sub-navigation Chips -->
      <div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button
          type="button"
          class="chip"
          :class="{ 'chip-active': activeTab === 'push' }"
          @click="activeTab = 'push'"
        >
          Push &amp; Inbox ({{ store.unreadNotifications }})
        </button>
        <button
          type="button"
          class="chip"
          :class="{ 'chip-active': activeTab === 'rules' }"
          @click="activeTab = 'rules'"
        >
          Email Rules ({{ store.reminderRules.length }})
        </button>
        <button
          type="button"
          class="chip"
          :class="{ 'chip-active': activeTab === 'templates' }"
          @click="activeTab = 'templates'"
        >
          Email Studio
        </button>
        <button
          type="button"
          class="chip"
          :class="{ 'chip-active': activeTab === 'prefs' }"
          @click="activeTab = 'prefs'"
        >
          FX, Lock &amp; Backup
        </button>
      </div>

      <!-- 1. PUSH PERMISSIONS & IN-APP NOTIFICATIONS -->
      <template v-if="activeTab === 'push'">
        <section class="card space-y-3.5 p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-[1rem] font-extrabold text-ink">
                Mobile Renewal Push Notifications
              </h2>
              <p class="mt-0.5 text-[0.8rem] text-ink-soft">
                Lead days:
                <strong class="tabular text-ink">
                  {{ store.settings.push_reminder_offsets }}d
                </strong>
                before renewal date
              </p>
            </div>
            <span
              class="rounded-full px-2.5 py-1 text-xs font-bold"
              :class="
                pwa.pushSubscribed
                  ? 'bg-ok/15 text-ok'
                  : 'bg-warn/15 text-warn'
              "
            >
              {{ pwa.pushSubscribed ? 'Enabled' : 'Setup Needed' }}
            </span>
          </div>

          <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              class="btn-primary text-[0.84rem]"
              @click="openNotifPermissionSheet"
            >
              {{ pwa.pushSubscribed ? 'Notification Settings' : 'Allow Notifications' }}
            </button>
            <button
              type="button"
              class="btn-soft text-[0.84rem]"
              @click="
                sendTestPushAction().then(() =>
                  toast('Test notification dispatched!', 'ok'),
                )
              "
            >
              Send Test Alert
            </button>
            <button
              type="button"
              class="btn-outline text-[0.84rem]"
              @click="
                runAllRemindersNowAction().then(() =>
                  toast('Checked all due subscriptions!', 'ok'),
                )
              "
            >
              Check Renewals Now
            </button>
          </div>
        </section>

        <!-- Notification Feed -->
        <section class="space-y-2.5">
          <div class="flex items-center justify-between px-1">
            <h3 class="text-[0.95rem] font-bold text-ink">
              Renewal Alert Inbox ({{ store.notifications.length }})
            </h3>
            <button
              v-if="store.unreadNotifications > 0"
              type="button"
              class="text-xs font-bold text-coral-600 dark:text-coral-400"
              @click="markNotificationsReadAction()"
            >
              Mark all read
            </button>
          </div>

          <div class="space-y-2">
            <article
              v-for="n in store.notifications"
              :key="n.name"
              class="card flex items-start justify-between gap-3 p-4"
              :class="!n.read ? 'border-coral-500/40' : 'opacity-80'"
              @click="
                markNotificationsReadAction(n.name);
                if (n.reference_doctype === 'Client Subscription')
                  router.push(`/client/${n.reference_name}`);
                else if (n.reference_doctype === 'Vendor Subscription')
                  router.push(`/vendor/${n.reference_name}`);
              "
            >
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span v-if="!n.read" class="h-2 w-2 shrink-0 rounded-full bg-coral-600" />
                  <p class="truncate text-[0.9rem] font-bold text-ink">{{ n.title }}</p>
                </div>
                <p class="mt-1 text-[0.8rem] text-ink-soft">{{ n.body }}</p>
                <p class="mt-1.5 text-[11px] text-ink-mute">{{ n.created_at }}</p>
              </div>
            </article>
          </div>
        </section>
      </template>

      <!-- 2. CUSTOMER EMAIL REMINDER RULES -->
      <template v-else-if="activeTab === 'rules'">
        <div class="flex items-center justify-between">
          <p class="text-[0.8125rem] text-ink-soft">
            Automated SMTP reminders per client at 30, 15, 7 &amp; 1 day stages
          </p>
          <button
            type="button"
            class="btn-primary min-h-[38px] px-3.5 text-xs"
            @click="openRuleEditor()"
          >
            + Add Rule
          </button>
        </div>

        <div class="space-y-2.5">
          <div
            v-for="r in store.reminderRules"
            :key="r.name"
            class="card space-y-2.5 p-4"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <h3 class="text-[0.95rem] font-bold text-ink">{{ r.client_name }}</h3>
                <p class="truncate text-[0.78rem] text-ink-soft">To: {{ r.to_emails }}</p>
                <p v-if="r.cc_emails" class="truncate text-[0.72rem] text-ink-mute">
                  CC: {{ r.cc_emails }}
                </p>
              </div>
              <div class="flex gap-1.5">
                <button
                  type="button"
                  class="rounded-full bg-surface-sunk px-2.5 py-1 text-xs font-semibold text-ink"
                  @click="openRuleEditor(r)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="rounded-full bg-bad/10 px-2.5 py-1 text-xs font-semibold text-bad"
                  @click="removeRule(r)"
                >
                  ×
                </button>
              </div>
            </div>

            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="off in r.offsets"
                :key="off.days_before"
                class="tabular rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                :class="
                  off.enabled
                    ? 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400'
                    : 'bg-surface-sunk text-ink-mute line-through'
                "
              >
                {{ off.days_before }}d before
              </span>
            </div>
          </div>
        </div>
      </template>

      <!-- 3. EMAIL TEMPLATE & WORDING STUDIO -->
      <template v-else-if="activeTab === 'templates'">
        <section class="card space-y-4 p-5">
          <div class="flex items-center justify-between">
            <h2 class="text-[1rem] font-bold text-ink">Branded HTML Email Studio</h2>
            <button
              type="button"
              class="btn-soft min-h-[36px] px-3.5 text-xs"
              @click="openEmailPreviewSheet({ overrides: emailForm })"
            >
              Live Preview
            </button>
          </div>

          <div class="seg-wrap">
            <button
              v-for="t in [
                { id: 'nest', label: 'Nest Executive' },
                { id: 'modern', label: 'Modern Coral' },
                { id: 'minimal', label: 'Minimal' },
              ]"
              :key="t.id"
              type="button"
              class="seg-btn"
              :class="{ 'seg-btn-active': emailForm.email_template === t.id }"
              @click="emailForm.email_template = t.id"
            >
              {{ t.label }}
            </button>
          </div>

          <div class="field-wrap">
            <label class="field-label">Subject Line ({client}, {service}, {due})</label>
            <div class="field-box">
              <input v-model="emailForm.tx_subject" type="text" class="field-input text-sm" />
            </div>
          </div>

          <div class="field-wrap">
            <label class="field-label">Intro Paragraph ({when}, {amount}, {cycle})</label>
            <div class="field-box">
              <textarea v-model="emailForm.tx_intro" rows="2" class="field-input text-sm" />
            </div>
          </div>

          <div class="field-wrap">
            <label class="field-label">Closing &amp; Payment Terms</label>
            <div class="field-box">
              <textarea v-model="emailForm.tx_closing" rows="4" class="field-input text-sm" />
            </div>
          </div>

          <div class="field-wrap">
            <label class="field-label">Bank Account / IBAN Footer</label>
            <div class="field-box">
              <textarea v-model="emailForm.email_footer" rows="3" class="field-input text-sm" />
            </div>
          </div>

          <button type="button" class="btn-primary w-full" @click="saveEmailStudio">
            Save Email Template &amp; Wording
          </button>
        </section>
      </template>

      <!-- 4. WORKSPACE FX, APPEARANCE, APP LOCK & BACKUP -->
      <template v-else>
        <!-- USD <-> EGP Rate -->
        <section class="card space-y-3 p-5">
          <h3 class="text-[0.95rem] font-bold text-ink">Exchange Rate (USD ↔ EGP)</h3>
          <div class="flex gap-2.5">
            <div class="field-box flex-1">
              <span class="text-sm font-semibold text-ink-mute">1 USD =</span>
              <input
                v-model="fxInput"
                type="number"
                step="0.05"
                class="field-input tabular font-bold"
              />
              <span class="text-sm font-semibold text-ink-mute">EGP</span>
            </div>
            <button type="button" class="btn-primary px-5" @click="saveFxRate">Save</button>
          </div>
        </section>

        <!-- Appearance -->
        <section class="card space-y-3 p-5">
          <h3 class="text-[0.95rem] font-bold text-ink">Appearance</h3>
          <div class="seg-wrap">
            <button
              v-for="mode in ['system', 'light', 'dark']"
              :key="mode"
              type="button"
              class="seg-btn capitalize"
              :class="{ 'seg-btn-active': pwa.theme === mode }"
              @click="applyTheme(mode)"
            >
              {{ mode }}
            </button>
          </div>
        </section>

        <!-- Security & Backup -->
        <section class="card space-y-3 p-5">
          <h3 class="text-[0.95rem] font-bold text-ink">Security &amp; Data</h3>
          <div class="flex flex-col gap-2.5 sm:flex-row">
            <button
              v-if="pwa.lockSupported"
              type="button"
              class="btn-outline flex-1"
              @click="toggleLock"
            >
              {{ pwa.lockEnabled ? 'Disable Biometric App Lock' : 'Enable Face ID / Touch ID Lock' }}
            </button>
            <button
              type="button"
              class="btn-soft flex-1"
              @click="exportWorkspaceAction"
            >
              Export JSON Backup
            </button>
          </div>

          <button
            v-if="!store.standaloneMode"
            type="button"
            class="btn-danger w-full"
            @click="handleSignOut"
          >
            Sign Out ({{ store.user?.email || store.user?.name }})
          </button>
        </section>
      </template>
    </main>

    <!-- Customer Reminder Rule Sheet -->
    <Sheet
      :open="ruleSheetOpen"
      :title="ruleForm.name ? 'Edit Reminder Rule' : 'New Reminder Rule'"
      subtitle="Automated email notifications before renewal"
      @close="ruleSheetOpen = false"
    >
      <div class="space-y-3.5">
        <div class="field-wrap">
          <label class="field-label">Client Name</label>
          <div class="field-box">
            <input
              v-model="ruleForm.client_name"
              type="text"
              class="field-input"
              placeholder="e.g. Cwater"
            />
          </div>
        </div>
        <div class="field-wrap">
          <label class="field-label">To Emails (comma-separated)</label>
          <div class="field-box">
            <input
              v-model="ruleForm.to_emails"
              type="text"
              class="field-input text-sm"
              placeholder="billing@client.com"
            />
          </div>
        </div>
        <div class="field-wrap">
          <label class="field-label">CC Emails</label>
          <div class="field-box">
            <input v-model="ruleForm.cc_emails" type="text" class="field-input text-sm" />
          </div>
        </div>
        <div class="space-y-1.5">
          <label class="field-label">Send Reminder Stages</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="d in [30, 15, 7, 1]"
              :key="d"
              type="button"
              class="chip tabular"
              :class="{ 'chip-active': ruleForm.days.includes(d) }"
              @click="toggleRuleDay(d)"
            >
              {{ d }}d before
            </button>
          </div>
        </div>
      </div>
      <template #footer>
        <button type="button" class="btn-primary w-full" @click="submitRule">
          Save Reminder Rule
        </button>
      </template>
    </Sheet>
  </div>
</template>

