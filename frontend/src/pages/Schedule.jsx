import { useEffect, useState } from 'react'
import {
  AlertCircle, RefreshCw, UserX, Zap, Check, X,
  CheckCircle2, ArrowLeftRight, DoorOpen, Clock, GripVertical,
  Sparkles, ShieldCheck, Cpu, CalendarCheck, Wand2,
} from 'lucide-react'
import { schedule as scheduleApi, staff as staffApi, ai } from '../api'

// ── Constants ────────────────────────────────────────────────────────────────
const DAY_NAMES    = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница']
const PERIODS      = [1, 2, 3, 4, 5, 6]
const PERIOD_TIMES = { 1: '08:00', 2: '08:50', 3: '09:40', 4: '10:40', 5: '11:30', 6: '12:20' }

const CARD = {
  background: 'var(--panel-strong)',
  border: '1px solid var(--panel-border)',
  borderRadius: '36px',
  boxShadow: 'var(--shadow-panel), var(--shadow-soft)',
}

const TH_STYLE = { color: 'var(--text-faint)', fontSize: '11px', fontWeight: 500 }

const GENERATION_STEPS = [
  { label: 'Анализ классов и учебной нагрузки', icon: Cpu },
  { label: 'Подбор учителей по квалификации', icon: Sparkles },
  { label: 'Распределение кабинетов и спецзалов', icon: DoorOpen },
  { label: 'Проверка накладок по слотам', icon: ShieldCheck },
  { label: 'Финальная сборка недельной сетки', icon: CalendarCheck },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function localDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ── Sub-components ───────────────────────────────────────────────────────────
function HeatmapCell({ value }) {
  const bg =
    value >= 6 ? 'rgba(239,68,68,0.7)'   :
    value >= 5 ? 'rgba(249,115,22,0.6)'  :
    value >= 3 ? 'rgba(234,179,8,0.4)'   :
    value >= 1 ? 'rgba(34,197,94,0.35)'  :
                 'rgba(255,255,255,0.04)'
  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold"
      style={{ background: bg, color: value ? 'white' : 'rgba(255,255,255,0.2)' }}
    >
      {value || ''}
    </span>
  )
}

