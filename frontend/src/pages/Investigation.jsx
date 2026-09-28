import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Database, ShieldX } from 'lucide-react'
import { api } from '../api.js'
import { ErrorBanner, SeverityBadge, Spinner } from '../components/ui.jsx'
import RecallFlow from '../components/RecallFlow.jsx'

const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean)

function Actions({ title, items, tone, icon: Icon, testid }) {
  const c = tone === 'ok' ? 'border-emerald-500/40 text-emerald-300' : 'border-red-500/40 text-red-300'
  return (
    <section data-testid={testid} className={`rounded-md border ${c} bg-ink-800 p-3`}>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"><Icon size={14} aria-hidden="true" />{title}</h3>
      {items?.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
        : <p className="text-sm text-slate-400">None identified in recalled memory.</p>}
    </section>
  )
}

function ResolvePanel({ incident, hist, onDone }) {
  const [f, setF] = useState({ root_cause: '', failed: '', successful: '', resolution: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (f.root_cause.trim().length < 3 || f.resolution.trim().length < 3) { setErr('Root cause and resolution are required.'); return }
    setBusy(true)
    try {
      const res = await api.resolve(incident.id, { root_cause: f.root_cause, failed_actions: lines(f.failed), successful_actions: lines(f.successful), resolution: f.resolution })
      onDone(res.incident)
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} noValidate className="panel space-y-3 p-5" data-testid="resolve-form">
      <h2 className="text-sm font-semibold text-slate-100">Resolve incident &amp; retain to memory</h2>
      <p className="text-xs text-slate-400">Record what actually happened. This is sent to Hindsight RETAIN so future incidents can learn from it.</p>
      {hist && (
        <button type="button" data-testid="prefill-button" className="btn-ghost text-xs" onClick={() => setF({
          root_cause: hist.probable_root_cause || '', failed: (hist.failed_actions || []).join('\n'),
          successful: (hist.successful_actions || []).join('\n'), resolution: hist.resolution || '' })}>
          Prefill from historical match (review before saving)
        </button>
      )}
      <div><label className="label" htmlFor="rc">Confirmed root cause</label>
        <input id="rc" data-testid="resolve-root-cause-input" className="field" value={f.root_cause} onChange={set('root_cause')} /></div>
      <div className="grid gap-3 md:grid-cols-2">
        <div><label className="label" htmlFor="fa">Failed actions (one per line)</label>
          <textarea id="fa" data-testid="resolve-failed-input" rows={3} className="field" value={f.failed} onChange={set('failed')} /></div>
        <div><label className="label" htmlFor="sa">Successful actions (one per line)</label>
          <textarea id="sa" data-testid="resolve-successful-input" rows={3} className="field" value={f.successful} onChange={set('successful')} /></div>
      </div>
      <div><label className="label" htmlFor="res">Final resolution</label>
        <textarea id="res" data-testid="resolve-resolution-input" rows={2} className="field" value={f.resolution} onChange={set('resolution')} /></div>
      <ErrorBanner error={err} />
      <button type="submit" disabled={busy} data-testid="resolve-incident-button" className="btn-primary">
        {busy ? <Spinner label="Retaining…" /> : 'Resolve & Retain'}
      </button>
    </form>
  )
}

export default function Investigation() {
  const { id } = useParams()
  const { state } = useLocation()
  const [incident, setIncident] = useState(state?.incident || null)
  const [loadErr, setLoadErr] = useState('')

  useEffect(() => {
    if (incident?.id === id) return
    api.incidents().then((r) => {
      const m = r.incidents.find((i) => i.id === id)
      m ? setIncident(m) : setLoadErr(`Incident ${id} was not found.`)
    }).catch((e) => setLoadErr(e.message))
  }, [id, incident])

  if (loadErr) return <div className="space-y-3"><ErrorBanner error={loadErr} /><Link className="btn-ghost" to="/incidents/new">New incident</Link></div>
  if (!incident) return <Spinner label="Loading investigation…" />

  const inv = incident.investigation
  const hist = inv?.historical
  const rec = inv?.recommendation
  const resolved = incident.status === 'resolved'
  const retained = incident.retain_status === 'retained'
  const recallText = !inv ? 'No recall was run for this incident (demo memory).'
    : inv.recall.status === 'empty' ? 'Hindsight recall completed: no memories returned.'
    : `Hindsight recall completed: ${inv.recall.count} memor${inv.recall.count === 1 ? 'y' : 'ies'} returned.`

  return (
    <div className="space-y-5">
      <header className="panel p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-xl text-slate-100" data-testid="incident-id">Incident {incident.id}</h1>
          <SeverityBadge severity={incident.severity} />
          <span className="text-sm text-slate-300" data-testid="incident-service">{incident.service}</span>
          <span className={`ml-auto rounded border px-2 py-0.5 text-xs ${resolved ? 'border-emerald-500/40 text-emerald-300' : 'border-amber-500/40 text-amber-300'}`} data-testid="incident-status">{resolved ? 'Resolved' : 'Active'}</span>
        </div>
        <p className="mt-2 font-mono text-sm text-slate-300">{incident.error_message}</p>
        <p className="text-sm text-slate-400">{incident.symptoms}</p>
        <p data-testid="recall-status" role="status" className="mt-3 text-xs text-slate-400">{recallText}</p>
      </header>

      {inv && <RecallFlow mode="done" found={inv.historical_experience_found} />}

      {inv && !inv.historical_experience_found && (
        <div data-testid="no-history-message" className="panel border-amber-500/40 p-5 text-amber-200">
          {inv.message}
          <p className="mt-2 text-xs text-slate-400">No recommendation was generated from history. Gather more evidence, and retain this incident once resolved so it can help next time.</p>
        </div>
      )}

      {inv?.historical_experience_found && hist && (
        <section data-testid="historical-experience-banner" className="anim-glow rounded-lg border-2 border-accent bg-ink-900 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Database className="text-accent" size={20} aria-hidden="true" />
            <h2 className="text-lg font-bold tracking-wide text-accent">HISTORICAL EXPERIENCE FOUND</h2>
          </div>
          <div data-testid="historical-memory-card" className="mt-4 space-y-4">
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <div><dt className="label">Historical incident</dt><dd className="font-mono text-slate-100" data-testid="historical-incident-id">{hist.incident_id ? `Incident ${hist.incident_id}` : 'Not identified in memory'}</dd></div>
              <div><dt className="label">Similarity / context</dt><dd>{hist.context || 'Recalled by semantic similarity to the current incident.'}</dd></div>
              <div className="md:col-span-2"><dt className="label">Probable root cause (historical)</dt><dd data-testid="historical-root-cause">{hist.probable_root_cause || 'Not stated in recalled memory.'}</dd></div>
            </dl>
            <div className="grid gap-3 md:grid-cols-2">
              <Actions title="What failed previously" items={hist.failed_actions} tone="bad" icon={ShieldX} testid="failed-actions-section" />
              <Actions title="What worked previously" items={hist.successful_actions} tone="ok" icon={CheckCircle2} testid="successful-actions-section" />
            </div>
            {hist.resolution && <p className="text-sm" data-testid="final-resolution"><span className="label">Final resolution (historical)</span>{hist.resolution}</p>}
            <div data-testid="evidence-section">
              <h3 className="label">Evidence used from memory</h3>
              <ul className="space-y-2">
                {hist.evidence.map((e, i) => (
                  <li key={i} className="rounded border border-ink-600 bg-ink-800 p-2 font-mono text-xs text-slate-300 whitespace-pre-wrap">
                    {e.incident_id && <span className="text-accent">[Incident {e.incident_id}] </span>}{e.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {inv?.historical_experience_found && !rec && (
        <div data-testid="llm-unavailable" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">{inv.message}</div>
      )}

      {rec && (
        <section data-testid="recommendation-section" className="anim-reveal panel space-y-3 p-5" style={{ animationDelay: '1.2s' }}>
          <h2 className="text-sm font-semibold text-slate-100">Recommendation</h2>
          <p className="text-sm"><span className="label">Probable root cause</span><span data-testid="probable-root-cause">{rec.probable_root_cause}</span></p>
          <div>
            <span className="label">Recommended next steps</span>
            <ol className="list-decimal space-y-1 pl-5 text-sm" data-testid="next-steps">{rec.recommended_next_steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </div>
          <p className="text-sm" data-testid="confidence"><span className="label">Confidence</span>
            <span className="font-mono">{rec.confidence_label.toUpperCase()} ({Math.round(rec.confidence_score * 100)}%)</span>
            <span className="text-slate-400"> — an estimate, not a guarantee.</span></p>
          {rec.evidence_basis.length > 0 && <div><span className="label">Evidence basis</span><ul className="list-disc pl-5 text-sm text-slate-300">{rec.evidence_basis.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
          <div data-testid="uncertainty-warning" className="flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{rec.validation_warning}
          </div>
        </section>
      )}

      {!resolved && <ResolvePanel incident={incident} hist={hist} onDone={setIncident} />}

      {(resolved || incident.retain_status === 'failed') && (
        <div className="panel flex flex-wrap items-center gap-3 p-4">
          <span data-testid="retain-status" role="status" className={retained ? 'text-emerald-300' : 'text-amber-300'}>
            {retained ? 'Retained in Hindsight memory.' : 'Retain failed — Hindsight did not store this incident.'}
          </span>
          {retained && <Link to="/patterns" data-testid="go-reflect-link" className="btn-primary ml-auto">Run Hindsight REFLECT</Link>}
        </div>
      )}
    </div>
  )
}
