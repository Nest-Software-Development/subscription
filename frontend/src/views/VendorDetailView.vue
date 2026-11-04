<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { dueBadge, fmtDate, fmtMoney } from '@/lib/format'
import { deleteVendorSub, displayAmount, store } from '@/lib/store'
import { askConfirm, openPaymentSheet, openSubFormSheet, toast } from '@/lib/ui'

const route = useRoute()
const router = useRouter()

const vsub = computed(() =>
  store.vendorSubscriptions.find((v) => v.name === route.params.id),
)

const cur = computed(() => store.displayCurrency)

const historyTxns = computed(() =>
  store.transactions.filter(
    (t) =>
      t.vendor_subscription === route.params.id ||
      (vsub.value && t.party === vsub.value.vendor_name && t.service === vsub.value.service),
  ),
)

async function handleDelete() {
  if (!vsub.value) return
  const ok = await askConfirm({
    title: `Delete ${vsub.value.vendor_name}?`,
    body: `Remove "${vsub.value.service}" from Vendor Subscriptions? Linked client margins will recalculate automatically.`,
    okText: 'Delete Vendor Subscription',
    danger: true,
  })
  if (!ok) return
  await deleteVendorSub(vsub.value.name)
  toast('Vendor subscription deleted.', 'info')
  router.replace('/list?tab=vendor')
}
</script>

<template>
  <div class="pb-12">
    <AppHeader
      :title="vsub ? vsub.vendor_name : 'Vendor Subscription'"
      :subtitle="vsub ? vsub.service : ''"
      back-to="/list?tab=vendor"
    >
      <template #actions>
        <button
          v-if="vsub"
          type="button"
          class="btn-outline min-h-[36px] px-3 text-[0.8rem]"
          @click="openSubFormSheet({ kind: 'vendor', item: vsub })"
        >
          Edit &amp; Link
        </button>
      </template>
    </AppHeader>

    <main v-if="vsub" class="mx-auto max-w-3xl space-y-4 px-4 pt-4">
      <!-- Hero Vendor Card -->
      <section class="card space-y-4 p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <span
              class="tabular inline-flex rounded-full border px-2.5 py-0.5 text-[0.75rem] font-bold"
              :class="dueBadge(vsub.days_until_due, vsub.status).classes"
            >
              {{ dueBadge(vsub.days_until_due, vsub.status).label }}
            </span>
            <h2 class="mt-2 text-xl font-extrabold text-ink">{{ vsub.service }}</h2>
            <p class="text-[0.85rem] text-ink-soft">
              Vendor: <strong class="text-ink">{{ vsub.vendor_name }}</strong> · Due
              <strong class="tabular text-ink">{{ fmtDate(vsub.next_due_date) }}</strong>
            </p>
          </div>
          <div class="text-right">
            <p class="tabular text-2xl font-extrabold text-coral-600 dark:text-coral-400">
              {{ fmtMoney(vsub.amount, vsub.currency) }}
            </p>
            <p class="text-xs font-semibold text-ink-mute">{{ vsub.billing_cycle }}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            class="btn-primary"
            @click="openPaymentSheet({ kind: 'vendor', item: vsub })"
          >
            Pay Vendor Renewal
          </button>
          <button
            type="button"
            class="btn-soft"
            @click="openSubFormSheet({ kind: 'vendor', item: vsub })"
          >
            Link Clients ({{ vsub.linked_clients_count }})
          </button>
        </div>
      </section>

      <!-- MULTI-CLIENT LINK & COST ALLOCATION MATRIX -->
      <section class="card space-y-3.5 p-5">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h3 class="text-[0.95rem] font-bold text-ink">
              Multi-Client Cost Allocation ({{ vsub.linked_clients_count }})
            </h3>
            <p class="text-[0.75rem] text-ink-soft">
              Strategy: <strong class="text-ink">{{ vsub.allocation_mode }}</strong>
            </p>
          </div>
          <span
            class="rounded-full px-2.5 py-1 text-[0.74rem] font-bold"
            :class="
              vsub.is_unlinked_overhead
                ? 'bg-warn/15 text-warn'
                : 'bg-ok/12 text-ok'
            "
          >
            {{ vsub.is_unlinked_overhead ? 'Unlinked Overhead' : 'Covered by Clients' }}
          </span>
        </div>

        <div class="grid grid-cols-3 gap-2 rounded-2xl bg-surface-sunk/70 p-3">
          <div>
            <p class="text-[0.7rem] text-ink-mute">Annual Cost</p>
            <p class="tabular text-[0.92rem] font-bold text-coral-600 dark:text-coral-400">
              {{ fmtMoney(displayAmount(vsub.annualized_egp, vsub.annualized_usd), cur) }}
            </p>
          </div>
          <div>
            <p class="text-[0.7rem] text-ink-mute">Linked Revenue</p>
            <p class="tabular text-[0.92rem] font-bold text-ink">
              {{ fmtMoney(displayAmount(vsub.linked_revenue_egp, undefined), cur) }}
            </p>
          </div>
          <div>
            <p class="text-[0.7rem] text-ink-mute">Net Contribution</p>
            <p
              class="tabular text-[0.92rem] font-bold"
              :class="vsub.net_contribution_egp >= 0 ? 'text-ok' : 'text-bad'"
            >
              {{ fmtMoney(displayAmount(vsub.net_contribution_egp, undefined), cur) }}
            </p>
          </div>
        </div>

        <div v-if="vsub.linked_subscriptions?.length" class="space-y-2">
          <div
            v-for="link in vsub.linked_subscriptions"
            :key="link.client_subscription"
            class="flex cursor-pointer items-center justify-between rounded-xl border border-line p-3 transition hover:bg-surface-sunk/50"
            @click="router.push(`/client/${link.client_subscription}`)"
          >
            <div class="min-w-0">
              <p class="truncate text-[0.875rem] font-bold text-ink">
                {{ link.client_name }}
              </p>
              <p class="truncate text-[0.75rem] text-ink-soft">
                {{ link.service }} · {{ link.allocation_weight_pct }}% cost share
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p class="tabular text-[0.85rem] font-bold text-ink">
                {{
                  fmtMoney(
                    displayAmount(link.allocated_annual_egp, link.allocated_annual_usd),
                    cur,
                  )
                }}/yr
              </p>
              <p class="text-[0.7rem] text-coral-600 dark:text-coral-400">View client →</p>
            </div>
          </div>
        </div>
        <div
          v-else
          class="rounded-xl border border-dashed border-line p-4 text-center text-[0.8125rem] text-ink-soft"
        >
          No client subscriptions linked yet — treated as general company overhead. Tap
          <strong>Link Clients</strong> above to split this cost across 1 or more clients.
        </div>
      </section>

      <!-- Outflow History -->
      <section class="card space-y-3 p-5">
        <h3 class="text-[0.95rem] font-bold text-ink">
          Vendor Outflow History ({{ historyTxns.length }})
        </h3>
        <p v-if="!historyTxns.length" class="text-[0.8125rem] text-ink-mute">
          No payments recorded yet for this vendor subscription.
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
            <p class="tabular font-bold text-coral-600 dark:text-coral-400">
              −{{ fmtMoney(t.amount, t.currency) }}
            </p>
          </div>
        </div>
      </section>

      <button type="button" class="btn-danger w-full" @click="handleDelete">
        Delete Vendor Subscription
      </button>
    </main>
  </div>
</template>