function LessonCard({ lesson, draggable, onDragStart }) {
  if (!lesson) return (
    <div className="h-full rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }} />
  )
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart ? e => onDragStart(e, lesson) : undefined}
      className={`rounded-xl p-1.5 text-xs border-l-2 h-full transition-opacity ${lesson.is_lenta ? 'border-dashed' : ''} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{ borderLeftColor: lesson.color, backgroundColor: (lesson.color || '#3d50d8') + '22' }}
      title={draggable ? 'Перетащите для изменения расписания' : undefined}
    >
      <div className="flex items-start gap-1">
        {draggable && <GripVertical size={10} style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0, marginTop: 1 }} />}
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate" style={{ color: lesson.color }}>{lesson.subject}</div>
          <div className="truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{lesson.teacher_name}</div>
          <div className="truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>Каб.{lesson.room_number}</div>
          {lesson.substitute_name && (
            <div className="font-medium truncate flex items-center gap-1" style={{ color: '#fb923c' }}>
              <ArrowLeftRight size={11} /> {lesson.substitute_name.split(' ')[0]}
            </div>
          )}
          {lesson.is_lenta && <span style={{ color: '#facc15', fontWeight: 700 }}>Лента</span>}
        </div>
      </div>
    </div>
  )
}

// ── ConflictBanner ───────────────────────────────────────────────────────────
function ConflictBanner({ conflicts }) {
  if (!conflicts?.length) return null
  return (
    <div
      className="app-panel animate-slide-up"
      style={{
        padding: '16px 20px',
        background: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.1) 100%)',
        border: '1px solid rgba(239,68,68,0.35)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle size={15} style={{ color: '#f87171' }} />
        <span className="font-semibold text-sm" style={{ color: '#fca5a5' }}>
          Обнаружено {conflicts.length} конфликт{conflicts.length > 1 ? 'а' : ''} расписания
        </span>
      </div>
      <div className="space-y-1">
        {conflicts.slice(0, 3).map((c, i) => (
          <div key={i} className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
            • {c.description || c.type || JSON.stringify(c)}
          </div>
        ))}
        {conflicts.length > 3 && (
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>и ещё {conflicts.length - 3}...</div>
        )}
      </div>
    </div>
  )
}

// ── GenerationPanel ──────────────────────────────────────────────────────────
function GenerationPanel({ generating, step, result, onGenerate }) {
  const currentStep = GENERATION_STEPS[Math.min(step, GENERATION_STEPS.length - 1)]
  const CurrentIcon = currentStep.icon
  const checks = result?.validation

  return (
    <div
      className="schedule-generator-panel"
      style={{
        background: 'linear-gradient(135deg, rgba(73,63,162,0.98) 0%, rgba(35,45,143,0.98) 52%, rgba(35,93,92,0.96) 100%)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: '32px',
        boxShadow: 'var(--shadow-panel), var(--shadow-soft)',
      }}
    >
      <div className="schedule-generator-copy">
        <div className="generator-eyebrow">
          <Sparkles size={13} /> AI генератор расписания
        </div>
        <h3>Собрать логичное расписание без накладок</h3>
        <p>
          Генератор учитывает занятость учителей, кабинеты, профильные предметы, дневную нагрузку классов и после сборки запускает автоматическую проверку конфликтов.
        </p>

        {result && !generating && (
          <div className="generator-result-grid">
            <div><strong>{result.created}</strong><span>уроков</span></div>
            <div><strong>{result.teachers_used}</strong><span>учителей</span></div>
            <div><strong>{result.rooms_used}</strong><span>кабинетов</span></div>
            <div><strong>{result.conflicts?.length || 0}</strong><span>накладок</span></div>
          </div>
        )}
      </div>

      <div className="schedule-generator-action">
        <div className={`generation-orbit ${generating ? 'is-active' : ''}`}>
          <div className="generation-orbit-ring" />
          <div className="generation-orbit-core">
            {generating ? <CurrentIcon size={28} /> : result?.ok ? <CheckCircle2 size={30} /> : <Wand2 size={30} />}
          </div>
          {GENERATION_STEPS.map((item, i) => {
            const Icon = item.icon
            return (
              <span
                key={item.label}
                className={`generation-node node-${i + 1} ${i <= step && generating ? 'is-lit' : ''} ${result && !generating ? 'is-done' : ''}`}
              >
                <Icon size={12} />
              </span>
            )
          })}
        </div>

        <div className="generator-status">
          {generating ? currentStep.label : result?.ok ? 'Расписание собрано и проверено' : 'Готов к генерации'}
        </div>

        <button onClick={onGenerate} disabled={generating} className="btn-primary justify-center">
          {generating ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {generating ? 'Генерирую...' : 'Сгенерировать расписание'}
        </button>

        {checks && !generating && (
          <div className="generator-checks">
            <span className={checks.conflicts_ok ? 'ok' : 'bad'}>
              {checks.conflicts_ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              Накладки: {checks.hard_conflicts}
            </span>
            <span className={checks.coverage_ok ? 'ok' : 'warn'}>
              {checks.coverage_ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              Покрытие: {checks.warnings_count}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── RoomMatrix ───────────────────────────────────────────────────────────────
function RoomMatrix({ weekData, selectedDay }) {
  if (!weekData) return <div className="dashboard-loading"><span>Нет данных</span></div>

  const dayLessons = weekData.days?.[selectedDay]?.lessons || []
  const roomNums   = [...new Set(dayLessons.map(l => l.room_number).filter(Boolean))].sort((a, b) => a - b)

  if (!roomNums.length) {
    return (
      <div className="app-panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <DoorOpen size={32} style={{ color: 'rgba(255,255,255,0.15)', display: 'block', margin: '0 auto 10px' }} />
        <span style={{ color: 'var(--text-muted)' }}>Нет данных о кабинетах на этот день</span>
      </div>
    )
  }

  return (
    <div className="page-panel" style={{ ...CARD, padding: 0 }}>
      <div className="p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2">
          <DoorOpen size={16} style={{ color: 'rgba(255,255,255,0.5)' }} />
          <h3 className="font-semibold" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
            Матрица помещений — {DAY_NAMES[selectedDay]}
          </h3>
        </div>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Занятость кабинетов по урокам. Красный — конфликт, зелёный — свободно.
        </p>
      </div>
      <div className="overflow-x-auto p-5">
        <table className="w-full border-collapse" style={{ minWidth: '500px' }}>
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 min-w-[80px]" style={TH_STYLE}>Кабинет</th>
              {PERIODS.map(p => (
                <th key={p} className="text-center py-2 px-2 min-w-[90px]" style={{ ...TH_STYLE, fontSize: '12px' }}>
                  <div>{p} урок</div>
                  <div style={{ color: 'rgba(255,255,255,0.3)' }}>{PERIOD_TIMES[p]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roomNums.map(room => (
              <tr key={room} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold"
                      style={{ background: 'rgba(255,255,255,0.08)' }}
                    >
                      {room}
                    </div>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>каб.</span>
                  </div>
                </td>
                {PERIODS.map(p => {
                  const lessons = dayLessons.filter(l => l.room_number === room && l.period === p)
                  const hasConflict = lessons.length > 1
                  const lesson = lessons[0]
                  return (
                    <td key={p} className="py-1 px-1" style={{ height: '68px' }}>
                      {lesson ? (
                        <div
                          className="rounded-xl p-1.5 h-full text-xs border-l-2"
                          style={{
                            borderLeftColor: hasConflict ? '#ef4444' : (lesson.color || '#3d50d8'),
                            backgroundColor: hasConflict ? 'rgba(239,68,68,0.2)' : (lesson.color || '#3d50d8') + '22',
                          }}
                        >
                          {hasConflict && (
                            <div className="font-bold mb-0.5" style={{ color: '#f87171' }}>⚠ Конфликт</div>
                          )}
                          <div className="font-semibold truncate" style={{ color: hasConflict ? '#f87171' : lesson.color }}>
                            {lesson.subject}
                          </div>
                          <div className="truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>{lesson.class_name}</div>
                          <div className="truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{lesson.teacher_name?.split(' ')[0]}</div>
                        </div>
                      ) : (
                        <div
                          className="h-full rounded-xl flex items-center justify-center"
                          style={{ background: 'rgba(34,197,94,0.08)', border: '1px dashed rgba(34,197,94,0.2)' }}
                        >
                          <span className="text-xs" style={{ color: 'rgba(34,197,94,0.45)' }}>свободно</span>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-5 pb-4 flex items-center gap-5 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(34,197,94,0.2)', border: '1px dashed rgba(34,197,94,0.3)' }} />
          Свободно
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(61,80,216,0.3)' }} />
          Занято
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(239,68,68,0.3)' }} />
          Конфликт
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Schedule() {
  const [view, setView]           = useState('week')
  const [weekData, setWeekData]   = useState(null)
  const [heatmap, setHeatmap]     = useState([])
  const [staff, setStaff]         = useState([])
  const [teacherSchedule, setTeacherSchedule] = useState([])
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [conflicts, setConflicts] = useState([])
  const [loading, setLoading]     = useState(true)
  const [absentModal, setAbsentModal]   = useState(false)
  const [absentTeacher, setAbsentTeacher] = useState('')
  const [substitution, setSubstitution]   = useState(null)
  const [simResult, setSimResult]         = useState(null)
  const [simLoading, setSimLoading]       = useState(false)
  const [applyLoading, setApplyLoading]   = useState(false)
  const [dragConflict, setDragConflict]   = useState(false)
  const [generating, setGenerating]       = useState(false)
  const [generationStep, setGenerationStep] = useState(0)
  const [generationResult, setGenerationResult] = useState(null)
  const [selectedDay, setSelectedDay]     = useState(
    new Date().getDay() === 0 || new Date().getDay() === 6 ? 0 : new Date().getDay() - 1
  )

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [wRes, hRes, sRes, cRes] = await Promise.allSettled([
        scheduleApi.getWeek(), scheduleApi.getHeatmap(),
        staffApi.getAll(), scheduleApi.getConflicts(),
      ])
      if (wRes.status === 'fulfilled') setWeekData(wRes.value.data)
      if (hRes.status === 'fulfilled') setHeatmap(hRes.value.data)
      if (sRes.status === 'fulfilled') setStaff(sRes.value.data)
      if (cRes.status === 'fulfilled') setConflicts(cRes.value.data)
    } finally { setLoading(false) }
  }

  async function loadTeacherSchedule(tid) {
    if (!tid) return
    const res = await staffApi.getSchedule(tid)
    setTeacherSchedule(res.data)
  }

  async function handleFindSub() {
    if (!absentTeacher) return
    setSimLoading(true)
    try {
      const [subRes, simRes] = await Promise.allSettled([
        ai.findSubstitution({ absent_teacher_id: parseInt(absentTeacher) }),
        ai.simulateAbsence(parseInt(absentTeacher)),
      ])
      if (subRes.status === 'fulfilled') setSubstitution(subRes.value.data)
      if (simRes.status === 'fulfilled') setSimResult(simRes.value.data)
    } finally { setSimLoading(false) }
  }

  async function handleApplySub() {
    if (!substitution?.substitute_id) return
    setApplyLoading(true)
    try {
      await scheduleApi.applySubstitution({
        absent_teacher_id: parseInt(absentTeacher),
        substitute_id: substitution.substitute_id,
        date: localDateString(),
      })
      await staffApi.updateAvailability(parseInt(absentTeacher), false)
      setAbsentModal(false); setSubstitution(null); setSimResult(null)
      loadAll()
      alert(`Замена оформлена. ${substitution.substitute_name} получит уведомление.`)
    } finally { setApplyLoading(false) }
  }

  async function handleGenerateSchedule() {
    setGenerating(true)
    setGenerationResult(null)
    setGenerationStep(0)
    const started = Date.now()
    const timer = setInterval(() => {
      setGenerationStep(prev => Math.min(prev + 1, GENERATION_STEPS.length - 1))
    }, 700)

    try {
      const res = await scheduleApi.generate({ strategy: 'balanced' })
      const elapsed = Date.now() - started
      if (elapsed < 3600) {
        await new Promise(resolve => setTimeout(resolve, 3600 - elapsed))
      }
      clearInterval(timer)
      setGenerationStep(GENERATION_STEPS.length - 1)
      setGenerationResult(res.data)
      await loadAll()
      setView('week')
      setSelectedDay(0)
      if (res.data.conflicts?.length) {
        alert(`Расписание создано, но найдено ${res.data.conflicts.length} накладок. Проверьте блок конфликтов.`)
      }
    } catch (err) {
      clearInterval(timer)
      alert('Не удалось сгенерировать расписание. Проверьте backend и попробуйте ещё раз.')
    } finally {
      setTimeout(() => setGenerating(false), 450)
    }
  }

  // Drag-and-drop handlers (visual-only — бэкенд endpoint не реализован)
  function handleDragStart(e, lesson) {
    e.dataTransfer.setData('lesson', JSON.stringify(lesson))
    setDragConflict(false)
  }

  function handleDragOver(e, targetLesson) {
    e.preventDefault()
    setDragConflict(!!targetLesson) // если ячейка занята — конфликт
  }

  function handleDrop(e, targetClass, targetPeriod, existingLesson) {
    e.preventDefault()
    if (existingLesson) {
      setDragConflict(true)
      setTimeout(() => setDragConflict(false), 2000)
      alert('⚠ Конфликт: кабинет или учитель уже заняты в этом слоте. Сохранение отменено.')
      return
    }
    setDragConflict(false)
    // здесь можно добавить API-вызов для сохранения
  }

  function buildDayGrid(dayIndex) {
    if (!weekData) return { classes: [], grid: {} }
    const dayLessons = weekData.days[dayIndex]?.lessons || []
    const classNames = [...new Set(dayLessons.map(l => l.class_name))].sort()
    const grid = {}
    for (const cls of classNames) {
      grid[cls] = {}
      for (const p of PERIODS) {
        grid[cls][p] = dayLessons.find(l => l.class_name === cls && l.period === p) || null
      }
    }
    return { classes: classNames, grid }
  }

  const { classes, grid } = buildDayGrid(selectedDay)
  const teachers = staff.filter(s => s.role === 'teacher')

  if (loading) return (
    <div className="dashboard-loading">
      <RefreshCw size={18} className="animate-spin" />
      <span>Загрузка расписания...</span>
    </div>
  )

  return (
    <div className="page-shell animate-slide-up">

      {/* ── Toolbar ── */}
      <div className="page-toolbar">
        <div className="page-intro">
          <h2>Расписание</h2>
          <p>AI-генерация, недельная сетка, тепловая карта нагрузки, матрица помещений и замещения.</p>
        </div>
      </div>

      <GenerationPanel
        generating={generating}
        step={generationStep}
        result={generationResult}
        onGenerate={handleGenerateSchedule}
      />

      {/* ── Conflict banner ── */}
      <ConflictBanner conflicts={conflicts} />

      {/* Drag conflict warning */}
      {dragConflict && (
        <div
          className="app-panel animate-slide-up"
          style={{
            padding: '14px 20px',
            background: 'rgba(239,68,68,0.2)',
            border: '1px solid rgba(239,68,68,0.4)',
          }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={14} style={{ color: '#f87171' }} />
            <span className="text-sm font-medium" style={{ color: '#fca5a5' }}>
              Конфликт при переносе — ячейка уже занята. Изменения не сохранены.
            </span>
          </div>
        </div>
      )}

      {/* ── View tabs + actions ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="pill-tabs">
          {[
            ['week',    'Расписание'],
            ['heatmap', 'Нагрузка'],
            ['teacher', 'По учителю'],
            ['rooms',   'Помещения'],
          ].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`pill-tab ${view === v ? 'is-active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setAbsentModal(true)} className="btn-primary">
            <UserX size={15} /> Оформить замену
          </button>
        </div>
      </div>

      {/* ── Week View ── */}
      {view === 'week' && (
        <div className="page-panel" style={{ ...CARD, padding: 0 }}>
          <div className="flex overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {DAY_NAMES.map((name, i) => (
              <button
                key={i}
                onClick={() => setSelectedDay(i)}
                className="flex-1 min-w-[100px] py-3 text-sm font-medium transition-colors"
                style={{
                  color: selectedDay === i ? 'white' : 'rgba(255,255,255,0.45)',
                  borderBottom: selectedDay === i ? '2px solid #8f86ff' : '2px solid transparent',
                  background: selectedDay === i ? 'rgba(143,134,255,0.1)' : 'transparent',
                }}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="p-3 text-xs flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.35)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <GripVertical size={11} />
            Можно перетаскивать карточки уроков. Система предупредит о конфликтах.
          </div>

          <div className="overflow-x-auto p-4">
            <table className="w-full border-collapse" style={{ minWidth: '600px' }}>
              <thead>
                <tr>
                  <th className="text-left py-2 pr-3 w-14" style={TH_STYLE}>Урок</th>
                  {classes.map(cls => (
                    <th key={cls} className="text-center py-2 px-1 min-w-[90px]" style={{ ...TH_STYLE, color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '12px' }}>
                      {cls}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map(period => (
                  <tr key={period} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="py-1.5 pr-3 align-top">
                      <div className="flex items-center gap-1">
                        <Clock size={10} style={{ color: 'rgba(255,255,255,0.3)' }} />
                        <div>
                          <div className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.8)' }}>{period}</div>
                          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{PERIOD_TIMES[period]}</div>
                        </div>
                      </div>
                    </td>
                    {classes.map(cls => {
                      const lesson = grid[cls]?.[period]
                      return (
                        <td
                          key={cls}
                          className="py-1 px-1"
                          style={{ height: '70px' }}
                          onDragOver={e => handleDragOver(e, lesson)}
                          onDrop={e => handleDrop(e, cls, period, lesson)}
                        >
                          <LessonCard lesson={lesson} draggable onDragStart={handleDragStart} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Heatmap View ── */}
      {view === 'heatmap' && (
        <div className="page-panel" style={CARD}>
          <div className="panel-header">
            <h3>Тепловая карта нагрузки учителей</h3>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>уроков в день</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <th className="text-left py-2 pr-4 min-w-[160px]" style={TH_STYLE}>Учитель</th>
                  {DAY_NAMES.map(d => <th key={d} className="text-center py-2 w-12" style={TH_STYLE}>{d.slice(0, 2)}</th>)}
                  <th className="text-center py-2 w-16" style={TH_STYLE}>Итого</th>
                  <th className="text-left py-2 pl-3 min-w-[140px]" style={TH_STYLE}>Нагрузка</th>
                </tr>
              </thead>
              <tbody>
                {heatmap.map(t => (
                  <tr key={t.teacher_id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="py-2.5 pr-4">
                      <div className="text-sm font-medium" style={{ color: t.overloaded ? '#f87171' : 'white' }}>{t.name}</div>
                      {t.overloaded && (
                        <span className="badge text-xs" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>Перегруз</span>
                      )}
                    </td>
                    {t.daily_loads.map((load, i) => (
                      <td key={i} className="text-center py-2">
                        <HeatmapCell value={load} />
                      </td>
                    ))}
                    <td className="text-center py-2">
                      <span className="font-bold text-sm" style={{ color: t.overloaded ? '#f87171' : 'white' }}>{t.weekly_total}</span>
                    </td>
                    <td className="py-2 pl-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, t.max_hours > 0 ? (t.weekly_total / t.max_hours) * 100 : 0)}%`,
                              background: t.overloaded ? '#ef4444' : t.weekly_total >= t.max_hours * 0.8 ? '#f97316' : '#8f86ff',
                            }}
                          />
                        </div>
                        <span className="text-xs w-6 text-right" style={{ color: 'rgba(255,255,255,0.5)' }}>{t.weekly_total}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(34,197,94,0.35)' }} />1–2</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(234,179,8,0.4)' }} />3–4</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(249,115,22,0.6)' }} />5</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(239,68,68,0.7)' }} />6 (перегруз)</div>
          </div>
        </div>
      )}

      {/* ── Teacher View ── */}
      {view === 'teacher' && (
        <div className="page-shell">
          <div className="app-panel" style={{ ...CARD, padding: '18px 22px' }}>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>Учитель:</label>
              <select
                className="input flex-1 max-w-xs"
                value={selectedTeacher || ''}
                onChange={e => { const id = parseInt(e.target.value) || null; setSelectedTeacher(id); if (id) loadTeacherSchedule(id) }}
              >
                <option value="">Выберите учителя...</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {selectedTeacher && teacherSchedule.length > 0 && (
            <div className="page-panel" style={{ ...CARD, padding: 0 }}>
              <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <h3 className="font-semibold" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                  {teachers.find(t => t.id === selectedTeacher)?.name}
                </h3>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="w-full" style={{ minWidth: '500px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <th className="text-left py-2 text-xs w-20" style={TH_STYLE}>День</th>
                      {PERIODS.map(p => (
                        <th key={p} className="text-center py-2 text-xs w-24" style={TH_STYLE}>
                          {p} · {PERIOD_TIMES[p]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAY_NAMES.map((day, di) => {
                      const dayLessons = teacherSchedule.filter(l => l.day === di)
                      return (
                        <tr key={di} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <td className="py-2 pr-3 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{day.slice(0, 3)}</td>
                          {PERIODS.map(p => {
                            const lesson = dayLessons.find(l => l.period === p)
                            return (
                              <td key={p} className="py-1 px-1" style={{ height: '60px' }}>
                                {lesson ? (
                                  <div className="rounded-xl p-1.5 h-full text-xs border-l-2" style={{ borderLeftColor: lesson.color, backgroundColor: (lesson.color || '#3d50d8') + '22' }}>
                                    <div className="font-semibold truncate" style={{ color: lesson.color }}>{lesson.subject}</div>
                                    <div style={{ color: 'rgba(255,255,255,0.5)' }}>{lesson.class_name}</div>
                                    <div style={{ color: 'rgba(255,255,255,0.3)' }}>Каб.{lesson.room_number}</div>
                                  </div>
                                ) : (
                                  <div className="h-full rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>окно</span>
                                  </div>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Rooms View ── */}
      {view === 'rooms' && (
        <div className="page-shell">
          {/* Day selector */}
          <div className="app-panel" style={{ ...CARD, padding: 0 }}>
            <div className="flex overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {DAY_NAMES.map((name, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedDay(i)}
                  className="flex-1 min-w-[90px] py-3 text-sm font-medium transition-colors"
                  style={{
                    color: selectedDay === i ? 'white' : 'rgba(255,255,255,0.45)',
                    borderBottom: selectedDay === i ? '2px solid #8f86ff' : '2px solid transparent',
                    background: selectedDay === i ? 'rgba(143,134,255,0.1)' : 'transparent',
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <RoomMatrix weekData={weekData} selectedDay={selectedDay} />
        </div>
      )}

      {/* ── Substitution Modal ── */}
      {absentModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up modal-panel">
            <div className="p-6">
              <h2 className="font-bold mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', letterSpacing: '-0.03em' }}>
                <UserX size={20} style={{ color: '#f87171' }} /> Оформить замену
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm block mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Отсутствующий учитель</label>
                  <select
                    className="input w-full"
                    value={absentTeacher}
                    onChange={e => { setAbsentTeacher(e.target.value); setSubstitution(null); setSimResult(null) }}
                  >
                    <option value="">Выберите учителя...</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                {absentTeacher && !simLoading && !substitution && (
                  <button onClick={handleFindSub} className="btn-primary w-full justify-center">
                    <Zap size={16} /> AI: Найти замену автоматически
                  </button>
                )}

                {simLoading && (
                  <div className="dashboard-loading" style={{ minHeight: 'auto', padding: '24px 0' }}>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Анализирую расписание...</span>
                  </div>
                )}

                {simResult?.scenarios?.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Варианты замены:</div>
                    <div className="space-y-2">
                      {simResult.scenarios.map((s, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-2xl"
                          style={{
                            background: s.recommended ? 'rgba(143,134,255,0.2)' : 'rgba(255,255,255,0.05)',
                            border: s.recommended ? '1px solid rgba(143,134,255,0.5)' : '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-sm">{s.scenario}</span>
                            {s.recommended && (
                              <span className="badge text-xs" style={{ background: 'rgba(143,134,255,0.35)', color: '#d8d3f6' }}>
                                Рекомендован
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-medium">{s.substitute_name}</div>
                          <div className="flex gap-4 mt-1.5 text-xs">
                            {s.pros?.[0] && <div className="flex items-center gap-1" style={{ color: '#4ade80' }}><Check size={12} /> {s.pros[0]}</div>}
                            {s.cons?.[0] && <div className="flex items-center gap-1" style={{ color: '#f87171' }}><X size={12} /> {s.cons[0]}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {substitution && (
                  <div className="p-4 rounded-2xl" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
                    <div className="font-semibold mb-1 flex items-center gap-1.5" style={{ color: '#86efac' }}>
                      <CheckCircle2 size={15} /> Рекомендуемая замена
                    </div>
                    <div className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>{substitution.substitute_name}</div>
                    <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>{substitution.reasoning}</div>
                    {substitution.lessons_covered?.length > 0 && (
                      <div className="mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        Уроков для покрытия: {substitution.lessons_covered.length}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  className="btn-secondary flex-1 justify-center"
                  onClick={() => { setAbsentModal(false); setSubstitution(null); setSimResult(null) }}
                >
                  Отмена
                </button>
                {substitution?.substitute_id && (
                  <button onClick={handleApplySub} disabled={applyLoading} className="btn-primary flex-1 justify-center">
                    {applyLoading ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                    Применить замену
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
