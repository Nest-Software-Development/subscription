<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { dueBadge, fmtCompact, fmtDate, fmtMoney, initials } from '@/lib/format'
import { usePullToRefresh } from '@/lib/refresh'
import { pwa } from '@/lib/pwa'
import { displayAmount, refreshWorkspace, store } from '@/lib/store'
import { openNotifPermissionSheet, openPaymentSheet, openSubFormSheet } from '@/lib/ui'

const router = useRouter()
usePullToRefresh(refreshWorkspace)

const cur = computed(() => store.displayCurrency)

const urgentQueue = computed(() => {
  const cRows = store.clientSubscriptions
    .filter((c) => c.status === 'Active' && c.days_until_due <= 45)
    .map((c) => ({
      id: `c-${c.name}`,
      kind: 'client',
      name: c.name,
      party: c.client_name,
      service: c.service,
      amount: c.amount,
      currency: c.currency,
      due: c.next_due_date,
      days: c.days_until_due,
      raw: c,
    }))
  const vRows = store.vendorSubscriptions
    .filter((v) => v.status === 'Active' && v.days_until_due <= 45)
    .map((v) => ({
      id: `v-${v.name}`,
      kind: 'vendor',
      name: v.name,
      party: v.vendor_name,
      service: v.service,
      amount: v.amount,
      currency: v.currency,
      due: v.next_due_date,
      days: v.days_until_due,
      linkedCount: v.linked_clients_count,
      raw: v,
    }))
  return [...cRows, ...vRows].sort((a, b) => a.days - b.days).slice(0, 7)
})

const multiClientVendors = computed(() =>
  store.vendorSubscriptions
    .filter((v) => v.status === 'Active' && v.linked_clients_count >= 1)
    .sort((a, b) => b.linked_clients_count - a.linked_clients_count)
    .slice(0, 4),
)

function openItem(item) {
  router.push(item.kind === 'client' ? `/client/${item.name}` : `/vendor/${item.name}`)
}
</script>

