<script setup>
import { ref, watch } from 'vue'
import Sheet from './Sheet.vue'
import { fetchEmailPreview, sendReminderNowAction, store } from '@/lib/store'
import { closeEmailPreviewSheet, toast, ui } from '@/lib/ui'

const loading = ref(false)
const sending = ref(false)
const templateChoice = ref('nest')
const subject = ref('')
const html = ref('')
const toEmails = ref('')

async function refreshPreview() {
  loading.value = true
  try {
    const res = await fetchEmailPreview(ui.emailPreviewModal?.clientSubscription || '', {
      ...(ui.emailPreviewModal?.overrides || {}),
      email_template: templateChoice.value,
    })
    subject.value = res?.subject || ''
    html.value = res?.html || ''
  } catch (err) {
    toast(err.message || 'Failed to render preview.', 'bad')
  } finally {
    loading.value = false
  }
}

watch(
  () => ui.emailPreviewModal,
  (modal) => {
    if (!modal) return
    templateChoice.value = modal.overrides?.email_template || store.settings.email_template || 'nest'
    const cName = modal.clientName || ''
    const rule = store.reminderRules.find((r) => r.client_name === cName)
    toEmails.value = rule?.to_emails || store.user?.email || 'info@nsd-eg.com'
    refreshPreview()
  },
)

watch(templateChoice, () => {
  if (ui.emailPreviewModal) refreshPreview()
})

async function sendNow(isTest = true) {
  const cSub =
    ui.emailPreviewModal?.clientSubscription || store.clientSubscriptions[0]?.name || ''
  if (!cSub) return
  sending.value = true
  try {
    await sendReminderNowAction({
      client_subscription: cSub,
      to_emails: toEmails.value,
      is_test: isTest ? 1 : 0,
    })
    toast(isTest ? '[TEST] email dispatched!' : 'Renewal reminder sent!', 'ok')
    if (!isTest) closeEmailPreviewSheet()
  } catch (err) {
    toast(err.message || 'Could not send email.', 'bad')
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <Sheet
    :open="Boolean(ui.emailPreviewModal)"
    title="Renewal Email Preview"
    :subtitle="subject || 'Branded HTML renewal notice'"
    max-width="max-w-xl"
    @close="closeEmailPreviewSheet"
  >
    <div class="space-y-3.5">
      <!-- Template Switcher -->
      <div class="seg-wrap">
        <button
          v-for="tpl in [
            { id: 'nest', label: 'Nest Executive' },
            { id: 'modern', label: 'Modern Coral' },
            { id: 'minimal', label: 'Minimal Clean' },
          ]"
          :key="tpl.id"
          type="button"
          class="seg-btn"
          :class="{ 'seg-btn-active': templateChoice === tpl.id }"
          @click="templateChoice = tpl.id"
        >
          {{ tpl.label }}
        </button>
      </div>

      <!--Rendered Email Frame -->
      <div
        class="overflow-hidden rounded-2xl border border-line bg-[#F5F6F8]"
        style="min-height: 290px"
      >
        <div v-if="loading" class="flex h-64 items-center justify-center text-sm text-ink-mute">
          Rendering HTML template…
        </div>
        <div v-else v-html="html" />
      </div>

      <!-- Recipient Input -->
      <div class="field-wrap">
        <label class="field-label">Recipient Email(s)</label>
        <div class="field-box">
          <input
            v-model="toEmails"
            type="email"
            multiple
            class="field-input text-[0.875rem]"
            placeholder="client@company.com"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex gap-2.5">
        <button
          type="button"
          class="btn-soft flex-1"
          :disabled="sending"
          @click="sendNow(true)"
        >
          Send [TEST]
        </button>
        <button
          type="button"
          class="btn-primary flex-1"
          :disabled="sending"
          @click="sendNow(false)"
        >
          Send Live Reminder
        </button>
      </div>
    </template>
  </Sheet>
</template>

