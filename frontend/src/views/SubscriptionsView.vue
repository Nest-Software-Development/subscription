<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { dueBadge, fmtDate, fmtMoney, initials } from '@/lib/format'
import { usePullToRefresh } from '@/lib/refresh'
import { displayAmount, refreshWorkspace, store } from '@/lib/store'
import { openPaymentSheet, openSubFormSheet } from '@/lib/ui'

const route = useRoute()
const router = useRouter()
usePullToRefresh(refreshWorkspace)

const activeKind = ref(route.query.tab === 'vendor' ? 'vendor' : 'client')
const search = ref('')
const activeFilter = ref('all')

const filterChips = computed(() => {
  const base = [
    { id: 'all', label: 'All' },
    { id: 'urgent', label: 'Due ≤ 30d' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'USD', label: 'USD ($)' },
    { id: 'EGP', label: 'EGP' },
  ]
  if (activeKind.value === 'vendor') {
    base.splice(3, 0, { id: 'multi', label: 'Multi-Client (2+)' }, { id: 'unlinked', label: 'Unlinked' })
  } else {
    base.splice(3, 0, { id: 'Monthly', label: 'Monthly' }, { id: 'Annual', label: 'Annual' })
  }
  return base
})

const filteredList = computed(() => {
  const q = search.value.trim().toLowerCase()
  const src =
    activeKind.value === 'client' ? store.clientSubscriptions : store.vendorSubscriptions

  return src.filter((item) => {
    const party = item.client_name || item.vendor_name || ''
    if (
      q &&
      !party.toLowerCase().includes(q) &&
      !String(item.service || '').toLowerCase().includes(q) &&
      !String(item.notes || '').toLowerCase().includes(q)
    ) {
      return false
    }
    const f = activeFilter.value
    if (f === 'urgent') return item.status === 'Active' && item.days_until_due <= 30
    if (f === 'overdue') return item.status === 'Active' && item.days_until_due < 0
    if (f === 'USD' || f === 'EGP') return item.currency === f
    if (f === 'Monthly' || f === 'Annual') return item.billing_cycle === f
    if (f === 'multi') return Number(item.linked_clients_count || 0) >= 2
    if (f === 'unlinked') return Number(item.linked_clients_count || 0) === 0
    return true
  })
})

function switchKind(k) {
  activeKind.value = k
  activeFilter.value = 'all'
}
</script>

<template>
  <div class="pb-tabbar">
    <AppHeader
      title="Subscriptions"
      :subtitle="`${store.clientSubscriptions.length} Client · ${store.vendorSubscriptions.length} Vendor`"
    >
      <template #actions>
        <button
          type="button"
          class="btn-primary min-h-[38px] px-3.5 text-[0.8125rem]"
          @click="openSubFormSheet({ kind: activeKind })"
        >
          + New
        </button>
      </template>
    </AppHeader>

    <main class="mx-auto max-w-5xl space-y-3.5 px-4 pt-3.5">
      <!-- Segmented Switcher: Client Inflows vs Vendor Outflows -->
      <div class="seg-wrap">
        <button
          type="button"
          class="seg-btn"
          :class="{ 'seg-btn-active': activeKind === 'client' }"
          @click="switchKind('client')"
        >
          Client Inflows ({{ store.clientSubscriptions.length }})
        </button>
        <button
          type="button"
          class="seg-btn"
          :class="{ 'seg-btn-active': activeKind === 'vendor' }"
          @click="switchKind('vendor')"
        >
          My Vendor Payments ({{ store.vendorSubscriptions.length }})
        </button>
      </div>

      <!-- Search Input -->
      <div class="field-box bg-surface shadow-xs">
        <svg
          class="h-4 w-4 shrink-0 text-ink-mute"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          v-model="search"
          type="search"
          class="field-input py-2"
          :placeholder="
            activeKind === 'client'
              ? 'Search client, service, or contract…'
              : 'Search Contabo, Verpex, domain, or client…'
          "
        />
      </div>

      <!-- Filter Chips -->
      <div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
        <button
          v-for="chip in filterChips"
          :key="chip.id"
          type="button"
          class="chip"
          :class="{ 'chip-active': activeFilter === chip.id }"
          @click="activeFilter = chip.id"
        >
          {{ chip.label }}
        </button>
      </div>

      <!-- Empty State -->
      <div v-if="!filteredList.length" class="card py-12 text-center">
        <p class="text-[0.95rem] font-bold text-ink">No matching subscriptions</p>
        <p class="mt-1 text-[0.8125rem] text-ink-soft">
          Try clearing filters or add a new {{ activeKind }} subscription.
        </p>
      </div>

      <!-- Subscription Cards -->
      <div class="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        <article
          v-for="item in filteredList"
          :key="item.name"
          class="card-pressable flex flex-col justify-between gap-3 p-4"
          @click="
            router.push(
              activeKind === 'client' ? `/client/${item.name}` : `/vendor/${item.name}`,
            )
          "
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex min-w-0 items-center gap-3">
              <div
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[0.8rem] font-bold"
                :class="
                  activeKind === 'client'
                    ? 'bg-emerald-500/12 text-ok'
                    : 'bg-coral-500/12 text-coral-600 dark:text-coral-400'
                "
              >
                {{ initials(item.client_name || item.vendor_name) }}
              </div>
              <div class="min-w-0">
                <h3 class="truncate text-[0.95rem] font-bold text-ink">
                  {{ item.client_name || item.vendor_name }}
                </h3>
                <p class="truncate text-[0.8rem] text-ink-soft">{{ item.service }}</p>
              </div>
            </div>

            <div class="shrink-0 text-right">
              <p class="tabular text-[1rem] font-extrabold text-ink">
                {{ fmtMoney(item.amount, item.currency) }}
              </p>
              <p class="text-[0.72rem] text-ink-mute">{{ item.billing_cycle }}</p>
            </div>
          </div>

          <!-- Footer Meta Row -->
          <div class="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2.5">
            <div class="flex flex-wrap items-center gap-1.5">
              <span
                class="tabular rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                :class="dueBadge(item.days_until_due, item.status).classes"
              >
                {{ dueBadge(item.days_until_due, item.status).label }}
              </span>
              <span class="tabular text-[0.75rem] text-ink-mute">
                {{ fmtDate(item.next_due_date) }}
              </span>

              <!-- Client Margin Pill OR Vendor Multi-Client Link Pill -->
              <span
                v-if="activeKind === 'client' && item.allocated_vendor_cost_egp > 0"
                class="tabular rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-ok"
              >
                {{ item.profit_margin_pct }}% margin
              </span>
              <span
                v-else-if="activeKind === 'vendor'"
                class="rounded-full px-2 py-0.5 text-[11px] font-bold"
                :class="
                  item.linked_clients_count > 0
                    ? 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400'
                    : 'bg-warn/12 text-warn'
                "
              >
                {{
                  item.linked_clients_count > 0
                    ? `${item.linked_clients_count} Linked ${item.linked_clients_count > 1 ? 'Clients' : 'Client'}`
                    : 'Unlinked Overhead'
                }}
              </span>
            </div>

            <button
              type="button"
              class="inline-flex min-h-[34px] items-center rounded-full px-3 text-[0.75rem] font-bold transition active:scale-95"
              :class="
                activeKind === 'client'
                  ? 'bg-ok/12 text-ok'
                  : 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400'
              "
              @click.stop="openPaymentSheet({ kind: activeKind, item })"
            >
              {{ activeKind === 'client' ? 'Collect' : 'Pay' }}
            </button>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>

