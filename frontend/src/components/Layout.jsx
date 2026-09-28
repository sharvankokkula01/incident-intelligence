import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Activity, Brain, Clock, LayoutDashboard, PlusCircle } from 'lucide-react'

const NAV = [
  { to: '/incidents/new', label: 'New Incident', icon: PlusCircle, testid: 'nav-new' },
  { to: '/overview', label: 'Overview', icon: LayoutDashboard, testid: 'nav-overview' },
  { to: '/timeline', label: 'Memory Timeline', icon: Clock, testid: 'nav-timeline' },
  { to: '/patterns', label: 'Pattern Insights', icon: Brain, testid: 'nav-patterns' },
]

export default function Layout() {
  const loc = useLocation()
  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-accent focus:px-3 focus:py-2 focus:text-ink-950">Skip to content</a>
      <aside className="border-b border-ink-600 bg-ink-900 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-4 py-4">
          <Activity className="text-accent" size={20} aria-hidden="true" />
          <div>
            <div className="text-sm font-semibold text-slate-100">Incident Intelligence</div>
            <div className="text-[11px] leading-tight text-slate-500">Powered by Hindsight memory</div>
          </div>
        </div>
        <nav aria-label="Primary" className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {NAV.map(({ to, label, icon: Icon, testid }) => (
            <NavLink key={to} to={to} data-testid={testid}
              className={({ isActive }) => `flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm ${isActive ? 'bg-ink-700 text-accent' : 'text-slate-300 hover:bg-ink-800'}`}>
              <Icon size={16} aria-hidden="true" />{label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 md:px-8">
        <div key={loc.pathname} className="anim-page mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
