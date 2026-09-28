import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Overview from './pages/Overview.jsx'
import NewIncident from './pages/NewIncident.jsx'
import Investigation from './pages/Investigation.jsx'
import Timeline from './pages/Timeline.jsx'
import Patterns from './pages/Patterns.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/incidents/new" replace />} />
        <Route path="/incidents/new" element={<NewIncident />} />
        <Route path="/investigations/:id" element={<Investigation />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/patterns" element={<Patterns />} />
        <Route path="*" element={<Navigate to="/incidents/new" replace />} />
      </Route>
    </Routes>
  )
}
