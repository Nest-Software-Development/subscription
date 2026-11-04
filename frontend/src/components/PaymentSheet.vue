<script setup>
import { computed, reactive, ref, watch } from 'vue'
import Sheet from './Sheet.vue'
import { advanceCycleDate, convertCurrency, fmtDate, fmtMoney, todayIso } from '@/lib/format'
import { recordPaymentAction, store } from '@/lib/store'
import { closePaymentSheet, toast, ui } from '@/lib/ui'

const saving = ref(false)
const form = reactive({
  reference_kind: 'client',
  direction: 'in',
  client_subscription: '',
  vendor_subscription: '',
  wallet: '',
  transaction_date: todayIso(),
  party: '',
  service: '',
  amount: '',
  currency: 'USD',
  exchange_rate: 56.25,
  advance_due_date: true,
  notes: '',
})

const activeWallets = computed(() => store.wallets.filter((w) => !w.archived))
const selectedWallet = computed(() => activeWallets.value.find((w) => w.name === form.wallet))

const subRecord = computed(() => {
  if (form.reference_kind === 'client') {
    return store.clientSubscriptions.find((c) => c.name === form.client_subscription)
  }
  if (form.reference_kind === 'vendor') {
    return store.vendorSubscriptions.find((v) => v.name === form.vendor_subscription)
  }
  return null
})

const convertedWalletAmount = computed(() => {
  const wCur = selectedWallet.value?.currency || form.currency
  return convertCurrency(form.amount, form.currency, wCur, form.exchange_rate)
})

const previewNextDue = computed(() => {
  if (!subRecord.value || !form.advance_due_date) return ''
  return advanceCycleDate(subRecord.value.next_due_date, subRecord.value.billing_cycle)
})

watch(
  () => ui.paymentModal,
  (modal) => {
    if (!modal) return
    form.exchange_rate = store.kpis.usd_egp_rate || 56.25
    form.transaction_date = todayIso()
    form.wallet = modal.wallet || activeWallets.value[0]?.name || ''
    form.notes = ''

    if (modal.kind === 'client' && modal.item) {
      const c = modal.item
      form.reference_kind = 'client'
      form.direction = 'in'
      form.client_subscription = c.name
      form.vendor_subscription = ''
      form.party = c.client_name
      form.service = c.service
      form.amount = c.amount
      form.currency = c.currency
      form.advance_due_date = true
    } else if (modal.kind === 'vendor' && modal.item) {
      const v = modal.item
      form.reference_kind = 'vendor'
      form.direction = 'out'
      form.vendor_subscription = v.name
      form.client_subscription = ''
      form.party = v.vendor_name
      form.service = v.service
      form.amount = v.amount
      form.currency = v.currency
      form.advance_due_date = true
    } else {
      form.reference_kind = 'manual'
      form.direction = modal.direction || 'in'
      form.client_subscription = ''
      form.vendor_subscription = ''
      form.party = ''
      form.service = ''
      form.amount = ''
      form.currency = selectedWallet.value?.currency || 'EGP'
      form.advance_due_date = false
    }
  },
)

const sheetTitle = computed(() => {
  if (form.reference_kind === 'client') return 'Record Client Collection'
  if (form.reference_kind === 'vendor') return 'Record Vendor Payment'
  return form.direction === 'in' ? 'Manual Wallet Deposit' : 'Manual Wallet Withdrawal'
})

