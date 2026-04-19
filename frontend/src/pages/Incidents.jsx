import { useEffect, useState } from 'react'
import { AlertTriangle, Plus, RefreshCw, CheckCircle, Clock, MapPin, User, Wrench, Heart, Shield, HelpCircle, SendHorizontal, Bot } from 'lucide-react'
import { incidents as incidentsApi, staff as staffApi } from '../api'

// ── Constants ───────────────────────────────────────────────────────────────
const PRIORITY_LABELS  = { urgent: 'Срочно', high: 'Высокий', medium: 'Средний', low: 'Низкий' }
const CATEGORY_ICONS   = { maintenance: Wrench, discipline: Shield, health: Heart, other: HelpCircle }
const CATEGORY_LABELS  = { maintenance: 'Техническая', discipline: 'Дисциплина', health: 'Здоровье', other: 'Прочее' }
const STATUS_LABELS    = { open: 'Открыт', in_progress: 'В работе', resolved: 'Решён' }

const PRIORITY_BORDER = {
  urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: 'rgba(255,255,255,0.15)'
}

const CARD = {
  background: 'var(--panel-strong)',
  border: '1px solid var(--panel-border)',
  borderRadius: '36px',
  boxShadow: 'var(--shadow-panel), var(--shadow-soft)',
}

