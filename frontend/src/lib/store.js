import { reactive } from 'vue'
import { DEMO_RAW_DB } from './demoSeed'
import { ApiError, get, initCsrfFromDom, post, setCsrfToken } from './api'
import {
  addMonthsIso,
  advanceCycleDate,
  annualize,
  computeDueState,
  convertCurrency,
  CYCLE_MONTHS,
  daysUntil,
  fmtDate,
  fmtMoney,
  parseIsoDate,
  toEgp,
  todayIso,
  toUsd,
} from './format'
import { cacheGet, cacheSet, purgeLocalData } from './offline'
import { pwa, syncBadge, triggerLocalNotification } from './pwa'

const STANDALONE_DB_KEY = 'subscription:standalone-db-v1'
const DISPLAY_CUR_KEY = 'subscription:display-cur'

export const store = reactive({
  ready: false,
  loading: false,
  standaloneMode: false,
  authenticated: false,
  user: null,
  isAdmin: true,
  permissions: {
    can_write_subscriptions: true,
    can_write_wallets: true,
    can_write_settings: true,
  },
  pushPublicKey: '',
  displayCurrency:
    (typeof localStorage !== 'undefined' && localStorage.getItem(DISPLAY_CUR_KEY)) || 'USD',
  kpis: {
    usd_egp_rate: 56.25,
    active_client_subs: 0,
    distinct_clients: 0,
    active_vendor_subs: 0,
    distinct_vendors: 0,
    annual_revenue_egp: 0,
    annual_revenue_usd: 0,
    mrr_egp: 0,
    mrr_usd: 0,
    annual_vendor_cost_egp: 0,
    annual_vendor_cost_usd: 0,
    unlinked_overhead_egp: 0,
    annual_net_profit_egp: 0,
    annual_net_profit_usd: 0,
    net_margin_pct: 0,
    wallet_total_egp: 0,
    wallet_total_usd: 0,
    overdue_count: 0,
    due_30d_count: 0,
  },
  settings: {
    usd_egp_rate: 56.25,
    default_currency: 'USD',
    enable_email_reminders: 1,
    from_name: 'Nest Software Development',
    reply_to: 'info@nsd-eg.com',
    email_template: 'nest',
    email_footer: '',
    signature_image: '',
    tx_subject: 'Renewal Reminder: {client} — {service} due {due}',
    tx_greeting: 'Dear {client} team,',
    tx_intro: 'This is a friendly reminder that the following service is due for renewal {when}.',
    tx_closing:
      'Please arrange the payment before the due date to ensure uninterrupted service.',
    tx_cta: 'Reply to confirm payment',
    tx_signoff: 'Thanks, and best regards,\nNest Software Development',
    enable_push_notifications: 1,
    notify_client_renewals: 1,
    notify_vendor_renewals: 1,
    push_reminder_offsets: '30, 15, 7, 3, 1, 0',
  },
  clientSubscriptions: [],
  vendorSubscriptions: [],
  wallets: [],
  erpnextBanking: {
    companies: [],
    banks: [],
    bank_accounts: [],
    gl_accounts: [],
  },
  transactions: [],
  reminderRules: [],
  emailLogs: [],
  notifications: [],
  unreadNotifications: 0,
  analytics: null,
  analyticsHorizon: 12,
})

export function setDisplayCurrency(cur) {
  const c = cur === 'EGP' ? 'EGP' : 'USD'
  store.displayCurrency = c
  try {
    localStorage.setItem(DISPLAY_CUR_KEY, c)
  } catch {}
}

export function toggleDisplayCurrency() {
  setDisplayCurrency(store.displayCurrency === 'USD' ? 'EGP' : 'USD')
}

export function displayAmount(egpVal, usdVal) {
  if (store.displayCurrency === 'USD') {
    return usdVal !== undefined
      ? Number(usdVal || 0)
      : toUsd(egpVal, 'EGP', store.kpis.usd_egp_rate)
  }
  return Number(egpVal || 0)
}

/* ==========================================================================
   STANDALONE / OFFLINE ENGINE (100% feature parity with Python controllers)
   ========================================================================== */
