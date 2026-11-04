<script setup>
import { computed, reactive, ref, watch } from 'vue'
import Sheet from './Sheet.vue'
import { annualize, fmtMoney, toEgp, todayIso, toUsd } from '@/lib/format'
import { saveClientSub, saveVendorSub, store } from '@/lib/store'
import { closeSubFormSheet, toast, ui } from '@/lib/ui'

const saving = ref(false)
const linkSearch = ref('')

const form = reactive({
  kind: 'client', // 'client' | 'vendor'
  name: '',
  party: '',
  service: '',
  billing_cycle: 'Annual',
  currency: 'USD',
  amount: '',
  next_due_date: todayIso(),
  status: 'Active',
  allocation_mode: 'Equal Split',
  selectedClientIds: [],
  customWeights: {},
  notes: '',
})

watch(
  () => ui.subFormModal,
  (modal) => {
    if (!modal) return
    linkSearch.value = ''
    const item = modal.item || null
    form.kind = modal.kind || 'client'
    form.name = item?.name || ''
    form.party =
      form.kind === 'client' ? item?.client_name || '' : item?.vendor_name || ''
    form.service = item?.service || ''
    form.billing_cycle = item?.billing_cycle || 'Annual'
    form.currency = item?.currency || 'USD'
    form.amount = item?.amount ?? ''
    form.next_due_date = item?.next_due_date || todayIso()
    form.status = item?.status || 'Active'
    form.allocation_mode = item?.allocation_mode || 'Equal Split'
    form.notes = item?.notes || ''

    if (form.kind === 'vendor' && item?.linked_subscriptions) {
      form.selectedClientIds = item.linked_subscriptions.map((l) => l.client_subscription)
      const wMap = {}
      item.linked_subscriptions.forEach((l) => {
        wMap[l.client_subscription] = Number(l.allocation_weight_pct || 0)
      })
      form.customWeights = wMap
    } else if (form.kind === 'vendor' && modal.prelinkClientId) {
      form.selectedClientIds = [modal.prelinkClientId]
      form.customWeights = { [modal.prelinkClientId]: 100 }
    } else {
      form.selectedClientIds = []
      form.customWeights = {}
    }
  },
)

const filteredClients = computed(() => {
  const q = linkSearch.value.trim().toLowerCase()
  return store.clientSubscriptions.filter((c) => {
    if (!q) return true
    return (
      c.client_name.toLowerCase().includes(q) ||
      c.service.toLowerCase().includes(q)
    )
  })
})

function toggleClientLink(cName) {
  const idx = form.selectedClientIds.indexOf(cName)
  if (idx >= 0) {
    form.selectedClientIds.splice(idx, 1)
  } else {
    form.selectedClientIds.push(cName)
    if (!form.customWeights[cName]) {
      form.customWeights[cName] = Number((100 / form.selectedClientIds.length).toFixed(1))
    }
  }
}

const vendorAnnualPreview = computed(() => {
  const rate = store.kpis.usd_egp_rate || 56.25
  const annNative = annualize(form.amount, form.billing_cycle)
  const annEgp = toEgp(annNative, form.currency, rate)
  const annUsd = toUsd(annNative, form.currency, rate)
  const n = form.selectedClientIds.length
  const perClientUsd = n > 0 ? annUsd / n : 0
  return { annEgp, annUsd, count: n, perClientUsd }
})