// ── IncidentCard ─────────────────────────────────────────────────────────────
function IncidentCard({ incident, staff, onUpdate }) {
  const Icon       = CATEGORY_ICONS[incident.category] || HelpCircle
  const assignee   = staff.find(s => s.id === incident.assigned_to_id)
  const isResolved = incident.status === 'resolved'

  const statusStyle = {
    resolved:    { background: 'rgba(34,197,94,0.2)',   color: '#86efac' },
    in_progress: { background: 'rgba(61,80,216,0.25)',  color: '#93c5fd' },
    open:        { background: 'rgba(239,68,68,0.2)',   color: '#f87171' },
  }[incident.status] || {}

  return (
    <div
      className="soft-list-item transition-all"
      style={{
        borderLeft: `4px solid ${PRIORITY_BORDER[incident.priority]}`,
        borderLeftWidth: '4px',
        borderLeftColor: PRIORITY_BORDER[incident.priority],
        opacity: isResolved ? 0.6 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className="p-2 rounded-2xl flex-shrink-0"
            style={{ background: isResolved ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)' }}
          >
            {isResolved
              ? <CheckCircle size={15} style={{ color: '#4ade80' }} />
              : <Icon size={15} style={{ color: 'rgba(255,255,255,0.65)' }} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm">{incident.title}</div>
            {incident.description && (
              <p className="text-xs mt-1 line-clamp-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{incident.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {incident.location && (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  <MapPin size={9} /> {incident.location}
                </span>
              )}
              <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                {CATEGORY_LABELS[incident.category]}
              </span>
              <span className="badge" style={{ background: PRIORITY_BORDER[incident.priority] + '33', color: PRIORITY_BORDER[incident.priority] }}>
                {PRIORITY_LABELS[incident.priority]}
              </span>
              {incident.source === 'telegram' && (
                <span className="badge flex items-center gap-1" style={{ background: 'rgba(61,80,216,0.2)', color: '#93c5fd' }}>
                  <SendHorizontal size={11} />Telegram
                </span>
              )}
              {incident.source === 'ai' && (
                <span className="badge flex items-center gap-1" style={{ background: 'rgba(168,85,247,0.2)', color: '#c084fc' }}>
                  <Bot size={11} />AI
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="badge text-xs font-medium" style={statusStyle}>{STATUS_LABELS[incident.status]}</span>
          <div className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <Clock size={9} />
            {new Date(incident.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          {assignee ? (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'rgba(61,80,216,0.3)', color: '#93c5fd' }}>
                {assignee.name[0]}
              </div>
              {assignee.name.split(' ')[0]}
            </div>
          ) : (
            <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <User size={9} /> Не назначен
            </span>
          )}
          {incident.reported_by && (
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>от: {incident.reported_by}</span>
          )}
        </div>

        {!isResolved && (
          <div className="flex items-center gap-1">
            {incident.status === 'open' && (
              <button
                onClick={() => onUpdate(incident.id, { status: 'in_progress' })}
                className="text-xs px-3 py-1.5 rounded-xl transition-colors"
                style={{ background: 'rgba(61,80,216,0.2)', color: '#93c5fd' }}
              >
                В работу
              </button>
            )}
            <button
              onClick={() => onUpdate(incident.id, { status: 'resolved' })}
              className="text-xs px-3 py-1.5 rounded-xl transition-colors"
              style={{ background: 'rgba(34,197,94,0.2)', color: '#86efac' }}
            >
              Решено
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── CategoryStat ─────────────────────────────────────────────────────────────
function CategoryStat({ cat, label, count }) {
  const Icon = CATEGORY_ICONS[cat] || HelpCircle
  return (
    <div className="page-panel-tight" style={CARD}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} style={{ color: 'rgba(255,255,255,0.5)' }} />
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.04em' }}>{count}</div>
      <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>открытых</div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function IncidentsPage() {
  const [allIncidents, setAllIncidents] = useState([])
  const [staff, setStaff]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('active')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', category: 'maintenance',
    location: '', priority: 'medium', assigned_to_id: '',
  })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [iRes, sRes] = await Promise.all([incidentsApi.getAll(), staffApi.getAll()])
      setAllIncidents(iRes.data)
      setStaff(sRes.data)
    } finally { setLoading(false) }
  }

  async function handleUpdate(id, data) {
    await incidentsApi.update(id, data)
    setAllIncidents(prev => prev.map(i => i.id === id ? { ...i, ...data } : i))
  }

  async function handleCreate(e) {
    e.preventDefault()
    await incidentsApi.create({
      ...form,
      assigned_to_id: form.assigned_to_id ? parseInt(form.assigned_to_id) : null,
    })
    setShowForm(false)
    setForm({ title: '', description: '', category: 'maintenance', location: '', priority: 'medium', assigned_to_id: '' })
    loadAll()
  }

  const displayed = allIncidents.filter(i =>
    filter === 'all'      ? true :
    filter === 'active'   ? i.status !== 'resolved' :
    i.status === filter
  )

  const counts = {
    active:      allIncidents.filter(i => i.status !== 'resolved').length,
    open:        allIncidents.filter(i => i.status === 'open').length,
    in_progress: allIncidents.filter(i => i.status === 'in_progress').length,
    resolved:    allIncidents.filter(i => i.status === 'resolved').length,
  }

  return (
    <div className="page-shell animate-slide-up">

      {/* ── Toolbar ── */}
      <div className="page-toolbar">
        <div className="page-intro">
          <h2>Инциденты</h2>
          <p>Регистрация, маршрутизация и контроль проблем по школе в одной ленте.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={15} /> Новый инцидент
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="pill-tabs">
        {[
          ['active',      `Активные (${counts.active})`],
          ['open',        `Открытые (${counts.open})`],
          ['in_progress', `В работе (${counts.in_progress})`],
          ['resolved',    `Решённые (${counts.resolved})`],
          ['all',         'Все'],
        ].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`pill-tab ${filter === v ? 'is-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Create form ── */}
      {showForm && (
        <div className="app-panel animate-slide-up" style={{ padding: '24px' }}>
          <h3
            className="flex items-center gap-2 mb-4"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.025em', margin: '0 0 16px' }}
          >
            <AlertTriangle size={15} style={{ color: '#fb923c' }} /> Зарегистрировать инцидент
          </h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              required
              className="input"
              placeholder="Краткое описание (напр. В кабинете 12 сломалась парта)"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            />
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Подробности (необязательно)"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input
                className="input"
                placeholder="Место (каб. 12)"
                value={form.location}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
              />
              <select className="input" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select className="input" value={form.assigned_to_id} onChange={e => setForm(p => ({ ...p, assigned_to_id: e.target.value }))}>
                <option value="">Ответственный</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">Создать</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Отмена</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Category stats ── */}
      <div className="three-panel-grid">
        {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
          <CategoryStat
            key={cat}
            cat={cat}
            label={label}
            count={allIncidents.filter(i => i.category === cat && i.status !== 'resolved').length}
          />
        ))}
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="dashboard-loading">
          <RefreshCw size={18} className="animate-spin" />
          <span>Загрузка инцидентов...</span>
        </div>
      ) : displayed.length === 0 ? (
        <div className="app-panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <CheckCircle size={40} style={{ color: 'rgba(74,222,128,0.4)', display: 'block', margin: '0 auto 12px' }} />
          <div style={{ color: 'var(--text-muted)' }}>Инцидентов нет</div>
        </div>
      ) : (
        <div className="soft-list">
          {displayed.map(inc => (
            <IncidentCard key={inc.id} incident={inc} staff={staff} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  )
}
