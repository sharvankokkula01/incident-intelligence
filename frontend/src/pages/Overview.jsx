import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DatabaseZap, PlusCircle } from 'lucide-react'
import { api } from '../api.js'
import { ErrorBanner, SeverityBadge, Spinner, Stat, StatusDot, fmtDate } from '../components/ui.jsx'

export default function Overview() {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [demo, setDemo] = useState({ busy: false, msg: '', error: '' })

  const load = useCallback(() => {
    api.dashboard().then((r) => { setD(r); setError('') }).catch((e) => setError(e.message))
  }, [])
  useEffect(load, [load])

  async function loadDemo() {
    setDemo({ busy: true, msg: '', error: '' })
    try {
      const r = await api.loadDemo()
      setDemo({ busy: false, error: '', msg: `Retained ${r.retained} incident(s) in Hindsight; ${r.skipped_existing} already present (${r.total} total).` })
      load()
    } catch (e) { setDemo({ busy: false, msg: '', error: e.message }) }
  }

  const hs = d?.hindsight
  const hsState = !hs ? 'idle' : !hs.configured ? 'bad' : hs.reachable ? 'ok' : 'warn'
  const hsText = !hs ? 'Checking…' : !hs.configured ? 'Not configured' : hs.reachable ? 'Connected' : 'Unreachable'

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold text-slate-100">Overview</h1>
          <p className="text-sm text-slate-400">Every incident makes the next incident easier to solve.</p>
        </div>
        <button onClick={loadDemo} disabled={demo.busy} data-testid="load-demo-button" className="btn-ghost">
          {demo.busy ? <Spinner label="Retaining demo incidents…" /> : <><DatabaseZap size={16} aria-hidden="true" />Load demo memory</>}
        </button>
        <Link to="/incidents/new" data-testid="new-incident-button" className="btn-primary"><PlusCircle size={16} aria-hidden="true" />New incident</Link>
      </header>

      <ErrorBanner error={demo.error} testid="demo-error" />
      {demo.msg && <p role="status" data-testid="demo-result" className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{demo.msg}</p>}
      <ErrorBanner error={error} />
      {!d && !error && <Spinner label="Loading dashboard…" />}

      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Active incidents" value={d.active_incidents} testid="stat-active" />
            <Stat label="Resolved incidents" value={d.resolved_incidents} testid="stat-resolved" />
            <Stat label="Memory experiences" value={d.memory_experiences} testid="stat-memory" />
            <Stat label="Services with repeat incidents" value={d.recurring_patterns.length} testid="stat-patterns" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="panel flex items-center gap-2 p-4" data-testid="hindsight-status" role="status"><StatusDot state={hsState} /><span className="text-sm">Hindsight: {hsText}</span></div>
            <div className="panel flex items-center gap-2 p-4" data-testid="llm-status" role="status"><StatusDot state={d.llm.configured ? 'ok' : 'warn'} /><span className="text-sm">LLM: {d.llm.configured ? 'Configured' : 'Not configured'}</span></div>
          </div>
          {d.recurring_patterns.length > 0 && (
            <p className="text-sm text-slate-400">Repeat services: {d.recurring_patterns.map((p) => `${p.service} (${p.count})`).join(', ')}</p>
          )}
          <section className="panel" aria-labelledby="recent">
            <h2 id="recent" className="border-b border-ink-600 px-4 py-3 text-sm font-semibold text-slate-100">Recent incidents</h2>
            {d.recent_incidents.length === 0 ? <p className="p-4 text-sm text-slate-400" data-testid="no-incidents">No incidents yet. Load demo memory or investigate a new incident.</p> : (
              <ul className="divide-y divide-ink-700" data-testid="recent-incidents">
                {d.recent_incidents.map((i) => (
                  <li key={i.id}>
                    <Link to={`/investigations/${encodeURIComponent(i.id)}`} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-ink-800">
                      <span className="font-mono text-slate-100">{i.id}</span><SeverityBadge severity={i.severity} />
                      <span>{i.service}</span><span className="text-slate-400">{i.error_message}</span>
                      <span className="ml-auto text-xs text-slate-500">{fmtDate(i.occurred_at)} · {i.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
