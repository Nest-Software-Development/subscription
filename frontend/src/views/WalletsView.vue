<script setup>
import { computed, reactive, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import Sheet from '@/components/Sheet.vue'
import { fmtCompact, fmtDate, fmtMoney } from '@/lib/format'
import { usePullToRefresh } from '@/lib/refresh'
import {
  deleteTransactionAction,
  displayAmount,
  refreshWorkspace,
  saveWalletAction,
  store,
} from '@/lib/store'
import { askConfirm, openPaymentSheet, toast } from '@/lib/ui'

usePullToRefresh(refreshWorkspace)

const tabMode = ref('ledger') // 'ledger' | 'reports'
const selectedWalletFilter = ref('all')
const activeReport = ref('by_service')
const walletSheetOpen = ref(false)
const walletForm = reactive({
  name: '',
  wallet_name: '',
  wallet_type: 'Bank',
  currency: 'EGP',
  company: '',
  erpnext_bank: '',
  erpnext_bank_account: '',
  bank_account: '',
  bank_account_no: '',
  iban: '',
  opening_balance: 0,
  notes: '',
})

const cur = computed(() => store.displayCurrency)

function onBankAccountSelect() {
  const ba = (store.erpnextBanking.bank_accounts || []).find(
    (x) => x.name === walletForm.erpnext_bank_account,
  )
  if (!ba) return
  if (ba.bank && !walletForm.erpnext_bank) walletForm.erpnext_bank = ba.bank
  if (ba.account) walletForm.bank_account = ba.account
  if (ba.company && !walletForm.company) walletForm.company = ba.company
  if (ba.bank_account_no && !walletForm.bank_account_no) {
    walletForm.bank_account_no = ba.bank_account_no
  }
  if (ba.iban && !walletForm.iban) walletForm.iban = ba.iban
}

const filteredTxns = computed(() =>
  store.transactions.filter((t) => {
    if (selectedWalletFilter.value === 'all') return true
    if (selectedWalletFilter.value === 'in' || selectedWalletFilter.value === 'out') {
      return t.direction === selectedWalletFilter.value
    }
    return t.wallet === selectedWalletFilter.value
  }),
)

function openNewWallet(w = null) {
  walletForm.name = w?.name || ''
  walletForm.wallet_name = w?.wallet_name || ''
  walletForm.wallet_type = w?.wallet_type || 'Bank'
  walletForm.currency = w?.currency || 'EGP'
  walletForm.company = w?.company || store.erpnextBanking.companies?.[0]?.name || ''
  walletForm.erpnext_bank = w?.erpnext_bank || ''
  walletForm.erpnext_bank_account = w?.erpnext_bank_account || ''
  walletForm.bank_account = w?.bank_account || ''
  walletForm.bank_account_no = w?.bank_account_no || ''
  walletForm.iban = w?.iban || ''
  walletForm.opening_balance = w?.opening_balance ?? 0
  walletForm.notes = w?.notes || ''
  walletSheetOpen.value = true
}

async function submitWallet() {
  if (!walletForm.wallet_name.trim()) {
    toast('Enter a wallet name.', 'bad')
    return
  }
  await saveWalletAction({ ...walletForm })
  walletSheetOpen.value = false
  toast('Wallet saved.', 'ok')
}

async function removeTxn(t) {
  const ok = await askConfirm({
    title: 'Delete Transaction?',
    body: `Remove ${fmtMoney(t.amount, t.currency)} (${t.party || 'Manual'}) from wallet ledger?`,
    okText: 'Delete Entry',
    danger: true,
  })
  if (!ok) return
  await deleteTransactionAction(t.name)
  toast('Ledger entry removed.', 'info')
}

const reportTabs = [
  { id: 'by_service', label: '1. Profit by Service' },
  { id: 'by_client', label: '2. Profit by Client' },
  { id: 'rev_share', label: '3. Client Revenue Share' },
  { id: 'by_cycle', label: '4. Billing Cycle Mix' },
  { id: 'forecast', label: '5. Monthly Forecast' },
  { id: 'schedule', label: '6. Payment Schedule' },
  { id: 'cashflow', label: '7. Actual Cash Flow' },
]
</script>

<template>
  <div class="pb-tabbar">
    <AppHeader
      title="Wallets & Reports"
      :subtitle="`Total Balance: ${fmtMoney(displayAmount(store.kpis.wallet_total_egp, store.kpis.wallet_total_usd), cur)}`"
    >
      <template #actions>
        <button
          type="button"
          class="btn-soft min-h-[36px] px-3 text-[0.78rem]"
          @click="openNewWallet()"
        >
          + Wallet
        </button>
      </template>
    </AppHeader>

    <main class="mx-auto max-w-5xl space-y-4 px-4 pt-3.5">
      <!-- Mode Switcher: Wallets & Ledger vs All 7 Reports -->
      <div class="seg-wrap">
        <button
          type="button"
          class="seg-btn"
          :class="{ 'seg-btn-active': tabMode === 'ledger' }"
          @click="tabMode = 'ledger'"
        >
          Wallets &amp; Ledger ({{ store.transactions.length }})
        </button>
        <button
          type="button"
          class="seg-btn"
          :class="{ 'seg-btn-active': tabMode === 'reports' }"
          @click="tabMode = 'reports'"
        >
          7 Executive Reports
        </button>
      </div>

      <!-- TAB 1: WALLETS & LEDGER -->
      <template v-if="tabMode === 'ledger'">
        <!-- Bank Pass Cards -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div
            v-for="w in store.wallets.filter((x) => !x.archived)"
            :key="w.name"
            class="relative overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-obsidian-900 to-[#18243C] p-4 text-white shadow-card"
          >
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs font-bold uppercase tracking-wider text-white/60">
                  {{ w.currency }} Account
                </p>
                <h3 class="mt-0.5 text-lg font-extrabold">{{ w.wallet_name }}</h3>
              </div>
              <button
                type="button"
                class="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80"
                @click="openNewWallet(w)"
              >
                Edit
              </button>
            </div>

            <p class="tabular mt-3 text-2xl font-extrabold">
              {{ fmtMoney(w.current_balance, w.currency, { decimals: 2 }) }}
            </p>

            <div
              v-if="w.erpnext_bank || w.bank_account || w.erpnext_bank_account"
              class="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-white/75"
            >
              <span class="rounded-full bg-white/10 px-2 py-0.5 font-semibold">
                ERPNext: {{ w.erpnext_bank || w.erpnext_bank_account || w.bank_account }}
              </span>
              <span
                v-if="w.bank_account"
                class="tabular rounded-full bg-emerald-400/15 px-2 py-0.5 font-semibold text-emerald-200"
              >
                GL: {{ fmtMoney(w.erpnext_gl_balance || 0, w.gl_account_currency || w.currency) }}
              </span>
            </div>

            <div class="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 text-xs">
              <span class="tabular text-emerald-300">
                In: +{{ fmtCompact(w.total_in, w.currency) }}
              </span>
              <span class="tabular text-coral-300">
                Out: −{{ fmtCompact(w.total_out, w.currency) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Quick Manual Deposit / Withdrawal -->
        <div class="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            class="btn-primary"
            @click="openPaymentSheet({ kind: 'manual', direction: 'in' })"
          >
            + Manual Deposit
          </button>
          <button
            type="button"
            class="btn-outline"
            @click="openPaymentSheet({ kind: 'manual', direction: 'out' })"
          >
            − Manual Withdrawal
          </button>
        </div>

        <!-- Filter Chips -->
        <div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <button
            type="button"
            class="chip"
            :class="{ 'chip-active': selectedWalletFilter === 'all' }"
            @click="selectedWalletFilter = 'all'"
          >
            All Entries
          </button>
          <button
            type="button"
            class="chip"
            :class="{ 'chip-active': selectedWalletFilter === 'in' }"
            @click="selectedWalletFilter = 'in'"
          >
            Inflows
          </button>
          <button
            type="button"
            class="chip"
            :class="{ 'chip-active': selectedWalletFilter === 'out' }"
            @click="selectedWalletFilter = 'out'"
          >
            Outflows
          </button>
          <button
            v-for="w in store.wallets"
            :key="w.name"
            type="button"
            class="chip"
            :class="{ 'chip-active': selectedWalletFilter === w.name }"
            @click="selectedWalletFilter = w.name"
          >
            {{ w.wallet_name }}
          </button>
        </div>

        <!-- Transactions List -->
        <div class="card divide-y divide-line/60 p-0 overflow-hidden">
          <div
            v-for="t in filteredTxns"
            :key="t.name"
            class="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  :class="
                    t.direction === 'in'
                      ? 'bg-ok/15 text-ok'
                      : 'bg-coral-50 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400'
                  "
                >
                  {{ t.direction === 'in' ? '↓' : '↑' }}
                </span>
                <p class="truncate text-[0.88rem] font-bold text-ink">
                  {{ t.party || 'Manual Entry' }}
                </p>
              </div>
              <p class="truncate pl-8 text-[0.75rem] text-ink-soft">
                {{ t.service || t.reference_kind }} · {{ fmtDate(t.transaction_date) }}
              </p>
            </div>

            <div class="flex items-center gap-2 text-right">
              <div>
                <p
                  class="tabular text-[0.9rem] font-extrabold"
                  :class="
                    t.direction === 'in'
                      ? 'text-ok'
                      : 'text-coral-600 dark:text-coral-400'
                  "
                >
                  {{ t.direction === 'in' ? '+' : '−' }}{{ fmtMoney(t.amount, t.currency) }}
                </p>
                <p
                  v-if="t.currency !== t.wallet_currency"
                  class="tabular text-[11px] text-ink-mute"
                >
                  {{ fmtMoney(t.wallet_amount, t.wallet_currency) }}
                </p>
              </div>
              <button
                type="button"
                class="icon-btn h-8 w-8 text-ink-mute hover:text-bad"
                aria-label="Delete transaction"
                @click="removeTxn(t)"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- TAB 2: ALL 7 EXECUTIVE REPORTS -->
      <template v-else>
        <div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <button
            v-for="rep in reportTabs"
            :key="rep.id"
            type="button"
            class="chip"
            :class="{ 'chip-active': activeReport === rep.id }"
            @click="activeReport = rep.id"
          >
            {{ rep.label }}
          </button>
        </div>

        <!-- 1. Cost & Profit by Service -->
        <div v-if="activeReport === 'by_service'" class="card divide-y divide-line/60 p-0 overflow-hidden">
          <div
            v-for="row in store.analytics?.by_service || []"
            :key="`${row.kind}-${row.name}`"
            class="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div class="min-w-0">
              <p class="truncate text-[0.88rem] font-bold text-ink">{{ row.party }}</p>
              <p class="truncate text-[0.75rem] text-ink-soft">
                {{ row.service }} · Cost
                {{ fmtMoney(displayAmount(row.allocated_cost_egp, undefined), cur) }}
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p
                class="tabular text-[0.9rem] font-extrabold"
                :class="row.annual_profit_egp >= 0 ? 'text-ok' : 'text-bad'"
              >
                {{ fmtMoney(displayAmount(row.annual_profit_egp, undefined), cur) }}/yr
              </p>
              <p class="tabular text-[11px] text-ink-mute">{{ row.margin_pct }}% margin</p>
            </div>
          </div>
        </div>

        <!-- 2 & 3. Profit & Revenue Share by Client -->
        <div
          v-else-if="activeReport === 'by_client' || activeReport === 'rev_share'"
          class="space-y-2.5"
        >
          <div
            v-for="row in store.analytics?.by_client || []"
            :key="row.client_name"
            class="card space-y-2 p-4"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-[0.92rem] font-bold text-ink">{{ row.client_name }}</p>
                <p class="text-[0.75rem] text-ink-soft">
                  {{ row.subscriptions_count }} plans · {{ row.share_pct }}% of revenue
                </p>
              </div>
              <div class="text-right">
                <p class="tabular text-[0.95rem] font-extrabold text-ink">
                  {{
                    fmtMoney(
                      activeReport === 'by_client'
                        ? displayAmount(row.annual_profit_egp, undefined)
                        : displayAmount(row.annual_revenue_egp, row.annual_revenue_usd),
                      cur,
                    )
                  }}/yr
                </p>
                <p class="tabular text-xs font-bold text-ok">{{ row.margin_pct }}% margin</p>
              </div>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-surface-sunk">
              <div
                class="h-full rounded-full bg-coral-500"
                :style="{ width: `${Math.min(100, Math.max(4, row.share_pct))}%` }"
              />
            </div>
          </div>
        </div>

        <!-- 4. Revenue by Billing Cycle -->
        <div v-else-if="activeReport === 'by_cycle'" class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div
            v-for="row in store.analytics?.by_cycle || []"
            :key="row.billing_cycle"
            class="card p-4"
          >
            <p class="text-xs font-bold uppercase tracking-wider text-ink-mute">
              {{ row.billing_cycle }}
            </p>
            <p class="tabular mt-1 text-xl font-extrabold text-ink">
              {{ fmtMoney(displayAmount(row.annual_revenue_egp, row.annual_revenue_usd), cur) }}/yr
            </p>
            <p class="mt-1 text-xs text-ink-soft">
              {{ row.count }} active plans · {{ row.share_pct }}% share
            </p>
          </div>
        </div>

        <!-- 5. Monthly Collection Forecast -->
        <div v-else-if="activeReport === 'forecast'" class="card divide-y divide-line/60 p-0 overflow-hidden">
          <div
            v-for="m in store.analytics?.forecast_months || []"
            :key="m.month_key"
            class="flex items-center justify-between px-4 py-3 text-[0.85rem]"
          >
            <div>
              <p class="font-bold text-ink">{{ m.label }}</p>
              <p class="text-xs text-ink-mute">{{ m.items.length }} scheduled renewals</p>
            </div>
            <div class="tabular text-right">
              <p class="font-extrabold text-ok">
                +{{ fmtMoney(displayAmount(m.inflow_egp, m.inflow_usd), cur) }}
              </p>
              <p class="text-xs text-coral-600 dark:text-coral-400">
                Vendor: −{{ fmtMoney(displayAmount(m.outflow_egp, m.outflow_usd), cur) }}
              </p>
            </div>
          </div>
        </div>

        <!-- 6. Detailed Payment Schedule -->
        <div v-else-if="activeReport === 'schedule'" class="card divide-y divide-line/60 p-0 overflow-hidden">
          <div
            v-for="(s, idx) in (store.analytics?.detailed_schedule || []).slice(0, 40)"
            :key="idx"
            class="flex items-center justify-between px-4 py-3 text-[0.84rem]"
          >
            <div class="min-w-0">
              <p class="truncate font-bold text-ink">{{ s.party }} · {{ s.service }}</p>
              <p class="text-xs text-ink-mute">{{ fmtDate(s.date) }} · {{ s.billing_cycle }}</p>
            </div>
            <span
              class="tabular shrink-0 font-bold"
              :class="s.kind === 'client' ? 'text-ok' : 'text-coral-600 dark:text-coral-400'"
            >
              {{ s.kind === 'client' ? '+' : '−' }}{{ fmtMoney(s.amount, s.currency) }}
            </span>
          </div>
        </div>

        <!-- 7. Actual Ledger Cash Flow -->
        <div v-else class="card divide-y divide-line/60 p-0 overflow-hidden">
          <div
            v-for="cf in store.analytics?.cashflow_months || []"
            :key="cf.month_key"
            class="flex items-center justify-between px-4 py-3 text-[0.85rem]"
          >
            <div>
              <p class="font-bold text-ink">{{ cf.label }}</p>
              <p class="text-xs text-ink-mute">{{ cf.tx_count }} posted transactions</p>
            </div>
            <div class="tabular text-right">
              <p class="font-extrabold text-ok">
                Net {{ fmtMoney(displayAmount(cf.net_egp, undefined), cur) }}
              </p>
              <p class="text-xs text-ink-soft">
                In {{ fmtCompact(displayAmount(cf.in_egp, undefined), cur) }} · Out
                {{ fmtCompact(displayAmount(cf.out_egp, undefined), cur) }}
              </p>
            </div>
          </div>
        </div>
      </template>
    </main>

    <!-- Create / Edit Wallet Sheet -->
    <Sheet
      :open="walletSheetOpen"
      :title="walletForm.name ? 'Edit Wallet' : 'New Subscription Wallet'"
      subtitle="Track bank or cash treasury balances"
      @close="walletSheetOpen = false"
    >
      <div class="space-y-3.5">
        <div class="field-wrap">
          <label class="field-label">Wallet Name</label>
          <div class="field-box">
            <input
              v-model="walletForm.wallet_name"
              type="text"
              class="field-input"
              placeholder="e.g. Banque Misr / CIB USD"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2.5">
          <div class="field-wrap">
            <label class="field-label">Currency</label>
            <div class="field-box">
              <select v-model="walletForm.currency" class="field-input font-semibold">
                <option value="EGP">EGP</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>
          <div class="field-wrap">
            <label class="field-label">Opening Balance</label>
            <div class="field-box">
              <input
                v-model="walletForm.opening_balance"
                type="number"
                step="0.01"
                class="field-input tabular"
              />
            </div>
          </div>
        </div>

        <div class="border-t border-line/70 pt-3">
          <p class="mb-2.5 text-xs font-extrabold uppercase tracking-wider text-ink-mute">
            ERPNext Bank &amp; Chart of Accounts Link
          </p>
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-2.5">
              <div class="field-wrap">
                <label class="field-label">ERPNext Bank</label>
                <div class="field-box">
                  <select
                    v-if="store.erpnextBanking.banks?.length"
                    v-model="walletForm.erpnext_bank"
                    class="field-input text-[0.84rem]"
                  >
                    <option value="">— Optional —</option>
                    <option
                      v-for="b in store.erpnextBanking.banks"
                      :key="b.name"
                      :value="b.name"
                    >
                      {{ b.bank_name || b.name }}
                    </option>
                  </select>
                  <input
                    v-else
                    v-model="walletForm.erpnext_bank"
                    type="text"
                    class="field-input text-[0.84rem]"
                    placeholder="e.g. CIB / Banque Misr"
                  />
                </div>
              </div>

              <div class="field-wrap">
                <label class="field-label">Company Bank Account</label>
                <div class="field-box">
                  <select
                    v-if="store.erpnextBanking.bank_accounts?.length"
                    v-model="walletForm.erpnext_bank_account"
                    class="field-input text-[0.84rem]"
                    @change="onBankAccountSelect"
                  >
                    <option value="">— Optional —</option>
                    <option
                      v-for="ba in store.erpnextBanking.bank_accounts"
                      :key="ba.name"
                      :value="ba.name"
                    >
                      {{ ba.account_name || ba.name }}
                    </option>
                  </select>
                  <input
                    v-else
                    v-model="walletForm.erpnext_bank_account"
                    type="text"
                    class="field-input text-[0.84rem]"
                    placeholder="ERPNext Bank Account"
                  />
                </div>
              </div>
            </div>

            <div class="field-wrap">
              <label class="field-label">ERPNext GL Account (Bank / Cash)</label>
              <div class="field-box">
                <select
                  v-if="store.erpnextBanking.gl_accounts?.length"
                  v-model="walletForm.bank_account"
                  class="field-input text-[0.84rem]"
                >
                  <option value="">— Link Chart of Accounts Ledger —</option>
                  <option
                    v-for="acc in store.erpnextBanking.gl_accounts"
                    :key="acc.name"
                    :value="acc.name"
                  >
                    {{ acc.name }} ({{ acc.account_currency || 'EGP' }})
                  </option>
                </select>
                <input
                  v-else
                  v-model="walletForm.bank_account"
                  type="text"
                  class="field-input text-[0.84rem]"
                  placeholder="e.g. 1200 - CIB Bank - NSD"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2.5">
              <div class="field-wrap">
                <label class="field-label">Account Number</label>
                <div class="field-box">
                  <input
                    v-model="walletForm.bank_account_no"
                    type="text"
                    class="field-input tabular text-[0.82rem]"
                    placeholder="Account No."
                  />
                </div>
              </div>
              <div class="field-wrap">
                <label class="field-label">IBAN</label>
                <div class="field-box">
                  <input
                    v-model="walletForm.iban"
                    type="text"
                    class="field-input tabular text-[0.82rem]"
                    placeholder="EG..."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <button type="button" class="btn-primary w-full" @click="submitWallet">
          Save Wallet
        </button>
      </template>
    </Sheet>
  </div>
</template>

