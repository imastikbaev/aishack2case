import { useState, useRef, useEffect } from 'react'
import { Bot, Send, RefreshCw, BookOpen, FileText, Copy, CheckCheck, BarChart3, TriangleAlert, MessageSquareText, FlaskConical } from 'lucide-react'
import { ai, messages as messagesApi } from '../api'

const QUICK_QUESTIONS = [
  'Какова максимальная нагрузка учителя по Приказу №130?',
  'Что делать если ученик заболел в школе?',
  'Как оформить замещение уроков по приказу?',
  'Санитарные нормы температуры в классах (Приказ №76)',
  'Требования к расписанию уроков',
  'Составь приказ о замещении уроков',
]

const DEMO_MSGS = [
  { sender_name: 'Жанар Омарова',  message: '1А - 28 детей, 2 болеют',                             parsed_type: 'attendance', created_at: new Date(Date.now()-3600000).toISOString() },
  { sender_name: 'Сауле Бекова',   message: '1Б - все 26 пришли',                                  parsed_type: 'attendance', created_at: new Date(Date.now()-3500000).toISOString() },
  { sender_name: 'Асель Мусина',   message: 'В кабинете 12 сломалась парта',                       parsed_type: 'incident',   created_at: new Date(Date.now()-1800000).toISOString() },
  { sender_name: 'Айжан Серікова', message: '3В - 30 детей. 2 на больничном.',                     parsed_type: 'attendance', created_at: new Date(Date.now()-1200000).toISOString() },
  { sender_name: 'Болат Рахимов',  message: 'Спортзал свободен до 11:00',                          parsed_type: 'general',    created_at: new Date(Date.now()-600000).toISOString() },
  { sender_name: 'Гүлдана Нұрова', message: 'Проектор в кабинете 7 не работает уже второй день',   parsed_type: 'incident',   created_at: new Date(Date.now()-300000).toISOString() },
]

const CARD = {
  background: 'var(--panel-strong)',
  border: '1px solid var(--panel-border)',
  borderRadius: '36px',
  boxShadow: 'var(--shadow-panel), var(--shadow-soft)',
}