function buildInitialStandaloneState(raw = DEMO_RAW_DB) {
  const srcSettings = raw.settings || {}
  const emailText = srcSettings.email_text || {}
  const rate = Number(raw.rate || srcSettings.usd_egp_rate || 56.25)

  const clientSubs = (raw.subscriptions || raw.client_subscriptions || raw.subs || []).map(
    (s, i) => ({
      name: s.name || s.id || `CSUB-${String(i + 1).padStart(4, '0')}`,
      legacy_id: s.id || s.legacy_id || '',
      client_name: s.client || s.client_name || '',
      service: s.service || '',
      status: s.status || 'Active',
      billing_cycle: s.cycle || s.billing_cycle || 'Annual',
      currency: String(s.cur || s.currency || 'USD').toUpperCase(),
      amount: Number(s.amount ?? s.amt ?? 0),
      next_due_date: s.due || s.next_due_date || todayIso(),
      notes: s.notes || '',
    }),
  )

  const clientNameSet = new Set(clientSubs.map((c) => c.name))
  const vendorSubs = (raw.vendor_subscriptions || raw.vsubs || []).map((v, i) => {
    const rawLinks = v.linked_subscriptions || v.link_subs || []
    const links = []
    const seen = new Set()
    rawLinks.forEach((entry) => {
      const ref = typeof entry === 'object' ? entry.client_subscription || entry.id : String(entry)
      const weight = typeof entry === 'object' ? Number(entry.allocation_weight_pct || 0) : 0
      if (ref && clientNameSet.has(ref) && !seen.has(ref)) {
        seen.add(ref)
        links.push({ client_subscription: ref, allocation_weight_pct: weight })
      }
    })
    return {
      name: v.name || v.id || `VSUB-${String(i + 1).padStart(4, '0')}`,
      legacy_id: v.id || v.legacy_id || '',
      vendor_name: v.vendor || v.vendor_name || '',
      service: v.service || '',
      status: v.status || 'Active',
      billing_cycle: v.cycle || v.billing_cycle || 'Annual',
      currency: String(v.cur || v.currency || 'USD').toUpperCase(),
      amount: Number(v.amount ?? v.amt ?? 0),
      next_due_date: v.due || v.next_due_date || todayIso(),
      allocation_mode: v.allocation_mode || 'Equal Split',
      linked_subscriptions: links,
      notes: v.notes || '',
    }
  })

  const wallets = (raw.wallets || []).map((w, i) => ({
    name: w.id || w.name || `WAL-${i + 1}`,
    legacy_id: w.id || w.legacy_id || '',
    wallet_name: w.wallet_name || w.name || `Wallet ${i + 1}`,
    currency: String(w.cur || w.currency || 'EGP').toUpperCase(),
    opening_balance: Number(w.opening ?? w.opening_balance ?? 0),
    archived: Number(w.archived || 0),
    notes: w.notes || '',
  }))

  const transactions = (raw.transactions || raw.txns || []).map((t, i) => ({
    name: `TXN-${String(t.id || i + 1).padStart(4, '0')}`,
    legacy_id: String(t.id || ''),
    transaction_date: t.tdate || t.date || t.transaction_date || todayIso(),
    direction: String(t.direction || 'in').toLowerCase(),
    wallet: t.wallet_id || t.wallet || wallets[0]?.name || '',
    reference_kind: String(t.ref_kind || t.reference_kind || 'manual').toLowerCase(),
    client_subscription:
      (t.ref_kind || t.reference_kind) === 'client' ? t.ref_id || t.client_subscription || '' : '',
    vendor_subscription:
      (t.ref_kind || t.reference_kind) === 'vendor' ? t.ref_id || t.vendor_subscription || '' : '',
    party: t.party || '',
    service: t.service || '',
    amount: Number(t.amount || 0),
    currency: String(t.cur || t.currency || 'EGP').toUpperCase(),
    exchange_rate: Number(t.rate || t.exchange_rate || rate),
    wallet_amount: Number(t.wallet_amount || t.amount || 0),
    advance_due_date: 0,
    notes: t.notes || '',
  }))

  const reminderRules = (raw.reminder_rules || raw.rules || []).map((r, i) => ({
    name: r.id || r.name || `RULE-${i + 1}`,
    legacy_id: r.id || '',
    client_name: r.client || r.client_name || '',
    enabled: Number(r.enabled ?? 1),
    to_emails: Array.isArray(r.to_emails) ? r.to_emails.join(', ') : r.to_emails || '',
    cc_emails: Array.isArray(r.cc_emails) ? r.cc_emails.join(', ') : r.cc_emails || '',
    offsets: (r.offsets || [30, 15, 7, 1].map((d) => ({ days: d, enabled: 1 }))).map((o) => ({
      days_before: Number(o.days_before ?? o.days ?? 7),
      enabled: Number(o.enabled ? 1 : 0),
    })),
  }))

  const cMap = Object.fromEntries(clientSubs.map((c) => [c.name, c]))
  const emailLogs = (raw.email_log || raw.email_logs || []).map((l, i) => {
    const c = cMap[l.sub_id || l.client_subscription]
    return {
      name: `ELOG-${String(i + 1).padStart(4, '0')}`,
      client_subscription: l.sub_id || l.client_subscription || '',
      client_name: l.client_name || c?.client_name || '',
      service: l.service || c?.service || '',
      due_date: l.due || l.due_date || '',
      days_before: Number(l.days_before || 0),
      recipients: l.recipients || '',
      subject: l.subject || '',
      template_used: srcSettings.email_template || 'nest',
      is_test: 0,
      status: l.status || 'Sent',
      sent_at: l.sent_at || '',
    }
  })

  // Generate actionable initial renewal notifications from real upcoming items
  const notifications = [
    {
      name: 'NTF-0001',
      title: 'Vendor Renewal Due Soon · Contabo VPS',
      body: 'Contabo VPS ($54.12 · Annual) powers 2 linked clients (Josoor & Kayan). Review renewal before due date.',
      category: 'Vendor Renewal',
      reference_doctype: 'Vendor Subscription',
      reference_name: '7wvw3ihx',
      due_date: '2026-11-03',
      days_before: 1,
      read: 0,
      created_at: '2026-11-03 08:30:00',
    },
    {
      name: 'NTF-0002',
      title: 'Multi-Client Server Renewal · Verpex Pro Reseller',
      body: 'Verpex Pro Reseller ($300.00) hosts 3 client subscriptions. Scheduled renewal on 12 Nov 2026.',
      category: 'Vendor Renewal',
      reference_doctype: 'Vendor Subscription',
      reference_name: 'qjabrnhn',
      due_date: '2026-11-12',
      days_before: 7,
      read: 0,
      created_at: '2026-11-03 08:30:00',
    },
    {
      name: 'NTF-0003',
      title: 'Client Renewal · Cwater Cloud server (ERP)',
      body: 'Cwater — Cloud server (ERP) ($450.00) is due 01 Dec 2026. 30-day email reminder dispatched.',
      category: 'Client Renewal',
      reference_doctype: 'Client Subscription',
      reference_name: '0kmba58x',
      due_date: '2026-12-01',
      days_before: 30,
      read: 0,
      created_at: '2026-11-01 09:22:22',
    },
  ]

  return {
    settings: {
      usd_egp_rate: rate,
      default_currency: 'USD',
      enable_email_reminders: 1,
      from_name: srcSettings.smtp_from_name || srcSettings.from_name || 'Nest Software Development',
      reply_to: srcSettings.smtp_user || 'info@nsd-eg.com',
      email_template: srcSettings.email_template || 'nest',
      email_footer:
        srcSettings.email_footer ||
        'Banque Misr\nNest Software Development | Account Number : 1760001000010231',
      signature_image: '',
      tx_subject:
        emailText.subject || 'Renewal Reminder: {client} — {service} due {due}',
      tx_greeting: emailText.greeting || 'Dear {client} team,',
      tx_intro:
        emailText.intro ||
        'This is a friendly reminder that the following service is due for renewal {when}.',
      tx_closing:
        emailText.closing ||
        'Please arrange the payment before the due date to ensure uninterrupted service.',
      tx_cta: emailText.cta || 'Reply to confirm payment',
      tx_signoff:
        emailText.signoff || 'Thanks, and best regards,\nNest Software Development',
      enable_push_notifications: 1,
      notify_client_renewals: 1,
      notify_vendor_renewals: 1,
      push_reminder_offsets: '30, 15, 7, 3, 1, 0',
    },
    client_subscriptions: clientSubs,
    vendor_subscriptions: vendorSubs,
    wallets,
    transactions,
    reminder_rules: reminderRules,
    email_logs: emailLogs,
    notifications,
  }
}

