import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { ErrorBanner, SeverityBadge, Spinner, fmtDate } from '../components/ui.jsx'

const RETAIN = {
  retained: ['Retained', 'text-emerald-300 border-emerald-500/40'],
  failed: ['Retain failed', 'text-red-300 border-red-500/40'],
  not_retained: ['Not retained', 'text-amber-300 border-amber-500/40'],
}

export default function Timeline() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.incidents().then((r) => setItems(r.incidents)).catch((e) => setError(e.message)) }, [])

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-100">Memory Timeline</h1>
      <p className="mb-6 text-sm text-slate-400">Incident history in chronological order.</p>
      <ErrorBanner error={error} />
      {!items && !error && <Spinner label="Loading timeline…" />}
      {items?.length === 0 && <p data-testid="timeline-empty" className="panel p-4 text-sm text-slate-400">No incidents recorded yet.</p>}
      {items?.length > 0 && (
        <ol data-testid="timeline" className="relative space-y-4 border-l border-ink-600 pl-5">
          {items.map((i, n) => {
            const [rl, rc] = RETAIN[i.retain_status] || RETAIN.not_retained
            return (
              <li key={i.id} data-testid={`timeline-item-${i.id}`} className="anim-reveal panel relative p-4" style={{ animationDelay: `${Math.min(n, 8) * 0.06}s` }}>
                <span aria-hidden="true" className="absolute -left-[26px] top-5 h-2.5 w-2.5 rounded-full bg-accent" />
                <div className="flex flex-wrap items-center gap-3">
                  <Link to={`/investigations/${encodeURIComponent(i.id)}`} className="font-mono text-slate-100 hover:text-accent">Incident {i.id}</Link>
                  <SeverityBadge severity={i.severity} /><span className="text-sm">{i.service}</span>
                  <span className="text-xs text-slate-500">{fmtDate(i.occurred_at)}</span>
                  <span data-testid={`timeline-retain-${i.id}`} className={`ml-auto rounded border px-2 py-0.5 text-xs ${rc}`}>{rl}</span>
                </div>
                <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                  <div><dt className="label">Root cause</dt><dd>{i.root_cause || 'Not yet determined'}</dd></div>
                  <div><dt className="label">Outcome</dt><dd>{i.status === 'resolved' ? i.resolution : 'Active — unresolved'}</dd></div>
                  <div><dt className="label text-red-300/80">Failed actions</dt><dd>{i.failed_actions.length ? i.failed_actions.join('; ') : '—'}</dd></div>
                  <div><dt className="label text-emerald-300/80">Successful actions</dt><dd>{i.successful_actions.length ? i.successful_actions.join('; ') : '—'}</dd></div>
                </dl>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
