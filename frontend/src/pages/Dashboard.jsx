import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users2,
  AlertTriangle,
  CheckCircle2,
  Utensils,
  ChevronRight,
  Lightbulb,
  RefreshCw,
  ShieldAlert,
  Dot,
  ClipboardList,
  Clock3,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { dashboard, attendance, ai, schedule } from '../api'

function MetricCard({ icon: Icon, label, value, sub, link }) {
  return (
    <article className="metric-card">
      <div className="metric-topline">
        <Icon size={34} strokeWidth={2.1} />
        <strong>{value ?? '—'}</strong>
      </div>
      <h3>{label}</h3>
      {sub ? <p>{sub}</p> : <p>&nbsp;</p>}
      {link && (
        <Link to={link} className="panel-link">
          подробнее <ChevronRight size={14} />
        </Link>
      )}
    </article>
  )
}

function SectionHeader({ title, link, linkLabel }) {
  return (
    <div className="panel-header">
      <h3>{title}</h3>
      {link && (
        <Link to={link} className="panel-link">
          {linkLabel} <ChevronRight size={14} />
        </Link>
      )}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{label}</div>
      {payload.map((item) => (
        <div key={item.name} className="chart-tooltip-row">
          <Dot size={16} style={{ color: item.color }} />
          <span>{item.name}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  )
}

function getInsightMeta(insight) {
  const trimmed = (insight || '').trim()

  if (trimmed.startsWith('🔴') || trimmed.startsWith('⚠')) {
    return {
      icon: AlertTriangle,
      text: trimmed.replace(/^[^\p{L}\p{N}]+/u, '').trim(),
      color: '#ffd166',
    }
  }

  if (trimmed.startsWith('📋') || trimmed.includes('задач')) {
    return {
      icon: ClipboardList,
      text: trimmed.replace(/^[^\p{L}\p{N}]+/u, '').trim(),
      color: '#d8dcff',
    }
  }

  if (trimmed.startsWith('⏰') || trimmed.includes('дедлайн')) {
    return {
      icon: Clock3,
      text: trimmed.replace(/^[^\p{L}\p{N}]+/u, '').trim(),
      color: '#ffb4c2',
    }
  }

  if (trimmed.startsWith('✅') || trimmed.startsWith('📊')) {
    return {
      icon: Lightbulb,
      text: trimmed.replace(/^[^\p{L}\p{N}]+/u, '').trim(),
      color: '#bfe9c9',
    }
  }

  return {
    icon: Lightbulb,
    text: trimmed.replace(/^[^\p{L}\p{N}]+/u, '').trim(),
    color: '#f4f0ea',
  }
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [insights, setInsights] = useState([])
  const [risks, setRisks] = useState([])
  const [prediction, setPrediction] = useState(null)
  const [todaySchedule, setTodaySchedule] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadAll() {
    setLoading(true)
    try {
      const [dashRes, histRes, insRes, riskRes, predRes, schedRes] = await Promise.allSettled([
        dashboard.get(),
        attendance.getHistory(7),
        ai.insights(),
        ai.risks(),
        ai.prediction(),
        schedule.getToday(),
      ])

      if (dashRes.status === 'fulfilled') setData(dashRes.value.data)
      if (histRes.status === 'fulfilled') setHistory(histRes.value.data)
      if (insRes.status === 'fulfilled') setInsights(insRes.value.data.insights || [])
      if (riskRes.status === 'fulfilled') {
        setRisks((riskRes.value.data.risks || []).filter((risk) => risk.risk_level !== 'low').slice(0, 4))
      }
      if (predRes.status === 'fulfilled') setPrediction(predRes.value.data)
      if (schedRes.status === 'fulfilled') setTodaySchedule(schedRes.value.data.slice(0, 8))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  if (loading) {
    return (
      <div className="dashboard-loading">
        <RefreshCw size={18} className="animate-spin" />
        <span>Загрузка данных...</span>
      </div>
    )
  }

  const att = data?.attendance_summary || {}
  const inc = data?.incidents || {}
  const tsk = data?.tasks || {}

  const chartData = history.map((item) => ({
    date: new Date(item.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
    Присутствует: item.present,
    Отсутствует: item.absent,
  }))

  return (
    <div className="dashboard-page animate-slide-up">
      <div className="dashboard-top-grid">
        <section className="metric-band">
          <MetricCard
            icon={Users2}
            label="Присутствует сегодня"
            value={att.present || 0}
            sub={`Отчиталось ${att.reported || 0}/${att.total_classes || 0} классов`}
            link="/attendance"
          />
          <MetricCard
            icon={Utensils}
            label="Порций в столовую"
            value={att.meal_portions || 0}
            sub={prediction ? `Прогноз завтра: ${prediction.recommended_portions}` : 'Нет прогноза'}
            link="/attendance"
          />
          <MetricCard
            icon={AlertTriangle}
            label="Открытых инцидентов"
            value={inc.open || 0}
            sub={inc.urgent > 0 ? `${inc.urgent} срочных` : 'Без срочных'}
            link="/incidents"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Задач в работе"
            value={tsk.pending || 0}
            sub={tsk.overdue > 0 ? `${tsk.overdue} просрочено` : 'Просроченных нет'}
            link="/tasks"
          />
        </section>

        <aside className="prediction-panel app-panel">
          <SectionHeader title="Прогноз на завтра" />

          {prediction ? (
            <>
              <div className="prediction-row">
                <div className="prediction-copy">
                  <span>Ожидается учеников:</span>
                  <strong>{prediction.predicted_present}</strong>
                </div>
                <Users2 size={54} strokeWidth={1.8} />
              </div>

              <div className="prediction-row">
                <div className="prediction-copy">
                  <span>Рекомендуемый заказ:</span>
                  <strong>{prediction.recommended_portions}</strong>
                </div>
                <Utensils size={54} strokeWidth={1.8} />
              </div>

              <div className="prediction-progress">
                <div className="prediction-progress-track">
                  <div
                    className="prediction-progress-fill"
                    style={{ width: `${Math.round(prediction.confidence * 100)}%` }}
                  />
                </div>
                <div className="prediction-accuracy">
                  <span>Точность</span>
                  <strong>{Math.round(prediction.confidence * 100)}%</strong>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">Нет данных для прогноза</div>
          )}
        </aside>
      </div>

      <div className="dashboard-middle-grid">
        <section className="app-panel chart-panel">
          <SectionHeader title="Посещаемость за неделю" link="/attendance" linkLabel="подробнее" />

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={295}>
              <AreaChart data={chartData} margin={{ top: 24, right: 12, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8f86ff" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#8f86ff" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="absentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff5b78" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#ff5b78" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.65)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.45)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Присутствует"
                  stroke="#f6f3ff"
                  fill="url(#presentGrad)"
                  strokeWidth={3}
                />
                <Area
                  type="monotone"
                  dataKey="Отсутствует"
                  stroke="#ff7a92"
                  fill="url(#absentGrad)"
                  strokeWidth={2}
                  strokeDasharray="6 6"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state empty-state--tall">Нет данных за последнюю неделю</div>
          )}
        </section>

        <aside className="dashboard-side-stack">
          <section className="app-panel insight-panel">
            <SectionHeader title="AI инсайты" />

            {insights.length === 0 ? (
              <div className="empty-state">Анализ данных...</div>
            ) : (
              <ul className="insight-list">
                {insights.slice(0, 4).map((insight, index) => (
                  (() => {
                    const meta = getInsightMeta(insight)
                    const Icon = meta.icon
                    return (
                      <li key={`${insight}-${index}`}>
                        <Icon size={16} style={{ color: meta.color, flexShrink: 0 }} />
                        <span>{meta.text}</span>
                      </li>
                    )
                  })()
                ))}
              </ul>
            )}
          </section>

          <section className="app-panel risks-panel">
            <SectionHeader title="Риск-алерты" link="/staff" linkLabel="все" />

            {risks.length === 0 ? (
              <div className="empty-state">Рисков не обнаружено</div>
            ) : (
              <div className="risk-list">
                {risks.map((risk) => (
                  <article key={risk.staff_id} className={`risk-card risk-card--${risk.risk_level || 'medium'}`}>
                    <div className="risk-card-head">
                      <div className="risk-card-name">
                        <ShieldAlert size={14} />
                        <span>{risk.name}</span>
                      </div>
                      <strong>{Math.round(risk.risk_score * 100)}%</strong>
                    </div>
                    <p>{risk.reasons?.[0] || 'Есть риск перегрузки'}</p>
                    {risk.recommendations?.[0] && <span>{risk.recommendations[0]}</span>}
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      <div className="dashboard-bottom-grid">
        <section className="app-panel lessons-panel">
          <SectionHeader title="Уроки сегодня" link="/schedule" linkLabel="расписание" />

          {todaySchedule.length === 0 ? (
            <div className="empty-state empty-state--tall">Нет уроков на сегодня</div>
          ) : (
            <div className="lesson-list">
              {todaySchedule.map((lesson, index) => (
                <div key={`${lesson.subject}-${lesson.class_name}-${index}`} className="lesson-item">
                  <div className="lesson-time">{lesson.period_time?.start || '08:00'}</div>
                  <div
                    className="lesson-marker"
                    style={{ backgroundColor: lesson.color || '#8f86ff' }}
                  />
                  <div className="lesson-copy">
                    <strong>{lesson.subject}</strong>
                    <span>
                      {lesson.class_name} · {lesson.teacher_name}
                    </span>
                  </div>
                  {lesson.is_lenta && <span className="lesson-tag">Лента</span>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="app-panel quick-panel">
          <SectionHeader title="Сводка дня" />
          <div className="quick-stats">
            <div>
              <span>Неотчитавшиеся классы</span>
              <strong>{att.total_classes && att.reported !== undefined ? att.total_classes - att.reported : 0}</strong>
            </div>
            <div>
              <span>Всего порций</span>
              <strong>{att.meal_portions || 0}</strong>
            </div>
            <div>
              <span>Открытые задачи</span>
              <strong>{tsk.pending || 0}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