async function submit() {
  if (!form.wallet) {
    toast('Select a target wallet first.', 'bad')
    return
  }
  if (!(Number(form.amount) > 0)) {
    toast('Enter an amount greater than zero.', 'bad')
    return
  }
  saving.value = true
  try {
    const res = await recordPaymentAction({
      ...form,
      amount: Number(form.amount),
      exchange_rate: Number(form.exchange_rate),
      advance_due_date: form.advance_due_date ? 1 : 0,
    })
    closePaymentSheet()
    toast(
      res?.new_due_date
        ? `Payment logged · Next due ${fmtDate(res.new_due_date)}`
        : 'Wallet transaction recorded.',
      'ok',
    )
  } catch (err) {
    toast(err.message || 'Could not record payment.', 'bad')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Sheet
    :open="Boolean(ui.paymentModal)"
    :title="sheetTitle"
    :subtitle="subRecord ? `${form.party} · ${form.service}` : 'Post directly to wallet ledger'"
    @close="closePaymentSheet"
  >
    <div class="space-y-4">
      <!-- Direction switch for Manual Entry -->
      <div v-if="form.reference_kind === 'manual'" class="seg-wrap">
        <button
          type="button"
          class="seg-btn"
          :class="{ 'seg-btn-active': form.direction === 'in' }"
          @click="form.direction = 'in'"
        >
          + Deposit (In)
        </button>
        <button
          type="button"
          class="seg-btn"
          :class="{ 'seg-btn-active': form.direction === 'out' }"
          @click="form.direction = 'out'"
        >
          − Withdrawal (Out)
        </button>
      </div>

      <!-- Target Wallet -->
      <div class="field-wrap">
        <label class="field-label">Bank / Cash Wallet</label>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="w in activeWallets"
            :key="w.name"
            type="button"
            class="flex flex-col items-start rounded-2xl border p-3 text-left transition active:scale-[0.98]"
            :class="
              form.wallet === w.name
                ? 'border-coral-600 bg-coral-50/70 dark:border-coral-400 dark:bg-coral-500/15'
                : 'border-line bg-surface-sunk/40'
            "
            @click="form.wallet = w.name"
          >
            <span class="text-[0.875rem] font-bold text-ink">{{ w.wallet_name }}</span>
            <span class="tabular text-[0.75rem] text-ink-soft">
              {{ fmtMoney(w.current_balance, w.currency) }}
            </span>
          </button>
        </div>
      </div>

      <!-- Manual Party & Service -->
      <div v-if="form.reference_kind === 'manual'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="field-wrap">
          <label class="field-label">Counterparty / Description</label>
          <div class="field-box">
            <input
              v-model="form.party"
              type="text"
              class="field-input"
              placeholder="e.g. Capital Top-Up / Transfer"
            />
          </div>
        </div>
        <div class="field-wrap">
          <label class="field-label">Category / Service (Optional)</label>
          <div class="field-box">
            <input
              v-model="form.service"
              type="text"
              class="field-input"
              placeholder="e.g. Treasury"
            />
          </div>
        </div>
      </div>

      <!-- Amount, Currency & Date -->
      <div class="grid grid-cols-12 gap-2.5">
        <div class="field-wrap col-span-7">
          <label class="field-label">Amount</label>
          <div class="field-box">
            <input
              v-model="form.amount"
              type="number"
              step="0.01"
              inputmode="decimal"
              class="field-input tabular font-semibold"
              placeholder="0.00"
            />
          </div>
        </div>
        <div class="field-wrap col-span-5">
          <label class="field-label">Currency</label>
          <div class="field-box">
            <select v-model="form.currency" class="field-input font-semibold">
              <option value="USD">USD ($)</option>
              <option value="EGP">EGP</option>
            </select>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <div class="field-wrap">
          <label class="field-label">Payment Date</label>
          <div class="field-box">
            <input v-model="form.transaction_date" type="date" class="field-input tabular" />
          </div>
        </div>
        <div class="field-wrap">
          <label class="field-label">FX Rate (1 USD → EGP)</label>
          <div class="field-box">
            <input
              v-model="form.exchange_rate"
              type="number"
              step="0.01"
              inputmode="decimal"
              class="field-input tabular"
            />
          </div>
        </div>
      </div>

      <!-- Live Conversion Banner -->
      <div
        v-if="selectedWallet && selectedWallet.currency !== form.currency && Number(form.amount) > 0"
        class="flex items-center justify-between rounded-2xl border border-line bg-surface-sunk/70 px-3.5 py-2.5 text-[0.8125rem]"
      >
        <span class="text-ink-soft">
          Posted to <strong>{{ selectedWallet.wallet_name }}</strong> ({{ selectedWallet.currency }})
        </span>
        <strong class="tabular text-ink">
          {{ fmtMoney(convertedWalletAmount, selectedWallet.currency, { decimals: 2 }) }}
        </strong>
      </div>

      <!-- Advance Renewal Date Toggle -->
      <label
        v-if="subRecord"
        class="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-line bg-surface-sunk/45 p-3.5"
      >
        <div class="min-w-0">
          <p class="text-[0.875rem] font-semibold text-ink">Advance Next Renewal Date</p>
          <p class="text-[0.75rem] text-ink-soft">
            <span v-if="form.advance_due_date">
              {{ fmtDate(subRecord.next_due_date) }} →
              <strong class="text-ok">{{ fmtDate(previewNextDue) }}</strong>
              ({{ subRecord.billing_cycle }})
            </span>
            <span v-else>Keep current due date ({{ fmtDate(subRecord.next_due_date) }})</span>
          </p>
        </div>
        <input
          v-model="form.advance_due_date"
          type="checkbox"
          class="h-5 w-5 accent-coral-600"
        />
      </label>

      <div class="field-wrap">
        <label class="field-label">Reference / Notes</label>
        <div class="field-box">
          <input
            v-model="form.notes"
            type="text"
            class="field-input"
            placeholder="Bank transfer ref, invoice #, etc."
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex gap-2.5">
        <button type="button" class="btn-outline flex-1" @click="closePaymentSheet">Cancel</button>
        <button
          type="button"
          class="btn-primary flex-[1.5]"
          :disabled="saving"
          @click="submit"
        >
          {{ saving ? 'Recording…' : form.direction === 'in' ? 'Confirm Inflow' : 'Confirm Payment' }}
        </button>
      </div>
    </template>
  </Sheet>
</template>

