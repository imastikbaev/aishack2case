import { useEffect, useState } from 'react'
import { RefreshCw, Shield, Clock, Dot, ArrowRight, Bell, UserCheck, UserX, ChevronDown } from 'lucide-react'
import { staff as staffApi, ai } from '../api'
import { useAppShell } from '../context/AppShellContext'

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLE_LABELS = {
  director: 'Директор', vice_principal: 'Завуч', teacher: 'Учитель',
  secretary: 'Секретарь', maintenance_chief: 'Завхоз', technician: 'Техник',
}

const ROLE_BG = {
  director:         'rgba(168,85,247,0.2)',
  vice_principal:   'rgba(99,102,241,0.2)',
  teacher:          'rgba(143,134,255,0.2)',
  secretary:        'rgba(255,255,255,0.08)',
  maintenance_chief:'rgba(245,158,11,0.2)',
  technician:       'rgba(249,115,22,0.2)',
}

const ROLE_COLOR = {
  director:         '#c084fc',
  vice_principal:   '#a5b4fc',
  teacher:          '#d8d3f6',
  secretary:        'rgba(255,255,255,0.5)',
  maintenance_chief:'#fcd34d',
  technician:       '#fdba74',
}

const CARD = {
  background: 'var(--panel-strong)',
  border: '1px solid var(--panel-border)',
  borderRadius: '36px',
  boxShadow: 'var(--shadow-panel), var(--shadow-soft)',
}

// ── RiskBar ───────────────────────────────────────────────────────────────────
function RiskBar({ score }) {
  const pct   = Math.round(score * 100)
  const color = score >= 0.7 ? '#ef4444' : score >= 0.5 ? '#f97316' : score >= 0.3 ? '#eab308' : '#22c55e'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs w-8 text-right" style={{ color: 'rgba(255,255,255,0.45)' }}>{pct}%</span>
    </div>
  )
}