async function submit() {
  if (!form.party.trim() || !form.service.trim()) {
    toast('Enter both Party Name and Service.', 'bad')
    return
  }
  if (!(Number(form.amount) >= 0)) {
    toast('Enter a valid subscription amount.', 'bad')
    return
  }

  saving.value = true
  try {
    if (form.kind === 'client') {
      await saveClientSub({
        name: form.name || undefined,
        client_name: form.party.trim(),
        service: form.service.trim(),
        billing_cycle: form.billing_cycle,
        currency: form.currency,
        amount: Number(form.amount),
        next_due_date: form.next_due_date,
        status: form.status,
        notes: form.notes,
      })
      toast(form.name ? 'Client subscription updated.' : 'Client subscription created.', 'ok')
    } else {
      const links = form.selectedClientIds.map((id) => ({
        client_subscription: id,
        allocation_weight_pct:
          form.allocation_mode === 'Custom Percentage'
            ? Number(form.customWeights[id] || 0)
            : Number((100 / Math.max(1, form.selectedClientIds.length)).toFixed(2)),
      }))
      await saveVendorSub({
        name: form.name || undefined,
        vendor_name: form.party.trim(),
        service: form.service.trim(),
        billing_cycle: form.billing_cycle,
        currency: form.currency,
        amount: Number(form.amount),
        next_due_date: form.next_due_date,
        status: form.status,
        allocation_mode: form.allocation_mode,
        linked_subscriptions: links,
        notes: form.notes,
      })
      toast(
        form.name ? 'Vendor subscription & links updated.' : 'Vendor subscription created.',
        'ok',
      )
    }
    closeSubFormSheet()
  } catch (err) {
    toast(err.message || 'Save failed.', 'bad')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Sheet
    :open="Boolean(ui.subFormModal)"
    :title="
      form.name
        ? `Edit ${form.kind === 'client' ? 'Client' : 'Vendor'} Subscription`
        : `New ${form.kind === 'client' ? 'Client' : 'Vendor'} Subscription`
    "
    :subtitle="
      form.kind === 'vendor'
        ? 'Link one vendor server/license to multiple client subscriptions'
        : 'Recurring client billing & renewal schedule'
    "
    max-width="max-w-xl"
    @close="closeSubFormSheet"
  >
    <div class="space-y-4">
      <!-- Switcher when creating new -->
      <div v-if="!form.name" class="seg-wrap">
        <button
          type="button"
          class="seg-btn"
          :class="{ 'seg-btn-active': form.kind === 'client' }"
          @click="form.kind = 'client'"
        >
          Client Inflow
        </button>
        <button
          type="button"
          class="seg-btn"
          :class="{ 'seg-btn-active': form.kind === 'vendor' }"
          @click="form.kind = 'vendor'"
        >
          Vendor Outflow ("My Payments")
        </button>
      </div>

      <!-- Party & Service -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="field-wrap">
          <label class="field-label">
            {{ form.kind === 'client' ? 'Client Name' : 'Vendor / Provider' }}
          </label>
          <div class="field-box">
            <input
              v-model="form.party"
              type="text"
              class="field-input"
              :placeholder="form.kind === 'client' ? 'e.g. Cwater / Kayan' : 'e.g. Contabo / Verpex'"
            />
          </div>
        </div>
        <div class="field-wrap">
          <label class="field-label">Service / Plan</label>
          <div class="field-box">
            <input
              v-model="form.service"
              type="text"
              class="field-input"
              :placeholder="form.kind === 'client' ? 'Cloud Server ERP' : 'VPS / Pro Reseller'"
            />
          </div>
        </div>
      </div>

      <!-- Amount, Currency, Cycle -->
      <div class="grid grid-cols-12 gap-2.5">
        <div class="field-wrap col-span-5">
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
        <div class="field-wrap col-span-3">
          <label class="field-label">Currency</label>
          <div class="field-box px-2.5">
            <select v-model="form.currency" class="field-input font-semibold">
              <option value="USD">USD</option>
              <option value="EGP">EGP</option>
            </select>
          </div>
        </div>
        <div class="field-wrap col-span-4">
          <label class="field-label">Cycle</label>
          <div class="field-box px-2.5">
            <select v-model="form.billing_cycle" class="field-input">
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Annual">Annual</option>
              <option value="Biennial">Biennial</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Due Date & Status -->
      <div class="grid grid-cols-2 gap-2.5">
        <div class="field-wrap">
          <label class="field-label">Next Renewal Date</label>
          <div class="field-box">
            <input v-model="form.next_due_date" type="date" class="field-input tabular" />
          </div>
        </div>
        <div class="field-wrap">
          <label class="field-label">Status</label>
          <div class="field-box">
            <select v-model="form.status" class="field-input">
              <option value="Active">Active</option>
              <option value="Paused">Paused</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <!-- MULTI-CLIENT VENDOR COST ALLOCATION MATRIX -->
      <div
        v-if="form.kind === 'vendor'"
        class="rounded-2xl border border-line bg-surface-sunk/45 p-3.5 space-y-3"
      >
        <div class="flex items-center justify-between gap-2">
          <div>
            <p class="text-[0.875rem] font-bold text-ink">
              Linked Client Subscriptions ({{ form.selectedClientIds.length }})
            </p>
            <p class="text-[0.75rem] text-ink-soft">
              Allocate this vendor cost across 1 or many client subscriptions
            </p>
          </div>
          <span
            v-if="form.selectedClientIds.length > 0 && Number(form.amount) > 0"
            class="tabular rounded-full bg-coral-50 px-2.5 py-1 text-[0.72rem] font-bold text-coral-600 dark:bg-coral-500/15 dark:text-coral-400"
          >
            ~{{ fmtMoney(vendorAnnualPreview.perClientUsd, 'USD', { decimals: 1 }) }}/yr each
          </span>
        </div>

        <div class="field-wrap">
          <label class="field-label">Cost Allocation Strategy</label>
          <div class="field-box bg-surface">
            <select v-model="form.allocation_mode" class="field-input text-[0.875rem]">
              <option value="Equal Split">Equal Split (Annual Cost ÷ N Clients)</option>
              <option value="Revenue Proportional">Revenue Proportional (By Client Revenue)</option>
              <option value="Custom Percentage">Custom Percentage (%)</option>
            </select>
          </div>
        </div>

        <div class="field-box bg-surface min-h-[42px]">
          <input
            v-model="linkSearch"
            type="search"
            class="field-input py-1.5 text-[0.875rem]"
            placeholder="Search client or service to link…"
          />
        </div>

        <div class="max-h-48 space-y-1.5 overflow-y-auto pr-1">
          <div
            v-for="c in filteredClients"
            :key="c.name"
            class="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition"
            :class="
              form.selectedClientIds.includes(c.name)
                ? 'border-coral-600/60 bg-surface shadow-xs dark:border-coral-400/60'
                : 'border-transparent bg-surface/60 hover:bg-surface'
            "
          >
            <label class="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                class="h-4 w-4 shrink-0 accent-coral-600"
                :checked="form.selectedClientIds.includes(c.name)"
                @change="toggleClientLink(c.name)"
              />
              <span class="min-w-0">
                <span class="block truncate text-[0.84rem] font-semibold text-ink">
                  {{ c.client_name }}
                </span>
                <span class="block truncate text-[0.73rem] text-ink-soft">
                  {{ c.service }} · {{ fmtMoney(c.amount, c.currency) }} ({{ c.billing_cycle }})
                </span>
              </span>
            </label>

            <div
              v-if="
                form.allocation_mode === 'Custom Percentage' &&
                form.selectedClientIds.includes(c.name)
              "
              class="flex w-20 items-center gap-1"
            >
              <input
                v-model="form.customWeights[c.name]"
                type="number"
                min="0"
                max="100"
                step="1"
                class="w-full rounded-lg border border-line bg-surface-sunk px-2 py-1 text-right text-[0.8rem] font-bold tabular"
              />
              <span class="text-[0.75rem] text-ink-mute">%</span>
            </div>
          </div>
        </div>
      </div>

      <div class="field-wrap">
        <label class="field-label">Notes</label>
        <div class="field-box">
          <input
            v-model="form.notes"
            type="text"
            class="field-input"
            placeholder="Server IP, billing contact, or contract terms…"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex gap-2.5">
        <button type="button" class="btn-outline flex-1" @click="closeSubFormSheet">Cancel</button>
        <button type="button" class="btn-primary flex-[1.5]" :disabled="saving" @click="submit">
          {{ saving ? 'Saving…' : form.name ? 'Save Changes' : 'Create Subscription' }}
        </button>
      </div>
    </template>
  </Sheet>
</template>

