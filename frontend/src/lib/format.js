export const CYCLE_MONTHS = {
  Monthly: 1,
  Quarterly: 3,
  Annual: 12,
  Biennial: 24,
}

export const CYCLE_ANNUAL_FACTOR = {
  Monthly: 12,
  Quarterly: 4,
  Annual: 1,
  Biennial: 0.5,
}

export function annualize(amount, cycle = 'Annual') {
  const factor = CYCLE_ANNUAL_FACTOR[cycle] ?? 1
  return Number((Number(amount || 0) * factor).toFixed(2))
}

export function convertCurrency(amount, fromCur = 'USD', toCur = 'EGP', rate = 56.25) {
  const val = Number(amount || 0)
  const fx = Number(rate) > 0 ? Number(rate) : 56.25
  const f = String(fromCur || 'USD').toUpperCase()
  const t = String(toCur || 'EGP').toUpperCase()
  if (f === t) return Number(val.toFixed(2))
  if (f === 'USD' && t === 'EGP') return Number((val * fx).toFixed(2))
  if (f === 'EGP' && t === 'USD') return Number((val / fx).toFixed(2))
  return Number(val.toFixed(2))
}

export function toEgp(amount, cur = 'EGP', rate = 56.25) {
  return convertCurrency(amount, cur, 'EGP', rate)
}

export function toUsd(amount, cur = 'USD', rate = 56.25) {
  return convertCurrency(amount, cur, 'USD', rate)
}

export function fmtMoney(amount, cur = 'USD', { decimals } = {}) {
  const n = Number(amount || 0)
  const c = String(cur || 'USD').toUpperCase()
  const dec =
    decimals !== undefined
      ? decimals
      : Math.abs(n % 1) > 0.004 && Math.abs(n) < 10000
        ? 2
        : 0
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(Math.abs(n))
  const sign = n < 0 ? '−' : ''
  if (c === 'USD') return `${sign}$${formatted}`
  return `${sign}${formatted} EGP`
}

export function fmtCompact(amount, cur = 'USD') {
  const n = Number(amount || 0)
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  const c = String(cur || 'USD').toUpperCase()
  let numStr
  if (abs >= 1_000_000) numStr = `${(abs / 1_000_000).toFixed(2)}M`
  else if (abs >= 10_000) numStr = `${(abs / 1_000).toFixed(1)}k`
  else
    numStr = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: abs % 1 > 0.01 ? 2 : 0,
    }).format(abs)
  return c === 'USD' ? `${sign}$${numStr}` : `${sign}${numStr} EGP`
}

export function parseIsoDate(iso) {
  if (!iso) return null
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function todayIso() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function daysUntil(iso, refIso = null) {
  const due = parseIsoDate(iso)
  const ref = refIso ? parseIsoDate(refIso) : parseIsoDate(todayIso())
  if (!due || !ref) return 0
  return Math.round((due.getTime() - ref.getTime()) / 86_400_000)
}

export function computeDueState(iso, status = 'Active') {
  if (status && status !== 'Active') return { days: 0, state: status }
  const days = daysUntil(iso)
  if (days < 0) return { days, state: 'Overdue' }
  if (days === 0) return { days, state: 'Due Today' }
  if (days <= 7) return { days, state: 'Due within 7d' }
  if (days <= 30) return { days, state: 'Due within 30d' }
  return { days, state: 'Upcoming' }
}

export function dueBadge(days, status = 'Active') {
  if (status && status !== 'Active') {
    return {
      label: status,
      tone: 'neutral',
      classes: 'bg-surface-sunk text-ink-mute border-line',
    }
  }
  const d = Number(days || 0)
  if (d < 0) {
    return {
      label: `${Math.abs(d)}d overdue`,
      tone: 'bad',
      classes: 'bg-bad/12 text-bad border-bad/25',
    }
  }
  if (d === 0) {
    return {
      label: 'Due today',
      tone: 'bad',
      classes: 'bg-bad/15 text-bad border-bad/30',
    }
  }
  if (d <= 7) {
    return {
      label: `In ${d}d`,
      tone: 'bad',
      classes: 'bg-coral-50 text-coral-600 border-coral-500/25 dark:bg-coral-500/15 dark:text-coral-400',
    }
  }
  if (d <= 30) {
    return {
      label: `In ${d}d`,
      tone: 'warn',
      classes: 'bg-warn/12 text-warn border-warn/25',
    }
  }
  return {
    label: `In ${d}d`,
    tone: 'ok',
    classes: 'bg-ok/10 text-ok border-ok/20',
  }
}

export function fmtDate(iso) {
  const dt = parseIsoDate(iso)
  if (!dt) return iso || '—'
  return dt.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function fmtShortDate(iso) {
  const dt = parseIsoDate(iso)
  if (!dt) return iso || '—'
  return dt.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })
}

export function addMonthsIso(iso, months) {
  const dt = parseIsoDate(iso) || parseIsoDate(todayIso())
  const targetMonth = dt.getMonth() + months
  const year = dt.getFullYear() + Math.floor(targetMonth / 12)
  const month = ((targetMonth % 12) + 12) % 12
  const maxDay = new Date(year, month + 1, 0).getDate()
  const day = Math.min(dt.getDate(), maxDay)
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function advanceCycleDate(iso, cycle = 'Annual') {
  const step = CYCLE_MONTHS[cycle] || 12
  const today = todayIso()
  let next = addMonthsIso(iso, step)
  let guard = 0
  while (next < today && guard < 48) {
    next = addMonthsIso(next, step)
    guard += 1
  }
  return next
}

export function initials(name = '') {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'SB'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

