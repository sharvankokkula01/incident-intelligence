import { AlertTriangle, Loader2 } from 'lucide-react'

export function SeverityBadge({ severity }) {
  const hot = severity === 'SEV-1'
  const tone = hot ? 'border-red-500/60 text-red-400 bg-red-500/10'
    : severity === 'SEV-2' ? 'border-orange-500/50 text-orange-400 bg-orange-500/10'
    : 'border-amber-500/40 text-amber-400 bg-amber-500/10'
  return (
    <span data-testid="severity-badge" className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs ${tone} ${hot ? 'anim-sev' : ''}`}>
      {severity}
    </span>
  )
}

export function StatusDot({ state }) {
  const color = state === 'ok' ? 'bg-emerald-400' : state === 'warn' ? 'bg-amber-400' : state === 'bad' ? 'bg-red-500' : 'bg-slate-500'
  return <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${color} ${state === 'ok' ? 'anim-status' : ''}`} />
}

export function ErrorBanner({ error, testid = 'error-banner' }) {
  if (!error) return null
  return (
    <div role="alert" data-testid={testid} className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{error}</span>
    </div>
  )
}

export function Spinner({ label }) {
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      {label}
    </span>
  )
}

export function Stat({ label, value, testid }) {
  return (
    <div className="panel p-4">
      <div className="label">{label}</div>
      <div data-testid={testid} className="font-mono text-3xl text-slate-100">{value}</div>
    </div>
  )
}

export function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
