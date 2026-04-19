# AI-Завуч | Aqbobek Lyceum

Интеллектуальная система управления школой — Web Dashboard + Telegram Bot + AI.

## Быстрый старт

```bash
# 1. Добавить API ключи
cp backend/.env.example backend/.env
# Вставить GROQ_API_KEY и TELEGRAM_BOT_TOKEN в backend/.env

# 2. Запустить всё одной командой
./start.sh
```

Откройте [http://localhost:5173](http://localhost:5173)

## Модули

| Модуль | Описание |
|--------|----------|
| 📊 Дашборд | Ежедневный брифинг, риски, прогнозы, AI-инсайты |
| 📅 Расписание | Недельная сетка, тепловая карта нагрузки, умные замены |
| ✅ Задачи | Канбан-доска, голосовой ввод Voice-to-Task |
| 👥 Посещаемость | Сводка по классам, прогноз на завтра, заявка в столовую |
| ⚠️ Инциденты | Регистрация и отслеживание инцидентов |
| 🤖 AI-Ассистент | RAG по Приказам №76/110/130, симулятор Telegram-сообщений |
| 👤 Сотрудники | Карточки, риск-алерты, нагрузка |

## Стек

- **Backend**: Python FastAPI + SQLAlchemy (SQLite) + Groq
- **Frontend**: React 18 + Vite + Tailwind CSS + Recharts
- **Bot**: python-telegram-bot
- **AI**: Groq llama-3.3-70b-versatile (работает и без ключа — smart mock responses)

## Структура

```
schoolportal/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI routes
│   │   ├── models.py         # DB models
│   │   ├── seed_data.py      # Mock data (20 staff, 10 classes)
│   │   └── services/
│   │       ├── ai_service.py       # Groq integration
│   │       └── schedule_service.py # Schedule logic
│   └── regulations/          # Приказы №76, №110, №130
├── frontend/
│   └── src/pages/            # Dashboard, Schedule, Tasks, ...
└── telegram_bot/
    └── bot.py                # Polling bot
```

## Без API ключей

Проект работает **без** `GROQ_API_KEY` — все AI-функции возвращают умные mock-ответы на основе реальных данных.

## API

Swagger UI доступен на [http://localhost:8000/docs](http://localhost:8000/docs)
