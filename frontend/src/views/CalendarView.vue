<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { fmtCompact, fmtDate, fmtMoney } from '@/lib/format'
import { usePullToRefresh } from '@/lib/refresh'
import { displayAmount, loadAnalytics, store } from '@/lib/store'
import { openPaymentSheet } from '@/lib/ui'

const router = useRouter()
usePullToRefresh(() => loadAnalytics(store.analyticsHorizon))

const selectedMonthKey = ref('')
const cur = computed(() => store.displayCurrency)

onMounted(() => {
  if (!store.analytics) loadAnalytics(12)
})

const months = computed(() => store.analytics?.forecast_months || [])

const chartMax = computed(() => {
  let maxVal = 1
  months.value.forEach((m) => {
    const inf = displayAmount(m.inflow_egp, m.inflow_usd)
    const outf = displayAmount(m.outflow_egp, m.outflow_usd)
    if (inf > maxVal) maxVal = inf
    if (outf > maxVal) maxVal = outf
  })
  return maxVal
})

const visibleMonths = computed(() => {
  if (!selectedMonthKey.value) return months.value.filter((m) => m.items.length > 0)
  return months.value.filter((m) => m.month_key === selectedMonthKey.value)
})

async function setHorizon(h) {
  selectedMonthKey.value = ''
  await loadAnalytics(h)
}

function triggerPay(entry) {
  if (entry.kind === 'client') {
    const c = store.clientSubscriptions.find((x) => x.name === entry.ref_name)
    if (c) openPaymentSheet({ kind: 'client', item: c })
  } else {
    const v = store.vendorSubscriptions.find((x) => x.name === entry.ref_name)
    if (v) openPaymentSheet({ kind: 'vendor', item: v })
  }
}
</script>

<template>
  <div class="pb-tabbar">
    <AppHeader
      title="Renewal Timeline"
      :subtitle="`${store.analyticsHorizon}-month cash inflow vs vendor outflow forecast`"
    />

    <main class="mx-auto max-w-5xl space-y-4 px-4 pt-3.5">
      <!-- Horizon Selector -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex gap-1.5">
          <button
            v-for="h in [6, 12, 18, 24]"
            :key="h"
            type="button"
            class="chip tabular"
            :class="{ 'chip-active': store.analyticsHorizon === h }"
            @click="setHorizon(h)"
          >
            {{ h }}M
          </button>
        </div>
        <button
          v-if="selectedMonthKey"
          type="button"
          class="text-xs font-bold text-coral-600 dark:text-coral-400"
          @click="selectedMonthKey = ''"
        >
          Show All Months
        </button>
      </div>

      <!-- Interactive Dual-Bar SVG Forecast Card -->
      <section class="card space-y-3 p-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-[0.95rem] font-bold text-ink">Monthly Collection vs Vendor Cost</h2>
            <p class="text-[0.75rem] text-ink-mute">Tap any month bar to filter schedule below</p>
          </div>
          <div class="flex items-center gap-3 text-[0.72rem] font-semibold">
            <span class="flex items-center gap-1 text-ok">
              <span class="h-2.5 w-2.5 rounded-sm bg-ok" /> Inflow
            </span>
            <span class="flex items-center gap-1 text-coral-600 dark:text-coral-400">
              <span class="h-2.5 w-2.5 rounded-sm bg-coral-500" /> Vendor
            </span>
          </div>
        </div>

        <div class="no-scrollbar flex items-end gap-2.5 overflow-x-auto pt-3 pb-1">
          <button
            v-for="m in months"
            :key="m.month_key"
            type="button"
            class="flex min-w-[46px] flex-col items-center gap-1.5 rounded-xl px-1.5 py-2 transition"
            :class="
              selectedMonthKey === m.month_key
                ? 'bg-coral-50 ring-1 ring-coral-500/40 dark:bg-coral-500/15'
                : 'hover:bg-surface-sunk'
            "
            @click="
              selectedMonthKey = selectedMonthKey === m.month_key ? '' : m.month_key
            "
          >
            <div class="flex h-28 items-end gap-1">
              <div
                class="w-3 rounded-t-md bg-ok transition-all"
                :style="{
                  height: `${Math.max(
                    4,
                    (displayAmount(m.inflow_egp, m.inflow_usd) / chartMax) * 108,
                  )}px`,
                }"
              />
              <div
                class="w-3 rounded-t-md bg-coral-500 transition-all"
                :style="{
                  height: `${Math.max(
                    4,
                    (displayAmount(m.outflow_egp, m.outflow_usd) / chartMax) * 108,
                  )}px`,
                }"
              />
            </div>
            <span class="tabular text-[10px] font-bold text-ink-soft">
              {{ m.short_label }}
            </span>
          </button>
        </div>
      </section>

      <!-- Month-by-Month Chronological Schedule -->
      <section v-for="m in visibleMonths" :key="m.month_key" class="space-y-2">
        <div class="flex items-center justify-between px-1">
          <h3 class="text-[0.95rem] font-extrabold text-ink">{{ m.label }}</h3>
          <div class="tabular flex items-center gap-2 text-[0.76rem] font-bold">
            <span class="text-ok">
              +{{ fmtCompact(displayAmount(m.inflow_egp, m.inflow_usd), cur) }}
            </span>
            <span class="text-coral-600 dark:text-coral-400">
              −{{ fmtCompact(displayAmount(m.outflow_egp, m.outflow_usd), cur) }}
            </span>
          </div>
        </div>

        <div class="card divide-y divide-line/60 p-0 overflow-hidden">
          <div
            v-for="(item, idx) in m.items"
            :key="`${item.kind}-${item.ref_name}-${idx}`"
            class="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div
              class="min-w-0 flex-1 cursor-pointer"
              @click="
                router.push(
                  item.kind === 'client'
                    ? `/client/${item.ref_name}`
                    : `/vendor/${item.ref_name}`,
                )
              "
            >
              <div class="flex items-center gap-1.5">
                <span
                  class="h-2 w-2 shrink-0 rounded-full"
                  :class="item.kind === 'client' ? 'bg-ok' : 'bg-coral-500'"
                />
                <p class="truncate text-[0.88rem] font-bold text-ink">{{ item.party }}</p>
              </div>
              <p class="truncate pl-3.5 text-[0.76rem] text-ink-soft">
                {{ item.service }} · {{ fmtDate(item.date) }}
              </p>
            </div>

            <div class="flex shrink-0 items-center gap-2.5">
              <span
                class="tabular text-[0.88rem] font-extrabold"
                :class="
                  item.kind === 'client'
                    ? 'text-ok'
                    : 'text-coral-600 dark:text-coral-400'
                "
              >
                {{ item.kind === 'client' ? '+' : '−' }}{{ fmtMoney(item.amount, item.currency) }}
              </span>
              <button
                type="button"
                class="rounded-full bg-surface-sunk px-2.5 py-1 text-[0.72rem] font-bold text-ink transition active:scale-95"
                @click="triggerPay(item)"
              >
                {{ item.kind === 'client' ? 'Collect' : 'Pay' }}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

