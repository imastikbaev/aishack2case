import { useEffect, useState, useRef } from 'react'
import {
  Mic, MicOff, Plus, RefreshCw, CheckCircle, Circle, Clock,
  Trash2, Zap, AlertCircle, Radio, Bot, SendHorizontal,
  CheckCircle2, ArrowRight, BookOpen, ShieldCheck,
  MessageCircle, Copy, CheckCheck, Keyboard,
} from 'lucide-react'
import { tasks as tasksApi, staff as staffApi, ai } from '../api'

// ── Constants ────────────────────────────────────────────────────────────────
const PRIORITY_LABELS = { urgent: 'Срочно', high: 'Высокий', medium: 'Средний', low: 'Низкий' }
const STATUS_LABELS   = { todo: 'К выполнению', in_progress: 'В работе', done: 'Готово' }
const COLUMNS         = ['todo', 'in_progress', 'done']
const PRIORITY_ICONS  = { urgent: AlertCircle, high: AlertCircle, medium: Radio, low: Circle }

const CARD = {
  background: 'var(--panel-strong)',
  border: '1px solid var(--panel-border)',
  borderRadius: '36px',
  boxShadow: 'var(--shadow-panel), var(--shadow-soft)',
}

const COL_CONFIG = {
  todo:        { label: 'К выполнению', headBg: 'rgba(255,255,255,0.07)',   colBg: 'rgba(255,255,255,0.03)'  },
  in_progress: { label: 'В работе',     headBg: 'rgba(143,134,255,0.25)',   colBg: 'rgba(143,134,255,0.04)'  },
  done:        { label: 'Готово',       headBg: 'rgba(34,197,94,0.2)',      colBg: 'rgba(34,197,94,0.04)'    },
}

// ── PriorityBadge ─────────────────────────────────────────────────────────────
function PriorityBadge({ p }) {
  const cls  = { urgent: 'priority-urgent', high: 'priority-high', medium: 'priority-medium', low: 'priority-low' }
  const Icon = PRIORITY_ICONS[p] || Circle
  return (
    <span className={`badge ${cls[p] || 'priority-low'} flex items-center gap-1`}>
      <Icon size={11} />{PRIORITY_LABELS[p] || p}
    </span>
  )
}

