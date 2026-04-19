import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Bell, X, Zap } from 'lucide-react'
import { notifications as notifApi, schedule as scheduleApi, dashboard as dashApi } from '../api'

const NAV = [
  { to: '/dashboard', label: 'Дашборд' },
  { to: '/schedule', label: 'Расписание' },
  { to: '/tasks', label: 'Задачи' },
  { to: '/attendance', label: 'Посещаемость' },
  { to: '/incidents', label: 'Инциденты' },
  { to: '/ai', label: 'AI ассистент' },
  { to: '/staff', label: 'Сотрудники' },
]

function BrandProfile() {
  return (
    <div className="brand-profile">
      <div className="brand-avatar">ГС</div>
      <div className="brand-profile-copy">
        <div className="brand-profile-name">Гульбара Сейтова</div>
        <div className="brand-profile-role">директор</div>
      </div>
    </div>
  )
}

function NotificationPanel({ notifs, unread, onClose, onMarkAllRead }) {
  return (
    <div className="notification-panel">
      <div className="notification-panel-head">
        <span>Уведомления</span>
        <div className="notification-panel-actions">
          {unread > 0 && (
            <button type="button" onClick={onMarkAllRead} className="notification-action-link">
              Прочитать все
            </button>
          )}
          <button type="button" onClick={onClose} className="notification-close">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="notification-list">
        {notifs.length === 0 ? (
          <div className="notification-empty">Нет уведомлений</div>
        ) : (
          notifs.map((notif) => (
            <div
              key={notif.id}
              className={`notification-item ${notif.is_read ? '' : 'notification-item--unread'}`}
            >
              <p>{notif.message}</p>
              <span>
                {notif.created_at ? new Date(notif.created_at).toLocaleString('ru-RU') : ''}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function Layout() {
  const [notifs, setNotifs] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [summary, setSummary] = useState(null)
  const [optimizing, setOptimizing] = useState(false)
  const location = useLocation()

  useEffect(() => {
    loadNotifs()
    loadSummary()
    const interval = setInterval(loadNotifs, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setShowNotifs(false)
  }, [location])

  async function loadNotifs() {
    try {
      const res = await notifApi.getAll(1)
      setNotifs(res.data)
    } catch {}
  }

  async function loadSummary() {
    try {
      const res = await scheduleApi.getSummary()
      setSummary(res.data)
    } catch {}
  }

  async function handleOptimize() {
    setOptimizing(true)
    try {
      const res = await dashApi.optimizeDay({ staff_id: 1 })
      await loadSummary()
      alert(`День оптимизирован.\n${res.data.actions?.join('\n') || 'Критических действий нет.'}`)
    } finally {
      setOptimizing(false)
    }
  }

  async function handleMarkAllRead() {
    try {
      await notifApi.markAllRead(1)
      setNotifs((current) => current.map((item) => ({ ...item, is_read: true })))
    } catch {}
  }

  const unread = notifs.filter((n) => !n.is_read).length
  const unreported = summary?.attendance?.unreported_classes?.length || 0
  const unavailable = summary?.unavailable_teachers?.length || 0
  const overdue = summary?.risks?.overdue_tasks || 0

  const issues = []
  if (unreported > 0) issues.push(`${unreported} кл не отчитались`)
  if (unavailable > 0) issues.push(`${unavailable} учит. отсутствуют`)
  if (overdue > 0) issues.push(`${overdue} просроченных задач`)

  const rawDate = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const dateStr = rawDate.charAt(0).toUpperCase() + rawDate.slice(1)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-row">
          <BrandProfile />

          <nav className="main-nav" aria-label="Основная навигация">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `main-nav-link ${isActive ? 'is-active' : ''}`}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="topbar-actions">
            <div className="notification-anchor">
              <button
                type="button"
                onClick={() => setShowNotifs((value) => !value)}
                className="notification-trigger"
                aria-label="Открыть уведомления"
              >
                <Bell size={18} />
                {unread > 0 && <span className="notification-counter">{unread > 9 ? '9+' : unread}</span>}
              </button>

              {showNotifs && (
                <NotificationPanel
                  notifs={notifs}
                  unread={unread}
                  onClose={() => setShowNotifs(false)}
                  onMarkAllRead={handleMarkAllRead}
                />
              )}
            </div>
          </div>
        </div>

        <div className="page-date">{dateStr}</div>
      </header>

      <div className="layout-grid">
        <aside className="optimization-rail">
          <div className="optimization-card">
            <div className="optimization-pill">Оптимизация</div>

            <div className="optimization-copy">
              <h2>Доброе утро!</h2>
              <p>Ситуация на сегодня:</p>

              {issues.length === 0 ? (
                <div className="issue-list issue-list--ok">Все показатели в норме</div>
              ) : (
                <ul className="issue-list">
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleOptimize}
            disabled={optimizing}
            className="solve-button"
          >
            <Zap size={14} />
            {optimizing ? 'Решаю...' : 'Решить'}
          </button>
        </aside>

        <main className="content-shell">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