<template>
  <div class="pb-tabbar">
    <AppHeader
      title="Pulse"
      :subtitle="`1 USD = ${store.kpis.usd_egp_rate} EGP · ${store.kpis.active_client_subs} active plans`"
    >
      <template #actions>
        <button
          type="button"
          class="icon-btn bg-coral-600 text-white hover:bg-coral-700 active:bg-coral-700"
          aria-label="New subscription"
          @click="openSubFormSheet({ kind: 'client' })"
        >
          <svg
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </template>
    </AppHeader>

    <main class="mx-auto max-w-5xl space-y-5 px-4 pt-3.5">
      <!-- 1. EXECUTIVE APPLE WALLET-STYLE HERO PASS -->
      <section
        class="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-obsidian-900 via-[#151E32] to-[#0B1220] p-5 text-white shadow-card ring-1 ring-white/10"
      >
        <div
          class="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-coral-500/25 blur-2xl"
        />

        <div class="relative flex items-start justify-between gap-3">
          <div>
            <p class="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-coral-400">
              Net Annual Recurring Profit
            </p>
            <p class="tabular mt-1 text-[2rem] font-extrabold leading-tight tracking-tight">
              {{
                fmtMoney(
                  displayAmount(
                    store.kpis.annual_net_profit_egp,
                    store.kpis.annual_net_profit_usd,
                  ),
                  cur,
                )
              }}
            </p>
          </div>
          <span
            class="tabular inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-[0.78rem] font-bold text-emerald-300 ring-1 ring-emerald-400/30"
          >
            {{ store.kpis.net_margin_pct }}% Margin
          </span>
        </div>

        <!-- 3-Column Metrics Strip -->
        <div class="relative mt-5 grid grid-cols-3 gap-2.5 border-t border-white/10 pt-4">
          <div>
            <p class="text-[0.7rem] text-white/60">Monthly MRR</p>
            <p class="tabular mt-0.5 text-[0.95rem] font-bold text-white">
              {{ fmtCompact(displayAmount(store.kpis.mrr_egp, store.kpis.mrr_usd), cur) }}
            </p>
          </div>
          <div>
            <p class="text-[0.7rem] text-white/60">Annual Revenue</p>
            <p class="tabular mt-0.5 text-[0.95rem] font-bold text-emerald-300">
              {{
                fmtCompact(
                  displayAmount(store.kpis.annual_revenue_egp, store.kpis.annual_revenue_usd),
                  cur,
                )
              }}
            </p>
          </div>
          <div>
            <p class="text-[0.7rem] text-white/60">Vendor Outflow</p>
            <p class="tabular mt-0.5 text-[0.95rem] font-bold text-coral-300">
              {{
                fmtCompact(
                  displayAmount(
                    store.kpis.annual_vendor_cost_egp,
                    store.kpis.annual_vendor_cost_usd,
                  ),
                  cur,
                )
              }}
            </p>
          </div>
        </div>
      </section>

      <!-- 2. CONTEXTUAL NOTIFICATION PERMISSION BANNER -->
      <section
        v-if="!pwa.pushSubscribed"
        class="card flex items-center justify-between gap-3 border-coral-500/30 bg-gradient-to-r from-coral-50/90 to-surface dark:from-coral-500/12 dark:to-surface"
      >
        <div class="flex min-w-0 items-center gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-coral-600 text-white"
          >
            <svg
              class="h-5 w-5"
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
          <div class="min-w-0">
            <p class="text-[0.875rem] font-bold text-ink">Enable Renewal Push Alerts</p>
            <p class="truncate text-[0.75rem] text-ink-soft">
              Get notified 30, 15, 7 &amp; 1 day before renewals expire
            </p>
          </div>
        </div>
        <button
          type="button"
          class="btn-primary min-h-[38px] shrink-0 px-4 text-[0.8125rem]"
          @click="openNotifPermissionSheet"
        >
          Allow
        </button>
      </section>

      <!-- 3. ACTIONABLE RENEWALS QUEUE (OVERDUE & DUE SOON) -->
      <section class="space-y-2.5">
        <div class="flex items-center justify-between px-0.5">
          <div>
            <h2 class="text-[1rem] font-bold tracking-tight text-ink">
              Upcoming &amp; Urgent Renewals
            </h2>
            <p class="text-[0.75rem] text-ink-mute">
              {{ store.kpis.overdue_count }} overdue · {{ store.kpis.due_30d_count }} due within
              30 days
            </p>
          </div>
          <button
            type="button"
            class="text-[0.8125rem] font-semibold text-coral-600 dark:text-coral-400"
            @click="router.push('/list')"
          >
            See all →
          </button>
        </div>

        <div class="space-y-2.5">
          <div
            v-for="item in urgentQueue"
            :key="item.id"
            class="card flex items-center justify-between gap-3 p-3.5"
          >
            <div
              class="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
              @click="openItem(item)"
            >
              <div
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[0.8rem] font-bold"
                :class="
                  item.kind === 'client'
                    ? 'bg-emerald-500/12 text-ok'
                    : 'bg-coral-500/12 text-coral-600 dark:text-coral-400'
                "
              >
                {{ initials(item.party) }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <p class="truncate text-[0.9rem] font-bold text-ink">{{ item.party }}</p>
                  <span
                    v-if="item.kind === 'vendor'"
                    class="shrink-0 rounded-md bg-surface-sunk px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink-soft"
                  >
                    Vendor
                  </span>
                </div>
                <p class="truncate text-[0.78rem] text-ink-soft">{{ item.service }}</p>
                <div class="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    class="tabular rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                    :class="dueBadge(item.days, 'Active').classes"
                  >
                    {{ dueBadge(item.days, 'Active').label }}
                  </span>
                  <span class="tabular text-[11px] text-ink-mute">{{ fmtDate(item.due) }}</span>
                </div>
              </div>
            </div>

            <div class="flex shrink-0 flex-col items-end gap-1.5">
              <p class="tabular text-[0.92rem] font-extrabold text-ink">
                {{ fmtMoney(item.amount, item.currency) }}
              </p>
              <button
                type="button"
                class="inline-flex min-h-[34px] items-center rounded-full px-3 text-[0.75rem] font-bold transition active:scale-95"
                :class="
                  item.kind === 'client'
                    ? 'bg-ok/12 text-ok'
                    : 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400'
                "
                @click.stop="openPaymentSheet({ kind: item.kind, item: item.raw })"
              >
                {{ item.kind === 'client' ? 'Collect' : 'Pay' }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. MULTI-CLIENT VENDOR INFRASTRUCTURE COVERAGE -->
      <section class="space-y-2.5">
        <div class="flex items-center justify-between px-0.5">
          <div>
            <h2 class="text-[1rem] font-bold tracking-tight text-ink">
              Shared Vendor → Multi-Client Profit
            </h2>
            <p class="text-[0.75rem] text-ink-mute">
              One server/reseller subscription linked across multiple clients
            </p>
          </div>
          <button
            type="button"
            class="text-[0.8125rem] font-semibold text-coral-600 dark:text-coral-400"
            @click="openSubFormSheet({ kind: 'vendor' })"
          >
            + Link Vendor
          </button>
        </div>

        <div class="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          <div
            v-for="v in multiClientVendors"
            :key="v.name"
            class="card-pressable space-y-2.5 p-4"
            @click="router.push(`/vendor/${v.name}`)"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="truncate text-[0.92rem] font-bold text-ink">
                  {{ v.vendor_name }} · {{ v.service }}
                </p>
                <p class="text-[0.75rem] text-ink-soft">
                  {{ v.allocation_mode }} · Cost
                  <strong class="tabular text-ink">{{ fmtMoney(v.amount, v.currency) }}</strong>
                  / {{ v.billing_cycle }}
                </p>
              </div>
              <span
                class="shrink-0 rounded-full bg-coral-50 px-2.5 py-1 text-[0.72rem] font-bold text-coral-600 dark:bg-coral-500/15 dark:text-coral-400"
              >
                {{ v.linked_clients_count }}
                {{ v.linked_clients_count === 1 ? 'Client' : 'Clients' }}
              </span>
            </div>

            <!-- Linked Client Chips -->
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="link in v.linked_subscriptions"
                :key="link.client_subscription"
                class="inline-flex items-center gap-1 rounded-lg bg-surface-sunk px-2 py-1 text-[0.72rem] font-medium text-ink-soft"
              >
                <strong class="text-ink">{{ link.client_name }}</strong>
                <span class="tabular text-ink-mute">({{ link.allocation_weight_pct }}%)</span>
              </span>
            </div>

            <div class="flex items-center justify-between border-t border-line/60 pt-2 text-[0.75rem]">
              <span class="text-ink-mute">Net Annual Contribution</span>
              <strong class="tabular text-ok">
                +{{
                  fmtMoney(
                    displayAmount(v.net_contribution_egp, undefined),
                    cur,
                  )
                }}/yr
              </strong>
            </div>
          </div>
        </div>
      </section>

      <!-- 5. BANK WALLETS STRIP -->
      <section class="space-y-2.5">
        <div class="flex items-center justify-between px-0.5">
          <h2 class="text-[1rem] font-bold tracking-tight text-ink">Bank &amp; Cash Wallets</h2>
          <button
            type="button"
            class="text-[0.8125rem] font-semibold text-coral-600 dark:text-coral-400"
            @click="router.push('/wallets')"
          >
            Ledger &amp; 7 Reports →
          </button>
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div
            v-for="w in store.wallets.filter((x) => !x.archived)"
            :key="w.name"
            class="card-pressable p-4"
            @click="router.push('/wallets')"
          >
            <p class="text-[0.75rem] font-semibold text-ink-mute">{{ w.wallet_name }}</p>
            <p class="tabular mt-1 text-[1.15rem] font-extrabold text-ink">
              {{ fmtMoney(w.current_balance, w.currency) }}
            </p>
            <p class="tabular mt-1 text-[0.7rem] text-ink-soft">
              {{ w.transaction_count }} ledger entries
            </p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