// ── TaskCard ──────────────────────────────────────────────────────────────────
function TaskCard({ task, onUpdate, onDelete, staff }) {
  const assignee  = staff.find(s => s.id === task.assignee_id)
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'

  return (
    <div
      className="rounded-2xl p-3.5"
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: isOverdue ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <button
            onClick={() => onUpdate(task.id, { status: task.status === 'done' ? 'todo' : 'done' })}
            className="mt-0.5 flex-shrink-0"
          >
            {task.status === 'done'
              ? <CheckCircle size={15} style={{ color: '#4ade80' }} />
              : <Circle size={15} style={{ color: 'rgba(255,255,255,0.25)' }} />}
          </button>
          <span
            className={`text-sm font-medium leading-tight ${task.status === 'done' ? 'line-through' : ''}`}
            style={{ color: task.status === 'done' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.9)' }}
          >
            {task.title}
          </span>
        </div>
        <button onClick={() => onDelete(task.id)} className="flex-shrink-0 transition-opacity hover:opacity-80">
          <Trash2 size={13} style={{ color: 'rgba(255,255,255,0.25)' }} />
        </button>
      </div>

      {task.description && task.description !== task.title && (
        <p className="text-xs mb-2 pl-5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>{task.description}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap pl-5">
        <PriorityBadge p={task.priority} />
        {task.source !== 'manual' && (
          <span className="badge flex items-center gap-1" style={{ background: 'rgba(168,85,247,0.2)', color: '#c084fc' }}>
            {task.source === 'voice' || task.source === 'whatsapp_voice' ? <Mic size={11} /> :
             task.source === 'ai' ? <Bot size={11} /> :
             <SendHorizontal size={11} />}
            {task.source === 'whatsapp_voice' ? 'WhatsApp' : task.source === 'voice' ? 'Голос' : task.source === 'ai' ? 'AI' : 'Telegram'}
          </span>
        )}
        {task.rag_checked && (
          <span className="badge flex items-center gap-1" style={{ background: 'rgba(34,197,94,0.18)', color: '#86efac' }}>
            <ShieldCheck size={11} /> Проверено
          </span>
        )}
      </div>

      <div className="mt-2 pl-5 flex items-center justify-between">
        {assignee ? (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'rgba(143,134,255,0.3)', color: '#d8d3f6' }}
            >
              {assignee.name[0]}
            </div>
            {assignee.name.split(' ')[0]}
          </div>
        ) : (
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>Не назначен</span>
        )}

        {task.due_date && (
          <div className="flex items-center gap-1 text-xs" style={{ color: isOverdue ? '#f87171' : 'rgba(255,255,255,0.35)' }}>
            <Clock size={10} />
            {new Date(task.due_date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
          </div>
        )}
      </div>

      <div className="mt-1.5 pl-5">
        <select
          value={task.status}
          onChange={e => onUpdate(task.id, { status: e.target.value })}
          className="text-xs bg-transparent focus:outline-none cursor-pointer"
          style={{ color: 'rgba(255,255,255,0.35)', border: 'none' }}
        >
          {COLUMNS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>
    </div>
  )
}

// ── RagCheckResult ────────────────────────────────────────────────────────────
function RagCheckResult({ result, onDismiss }) {
  if (!result) return null
  const ok = !result.answer?.toLowerCase().includes('наруш') && !result.answer?.toLowerCase().includes('запрещ')
  return (
    <div
      className="animate-slide-up rounded-2xl p-4"
      style={{
        background: ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
        border: ok ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(239,68,68,0.25)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {ok
            ? <ShieldCheck size={15} style={{ color: '#4ade80', flexShrink: 0 }} />
            : <AlertCircle size={15} style={{ color: '#f87171', flexShrink: 0 }} />}
          <div>
            <div className="font-semibold text-sm mb-1" style={{ color: ok ? '#86efac' : '#f87171' }}>
              {ok ? 'Соответствует нормативам' : 'Обратите внимание'}
            </div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>{result.answer}</p>
            {result.sources?.length > 0 && (
              <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <BookOpen size={9} /> {result.sources.join(', ')}
              </div>
            )}
            {result.bullet_points?.length > 0 && (
              <ul className="mt-2 space-y-1">
                {result.bullet_points.slice(0, 3).map((b, i) => (
                  <li key={i} className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>• {b}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <button onClick={onDismiss} className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>✕</button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Tasks() {
  const [allTasks, setAllTasks]         = useState([])
  const [staff, setStaff]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [recording, setRecording]       = useState(false)
  const [transcript, setTranscript]     = useState('')
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [voiceResult, setVoiceResult]   = useState(null)
  const [deliveryMode, setDeliveryMode] = useState('tasks')
  const [voiceNotice, setVoiceNotice]   = useState('')
  const [whatsappCopied, setWhatsappCopied] = useState(false)
  const [showNewTask, setShowNewTask]   = useState(false)
  const [newTask, setNewTask] = useState({ title: '', assignee_id: '', priority: 'medium', due_date: '', description: '' })
  const [ragCheckLoading, setRagCheckLoading] = useState(false)
  const [ragCheckResult, setRagCheckResult]   = useState(null)
  const recognitionRef = useRef(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [tRes, sRes] = await Promise.all([tasksApi.getAll(), staffApi.getAll()])
      setAllTasks(tRes.data)
      setStaff(sRes.data)
    } finally { setLoading(false) }
  }

  async function handleUpdate(id, data) {
    await tasksApi.update(id, data)
    setAllTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
  }

  async function handleDelete(id) {
    if (!confirm('Удалить задачу?')) return
    await tasksApi.delete(id)
    setAllTasks(prev => prev.filter(t => t.id !== id))
  }

  async function handleCreateTask(e) {
    e.preventDefault()
    const res = await tasksApi.create({
      ...newTask,
      assignee_id: newTask.assignee_id ? parseInt(newTask.assignee_id) : null,
      due_date: newTask.due_date || null,
      source: 'manual',
    })
    setAllTasks(prev => [res.data, ...prev])
    setNewTask({ title: '', assignee_id: '', priority: 'medium', due_date: '', description: '' })
    setShowNewTask(false)
    setRagCheckResult(null)
  }

  async function handleRagCheck() {
    if (!newTask.title.trim()) return
    setRagCheckLoading(true)
    try {
      const question = `Задача для школы: "${newTask.title}". Есть ли нарушения Приказов №76, №110, №130?`
      const res = await ai.rag(question)
      setRagCheckResult(res.data)
    } finally { setRagCheckLoading(false) }
  }

  function startRecording() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setVoiceNotice('Браузер не поддерживает распознавание речи. Вставьте поручение вручную или нажмите пример ниже.')
      return
    }
    const rec = new SR()
    rec.lang = 'ru-RU'
    rec.continuous = false
    rec.interimResults = true
    rec.onresult = e => {
      const text = Array.from(e.results).map(r => r[0].transcript).join(' ')
      setTranscript(text)
      setVoiceNotice('')
    }
    rec.onerror  = (event) => {
      setRecording(false)
      const reason = event?.error === 'not-allowed'
        ? 'Микрофон недоступен. Разрешите доступ в браузере или вставьте поручение вручную.'
        : 'Не удалось распознать голос. Вставьте поручение вручную в поле ниже или нажмите демо-пример.'
      setVoiceNotice(reason)
    }
    rec.onend    = () => setRecording(false)
    rec.start()
    recognitionRef.current = rec
    setRecording(true)
    setTranscript('')
    setVoiceResult(null)
    setVoiceNotice('')
  }

  function stopRecording() {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  async function handleParseVoice() {
    if (!transcript.trim()) return
    setVoiceLoading(true)
    try {
      const res = await ai.voiceToTask(transcript, {
        send_whatsapp: deliveryMode === 'whatsapp',
        director_name: 'Гульбара Сейтова',
        whatsapp_group_name: 'Рабочая группа Aqbobek Lyceum',
      })
      setVoiceResult(res.data)
      await loadAll()
    } finally { setVoiceLoading(false) }
  }

  async function copyWhatsappMessage() {
    const message = voiceResult?.whatsapp?.message
    if (!message) return
    await navigator.clipboard.writeText(message)
    setWhatsappCopied(true)
    setTimeout(() => setWhatsappCopied(false), 1800)
  }

  function openWhatsappShare() {
    const url = voiceResult?.whatsapp?.share_url
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="page-shell animate-slide-up">

      {/* ── Toolbar ── */}
      <div className="page-toolbar">
        <div className="page-intro">
          <h2>Задачи</h2>
          <p>Канбан-доска, голосовой ввод, проверка нормативов и назначение исполнителей.</p>
        </div>
        <button onClick={() => { setShowNewTask(!showNewTask); setRagCheckResult(null) }} className="btn-primary">
          <Plus size={15} /> Новая задача
        </button>
      </div>

      {/* ── Voice panel ── */}
      <div
        className="app-panel"
        style={{
          padding: '22px 24px',
          background: 'linear-gradient(135deg, rgba(91,78,174,0.98) 0%, rgba(58,47,137,0.98) 100%)',
        }}
      >
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3
              className="flex items-center gap-2 mb-1"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-0.025em', margin: '0 0 4px' }}
            >
              <Zap size={15} style={{ color: '#facc15' }} />
              Голосовой ввод задач
            </h3>
            <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Продиктуйте поручение — AI разделит его по исполнителям, создаст задачи и подготовит структурированное сообщение для WhatsApp-группы.
            </p>

            <div className="pill-tabs mb-3" style={{ maxWidth: 520 }}>
              <button
                type="button"
                onClick={() => setDeliveryMode('tasks')}
                className={`pill-tab ${deliveryMode === 'tasks' ? 'is-active' : ''} flex-1 flex items-center justify-center gap-2`}
              >
                <CheckCircle2 size={14} /> Только задачи
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode('whatsapp')}
                className={`pill-tab ${deliveryMode === 'whatsapp' ? 'is-active' : ''} flex-1 flex items-center justify-center gap-2`}
              >
                <MessageCircle size={14} /> WhatsApp-группа
              </button>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={recording ? stopRecording : startRecording}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl font-medium text-sm transition-all"
                style={{
                  background: recording ? '#ef4444' : '#2d3dbf',
                  color: 'white',
                  animation: recording ? 'pulse-slow 2s infinite' : 'none',
                }}
              >
                {recording ? <><MicOff size={15} /> Стоп</> : <><Mic size={15} /> Записать</>}
              </button>
              <button onClick={handleParseVoice} disabled={voiceLoading || recording || !transcript.trim()} className="btn-primary">
                {voiceLoading
                  ? <RefreshCw size={15} className="animate-spin" />
                  : deliveryMode === 'whatsapp' ? <MessageCircle size={15} /> : <Zap size={15} />}
                {voiceLoading ? 'Обрабатываю...' : deliveryMode === 'whatsapp' ? 'Создать и подготовить WhatsApp' : 'Создать задачи'}
              </button>
            </div>

            {recording && (
              <div className="mt-3 flex items-center gap-2">
                <div className="flex gap-0.5 items-end h-5">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full animate-pulse-slow"
                      style={{ height: `${8 + (i % 3) * 6}px`, background: '#f87171', animationDelay: `${i * 0.12}s` }}
                    />
                  ))}
                </div>
                <span className="text-xs font-medium" style={{ color: '#f87171' }}>Запись...</span>
              </div>
            )}

            {voiceNotice && (
              <div className="mt-3 rounded-2xl p-3 flex items-start gap-2" style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.28)', color: '#fde68a' }}>
                <Keyboard size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span className="text-xs leading-relaxed">{voiceNotice}</span>
              </div>
            )}

            <div className="mt-3 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="text-xs mb-1 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                <Keyboard size={12} /> Текст поручения
              </div>
              <textarea
                value={transcript}
                onChange={e => { setTranscript(e.target.value); setVoiceResult(null); setVoiceNotice('') }}
                className="text-sm w-full resize-none bg-transparent outline-none"
                placeholder="Например: Назкен, подготовь списки учеников сегодня. Айгерим, проверь актовый зал и проектор."
                style={{ color: 'rgba(255,255,255,0.85)' }}
                rows={3}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                'Назкен, подготовь списки учеников к педсовету сегодня. Айгерим, проверь актовый зал и проектор.',
                'Срочно: завхозу проверить кабинет 12, учителю 3А отправить посещаемость до 10:00.',
                'Сауле, собери заявки на столовую. Болат, организуй замену учителя математики на второй урок.',
              ].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => { setTranscript(example); setVoiceResult(null) }}
                  className="text-xs px-3 py-1.5 rounded-full transition-colors"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.58)' }}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden lg:block text-xs max-w-48 italic mt-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
            "Айгерим, подготовь актовый зал. Назкен, закажи воду и бейджи."
          </div>
        </div>

        {voiceResult && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: '#86efac' }}>
              <CheckCircle2 size={14} /> Создано {voiceResult.tasks_created} задач(и):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {voiceResult.tasks?.map((t, i) => (
                <div key={i} className="rounded-2xl p-2.5 text-sm" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <div className="font-medium">{t.title}</div>
                  {t.assignee_name && (
                    <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      <ArrowRight size={11} /> {t.assignee_name}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {voiceResult.whatsapp && (
              <div className="mt-4 rounded-2xl p-3" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.22)' }}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-sm font-medium flex items-center gap-1.5" style={{ color: '#86efac' }}>
                    <MessageCircle size={14} /> Сообщение для {voiceResult.whatsapp.group_name}
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <button type="button" onClick={copyWhatsappMessage} className="btn-secondary flex items-center gap-2">
                      {whatsappCopied ? <CheckCheck size={13} /> : <Copy size={13} />}
                      {whatsappCopied ? 'Скопировано' : 'Копировать'}
                    </button>
                    <button type="button" onClick={openWhatsappShare} className="btn-primary">
                      <MessageCircle size={14} /> Отправить
                    </button>
                  </div>
                </div>
                <pre
                  className="text-xs whitespace-pre-wrap rounded-xl p-3 max-h-56 overflow-auto"
                  style={{ background: 'rgba(0,0,0,0.18)', color: 'rgba(255,255,255,0.78)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {voiceResult.whatsapp.message}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── New task form ── */}
      {showNewTask && (
        <div className="app-panel animate-slide-up" style={{ padding: '24px' }}>
          <h3
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-0.025em', margin: '0 0 12px' }}
          >
            Новая задача
          </h3>
          <form onSubmit={handleCreateTask} className="space-y-3">
            <input
              required
              className="input"
              placeholder="Название задачи"
              value={newTask.title}
              onChange={e => { setNewTask(p => ({ ...p, title: e.target.value })); setRagCheckResult(null) }}
            />
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Описание (необязательно)"
              value={newTask.description}
              onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
            />
            <div className="grid grid-cols-3 gap-3">
              <select className="input" value={newTask.assignee_id} onChange={e => setNewTask(p => ({ ...p, assignee_id: e.target.value }))}>
                <option value="">Исполнитель</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className="input" value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))}>
                {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input type="date" className="input" value={newTask.due_date} onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))} />
            </div>

            {/* RAG check */}
            <RagCheckResult result={ragCheckResult} onDismiss={() => setRagCheckResult(null)} />

            <div className="flex gap-2 flex-wrap">
              <button type="submit" className="btn-primary">Создать</button>
              {newTask.title.trim() && (
                <button
                  type="button"
                  onClick={handleRagCheck}
                  disabled={ragCheckLoading}
                  className="btn-secondary flex items-center gap-2"
                >
                  {ragCheckLoading
                    ? <RefreshCw size={13} className="animate-spin" />
                    : <BookOpen size={13} />}
                  {ragCheckLoading ? 'Проверяю...' : 'Проверить нормативы'}
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={() => { setShowNewTask(false); setRagCheckResult(null) }}>
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Board header ── */}
      <div className="page-intro">
        <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.035em' }}>
          Доска задач
        </h3>
        <p style={{ margin: '4px 0 0', color: 'var(--text-soft)', fontSize: '0.95rem' }}>{allTasks.length} задач всего</p>
      </div>

      {/* ── Kanban ── */}
      {loading ? (
        <div className="dashboard-loading">
          <RefreshCw size={18} className="animate-spin" />
          <span>Загрузка задач...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {COLUMNS.map(status => {
            const { label, headBg, colBg } = COL_CONFIG[status]
            const colTasks = allTasks.filter(t => t.status === status)
            return (
              <div
                key={status}
                className="page-panel-tight"
                style={{ background: colBg, border: '1px solid rgba(255,255,255,0.08)', borderRadius: '28px' }}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3
                    className="font-semibold text-sm"
                    style={{ fontFamily: 'var(--font-display)', margin: 0, letterSpacing: '-0.015em' }}
                  >
                    {label}
                  </h3>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: headBg }}
                  >
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {colTasks.map(t => (
                    <TaskCard key={t.id} task={t} onUpdate={handleUpdate} onDelete={handleDelete} staff={staff} />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>Пусто</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