function loadStandaloneDb() {
  try {
    const raw = localStorage.getItem(STANDALONE_DB_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  const fresh = buildInitialStandaloneState(DEMO_RAW_DB)
  saveStandaloneDb(fresh)
  return fresh
}

function saveStandaloneDb(db) {
  try {
    localStorage.setItem(STANDALONE_DB_KEY, JSON.stringify(db))
  } catch {}
}

function recomputeDerivedBootstrap(db) {
  const rate = Number(db.settings?.usd_egp_rate || 56.25)

  // 1. Pre-compute client annualized revenue
  const clientById = {}
  const clients = db.client_subscriptions.map((c) => {
    const annNative = annualize(c.amount, c.billing_cycle)
    const annEgp = toEgp(annNative, c.currency, rate)
    const annUsd = toUsd(annNative, c.currency, rate)
    const dueInfo = computeDueState(c.next_due_date, c.status)
    const row = {
      ...c,
      days_until_due: dueInfo.days,
      due_state: dueInfo.state,
      annualized_egp: annEgp,
      annualized_usd: annUsd,
      allocated_vendor_cost_egp: 0,
      annual_profit_egp: annEgp,
      profit_margin_pct: annEgp > 0 ? 100 : 0,
      vendor_cost_links: [],
    }
    clientById[row.name] = row
    return row
  })

  // 2. Vendor subscriptions & multi-client cost allocation
  const vendors = db.vendor_subscriptions.map((v) => {
    const annNative = annualize(v.amount, v.billing_cycle)
    const annEgp = toEgp(annNative, v.currency, rate)
    const annUsd = toUsd(annNative, v.currency, rate)
    const dueInfo = computeDueState(v.next_due_date, v.status)
    const validLinks = (v.linked_subscriptions || []).filter(
      (l) => clientById[l.client_subscription],
    )
    const n = validLinks.length
    const mode = v.allocation_mode || 'Equal Split'

    let weights = []
    if (n > 0) {
      if (mode === 'Custom Percentage') {
        const totalW = validLinks.reduce((s, l) => s + Number(l.allocation_weight_pct || 0), 0)
        weights =
          totalW > 0
            ? validLinks.map((l) => (Number(l.allocation_weight_pct || 0) / totalW) * 100)
            : validLinks.map(() => 100 / n)
      } else if (mode === 'Revenue Proportional') {
        const totalRev = validLinks.reduce(
          (s, l) => s + Number(clientById[l.client_subscription]?.annualized_egp || 0),
          0,
        )
        weights =
          totalRev > 0
            ? validLinks.map(
                (l) =>
                  (Number(clientById[l.client_subscription]?.annualized_egp || 0) / totalRev) * 100,
              )
            : validLinks.map(() => 100 / n)
      } else {
        weights = validLinks.map(() => 100 / n)
      }
    }

    let linkedRevEgp = 0
    const enrichedLinks = validLinks.map((l, idx) => {
      const target = clientById[l.client_subscription]
      const pct = Number(weights[idx].toFixed(2))
      const shareEgp = v.status === 'Active' ? Number(((annEgp * pct) / 100).toFixed(2)) : 0
      const shareUsd = toUsd(shareEgp, 'EGP', rate)
      if (target) {
        linkedRevEgp += target.annualized_egp
        target.allocated_vendor_cost_egp = Number(
          (target.allocated_vendor_cost_egp + shareEgp).toFixed(2),
        )
        target.vendor_cost_links.push({
          vendor_subscription: v.name,
          vendor_name: v.vendor_name,
          vendor_service: v.service,
          vendor_status: v.status,
          allocation_mode: mode,
          allocation_weight_pct: pct,
          allocated_annual_egp: shareEgp,
          allocated_annual_usd: shareUsd,
        })
      }
      return {
        client_subscription: l.client_subscription,
        client_name: target?.client_name || '',
        service: target?.service || '',
        billing_cycle: target?.billing_cycle || 'Annual',
        allocation_weight_pct: pct,
        allocated_annual_egp: shareEgp,
        allocated_annual_usd: shareUsd,
      }
    })

    return {
      ...v,
      days_until_due: dueInfo.days,
      due_state: dueInfo.state,
      linked_clients_count: n,
      annualized_egp: annEgp,
      annualized_usd: annUsd,
      linked_revenue_egp: Number(linkedRevEgp.toFixed(2)),
      net_contribution_egp: Number((linkedRevEgp - annEgp).toFixed(2)),
      is_unlinked_overhead: n === 0 ? 1 : 0,
      linked_subscriptions: enrichedLinks,
    }
  })

  // Finalize client net profit & margin
  clients.forEach((c) => {
    c.annual_profit_egp = Number((c.annualized_egp - c.allocated_vendor_cost_egp).toFixed(2))
    c.profit_margin_pct =
      c.annualized_egp > 0
        ? Number(((c.annual_profit_egp / c.annualized_egp) * 100).toFixed(1))
        : 0
  })

  clients.sort((a, b) => String(a.next_due_date).localeCompare(String(b.next_due_date)))
  vendors.sort((a, b) => String(a.next_due_date).localeCompare(String(b.next_due_date)))

  // 3. Wallets & Transactions
  const walletMap = {}
  const wallets = db.wallets.map((w) => {
    const row = {
      ...w,
      total_in: 0,
      total_out: 0,
      current_balance: Number(w.opening_balance || 0),
      transaction_count: 0,
    }
    walletMap[row.name] = row
    return row
  })

  const txns = [...db.transactions]
    .sort((a, b) => String(b.transaction_date).localeCompare(String(a.transaction_date)))
    .map((t) => {
      const w = walletMap[t.wallet]
      const wAmt =
        Number(t.wallet_amount) > 0
          ? Number(t.wallet_amount)
          : convertCurrency(t.amount, t.currency, w?.currency || t.currency, t.exchange_rate || rate)
      if (w) {
        if (t.direction === 'in') w.total_in = Number((w.total_in + wAmt).toFixed(2))
        else w.total_out = Number((w.total_out + wAmt).toFixed(2))
        w.transaction_count += 1
      }
      return {
        ...t,
        wallet_currency: w?.currency || t.currency,
        wallet_amount: wAmt,
      }
    })

  wallets.forEach((w) => {
    w.current_balance = Number((w.opening_balance + w.total_in - w.total_out).toFixed(2))
  })

  // 4. Executive KPIs
  const activeC = clients.filter((c) => c.status === 'Active')
  const activeV = vendors.filter((v) => v.status === 'Active')
  const annRevEgp = Number(activeC.reduce((s, c) => s + c.annualized_egp, 0).toFixed(2))
  const annRevUsd = toUsd(annRevEgp, 'EGP', rate)
  const annCostEgp = Number(activeV.reduce((s, v) => s + v.annualized_egp, 0).toFixed(2))
  const annCostUsd = toUsd(annCostEgp, 'EGP', rate)
  const unlinkedEgp = Number(
    activeV
      .filter((v) => v.is_unlinked_overhead)
      .reduce((s, v) => s + v.annualized_egp, 0)
      .toFixed(2),
  )
  const netProfitEgp = Number((annRevEgp - annCostEgp).toFixed(2))
  const netProfitUsd = toUsd(netProfitEgp, 'EGP', rate)
  const netMarginPct = annRevEgp > 0 ? Number(((netProfitEgp / annRevEgp) * 100).toFixed(1)) : 0
  const walletTotalEgp = Number(
    wallets
      .filter((w) => !w.archived)
      .reduce((s, w) => s + toEgp(w.current_balance, w.currency, rate), 0)
      .toFixed(2),
  )

  const unread = (db.notifications || []).filter((n) => !n.read).length

  return {
    kpis: {
      usd_egp_rate: rate,
      active_client_subs: activeC.length,
      distinct_clients: new Set(activeC.map((c) => c.client_name)).size,
      active_vendor_subs: activeV.length,
      distinct_vendors: new Set(activeV.map((v) => v.vendor_name)).size,
      annual_revenue_egp: annRevEgp,
      annual_revenue_usd: annRevUsd,
      mrr_egp: Number((annRevEgp / 12).toFixed(2)),
      mrr_usd: Number((annRevUsd / 12).toFixed(2)),
      annual_vendor_cost_egp: annCostEgp,
      annual_vendor_cost_usd: annCostUsd,
      unlinked_overhead_egp: unlinkedEgp,
      annual_net_profit_egp: netProfitEgp,
      annual_net_profit_usd: netProfitUsd,
      net_margin_pct: netMarginPct,
      wallet_total_egp: walletTotalEgp,
      wallet_total_usd: toUsd(walletTotalEgp, 'EGP', rate),
      overdue_count:
        activeC.filter((c) => c.days_until_due < 0).length +
        activeV.filter((v) => v.days_until_due < 0).length,
      due_30d_count:
        activeC.filter((c) => c.days_until_due >= 0 && c.days_until_due <= 30).length +
        activeV.filter((v) => v.days_until_due >= 0 && v.days_until_due <= 30).length,
    },
    settings: { ...db.settings, usd_egp_rate: rate },
    client_subscriptions: clients,
    vendor_subscriptions: vendors,
    wallets,
    transactions: txns,
    reminder_rules: db.reminder_rules || [],
    email_logs: db.email_logs || [],
    notifications: db.notifications || [],
    unread_notifications: unread,
  }
}

export function computeLocalAnalytics(horizonMonths = store.analyticsHorizon) {
  const horizon = Math.max(3, Math.min(Number(horizonMonths) || 12, 24))
  const rate = Number(store.kpis.usd_egp_rate || 56.25)
  const today = parseIsoDate(todayIso())
  const month0Iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const endIso = addMonthsIso(month0Iso, horizon)

  const monthsMap = {}
  for (let i = 0; i < horizon; i += 1) {
    const mIso = addMonthsIso(month0Iso, i)
    const dt = parseIsoDate(mIso)
    const mk = mIso.slice(0, 7)
    monthsMap[mk] = {
      month_key: mk,
      label: dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
      short_label: dt.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      inflow_egp: 0,
      inflow_usd: 0,
      outflow_egp: 0,
      outflow_usd: 0,
      net_egp: 0,
      net_usd: 0,
      items: [],
    }
  }

  function occurrences(nextDueIso, cycle) {
    if (!nextDueIso) return []
    const step = CYCLE_MONTHS[cycle] || 12
    let cur = nextDueIso
    let guard = 0
    while (cur < month0Iso && guard < 60) {
      cur = addMonthsIso(cur, step)
      guard += 1
    }
    const list = []
    guard = 0
    while (cur < endIso && guard < 60) {
      list.push(cur)
      cur = addMonthsIso(cur, step)
      guard += 1
    }
    return list
  }

  const scheduleRows = []
  store.clientSubscriptions
    .filter((c) => c.status === 'Active')
    .forEach((c) => {
      const egp = toEgp(c.amount, c.currency, rate)
      const usd = toUsd(c.amount, c.currency, rate)
      occurrences(c.next_due_date, c.billing_cycle).forEach((occ) => {
        const mk = occ.slice(0, 7)
        if (!monthsMap[mk]) return
        const row = {
          date: occ,
          month_key: mk,
          kind: 'client',
          ref_name: c.name,
          party: c.client_name,
          service: c.service,
          billing_cycle: c.billing_cycle,
          currency: c.currency,
          amount: c.amount,
          amount_egp: egp,
          amount_usd: usd,
          days_from_today: daysUntil(occ),
        }
        monthsMap[mk].inflow_egp = Number((monthsMap[mk].inflow_egp + egp).toFixed(2))
        monthsMap[mk].inflow_usd = Number((monthsMap[mk].inflow_usd + usd).toFixed(2))
        monthsMap[mk].items.push(row)
        scheduleRows.push(row)
      })
    })

  store.vendorSubscriptions
    .filter((v) => v.status === 'Active')
    .forEach((v) => {
      const egp = toEgp(v.amount, v.currency, rate)
      const usd = toUsd(v.amount, v.currency, rate)
      occurrences(v.next_due_date, v.billing_cycle).forEach((occ) => {
        const mk = occ.slice(0, 7)
        if (!monthsMap[mk]) return
        const row = {
          date: occ,
          month_key: mk,
          kind: 'vendor',
          ref_name: v.name,
          party: v.vendor_name,
          service: v.service,
          billing_cycle: v.billing_cycle,
          currency: v.currency,
          amount: v.amount,
          amount_egp: egp,
          amount_usd: usd,
          days_from_today: daysUntil(occ),
        }
        monthsMap[mk].outflow_egp = Number((monthsMap[mk].outflow_egp + egp).toFixed(2))
        monthsMap[mk].outflow_usd = Number((monthsMap[mk].outflow_usd + usd).toFixed(2))
        monthsMap[mk].items.push(row)
        scheduleRows.push(row)
      })
    })

  const forecastMonths = Object.values(monthsMap).map((m) => {
    m.net_egp = Number((m.inflow_egp - m.outflow_egp).toFixed(2))
    m.net_usd = Number((m.inflow_usd - m.outflow_usd).toFixed(2))
    m.items.sort((a, b) => a.date.localeCompare(b.date))
    return m
  })
  scheduleRows.sort((a, b) => a.date.localeCompare(b.date))

  const activeClients = store.clientSubscriptions.filter((c) => c.status === 'Active')
  const totalRevEgp = activeClients.reduce((s, c) => s + c.annualized_egp, 0) || 1
  const byClientMap = {}
  activeClients.forEach((c) => {
    const b =
      byClientMap[c.client_name] ||
      (byClientMap[c.client_name] = {
        client_name: c.client_name,
        subscriptions_count: 0,
        annual_revenue_egp: 0,
        annual_revenue_usd: 0,
        allocated_cost_egp: 0,
        annual_profit_egp: 0,
      })
    b.subscriptions_count += 1
    b.annual_revenue_egp = Number((b.annual_revenue_egp + c.annualized_egp).toFixed(2))
    b.annual_revenue_usd = Number((b.annual_revenue_usd + c.annualized_usd).toFixed(2))
    b.allocated_cost_egp = Number((b.allocated_cost_egp + c.allocated_vendor_cost_egp).toFixed(2))
    b.annual_profit_egp = Number((b.annual_profit_egp + c.annual_profit_egp).toFixed(2))
  })
  const byClient = Object.values(byClientMap)
    .map((b) => ({
      ...b,
      share_pct: Number(((b.annual_revenue_egp / totalRevEgp) * 100).toFixed(1)),
      margin_pct:
        b.annual_revenue_egp > 0
          ? Number(((b.annual_profit_egp / b.annual_revenue_egp) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.annual_revenue_egp - a.annual_revenue_egp)

  const byCycle = ['Monthly', 'Quarterly', 'Annual', 'Biennial'].map((cyc) => {
    const rows = activeClients.filter((c) => c.billing_cycle === cyc)
    const revEgp = Number(rows.reduce((s, c) => s + c.annualized_egp, 0).toFixed(2))
    const revUsd = Number(rows.reduce((s, c) => s + c.annualized_usd, 0).toFixed(2))
    return {
      billing_cycle: cyc,
      count: rows.length,
      annual_revenue_egp: revEgp,
      annual_revenue_usd: revUsd,
      share_pct: Number(((revEgp / totalRevEgp) * 100).toFixed(1)),
    }
  })

  const byService = [
    ...activeClients.map((c) => ({
      kind: 'client_service',
      name: c.name,
      party: c.client_name,
      service: c.service,
      annual_revenue_egp: c.annualized_egp,
      allocated_cost_egp: c.allocated_vendor_cost_egp,
      annual_profit_egp: c.annual_profit_egp,
      margin_pct: c.profit_margin_pct,
    })),
    ...store.vendorSubscriptions
      .filter((v) => v.status === 'Active' && v.is_unlinked_overhead)
      .map((v) => ({
        kind: 'unlinked_vendor',
        name: v.name,
        party: `${v.vendor_name} (Unlinked Overhead)`,
        service: v.service,
        annual_revenue_egp: 0,
        allocated_cost_egp: v.annualized_egp,
        annual_profit_egp: -v.annualized_egp,
        margin_pct: -100,
      })),
  ].sort((a, b) => b.annual_profit_egp - a.annual_profit_egp)

  const cfMap = {}
  store.transactions.forEach((t) => {
    if (!t.transaction_date) return
    const mk = t.transaction_date.slice(0, 7)
    const dt = parseIsoDate(`${mk}-01`)
    const b =
      cfMap[mk] ||
      (cfMap[mk] = {
        month_key: mk,
        label: dt ? dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : mk,
        in_egp: 0,
        out_egp: 0,
        net_egp: 0,
        tx_count: 0,
      })
    const egp = toEgp(t.amount, t.currency, t.exchange_rate || rate)
    if (t.direction === 'in') b.in_egp = Number((b.in_egp + egp).toFixed(2))
    else b.out_egp = Number((b.out_egp + egp).toFixed(2))
    b.net_egp = Number((b.in_egp - b.out_egp).toFixed(2))
    b.tx_count += 1
  })
  const cashflowMonths = Object.keys(cfMap)
    .sort()
    .map((k) => cfMap[k])

  return {
    horizon_months: horizon,
    usd_egp_rate: rate,
    forecast_months: forecastMonths,
    detailed_schedule: scheduleRows,
    by_client: byClient,
    by_cycle: byCycle,
    by_service: byService,
    cashflow_months: cashflowMonths,
  }
}

export function renderLocalEmailPreview(sub, overrides = {}) {
  const cfg = { ...store.settings, ...(overrides || {}) }
  const client = sub?.client_name || 'Cwater'
  const service = sub?.service || 'Cloud server (ERP)'
  const due = fmtDate(sub?.next_due_date || todayIso())
  const days = daysUntil(sub?.next_due_date || todayIso())
  const amount = fmtMoney(sub?.amount ?? 450, sub?.currency || 'USD', { decimals: 2 })
  const cycle = sub?.billing_cycle || 'Annual'
  const when =
    days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'today' : `in ${days} days`

  const replaceTokens = (str = '') =>
    String(str)
      .replace(/\{client\}/g, client)
      .replace(/\{service\}/g, service)
      .replace(/\{amount\}/g, amount)
      .replace(/\{due\}/g, due)
      .replace(/\{when\}/g, when)
      .replace(/\{days\}/g, String(days))
      .replace(/\{cycle\}/g, cycle)

  const subject = replaceTokens(cfg.tx_subject)
  const greeting = replaceTokens(cfg.tx_greeting)
  const intro = replaceTokens(cfg.tx_intro)
  const closing = replaceTokens(cfg.tx_closing).replace(/\n/g, '<br/>')
  const cta = replaceTokens(cfg.tx_cta)
  const signoff = replaceTokens(cfg.tx_signoff).replace(/\n/g, '<br/>')
  const footer = String(cfg.email_footer || '').replace(/\n/g, '<br/>')
  const tpl = cfg.email_template || 'nest'

  const headerBand =
    tpl === 'nest'
      ? `<div style="background:linear-gradient(135deg,#0B1220,#1A2438);padding:24px 28px;color:#fff;border-radius:16px 16px 0 0;">
           <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#FF7676;font-weight:700;">Renewal Notice · ${when}</div>
           <div style="font-size:20px;font-weight:700;margin-top:6px;">${cfg.from_name || 'Nest Software Development'}</div>
         </div>`
      : tpl === 'modern'
        ? `<div style="padding:24px 28px 12px;border-top:5px solid #D92D20;">
             <div style="font-size:12px;font-weight:700;color:#D92D20;text-transform:uppercase;letter-spacing:.08em;">Subscription Renewal</div>
             <div style="font-size:19px;font-weight:700;color:#0B1220;margin-top:4px;">${service}</div>
           </div>`
        : `<div style="padding:24px 28px 8px;border-bottom:1px solid #E5E7EB;">
             <div style="font-size:16px;font-weight:700;color:#111827;">${cfg.from_name || 'Nest Software Development'}</div>
           </div>`

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F5F6F8;padding:18px;color:#0B1220;">
      <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;border:1px solid #E5E7EB;overflow:hidden;">
        ${headerBand}
        <div style="padding:24px 28px;font-size:14px;line-height:1.6;color:#1F2937;">
          <p style="margin:0 0 12px;font-weight:600;color:#0B1220;">${greeting}</p>
          <p style="margin:0 0 18px;">${intro}</p>
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:14px 16px;margin-bottom:18px;">
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #EDF2F7;">
              <span style="color:#64748B;">Service</span><strong style="color:#0B1220;">${service}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #EDF2F7;">
              <span style="color:#64748B;">Billing Cycle</span><strong style="color:#0B1220;">${cycle}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #EDF2F7;">
              <span style="color:#64748B;">Renewal Due</span><strong style="color:#D92D20;">${due}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 0 2px;">
              <span style="color:#64748B;">Amount Due</span><strong style="font-size:16px;color:#0B1220;">${amount}</strong>
            </div>
          </div>
          <p style="margin:0 0 18px;font-size:13px;color:#475467;">${closing}</p>
          <div style="margin:20px 0;">
            <span style="display:inline-block;background:#D92D20;color:#FFFFFF;font-weight:600;padding:10px 20px;border-radius:999px;font-size:13px;">${cta}</span>
          </div>
          <p style="margin:18px 0 0;font-size:13px;color:#334155;">${signoff}</p>
        </div>
        ${
          footer
            ? `<div style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:14px 28px;font-size:11.5px;line-height:1.55;color:#64748B;">${footer}</div>`
            : ''
        }
      </div>
    </div>`

  return { subject, html }
}

/* ==========================================================================
   BOOTSTRAP & DATA MUTATIONS
   ========================================================================== */
function applyBootstrapPayload(data) {
  if (!data) return
  if (data.kpis) Object.assign(store.kpis, data.kpis)
  if (data.settings) Object.assign(store.settings, data.settings)
  store.clientSubscriptions = data.client_subscriptions || []
  store.vendorSubscriptions = data.vendor_subscriptions || []
  store.wallets = data.wallets || []
  if (data.erpnext_banking) {
    Object.assign(store.erpnextBanking, data.erpnext_banking)
  }
  store.transactions = data.transactions || []
  store.reminderRules = data.reminder_rules || []
  store.emailLogs = data.email_logs || []
  store.notifications = data.notifications || []
  store.unreadNotifications = Number(data.unread_notifications || 0)
  store.analytics = computeLocalAnalytics(store.analyticsHorizon)
  syncBadge(store.unreadNotifications)
}

export async function bootstrapApp() {
  store.loading = true
  const boot = initCsrfFromDom()
  try {
    const sess = await get('subscription.api.pwa.get_session')
    store.standaloneMode = false
    store.authenticated = true
    store.user = sess.user
    store.isAdmin = Boolean(sess.is_admin)
    if (sess.permissions) Object.assign(store.permissions, sess.permissions)
    store.pushPublicKey = sess.push_public_key || ''
    if (sess.csrf_token) setCsrfToken(sess.csrf_token)

    const snap = await get('subscription.api.v1.get_bootstrap')
    applyBootstrapPayload(snap)
    await cacheSet('bootstrap', snap)
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      store.standaloneMode = false
      store.authenticated = false
      store.user = null
    } else {
      // Check if we have an IndexedDB cached snapshot from a previous Frappe session
      const cached = await cacheGet('bootstrap')
      if (cached && boot?.site_name) {
        store.standaloneMode = false
        store.authenticated = true
        applyBootstrapPayload(cached)
      } else {
        // Standalone / local Vite preview mode: run 100% interactive engine over bundled seed
        store.standaloneMode = true
        store.authenticated = true
        store.user = {
          name: 'info@nsd-eg.com',
          full_name: 'nsdLabs Admin',
          email: 'info@nsd-eg.com',
        }
        if (localStorage.getItem('subscription:local-push-enabled') === '1') {
          pwa.pushSubscribed = true
        }
        const db = loadStandaloneDb()
        applyBootstrapPayload(recomputeDerivedBootstrap(db))
      }
    }
  } finally {
    store.loading = false
    store.ready = true
  }
}

export async function refreshWorkspace() {
  if (store.standaloneMode) {
    const db = loadStandaloneDb()
    applyBootstrapPayload(recomputeDerivedBootstrap(db))
    return
  }
  const snap = await get('subscription.api.v1.get_bootstrap')
  applyBootstrapPayload(snap)
  await cacheSet('bootstrap', snap)
}

export async function loadAnalytics(horizon = store.analyticsHorizon) {
  store.analyticsHorizon = horizon
  if (store.standaloneMode) {
    store.analytics = computeLocalAnalytics(horizon)
    return store.analytics
  }
  try {
    const res = await get('subscription.api.v1.get_analytics', { horizon_months: horizon })
    store.analytics = res
    return res
  } catch {
    store.analytics = computeLocalAnalytics(horizon)
    return store.analytics
  }
}

export async function loginWithCredentials(usr, pwd) {
  const res = await post('subscription.api.pwa.login', { usr, pwd })
  if (res?.logged_in) {
    await bootstrapApp()
  }
  return res
}

export async function verifyTwoFactor(tmp_id, otp) {
  const res = await post('subscription.api.pwa.verify_otp', { tmp_id, otp })
  if (res?.logged_in) {
    await bootstrapApp()
  }
  return res
}

export async function logoutSession() {
  if (!store.standaloneMode) {
    try {
      await post('logout')
    } catch {}
  }
  await purgeLocalData()
  syncBadge(0)
  store.authenticated = false
  store.user = null
}

export async function saveClientSub(payload) {
  if (store.standaloneMode) {
    const db = loadStandaloneDb()
    const idx = db.client_subscriptions.findIndex((c) => c.name === payload.name)
    const record = {
      name: payload.name || `CSUB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      legacy_id: payload.legacy_id || '',
      client_name: String(payload.client_name || '').trim(),
      service: String(payload.service || '').trim(),
      billing_cycle: payload.billing_cycle || 'Annual',
      currency: String(payload.currency || 'USD').toUpperCase(),
      amount: Number(payload.amount || 0),
      next_due_date: payload.next_due_date || todayIso(),
      status: payload.status || 'Active',
      notes: payload.notes || '',
    }
    if (idx >= 0) db.client_subscriptions[idx] = { ...db.client_subscriptions[idx], ...record }
    else db.client_subscriptions.push(record)
    saveStandaloneDb(db)
    applyBootstrapPayload(recomputeDerivedBootstrap(db))
    return { name: record.name }
  }
  const res = await post('subscription.api.v1.save_client_subscription', {
    payload: JSON.stringify(payload),
  })
  await refreshWorkspace()
  return res
}

export async function deleteClientSub(name) {
  if (store.standaloneMode) {
    const db = loadStandaloneDb()
    db.client_subscriptions = db.client_subscriptions.filter((c) => c.name !== name)
    db.vendor_subscriptions.forEach((v) => {
      v.linked_subscriptions = (v.linked_subscriptions || []).filter(
        (l) => l.client_subscription !== name,
      )
    })
    saveStandaloneDb(db)
    applyBootstrapPayload(recomputeDerivedBootstrap(db))
    return { deleted: true }
  }
  const res = await post('subscription.api.v1.delete_client_subscription', { name })
  await refreshWorkspace()
  return res
}

export async function saveVendorSub(payload) {
  if (store.standaloneMode) {
    const db = loadStandaloneDb()
    const idx = db.vendor_subscriptions.findIndex((v) => v.name === payload.name)
    const record = {
      name: payload.name || `VSUB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      legacy_id: payload.legacy_id || '',
      vendor_name: String(payload.vendor_name || '').trim(),
      service: String(payload.service || '').trim(),
      billing_cycle: payload.billing_cycle || 'Annual',
      currency: String(payload.currency || 'USD').toUpperCase(),
      amount: Number(payload.amount || 0),
      next_due_date: payload.next_due_date || todayIso(),
      status: payload.status || 'Active',
      allocation_mode: payload.allocation_mode || 'Equal Split',
      linked_subscriptions: (payload.linked_subscriptions || []).map((l) => ({
        client_subscription:
          typeof l === 'object' ? l.client_subscription : String(l),
        allocation_weight_pct:
          typeof l === 'object' ? Number(l.allocation_weight_pct || 0) : 0,
      })),
      notes: payload.notes || '',
    }
    if (idx >= 0) db.vendor_subscriptions[idx] = { ...db.vendor_subscriptions[idx], ...record }
    else db.vendor_subscriptions.push(record)
    saveStandaloneDb(db)
    applyBootstrapPayload(recomputeDerivedBootstrap(db))
    return { name: record.name }
  }
  const res = await post('subscription.api.v1.save_vendor_subscription', {
    payload: JSON.stringify(payload),
  })
  await refreshWorkspace()
  return res
}

export async function deleteVendorSub(name) {
  if (store.standaloneMode) {
    const db = loadStandaloneDb()
    db.vendor_subscriptions = db.vendor_subscriptions.filter((v) => v.name !== name)
    saveStandaloneDb(db)
    applyBootstrapPayload(recomputeDerivedBootstrap(db))
    return { deleted: true }
  }
  const res = await post('subscription.api.v1.delete_vendor_subscription', { name })
  await refreshWorkspace()
  return res
}

export async function recordPaymentAction(payload) {
  if (store.standaloneMode) {
    const db = loadStandaloneDb()
    const rate = Number(payload.exchange_rate || db.settings.usd_egp_rate || 56.25)
    const w = db.wallets.find((x) => x.name === payload.wallet) || db.wallets[0]
    if (!w) throw new Error('Create a Wallet first before recording a payment.')
    const refKind = payload.reference_kind || 'manual'
    let newDueDate = ''

    if (refKind === 'client' && payload.client_subscription && payload.advance_due_date !== 0) {
      const c = db.client_subscriptions.find((x) => x.name === payload.client_subscription)
      if (c) {
        c.next_due_date = advanceCycleDate(c.next_due_date, c.billing_cycle)
        newDueDate = c.next_due_date
      }
    } else if (
      refKind === 'vendor' &&
      payload.vendor_subscription &&
      payload.advance_due_date !== 0
    ) {
      const v = db.vendor_subscriptions.find((x) => x.name === payload.vendor_subscription)
      if (v) {
        v.next_due_date = advanceCycleDate(v.next_due_date, v.billing_cycle)
        newDueDate = v.next_due_date
      }
    }

    const amt = Number(payload.amount || 0)
    const cur = String(payload.currency || w.currency || 'EGP').toUpperCase()
    const wAmt = convertCurrency(amt, cur, w.currency, rate)
    const txn = {
      name: `TXN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      transaction_date: payload.transaction_date || todayIso(),
      direction: payload.direction || (refKind === 'vendor' ? 'out' : 'in'),
      wallet: w.name,
      reference_kind: refKind,
      client_subscription: payload.client_subscription || '',
      vendor_subscription: payload.vendor_subscription || '',
      party: payload.party || '',
      service: payload.service || '',
      amount: amt,
      currency: cur,
      exchange_rate: rate,
      wallet_amount: wAmt,
      advance_due_date: Number(payload.advance_due_date ?? 1),
      new_due_date: newDueDate,
      notes: payload.notes || '',
    }
    db.transactions.unshift(txn)
    saveStandaloneDb(db)
    applyBootstrapPayload(recomputeDerivedBootstrap(db))
    return {
      transaction: txn.name,
      wallet_amount: wAmt,
      wallet_currency: w.currency,
      new_due_date: newDueDate,
    }
  }

  const res = await post('subscription.api.v1.record_payment', {
    payload: JSON.stringify(payload),
  })
  await refreshWorkspace()
  return res
}

export async function saveWalletAction(payload) {
  if (store.standaloneMode) {
    const db = loadStandaloneDb()
    const idx = db.wallets.findIndex((w) => w.name === payload.name)
    const record = {
      name: payload.name || `WAL-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      wallet_name: String(payload.wallet_name || '').trim(),
      wallet_type: payload.wallet_type || 'Bank',
      currency: String(payload.currency || 'EGP').toUpperCase(),
      company: payload.company || '',
      erpnext_bank: payload.erpnext_bank || '',
      erpnext_bank_account: payload.erpnext_bank_account || '',
      bank_account: payload.bank_account || '',
      bank_account_no: payload.bank_account_no || '',
      iban: payload.iban || '',
      opening_balance: Number(payload.opening_balance || 0),
      archived: Number(payload.archived || 0),
      notes: payload.notes || '',
    }
    if (idx >= 0) db.wallets[idx] = { ...db.wallets[idx], ...record }
    else db.wallets.push(record)
    saveStandaloneDb(db)
    applyBootstrapPayload(recomputeDerivedBootstrap(db))
    return { name: record.name }
  }
  const res = await post('subscription.api.v1.save_wallet', {
    payload: JSON.stringify(payload),
  })
  await refreshWorkspace()
  return res
}

export async function deleteTransactionAction(name) {
  if (store.standaloneMode) {
    const db = loadStandaloneDb()
    db.transactions = db.transactions.filter((t) => t.name !== name)
    saveStandaloneDb(db)
    applyBootstrapPayload(recomputeDerivedBootstrap(db))
    return { deleted: true }
  }
  const res = await post('subscription.api.v1.delete_transaction', { name })
  await refreshWorkspace()
  return res
}

export async function saveReminderRuleAction(payload) {
  if (store.standaloneMode) {
    const db = loadStandaloneDb()
    const idx = db.reminder_rules.findIndex(
      (r) => r.name === payload.name || r.client_name === payload.client_name,
    )
    const record = {
      name: payload.name || `RULE-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      client_name: String(payload.client_name || '').trim(),
      enabled: Number(payload.enabled ?? 1),
      to_emails: payload.to_emails || '',
      cc_emails: payload.cc_emails || '',
      offsets: (payload.offsets || []).map((o) => ({
        days_before: Number(o.days_before ?? o.days ?? 7),
        enabled: Number(o.enabled ? 1 : 0),
      })),
    }
    if (idx >= 0) db.reminder_rules[idx] = { ...db.reminder_rules[idx], ...record }
    else db.reminder_rules.push(record)
    saveStandaloneDb(db)
    applyBootstrapPayload(recomputeDerivedBootstrap(db))
    return { name: record.name }
  }
  const res = await post('subscription.api.v1.save_reminder_rule', {
    payload: JSON.stringify(payload),
  })
  await refreshWorkspace()
  return res
}

export async function deleteReminderRuleAction(name) {
  if (store.standaloneMode) {
    const db = loadStandaloneDb()
    db.reminder_rules = db.reminder_rules.filter((r) => r.name !== name)
    saveStandaloneDb(db)
    applyBootstrapPayload(recomputeDerivedBootstrap(db))
    return { deleted: true }
  }
  const res = await post('subscription.api.v1.delete_reminder_rule', { name })
  await refreshWorkspace()
  return res
}

export async function saveSettingsAction(partial) {
  if (store.standaloneMode) {
    const db = loadStandaloneDb()
    db.settings = { ...db.settings, ...partial }
    saveStandaloneDb(db)
    applyBootstrapPayload(recomputeDerivedBootstrap(db))
    return { saved: true }
  }
  const res = await post('subscription.api.v1.save_settings', {
    payload: JSON.stringify(partial),
  })
  await refreshWorkspace()
  return res
}

export async function fetchEmailPreview(clientSubName = '', overrides = null) {
  if (store.standaloneMode) {
    const sub =
      store.clientSubscriptions.find((c) => c.name === clientSubName) ||
      store.clientSubscriptions[0]
    return renderLocalEmailPreview(sub, overrides)
  }
  return post('subscription.api.v1.preview_email', {
    client_subscription: clientSubName || undefined,
    overrides: overrides ? JSON.stringify(overrides) : undefined,
  })
}

export async function sendReminderNowAction({ client_subscription, to_emails = '', is_test = 0 }) {
  if (store.standaloneMode) {
    const db = loadStandaloneDb()
    const sub = db.client_subscriptions.find((c) => c.name === client_subscription)
    const rendered = renderLocalEmailPreview(sub)
    db.email_logs.unshift({
      name: `ELOG-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      client_subscription,
      client_name: sub?.client_name || '',
      service: sub?.service || '',
      due_date: sub?.next_due_date || todayIso(),
      days_before: daysUntil(sub?.next_due_date || todayIso()),
      recipients: to_emails || 'info@nsd-eg.com',
      subject: `${is_test ? '[TEST] ' : ''}${rendered.subject}`,
      template_used: db.settings.email_template || 'nest',
      is_test: Number(is_test ? 1 : 0),
      status: 'Queued (Preview)',
      sent_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    })
    saveStandaloneDb(db)
    applyBootstrapPayload(recomputeDerivedBootstrap(db))
    return { sent: true }
  }
  const res = await post('subscription.api.v1.send_reminder_now', {
    client_subscription,
    to_emails,
    is_test: is_test ? 1 : 0,
  })
  await refreshWorkspace()
  return res
}

export async function markNotificationsReadAction(name = '') {
  if (store.standaloneMode) {
    const db = loadStandaloneDb()
    db.notifications.forEach((n) => {
      if (!name || n.name === name) n.read = 1
    })
    saveStandaloneDb(db)
    applyBootstrapPayload(recomputeDerivedBootstrap(db))
    return { unread_count: store.unreadNotifications }
  }
  const res = await post('subscription.api.v1.mark_notifications_read', {
    name: name || undefined,
  })
  await refreshWorkspace()
  return res
}

export async function sendTestPushAction() {
  if (store.standaloneMode) {
    const db = loadStandaloneDb()
    const nextItem =
      store.clientSubscriptions.find((c) => c.days_until_due <= 30) ||
      store.clientSubscriptions[0]
    const title = 'Subscription Renewal Alert'
    const body = nextItem
      ? `${nextItem.client_name} — ${nextItem.service} (${fmtMoney(nextItem.amount, nextItem.currency)}) is due ${fmtDate(nextItem.next_due_date)}.`
      : 'Push Notifications are active for upcoming subscription renewals!'
    db.notifications.unshift({
      name: `NTF-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      title,
      body,
      category: 'Test Alert',
      reference_doctype: nextItem ? 'Client Subscription' : '',
      reference_name: nextItem?.name || '',
      due_date: nextItem?.next_due_date || todayIso(),
      days_before: nextItem?.days_until_due ?? 0,
      read: 0,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    })
    saveStandaloneDb(db)
    applyBootstrapPayload(recomputeDerivedBootstrap(db))
    await triggerLocalNotification({
      title,
      body,
      url: '/subscriptions/alerts',
      badgeCount: store.unreadNotifications,
    })
    return { sent: 1 }
  }
  const res = await post('subscription.push.send_test_push')
  await refreshWorkspace()
  return res
}

export async function runAllRemindersNowAction() {
  if (store.standaloneMode) {
    return sendTestPushAction()
  }
  const res = await post('subscription.api.v1.run_all_reminders_now')
  await refreshWorkspace()
  return res
}

export async function exportWorkspaceAction() {
  let data
  if (store.standaloneMode) {
    data = {
      exported_at: new Date().toISOString(),
      publisher: 'nsdLabs — Nest Software Development',
      rate: store.kpis.usd_egp_rate,
      settings: store.settings,
      client_subscriptions: store.clientSubscriptions,
      vendor_subscriptions: store.vendorSubscriptions,
      wallets: store.wallets,
      transactions: store.transactions,
      reminder_rules: store.reminderRules,
    }
  } else {
    data = await get('subscription.api.v1.export_workspace_json')
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `subscription_backup_${todayIso()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

