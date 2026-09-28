const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status, fields) {
    super(message)
    this.status = status
    this.fields = fields || {}
  }
}

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new ApiError('Cannot reach the Incident Intelligence backend. Is it running?', 0)
  }
  let data = null
  try { data = await res.json() } catch { /* non-JSON body */ }
  if (!res.ok) {
    const fields = {}
    ;(data?.errors || []).forEach((e) => { fields[e.field] = e.message })
    throw new ApiError(data?.detail || `Request failed (${res.status}).`, res.status, fields)
  }
  return data
}

const post = (path, body) => request(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })

export const api = {
  health: () => request('/api/health'),
  dashboard: () => request('/api/dashboard'),
  incidents: () => request('/api/incidents'),
  loadDemo: () => post('/api/demo/load'),
  investigate: (b) => post('/api/incidents/investigate', b),
  resolve: (id, b) => post(`/api/incidents/${encodeURIComponent(id)}/resolve`, b),
  reflect: () => post('/api/patterns/reflect'),
}