function ParsedTypeBadge({ type }) {
  const s = {
    attendance: { bg: 'rgba(34,197,94,0.2)', color: '#86efac', label: 'Посещаемость', icon: BarChart3 },
    incident: { bg: 'rgba(239,68,68,0.2)', color: '#f87171', label: 'Инцидент', icon: TriangleAlert },
    general: { bg: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', label: 'Общее', icon: MessageSquareText },
  }[type] || { bg: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', label: type }
  const Icon = s.icon
  return <span className="badge text-xs flex items-center gap-1" style={{ background: s.bg, color: s.color }}>{Icon ? <Icon size={11} /> : null}{s.label}</span>
}

function ChatBubble({ msg }) {
  const [copied, setCopied] = useState(false)
  const isBot = msg.isBot

  function copy(text) {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div className={`flex gap-3 ${isBot ? '' : 'flex-row-reverse'}`}>
      <div
        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
        style={{ background: isBot ? 'rgba(61,80,216,0.4)' : 'rgba(255,255,255,0.15)' }}
      >
        {isBot ? <Bot size={15} /> : 'Г'}
      </div>
      <div
        className="max-w-[80%] rounded-2xl px-4 py-3 text-sm"
        style={{
          background: isBot ? 'rgba(45, 61, 191, 0.45)' : '#2d3dbf',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.9)',
        }}
      >
        {msg.type === 'rag' ? (
          <div className="space-y-2">
            <p>{msg.answer}</p>
            {msg.bullet_points?.length > 0 && (
              <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(61,80,216,0.2)' }}>
                <div className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: '#93c5fd' }}>
                  <FileText size={11} /> Чек-лист:
                </div>
                <ul className="space-y-1">
                  {msg.bullet_points.map((b, i) => (
                    <li key={i} className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
            {msg.sources?.length > 0 && (
              <div className="text-xs flex items-center gap-1 mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <BookOpen size={9} /> Источники: {msg.sources.join(', ')}
              </div>
            )}
            {msg.document_template && (
              <div className="mt-2">
                <div className="text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Шаблон документа:</div>
                <pre
                  className="text-xs rounded-lg p-2 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto"
                  style={{ background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
                >{msg.document_template}</pre>
                <button
                  onClick={() => copy(msg.document_template)}
                  className="mt-1 text-xs flex items-center gap-1 hover:opacity-80"
                  style={{ color: '#60a5fa' }}
                >
                  {copied ? <><CheckCheck size={10} /> Скопировано</> : <><Copy size={10} /> Копировать</>}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p>{msg.text}</p>
        )}
      </div>
    </div>
  )
}

export default function AIAssistant() {
  const [tab, setTab] = useState('rag')
  const [chatHistory, setChatHistory] = useState([
    { id: 0, type: 'text', text: 'Привет! Я AI-ассистент школы. Задайте вопрос о нормативных актах (Приказы №76, №110, №130) или попросите составить документ.', isBot: true }
  ])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading]         = useState(false)
  const [telegramMessages, setTelegramMessages] = useState(DEMO_MSGS)
  const [simMessage, setSimMessage]   = useState('')
  const [simSender, setSimSender]     = useState('Жанар Омарова')
  const [simLoading, setSimLoading]   = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatHistory])

  async function handleAskQuestion(question) {
    const q = question || inputValue.trim()
    if (!q) return
    setInputValue('')
    setChatHistory(prev => [...prev, { id: Date.now(), type: 'text', text: q, isBot: false }])
    setLoading(true)
    try {
      const res = await ai.rag(q)
      setChatHistory(prev => [...prev, {
        id: Date.now() + 1, type: 'rag', isBot: true,
        answer: res.data.answer,
        bullet_points: res.data.bullet_points,
        sources: res.data.sources,
        document_template: res.data.document_template,
      }])
    } catch {
      setChatHistory(prev => [...prev, { id: Date.now() + 1, type: 'text', text: 'Ошибка подключения. Проверьте API-ключ.', isBot: true }])
    } finally { setLoading(false) }
  }

  async function handleSimulateMessage() {
    if (!simMessage.trim()) return
    setSimLoading(true)
    try {
      const res    = await messagesApi.parse({ message: simMessage, sender: simSender })
      const parsed = res.data.parsed
      const action = res.data.action_result

      setTelegramMessages(prev => [{
        sender_name: simSender, message: simMessage,
        parsed_type: parsed.type, created_at: new Date().toISOString(),
      }, ...prev.slice(0, 19)])

      let feedback = `AI распознал: ${parsed.type === 'attendance' ? `посещаемость класса ${parsed.class_name || '?'}: ${parsed.present} присутствует, ${parsed.absent} отсутствует` : parsed.type === 'incident' ? `инцидент: «${parsed.title || simMessage.slice(0, 50)}»` : 'общее сообщение'}`
      if (action?.action === 'attendance_recorded') feedback += '\nПосещаемость сохранена автоматически.'
      if (action?.action === 'incident_created')   feedback += '\nСоздана карточка инцидента для завхоза.'
      alert(feedback)
      setSimMessage('')
    } finally { setSimLoading(false) }
  }

  return (
    <div className="page-shell animate-slide-up">
      <div className="page-intro">
        <h2>AI ассистент</h2>
        <p>Нормативная база, чат и симулятор сообщений собраны в едином стиле интерфейса.</p>
      </div>

      <div className="pill-tabs">
        {[['rag', 'Нормативная база', BookOpen], ['chat', 'Чат учителей', MessageSquareText], ['parse', 'Симулятор', FlaskConical]].map(([v, label, Icon]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`pill-tab ${tab === v ? 'is-active' : ''} flex-1 flex items-center justify-center gap-2`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── RAG ── */}
      {tab === 'rag' && (
        <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 230px)' }}>
          <div className="page-panel" style={CARD}>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={14} style={{ color: '#60a5fa' }} />
              <span className="text-sm font-semibold">Быстрые вопросы</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleAskQuestion(q)}
                  className="text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
                  style={{ background: 'rgba(61,80,216,0.25)', color: '#93c5fd', border: '1px solid rgba(61,80,216,0.3)' }}
                >
                  <BookOpen size={11} />
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="page-panel flex-1 flex flex-col min-h-0 overflow-hidden" style={CARD}>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatHistory.map(msg => <ChatBubble key={msg.id} msg={msg} />)}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(61,80,216,0.4)' }}><Bot size={15} /></div>
                  <div className="rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background: '#232e98', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <RefreshCw size={13} className="animate-spin" style={{ color: '#60a5fa' }} />
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Анализирую нормативные акты...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <input
                className="input flex-1"
                placeholder="Задайте вопрос о Приказах №76, №110, №130..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAskQuestion()}
              />
              <button onClick={() => handleAskQuestion()} disabled={loading || !inputValue.trim()} className="btn-primary">
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Chat viewer ── */}
      {tab === 'chat' && (
        <div className="page-panel" style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
          <div
            className="px-5 py-3 flex items-center gap-2"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}
          >
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium">Чат учителей (Telegram-бот) — последние сообщения</span>
          </div>
          <div>
            {telegramMessages.map((msg, i) => (
              <div
                key={i}
                className="px-5 py-3.5 transition-colors"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg, #3d50d8, #6366f1)' }}
                    >
                      {msg.sender_name[0]}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{msg.sender_name}</div>
                      <div className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>{msg.message}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <ParsedTypeBadge type={msg.parsed_type} />
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Simulator ── */}
      {tab === 'parse' && (
        <div className="space-y-4">
          <div className="page-panel" style={CARD}>
            <h3 className="font-semibold mb-1">Симулятор сообщений Telegram</h3>
            <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Отправьте тестовое сообщение — AI распознает его как посещаемость или инцидент.
            </p>
            <div className="space-y-3">
              <input className="input" placeholder="Имя отправителя" value={simSender} onChange={e => setSimSender(e.target.value)} />
              <textarea
                className="input resize-none"
                rows={3}
                placeholder={'Примеры:\n"3А - 30 детей, 3 болеют"\n"В кабинете 5 сломана доска"'}
                value={simMessage}
                onChange={e => setSimMessage(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {['2А - 29 детей, 3 отсутствуют', 'В кабинете 12 сломалась парта', '4Б - все 38 на месте', 'Конфликт между учениками 3В'].map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setSimMessage(ex)}
                    className="text-xs px-3 py-1.5 rounded-full transition-colors"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <button onClick={handleSimulateMessage} disabled={simLoading || !simMessage.trim()} className="btn-primary">
                {simLoading ? <RefreshCw size={15} className="animate-spin" /> : <Bot size={15} />}
                {simLoading ? 'Обрабатываю...' : 'Отправить через AI'}
              </button>
            </div>
          </div>

          <div className="page-panel" style={CARD}>
            <h4 className="font-medium text-sm mb-3" style={{ color: 'rgba(255,255,255,0.7)' }}>Обработанные сообщения:</h4>
            <div className="space-y-2">
              {telegramMessages.slice(0, 6).map((msg, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm py-1.5"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <ParsedTypeBadge type={msg.parsed_type} />
                  <span className="font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{msg.sender_name}:</span>
                  <span className="flex-1 truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{msg.message}</span>
                  <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
