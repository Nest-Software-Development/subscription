<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { dueBadge, fmtDate, fmtMoney } from '@/lib/format'
import { deleteClientSub, displayAmount, store } from '@/lib/store'
import {
  askConfirm,
  openEmailPreviewSheet,
  openPaymentSheet,
  openSubFormSheet,
  toast,
} from '@/lib/ui'

const route = useRoute()
const router = useRouter()

const sub = computed(() =>
  store.clientSubscriptions.find((c) => c.name === route.params.id),
)

const cur = computed(() => store.displayCurrency)

const historyTxns = computed(() =>
  store.transactions.filter(
    (t) =>
      t.client_subscription === route.params.id ||
      (sub.value && t.party === sub.value.client_name && t.service === sub.value.service),
  ),
)

async function handleDelete() {
  if (!sub.value) return
  const ok = await askConfirm({
    title: `Delete ${sub.value.client_name}?`,
    body: `Remove "${sub.value.service}" from Client Subscriptions? Linked vendor shares will automatically rebalance.`,
    okText: 'Delete Subscription',
    danger: true,
  })
  if (!ok) return
  await deleteClientSub(sub.value.name)
  toast('Client subscription deleted.', 'info')
  router.replace('/list')
}
</script>

<template>
  <div class="pb-12">
    <AppHeader
      :title="sub ? sub.client_name : 'Client Subscription'"
      :subtitle="sub ? sub.service : ''"
      back-to="/list"
    >
      <template #actions>
        <button
          v-if="sub"
          type="button"
          class="btn-outline min-h-[36px] px-3 text-[0.8rem]"
          @click="openSubFormSheet({ kind: 'client', item: sub })"
        >
          Edit
        </button>
      </template>
    </AppHeader>

    <main v-if="sub" class="mx-auto max-w-3xl space-y-4 px-4 pt-4">
      <!-- Hero Summary Card -->
      <section class="card space-y-4 p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <span
              class="tabular inline-flex rounded-full border px-2.5 py-0.5 text-[0.75rem] font-bold"
              :class="dueBadge(sub.days_until_due, sub.status).classes"
            >
              {{ dueBadge(sub.days_until_due, sub.status).label }}
            </span>
            <h2 class="mt-2 text-xl font-extrabold text-ink">{{ sub.service }}</h2>
            <p class="text-[0.85rem] text-ink-soft">
              Client: <strong class="text-ink">{{ sub.client_name }}</strong> · Next Renewal
              <strong class="tabular text-ink">{{ fmtDate(sub.next_due_date) }}</strong>
            </p>
          </div>
          <div class="text-right">
            <p class="tabular text-2xl font-extrabold text-ink">
              {{ fmtMoney(sub.amount, sub.currency) }}
            </p>
            <p class="text-xs font-semibold text-ink-mute">{{ sub.billing_cycle }}</p>
          </div>
        </div>

        <!-- Primary Action Buttons -->
        <div class="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            class="btn-primary"
            @click="openPaymentSheet({ kind: 'client', item: sub })"
          >
            Record Collection
          </button>
          <button
            type="button"
            class="btn-soft"
            @click="
              openEmailPreviewSheet({
                clientSubscription: sub.name,
                clientName: sub.client_name,
              })
            "
          >
            Email Reminder
          </button>
        </div>
      </section>

      <!-- Unit Economics & Linked Vendor Infrastructure Breakdown -->
      <section class="card space-y-3.5 p-5">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-[0.95rem] font-bold text-ink">
              Unit Economics &amp; Linked Vendor Costs
            </h3>
            <p class="text-[0.75rem] text-ink-soft">
              Net profitability after allocated server/domain shares
            </p>
          </div>
          <span
            class="tabular rounded-full bg-ok/12 px-2.5 py-1 text-[0.78rem] font-extrabold text-ok"
          >
            {{ sub.profit_margin_pct }}% Net Margin
          </span>
        </div>

        <div class="grid grid-cols-3 gap-2 rounded-2xl bg-surface-sunk/70 p-3">
          <div>
            <p class="text-[0.7rem] text-ink-mute">Annual Revenue</p>
            <p class="tabular text-[0.92rem] font-bold text-ink">
              {{ fmtMoney(displayAmount(sub.annualized_egp, sub.annualized_usd), cur) }}
            </p>
          </div>
          <div>
            <p class="text-[0.7rem] text-ink-mute">Vendor Share</p>
            <p class="tabular text-[0.92rem] font-bold text-coral-600 dark:text-coral-400">
              {{ fmtMoney(displayAmount(sub.allocated_vendor_cost_egp, undefined), cur) }}
            </p>
          </div>
          <div>
            <p class="text-[0.7rem] text-ink-mute">Net Profit</p>
            <p class="tabular text-[0.92rem] font-bold text-ok">
              {{ fmtMoney(displayAmount(sub.annual_profit_egp, undefined), cur) }}
            </p>
          </div>
        </div>

        <!-- Linked Vendor Subscriptions -->
        <div v-if="sub.vendor_cost_links?.length" class="space-y-2">
          <p class="text-[0.78rem] font-semibold text-ink-soft">
            Allocated from {{ sub.vendor_cost_links.length }} Vendor
            {{ sub.vendor_cost_links.length > 1 ? 'Subscriptions' : 'Subscription' }}:
          </p>
          <div
            v-for="vlink in sub.vendor_cost_links"
            :key="vlink.vendor_subscription"
            class="flex cursor-pointer items-center justify-between rounded-xl border border-line p-3 transition hover:bg-surface-sunk/50"
            @click="router.push(`/vendor/${vlink.vendor_subscription}`)"
          >
            <div class="min-w-0">
              <p class="truncate text-[0.85rem] font-bold text-ink">
                {{ vlink.vendor_name }} · {{ vlink.vendor_service }}
              </p>
              <p class="text-[0.73rem] text-ink-mute">
                {{ vlink.allocation_mode }} · {{ vlink.allocation_weight_pct }}% share
              </p>
            </div>
            <p class="tabular text-[0.85rem] font-bold text-coral-600 dark:text-coral-400">
              −{{
                fmtMoney(
                  displayAmount(vlink.allocated_annual_egp, vlink.allocated_annual_usd),
                  cur,
                )
              }}/yr
            </p>
          </div>
        </div>

        <button
          type="button"
          class="btn-outline w-full text-[0.8125rem]"
          @click="openSubFormSheet({ kind: 'vendor', prelinkClientId: sub.name })"
        >
          + Link New Vendor Cost to {{ sub.client_name }}
        </button>
      </section>

      <!-- Notes -->
      <section v-if="sub.notes" class="card p-4">
        <p class="text-xs font-bold uppercase tracking-wider text-ink-mute">Notes</p>
        <p class="mt-1 text-sm text-ink-soft">{{ sub.notes }}</p>
      </section>

      <!-- Collection History -->
      <section class="card space-y-3 p-5">
        <h3 class="text-[0.95rem] font-bold text-ink">
          Payment &amp; Collection History ({{ historyTxns.length }})
        </h3>
        <p v-if="!historyTxns.length" class="text-[0.8125rem] text-ink-mute">
          No ledger payments recorded yet for this subscription.
        </p>
        <div v-else class="divide-y divide-line/60">
          <div
            v-for="t in historyTxns"
            :key="t.name"
            class="flex items-center justify-between py-2.5 text-[0.85rem]"
          >
            <div>
              <p class="font-semibold text-ink">{{ fmtDate(t.transaction_date) }}</p>
              <p class="text-[0.74rem] text-ink-mute">Wallet: {{ t.wallet }}</p>
            </div>
            <p class="tabular font-bold text-ok">+{{ fmtMoney(t.amount, t.currency) }}</p>
          </div>
        </div>
      </section>

      <button type="button" class="btn-danger w-full" @click="handleDelete">
        Delete Client Subscription
      </button>
    </main>
  </div>
</template>

