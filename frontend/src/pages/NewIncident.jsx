import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Wand2 } from 'lucide-react'
import { api, ApiError } from '../api.js'
import { ErrorBanner } from '../components/ui.jsx'
import RecallFlow from '../components/RecallFlow.jsx'

const EMPTY = { incident_id: '', service: '', severity: 'SEV-2', error_message: '', symptoms: '', logs: '', recent_change: '' }
const EXAMPLE = {
  incident_id: '1087', service: 'Payment API', severity: 'SEV-2', error_message: 'Connection pool exhausted',
  symptoms: 'Checkout requests time out under load', logs: 'Database connection pool is at capacity',
  recent_change: 'New Payment API deployment',
}

function validate(f) {
  const e = {}
  if (f.service.trim().length < 2) e.service = 'Service is required.'
  if (f.error_message.trim().length < 3) e.error_message = 'Describe the error message.'
  if (f.symptoms.trim().length < 3) e.symptoms = 'Describe the observed symptoms.'
  if (f.incident_id && !/^[A-Za-z0-9-]{1,32}$/.test(f.incident_id)) e.incident_id = 'Use letters, numbers and dashes only.'
  return e
}

function Field({ id, label, error, required, children }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}{required && <span className="text-red-400"> *</span>}</label>
      {children}
      {error && <p id={`${id}-err`} data-testid={`${id}-error`} className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}

export default function NewIncident() {
  const nav = useNavigate()
  const [f, setF] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const a11y = (k) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${k}-err` : undefined })

  async function submit(e) {
    e.preventDefault()
    setApiError('')
    const v = validate(f)
    setErrors(v)
    if (Object.keys(v).length) return
    setLoading(true)
    try {
      const res = await api.investigate(f)
      nav(`/investigations/${encodeURIComponent(res.incident.id)}`, { state: res })
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors(err.fields)
      setApiError(err.message)
      setLoading(false)
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-100">New Incident Investigation</h1>
        <p className="mt-1 text-sm text-slate-400">Describe what is happening. Hindsight will be searched for similar past incidents.</p>
      </header>
      <form onSubmit={submit} noValidate className="panel space-y-4 p-5" aria-busy={loading}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field id="service" label="Service" required error={errors.service}>
            <input id="service" data-testid="incident-service-input" className="field" value={f.service} onChange={set('service')} placeholder="e.g. Payment API" {...a11y('service')} />
          </Field>
          <Field id="severity" label="Severity" required error={errors.severity}>
            <select id="severity" data-testid="incident-severity-input" className="field" value={f.severity} onChange={set('severity')}>
              {['SEV-1', 'SEV-2', 'SEV-3', 'SEV-4'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field id="incident_id" label="Incident ID (optional)" error={errors.incident_id}>
            <input id="incident_id" data-testid="incident-id-input" className="field font-mono" value={f.incident_id} onChange={set('incident_id')} placeholder="auto-generated if empty" {...a11y('incident_id')} />
          </Field>
        </div>
        <Field id="error_message" label="Error message" required error={errors.error_message}>
          <input id="error_message" data-testid="incident-error-input" className="field font-mono" value={f.error_message} onChange={set('error_message')} placeholder="e.g. Connection pool exhausted" {...a11y('error_message')} />
        </Field>
        <Field id="symptoms" label="Symptoms" required error={errors.symptoms}>
          <textarea id="symptoms" data-testid="incident-symptoms-input" rows={2} className="field" value={f.symptoms} onChange={set('symptoms')} placeholder="What are users and systems experiencing?" {...a11y('symptoms')} />
        </Field>
        <Field id="logs" label="Logs" error={errors.logs}>
          <textarea id="logs" data-testid="incident-logs-input" rows={3} className="field font-mono text-xs" value={f.logs} onChange={set('logs')} placeholder="Relevant log lines" />
        </Field>
        <Field id="recent_change" label="Recent change" error={errors.recent_change}>
          <input id="recent_change" data-testid="incident-change-input" className="field" value={f.recent_change} onChange={set('recent_change')} placeholder="Deploy, config or infrastructure change" />
        </Field>
        <ErrorBanner error={apiError} />
        {loading && (
          <div data-testid="recall-status" role="status" className="space-y-2">
            <p className="text-sm text-accent">Searching Hindsight for similar incidents…</p>
            <RecallFlow mode="searching" />
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={loading} data-testid="investigate-incident-button" className="btn-primary">
            <Search size={16} aria-hidden="true" />{loading ? 'Investigating…' : 'Investigate Incident'}
          </button>
          <button type="button" disabled={loading} data-testid="fill-example-button" className="btn-ghost" onClick={() => { setF(EXAMPLE); setErrors({}) }}>
            <Wand2 size={16} aria-hidden="true" />Fill Incident 1087 example
          </button>
        </div>
      </form>
    </div>
  )
}
