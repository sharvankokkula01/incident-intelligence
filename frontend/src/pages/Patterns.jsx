import { useState } from 'react'
import { Brain } from 'lucide-react'
import { api } from '../api.js'
import { ErrorBanner, Spinner } from '../components/ui.jsx'

export default function Patterns() {
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    setBusy(true); setError('')
    try { setRes(await api.reflect()) } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-slate-100">Pattern Insights</h1>
        <p className="mt-1 text-sm text-slate-400">Reasoning over all retained incidents, generated live by Hindsight REFLECT. Nothing here is precomputed.</p>
      </header>
      <button onClick={run} disabled={busy} data-testid="reflect-button" className="btn-primary">
        {busy ? <Spinner label="Reflecting…" /> : <><Brain size={16} aria-hidden="true" />Run Hindsight REFLECT</>}
      </button>
      <ErrorBanner error={error} />
      {res && (
        <div data-testid="reflection-result" className="space-y-3">
          <p className="inline-block rounded border border-accent/50 px-2 py-0.5 font-mono text-xs text-accent">{res.source}</p>
          {res.reflections.map((r, i) => (
            <section key={i} className="anim-reveal panel p-4" style={{ animationDelay: `${i * 0.12}s` }} data-testid={`reflection-${i}`}>
              <h2 className="mb-2 text-sm font-semibold text-slate-100">{r.question}</h2>
              {r.answer ? <p className="whitespace-pre-wrap text-sm text-slate-300">{r.answer}</p> : <p className="text-sm text-amber-300">{r.error || 'No answer returned.'}</p>}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
