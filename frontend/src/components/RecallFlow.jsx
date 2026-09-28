import { CheckCircle2, Database, Lightbulb, Search, ShieldX, Siren, Sparkles } from 'lucide-react'

const STEPS = [
  { key: 'incident', label: 'Current Incident', icon: Siren },
  { key: 'search', label: 'Searching Hindsight', icon: Search },
  { key: 'found', label: 'Historical Experience Found', icon: Database },
  { key: 'worked', label: 'What Worked', icon: CheckCircle2 },
  { key: 'failed', label: 'What Failed', icon: ShieldX },
  { key: 'evidence', label: 'Evidence', icon: Sparkles },
  { key: 'rec', label: 'Recommendation', icon: Lightbulb },
]

/** mode "searching": first two steps. mode "done": all steps, revealed in sequence.
 *  Every step is plain text in the DOM, so nothing depends on animation. */
export default function RecallFlow({ mode, found = true }) {
  const steps = mode === 'searching' || !found ? STEPS.slice(0, 2) : STEPS
  return (
    <ol data-testid="recall-flow" aria-label="Recall progress" className="flex flex-wrap items-stretch gap-2">
      {steps.map((s, i) => {
        const Icon = s.icon
        const active = mode === 'searching' && i === 1
        return (
          <li key={s.key} className={`anim-reveal relative flex items-center gap-2 overflow-hidden rounded-md border px-3 py-2 text-xs ${active ? 'border-accent text-accent' : 'border-ink-600 text-slate-300'}`}
              style={{ animationDelay: mode === 'done' ? `${i * 0.18}s` : '0s' }}>
            <Icon size={14} aria-hidden="true" />
            <span>{s.label}</span>
            {active && <span aria-hidden="true" className="anim-scan absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-accent/20 to-transparent" />}
            {i < steps.length - 1 && <span aria-hidden="true" className="ml-1 text-slate-600">→</span>}
          </li>
        )
      })}
    </ol>
  )
}