// ── StaffCard ─────────────────────────────────────────────────────────────────
function StaffCard({ s, risk, onToggleAvailability, onSendNotification }) {
  const [toggling, setToggling]   = useState(false)
  const [notifying, setNotifying] = useState(false)
  const [isOpen, setIsOpen]       = useState(false)

  const riskLevel    = risk?.risk_level || 'low'
  const isOverloaded = s.current_hours_week > s.max_hours_per_week && s.max_hours_per_week > 0

  async function handleToggle(e) {
    e.stopPropagation()
    setToggling(true)
    try { await onToggleAvailability(s.id, !s.is_available) }
    finally { setToggling(false) }
  }

  async function handleNotify(e) {
    e.stopPropagation()
    setNotifying(true)
    try { await onSendNotification(s) }
    finally { setNotifying(false) }
  }

  return (
    <div
      className="app-panel transition-all cursor-pointer"
      style={{
        padding: '20px 22px',
        opacity: !s.is_available ? 0.75 : 1,
        border: !s.is_available ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--panel-border)',
      }}
      onClick={() => setIsOpen(o => !o)}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0"
          style={{
            fontFamily: 'var(--font-display)',
            background: !s.is_available ? 'rgba(239,68,68,0.2)' : 'rgba(143,134,255,0.25)',
            color:      !s.is_available ? '#f87171'             : '#d8d3f6',
          }}
        >
          {s.name[0]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.015em' }}>
                {s.name}
              </div>
              <span
                className="badge mt-1 text-xs"
                style={{ background: ROLE_BG[s.role] || 'rgba(255,255,255,0.08)', color: ROLE_COLOR[s.role] || 'rgba(255,255,255,0.55)' }}
              >
                {ROLE_LABELS[s.role] || s.role}
              </span>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
              {/* Notify button */}
              {s.telegram_username && (
                <button
                  onClick={handleNotify}
                  disabled={notifying}
                  className="btn-secondary text-xs"
                  style={{ padding: '6px 10px' }}
                  title={`Отправить уведомление @${s.telegram_username}`}
                >
                  {notifying ? <RefreshCw size={12} className="animate-spin" /> : <Bell size={12} />}
                  Уведомить
                </button>
              )}
              {/* Availability toggle */}
              <button
                onClick={handleToggle}
                disabled={toggling}
                className={s.is_available ? 'btn-secondary' : 'btn-danger'}
                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                title={s.is_available ? 'Отметить как отсутствует' : 'Отметить как присутствует'}
              >
                {toggling
                  ? <RefreshCw size={12} className="animate-spin" />
                  : s.is_available
                    ? <UserX size={12} />
                    : <UserCheck size={12} />}
                {s.is_available ? 'Отс.' : 'Вернулся'}
              </button>
            </div>
          </div>

          {/* Subjects */}
          {s.subjects?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {s.subjects.slice(0, 3).map(sub => (
                <span key={sub} className="badge text-xs" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
                  {sub}
                </span>
              ))}
              {s.subjects.length > 3 && (
                <span className="badge text-xs" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>
                  +{s.subjects.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Teacher load + risk */}
          {s.role === 'teacher' && (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <span className="flex items-center gap-1"><Clock size={9} /> Нагрузка</span>
                <span style={{ color: isOverloaded ? '#f87171' : 'inherit', fontWeight: isOverloaded ? 700 : 400 }}>
                  {s.current_hours_week}/{s.max_hours_per_week} ч/нед
                </span>
              </div>
              <RiskBar score={s.risk_score} />
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="badge text-xs flex items-center gap-1"
                  style={{
                    background: riskLevel === 'critical' ? 'rgba(239,68,68,0.2)'   :
                                riskLevel === 'high'     ? 'rgba(249,115,22,0.2)'  :
                                riskLevel === 'medium'   ? 'rgba(234,179,8,0.2)'   : 'rgba(34,197,94,0.15)',
                    color:      riskLevel === 'critical' ? '#f87171' :
                                riskLevel === 'high'     ? '#fdba74' :
                                riskLevel === 'medium'   ? '#fde047' : '#86efac',
                  }}
                >
                  <Shield size={9} />
                  Риск: {riskLevel === 'critical' ? 'Критич.' : riskLevel === 'high' ? 'Высокий' : riskLevel === 'medium' ? 'Средний' : 'Низкий'}
                </span>
                {s.absence_count > 0 && (
                  <span className="badge text-xs" style={{ background: 'rgba(249,115,22,0.2)', color: '#fdba74' }}>
                    {s.absence_count} отсутствий
                  </span>
                )}
                {isOverloaded && (
                  <span className="badge text-xs" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
                    Перегруз
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expand chevron */}
      {risk && (
        <div className="flex justify-center mt-2">
          <ChevronDown
            size={14}
            style={{
              color: 'rgba(255,255,255,0.25)',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </div>
      )}

      {/* Expanded risk detail */}
      {isOpen && risk && (
        <div className="mt-3 pt-3 animate-slide-up" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {risk.reasons?.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Факторы риска:</div>
              <ul className="space-y-1">
                {risk.reasons.map((r, i) => (
                  <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <Dot size={14} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} /> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {risk.recommendations?.length > 0 && (
            <div>
              <div className="text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Рекомендации:</div>
              <ul className="space-y-1">
                {risk.recommendations.map((r, i) => (
                  <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: '#86efac' }}>
                    <ArrowRight size={12} style={{ flexShrink: 0, marginTop: 1 }} /> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {s.telegram_username && (
            <div className="mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Telegram: @{s.telegram_username}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StaffPage() {
  const { t } = useAppShell()
  const [staffList, setStaffList] = useState([])
  const [risks, setRisks]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [sRes, rRes] = await Promise.allSettled([staffApi.getAll(), ai.risks()])
      if (sRes.status === 'fulfilled') setStaffList(sRes.value.data)
      if (rRes.status === 'fulfilled') setRisks(rRes.value.data.risks || [])
    } finally { setLoading(false) }
  }

  async function handleToggleAvailability(id, is_available) {
    await staffApi.updateAvailability(id, is_available)
    setStaffList(prev => prev.map(s => s.id === id ? { ...s, is_available } : s))
  }

  async function handleSendNotification(person) {
    const message = prompt(`Сообщение для ${person.name} (@${person.telegram_username}):`)
    if (!message?.trim()) return
    const res = await staffApi.notify(person.id, message.trim())
    const tg = res.data?.telegram || {}
    if (tg.direct_sent) {
      alert(`✅ Уведомление отправлено ${person.name} в Telegram.\n\n"${message.trim()}"`)
    } else if (tg.needs_start) {
      alert(
        `✅ Уведомление сохранено для ${person.name}, но Telegram не может написать первым.\n\n` +
        `Попроси @${person.telegram_username} один раз открыть школьного бота и нажать /start.`
      )
    } else {
      alert(`✅ Уведомление поставлено в очередь для ${person.name}.\n\n"${message.trim()}"`)
    }
  }

  const roles    = ['all', 'teacher', 'vice_principal', 'director', 'secretary', 'maintenance_chief', 'technician']
  const displayed = filter === 'all' ? staffList : staffList.filter(s => s.role === filter)
  const getRisk   = id => risks.find(r => r.staff_id === id)

  const totalPresent   = staffList.filter(s => s.is_available).length
  const totalAbsent    = staffList.filter(s => !s.is_available).length
  const overloadedCount = staffList.filter(s => s.current_hours_week > s.max_hours_per_week && s.max_hours_per_week > 0).length

  return (
    <div className="page-shell animate-slide-up">

      {/* ── Toolbar ── */}
      <div className="page-intro">
        <h2>{t('pages.staff.title')}</h2>
        <p>Нагрузка, риск-алерты, уведомления через Telegram и управление доступностью.</p>
      </div>

      {/* ── Summary band ── */}
      <div className="compact-metric-band">
        {[
          { label: 'Присутствуют',    value: totalPresent,    color: '#86efac', bg: 'rgba(34,197,94,0.2)'  },
          { label: 'Отсутствуют',     value: totalAbsent,     color: '#f87171', bg: 'rgba(239,68,68,0.2)'  },
          { label: 'Перегружены',     value: overloadedCount, color: '#fdba74', bg: 'rgba(249,115,22,0.2)' },
          { label: 'Всего сотрудн.',  value: staffList.length,color: '#d8d3f6', bg: 'rgba(143,134,255,0.2)'},
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="compact-metric-card">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: bg }}>
              <span style={{ color, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem' }}>{value}</span>
            </div>
            <div className="compact-metric-topline">
              <strong style={{ color }}>{value}</strong>
            </div>
            <h3>{label}</h3>
          </div>
        ))}
      </div>

      {/* ── Role filter ── */}
      <div className="pill-tabs">
        {roles.map(r => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`pill-tab ${filter === r ? 'is-active' : ''}`}
          >
            {r === 'all' ? `Все (${staffList.length})` : ROLE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div className="dashboard-loading">
          <RefreshCw size={18} className="animate-spin" />
          <span>Загрузка сотрудников...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {displayed.map(s => (
            <StaffCard
              key={s.id}
              s={s}
              risk={getRisk(s.id)}
              onToggleAvailability={handleToggleAvailability}
              onSendNotification={handleSendNotification}
            />
          ))}
          {displayed.length === 0 && (
            <div className="app-panel text-center" style={{ padding: '48px 24px', gridColumn: '1 / -1' }}>
              <div style={{ color: 'var(--text-muted)' }}>Нет сотрудников в этой категории</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
