import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Schedule from './pages/Schedule'
import Tasks from './pages/Tasks'
import AttendancePage from './pages/Attendance'
import IncidentsPage from './pages/Incidents'
import AIAssistant from './pages/AIAssistant'
import StaffPage from './pages/Staff'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="ai" element={<AIAssistant />} />
          <Route path="staff" element={<StaffPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
