import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Send, TrendingDown, Utensils, CheckCircle, AlertCircle, Plus, Dot, Clock, Bell } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { attendance as attApi, ai } from '../api'

// ── Constants ────────────────────────────────────────────────────────────────
const CARD = {
  background: 'var(--panel-strong)',
  border: '1px solid var(--panel-border)',
  borderRadius: '36px',
  boxShadow: 'var(--shadow-panel), var(--shadow-soft)',
}

const TH = {
  color: 'var(--text-faint)',
  fontSize: '11px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

// ── Custom chart tooltip ─────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="chart-tooltip-row">
          <Dot size={16} style={{ color: p.fill }} />
          <span>{p.name}:</span>
          <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ── Auto-collect timer widget ─────────────────────────────────────────────────
function AutoCollectTimer({ onSend, sending }) {
  const [timeLeft, setTimeLeft] = useState('')
  const [isPast, setIsPast] = useState(false)

  useEffect(() => {
    function tick() {
      const now   = new Date()
      const target = new Date()
      target.setHours(9, 0, 0, 0)
      if (now >= target) {
        setIsPast(true)
        setTimeLeft('выполнен сегодня')
        return
      }
      const diff    = target - now
      const hh      = String(Math.floor(diff / 3_600_000)).padStart(2, '0')
      const mm      = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, '0')
      const ss      = String(Math.floor((diff % 60_000) / 1_000)).padStart(2, '0')
      setIsPast(false)
      setTimeLeft(`${hh}:${mm}:${ss}`)
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="app-panel"
      style={{
        padding: '20px 24px',
        background: isPast
          ? 'linear-gradient(135deg, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0.06) 100%)'
          : 'linear-gradient(135deg, rgba(143,134,255,0.2) 0%, rgba(143,134,255,0.06) 100%)',
        border: isPast ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(143,134,255,0.3)',
      }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: isPast ? 'rgba(34,197,94,0.2)' : 'rgba(143,134,255,0.2)' }}
          >
            {isPast
              ? <CheckCircle size={18} style={{ color: '#4ade80' }} />
              : <Clock size={18} style={{ color: '#d8d3f6' }} />}
          </div>
          <div>
            <div className="font-semibold text-sm" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              Автосбор в столовую — 09:00
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {isPast
                ? 'AI автоматически собрал данные и отправил завстоловой'
                : <>До автосбора: <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: '#d8d3f6', letterSpacing: '-0.02em' }}>{timeLeft}</span></>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isPast && (
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
              <Bell size={11} />
              Учителя отчитываются в Telegram
            </div>
          )}
          <button onClick={onSend} disabled={sending} className="btn-primary">
            {sending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
            {sending ? 'Отправляю...' : 'В столовую сейчас'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const [records, setRecords]     = useState([])
  const [summary, setSummary]     = useState(null)
  const [history, setHistory]     = useState([])
  const [prediction, setPrediction] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [sending, setSending]     = useState(false)
  const [manualModal, setManualModal] = useState(false)
  const [manualData, setManualData]   = useState({ class_name: '', present: '', absent: '' })

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [rRes, sRes, hRes, pRes] = await Promise.allSettled([
        attApi.getToday(), attApi.getSummary(), attApi.getHistory(7), ai.prediction()
      ])
      if (rRes.status === 'fulfilled') setRecords(rRes.value.data)
      if (sRes.status === 'fulfilled') setSummary(sRes.value.data)
      if (hRes.status === 'fulfilled') setHistory(hRes.value.data)
      if (pRes.status === 'fulfilled') setPrediction(pRes.value.data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function handleSendToCanteen() {
    setSending(true)
    try {
      const res = await attApi.sendCanteen({ staff_id: 1 })
      await loadAll()
      alert(`Заявка в столовую отправлена.\nПорций: ${res.data.portions}`)
    } finally { setSending(false) }
  }

  async function handleManualSubmit(e) {
    e.preventDefault()
    await attApi.create({
      class_name: manualData.class_name,
      present:    parseInt(manualData.present),
      absent:     parseInt(manualData.absent) || 0,
      total:      parseInt(manualData.present) + (parseInt(manualData.absent) || 0),
    })
    setManualModal(false)
    setManualData({ class_name: '', present: '', absent: '' })
    loadAll()
  }

  const chartData = history.map(h => ({
    date:       new Date(h.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
    'Присут.':  h.present,
    'Отсут.':   h.absent,
  }))

  if (loading) return (
    <div className="dashboard-loading">
      <RefreshCw size={18} className="animate-spin" />
      <span>Загрузка посещаемости...</span>
    </div>
  )

  const unreported = (summary?.total_classes ?? 0) - (summary?.reported_classes ?? 0)

  return (
    <div className="page-shell animate-slide-up">

      {/* ── Toolbar ── */}
      <div className="page-toolbar">
        <div className="page-intro">
          <h2>Посещаемость</h2>
          <p>Ежедневная сводка по классам, прогноз на завтра и отправка данных в столовую.</p>
        </div>
        <button onClick={() => setManualModal(true)} className="btn-primary">
          <Plus size={15} /> Внести вручную
        </button>
      </div>

      {/* ── Auto-collect timer ── */}
      <AutoCollectTimer onSend={handleSendToCanteen} sending={sending} />

      {/* ── Metric band ── */}
      <div className="compact-metric-band">
        {[
          { label: 'Присутствует',       value: summary?.present ?? 0,                icon: CheckCircle,  cls: 'icon-green'  },
          { label: 'Отсутствует',        value: summary?.absent ?? 0,                 icon: TrendingDown, cls: 'icon-red'    },
          { label: 'Порций в столовую',  value: summary?.meal_portions_needed ?? 0,   icon: Utensils,     cls: 'icon-blue'   },
          { label: 'Не отчитались кл.',  value: unreported > 0 ? unreported : '✓',    icon: AlertCircle,  cls: unreported > 0 ? 'icon-orange' : 'icon-green' },
        ].map(({ label, value, icon: Icon, cls }) => (
          <div key={label} className="compact-metric-card">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${cls}`}>
              <Icon size={17} />
            </div>
            <div className="compact-metric-topline">
              <strong>{value}</strong>
            </div>
            <h3>{label}</h3>
          </div>
        ))}
      </div>

      {/* ── Chart + Prediction ── */}
      <div className="two-panel-grid">
        <div className="page-panel" style={CARD}>
          <div className="panel-header">
            <h3>История посещаемости</h3>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={chartData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Присут." fill="#8f86ff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Отсут."  fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {prediction && (
          <div className="page-panel flex flex-col gap-4" style={CARD}>
            <div className="panel-header">
              <h3>Прогноз на завтра</h3>
            </div>
            <div className="text-center py-5 rounded-[24px]" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="font-bold"
                style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', letterSpacing: '-0.04em', color: '#d8d3f6' }}
              >
                {prediction.predicted_present}
              </div>
              <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>ожидается учеников</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>±{prediction.predicted_absent} отсутствий</div>
            </div>
            <div
              className="soft-list-item"
              style={{ background: 'rgba(250,204,21,0.12)', borderColor: 'rgba(250,204,21,0.2)' }}
            >
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#fde047' }}>
                <Utensils size={13} /> Рекомендуется заказать
              </div>
              <div
                className="mt-1"
                style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.04em' }}
              >
                {prediction.recommended_portions} <span className="text-sm font-normal" style={{ color: 'rgba(255,255,255,0.5)' }}>порций</span>
              </div>
            </div>
            {prediction.reasoning && (
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{prediction.reasoning}</p>
            )}
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.round(prediction.confidence * 100)}%`, background: '#8f86ff' }} />
              </div>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{Math.round(prediction.confidence * 100)}% точность</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="page-panel" style={{ ...CARD, padding: 0 }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-0.025em', margin: 0 }}>
            Посещаемость на сегодня
          </h3>
          <div className="flex items-center gap-2">
            {unreported > 0 && (
              <span className="badge text-xs" style={{ background: 'rgba(250,204,21,0.2)', color: '#fde047' }}>
                {unreported} кл. ожидают
              </span>
            )}
            <button onClick={() => setManualModal(true)} className="btn-secondary text-xs">
              <Plus size={13} /> Добавить
            </button>
            <button onClick={handleSendToCanteen} disabled={sending} className="btn-primary text-xs">
              {sending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
              {sending ? 'Отправляю...' : 'В столовую'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto table-shell">
          <table className="w-full">
            <thead>
              <tr>
                {['Класс', 'Присутствует', 'Отсутствует', 'Всего', 'Порций', 'Отчитался', 'Статус'].map(h => (
                  <th key={h} className="px-4 py-3 text-left" style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const reported = r.present !== null
                const pct      = r.total > 0 ? Math.round((r.present || 0) / r.total * 100) : 0
                return (
                  <tr
                    key={r.class_id}
                    style={{
                      borderTop: '1px solid rgba(255,255,255,0.04)',
                      background: !reported ? 'rgba(250,204,21,0.03)' : 'transparent',
                    }}
                  >
                    <td className="px-4 py-3 font-semibold">{r.class_name}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: '#4ade80' }}>{reported ? r.present : '—'}</td>
                    <td className="px-4 py-3" style={{ color: '#f87171' }}>{reported ? r.absent : '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.5)' }}>{r.total}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: '#d8d3f6' }}>{reported ? r.meal_portions || r.present : '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{r.reported_by || '—'}</td>
                    <td className="px-4 py-3">
                      {reported ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#4ade80' }} />
                          </div>
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{pct}%</span>
                        </div>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(250,204,21,0.2)', color: '#fde047' }}>Ожидается</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Manual modal ── */}
      {manualModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm p-6 animate-slide-up modal-panel">
            <h3
              className="mb-4"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.03em', margin: '0 0 16px' }}
            >
              Внести посещаемость
            </h3>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <input
                required
                className="input"
                placeholder="Класс (напр. 2А)"
                value={manualData.class_name}
                onChange={e => setManualData(p => ({ ...p, class_name: e.target.value }))}
              />
              <input
                required
                type="number"
                className="input"
                placeholder="Присутствует"
                min={0}
                value={manualData.present}
                onChange={e => setManualData(p => ({ ...p, present: e.target.value }))}
              />
              <input
                type="number"
                className="input"
                placeholder="Отсутствует"
                min={0}
                value={manualData.absent}
                onChange={e => setManualData(p => ({ ...p, absent: e.target.value }))}
              />
              <div className="flex gap-2 pt-1">
                <button type="submit" className="btn-primary flex-1 justify-center">Сохранить</button>
                <button type="button" className="btn-secondary" onClick={() => setManualModal(false)}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
