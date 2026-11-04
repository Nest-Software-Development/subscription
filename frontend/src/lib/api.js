export class ApiError extends Error {
  constructor(message, { status = 0, offline = false, data = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.offline = offline
    this.data = data
  }
}

let csrfToken = ''

export function initCsrfFromDom() {
  const meta = document.querySelector('meta[name="csrf-token"]')
  const raw = meta?.getAttribute('content') || ''
  if (raw && !raw.includes('{{')) {
    csrfToken = raw
  }
  const bootEl = document.getElementById('subscription-boot')
  if (bootEl && bootEl.textContent && !bootEl.textContent.includes('{{')) {
    try {
      const parsed = JSON.parse(bootEl.textContent)
      if (parsed?.csrf_token) csrfToken = parsed.csrf_token
      return parsed
    } catch {}
  }
  return null
}

export function setCsrfToken(token) {
  if (token) csrfToken = token
}

function extractFrappeError(payload, fallback) {
  if (!payload) return fallback
  if (payload._server_messages) {
    try {
      const msgs = JSON.parse(payload._server_messages)
      const first = typeof msgs[0] === 'string' ? JSON.parse(msgs[0]) : msgs[0]
      if (first?.message) {
        return first.message.replace(/<[^>]+>/g, '').trim()
      }
    } catch {}
  }
  if (typeof payload.message === 'string') return payload.message
  if (typeof payload.exc_type === 'string' && payload.exc_type === 'AuthenticationError') {
    return 'Session expired or invalid credentials.'
  }
  return fallback
}

export async function call(method, params = {}, { httpMethod = 'POST' } = {}) {
  const isGet = httpMethod.toUpperCase() === 'GET'
  let url = `/api/method/${method}`
  const headers = { Accept: 'application/json' }
  if (csrfToken) headers['X-Frappe-CSRF-Token'] = csrfToken

  const fetchOpts = {
    method: isGet ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers,
  }

  if (isGet) {
    const qs = new URLSearchParams()
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        qs.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
      }
    })
    const query = qs.toString()
    if (query) url += `?${query}`
  } else {
    headers['Content-Type'] = 'application/json'
    fetchOpts.body = JSON.stringify(params || {})
  }

  let res
  try {
    res = await fetch(url, fetchOpts)
  } catch {
    throw new ApiError('Network unavailable — viewing offline data.', { offline: true })
  }

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new ApiError(`Endpoint ${method} returned non-JSON (${res.status})`, {
      status: res.status,
      offline: res.status === 0 || res.status === 404 || res.status === 502,
    })
  }

  const data = await res.json()
  if (!res.ok) {
    throw new ApiError(extractFrappeError(data, `Request failed (${res.status})`), {
      status: res.status,
      data,
    })
  }
  return data.message !== undefined ? data.message : data
}

export function get(method, params = {}) {
  return call(method, params, { httpMethod: 'GET' })
}

export function post(method, params = {}) {
  return call(method, params, { httpMethod: 'POST' })
}

