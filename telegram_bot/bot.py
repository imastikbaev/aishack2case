"""
AI-Завуч Telegram Bot
- Teachers report attendance and incidents
- Bot sends notifications to staff
- Polls backend for pending notifications
"""
import os, asyncio, logging, httpx
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    CallbackQueryHandler, ContextTypes, filters
)

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "../backend/.env"))
TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ─── Helpers ────────────────────────────��──────────────────────────��─────────

async def backend_post(path: str, data: dict) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(f"{BACKEND_URL}{path}", json=data)
            res.raise_for_status()
            return res.json()
    except Exception as e:
        log.error(f"Backend POST {path} failed: {e}")
        return None


async def backend_get(path: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(f"{BACKEND_URL}{path}")
            res.raise_for_status()
            return res.json()
    except Exception as e:
        log.error(f"Backend GET {path} failed: {e}")
        return None


# ─── Commands ─────────────────────────────────────────────────────────────────

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    name = f"{user.first_name} {user.last_name or ''}".strip()
    await update.message.reply_text(
        f"👋 Добро пожаловать, {name}!\n\n"
        "Я AI-Завуч бот школы Aqbobek Lyceum.\n\n"
        "📊 *Посещаемость* — напишите: `1А - 25 детей, 2 болеют`\n"
        "⚠️ *Инцидент* — напишите: `В кабинете 12 сломалась парта`\n\n"
        "Команды:\n"
        "/attendance — сводка по посещаемости\n"
        "/tasks — мои задачи\n"
        "/help — помощь",
        parse_mode="Markdown"
    )


async def cmd_help(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📚 *Как пользоваться ботом:*\n\n"
        "*Посещаемость:*\n"
        "Напишите в любом формате, например:\n"
        "• `2А - 28 детей, 4 болеют`\n"
        "• `3Б - все 31 пришли`\n"
        "• `1В: присутствует 24, 1 болеет`\n\n"
        "*Инцидент:*\n"
        "• `В кабинете 5 не работает проектор`\n"
        "• `Ребёнок 2А получил травму на физкультуре`\n"
        "• `Конфликт между учениками 3В`\n\n"
        "*Команды:*\n"
        "/attendance — посещаемость сегодня\n"
        "/tasks — мои задачи\n"
        "/summary — сводка по школе\n",
        parse_mode="Markdown"
    )


async def cmd_attendance(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    data = await backend_get("/api/attendance/summary")
    if not data:
        await update.message.reply_text("⚠️ Не удалось получить данные. Сервер недоступен.")
        return

    reported = data.get("reported_classes", 0)
    total = data.get("total_classes", 0)
    present = data.get("present", 0)
    absent = data.get("absent", 0)
    portions = data.get("meal_portions_needed", 0)
    pct = data.get("completion_pct", 0)

    msg = (
        f"📊 *Посещаемость на сегодня*\n\n"
        f"✅ Присутствует: *{present}* учеников\n"
        f"❌ Отсутствует: *{absent}* учеников\n"
        f"🍽 Порций в столовую: *{portions}*\n\n"
        f"Отчиталось: {reported}/{total} классов ({pct}%)\n"
    )
    await update.message.reply_text(msg, parse_mode="Markdown")


async def cmd_tasks(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    name = f"{user.first_name} {user.last_name or ''}".strip()

    tasks_data = await backend_get("/api/tasks")
    if not tasks_data:
        await update.message.reply_text("⚠️ Не удалось получить задачи.")
        return

    # Filter tasks roughly matching this user's name
    my_tasks = [
        t for t in tasks_data
        if t.get("assignee_name")
        and user
        and user.first_name
        and user.first_name.lower() in t["assignee_name"].lower()
    ]

    if not my_tasks:
        await update.message.reply_text(f"У вас нет активных задач, {user.first_name}! 🎉")
        return

    lines = [f"📋 *Ваши задачи:*\n"]
    for t in my_tasks[:8]:
        emoji = {"todo": "⬜", "in_progress": "🔵", "done": "✅"}.get(t["status"], "⬜")
        priority_mark = {"urgent": "🔴", "high": "🟠", "medium": "🟡", "low": "⚪"}.get(t["priority"], "")
        lines.append(f"{emoji} {priority_mark} {t['title']}")
        if t.get("due_date"):
            due = t["due_date"][:10]
            lines.append(f"   📅 Срок: {due}")

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def cmd_summary(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    data = await backend_get("/api/dashboard")
    if not data:
        await update.message.reply_text("⚠️ Нет данных.")
        return

    att = data.get("attendance_summary", {})
    inc = data.get("incidents", {})
    tsk = data.get("tasks", {})

    msg = (
        f"🏫 *Сводка по школе*\n\n"
        f"👥 Учеников сегодня: {att.get('present', 0)} / отсутствует {att.get('absent', 0)}\n"
        f"📚 Классов отчиталось: {att.get('reported', 0)}/{att.get('total_classes', 0)}\n"
        f"⚠️ Открытых инцидентов: {inc.get('open', 0)} (срочных: {inc.get('urgent', 0)})\n"
        f"✅ Задач в работе: {tsk.get('pending', 0)} (просроч.: {tsk.get('overdue', 0)})\n"
    )
    unreported = data.get("unreported_classes", [])
    if unreported:
        msg += f"\n⏳ Не отчитались: {', '.join(unreported)}"

    await update.message.reply_text(msg, parse_mode="Markdown")


# ─── Message handler ──────────────────────────────────────────────────────────

async def handle_message(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    msg = update.message
    if not msg or not msg.text:
        return

    text = msg.text.strip()
    user = msg.from_user
    sender_name = f"{user.first_name} {user.last_name or ''}".strip()

    # Send to backend for AI parsing
    result = await backend_post("/api/messages/parse", {
        "message": text,
        "sender": sender_name,
        "telegram_id": str(user.id),
    })

    if not result:
        await msg.reply_text("⚠️ Сервер недоступен. Попробуйте позже.")
        return

    parsed = result.get("parsed", {})
    action = result.get("action_result", {})
    ptype = parsed.get("type", "general")

    if ptype == "attendance":
        cls = parsed.get("class_name", "?")
        present = parsed.get("present", 0)
        absent = parsed.get("absent", 0)
        if action and action.get("action") == "attendance_recorded":
            await msg.reply_text(
                f"✅ *Посещаемость {cls} принята*\n"
                f"👥 Присутствует: {present} | ❌ Отсутствует: {absent}",
                parse_mode="Markdown"
            )
        else:
            await msg.reply_text(f"⚠️ Не удалось записать посещаемость {cls}. {action.get('error', '')}")

    elif ptype == "incident":
        title = parsed.get("title") or text[:60]
        location = parsed.get("location") or "Не указано"
        if action and action.get("action") == "incident_created":
            await msg.reply_text(
                f"⚠️ *Инцидент зарегистрирован*\n"
                f"📍 Место: {location}\n"
                f"📋 Суть: {title}\n"
                f"🔧 Ответственный уведомлён",
                parse_mode="Markdown"
            )
        else:
            await msg.reply_text(f"⚠️ Не удалось создать инцидент. {action.get('error', '')}")

    else:
        # For general messages, just acknowledge
        keyboard = InlineKeyboardMarkup([[
            InlineKeyboardButton("📊 Посещаемость", callback_data="attendance"),
            InlineKeyboardButton("📋 Мои задачи", callback_data="tasks"),
        ]])
        await msg.reply_text(
            "✅ Сообщение получено. Что вы хотите сделать?",
            reply_markup=keyboard
        )


async def handle_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    if query.data == "attendance":
        data = await backend_get("/api/attendance/summary")
        if not data:
            await query.message.reply_text("⚠️ Не удалось получить данные. Сервер недоступен.")
            return
        await query.message.reply_text(
            f"📊 *Посещаемость на сегодня*\n\n"
            f"✅ Присутствует: *{data.get('present', 0)}* учеников\n"
            f"❌ Отсутствует: *{data.get('absent', 0)}* учеников\n"
            f"🍽 Порций в столовую: *{data.get('meal_portions_needed', 0)}*\n\n"
            f"Отчиталось: {data.get('reported_classes', 0)}/{data.get('total_classes', 0)} классов ({data.get('completion_pct', 0)}%)\n",
            parse_mode="Markdown",
        )
    elif query.data == "tasks":
        user = query.from_user
        tasks_data = await backend_get("/api/tasks")
        if not tasks_data:
            await query.message.reply_text("⚠️ Не удалось получить задачи.")
            return
        my_tasks = [
            t for t in tasks_data
            if t.get("assignee_name")
            and user.first_name
            and user.first_name.lower() in t["assignee_name"].lower()
        ]
        if not my_tasks:
            await query.message.reply_text(f"У вас нет активных задач, {user.first_name}! 🎉")
            return
        lines = ["📋 *Ваши задачи:*\n"]
        for t in my_tasks[:8]:
            emoji = {"todo": "⬜", "in_progress": "🔵", "done": "✅"}.get(t["status"], "⬜")
            priority_mark = {"urgent": "🔴", "high": "🟠", "medium": "🟡", "low": "⚪"}.get(t["priority"], "")
            lines.append(f"{emoji} {priority_mark} {t['title']}")
            if t.get("due_date"):
                lines.append(f"   📅 Срок: {t['due_date'][:10]}")
        await query.message.reply_text("\n".join(lines), parse_mode="Markdown")


# ─── Notification polling ─────────────────────────────────────────────────────

async def poll_notifications(app: Application):
    """Every 15 seconds check for pending notifications to send."""
    while True:
        try:
            data = await backend_get("/api/telegram/pending-notifications")
            if data and data.get("notifications"):
                for notif in data["notifications"]:
                    username = notif.get("username")
                    message = notif.get("message")
                    if username and message:
                        # In a real deployment we'd look up the chat_id from username
                        # For demo: log the notification
                        log.info(f"[NOTIF] @{username}: {message}")
        except Exception as e:
            log.debug(f"Notification poll error: {e}")
        await asyncio.sleep(15)


# ─── Main ─────────────────────────────────────────────────────────────────────

async def async_main():
    if not TELEGRAM_TOKEN or TELEGRAM_TOKEN == "your-telegram-bot-token":
        print("⚠️  TELEGRAM_BOT_TOKEN not set. Bot will not start.")
        print("   Set it in backend/.env and try again.")
        return

    app = Application.builder().token(TELEGRAM_TOKEN).build()

    app.add_handler(CommandHandler("start",      cmd_start))
    app.add_handler(CommandHandler("help",       cmd_help))
    app.add_handler(CommandHandler("attendance", cmd_attendance))
    app.add_handler(CommandHandler("tasks",      cmd_tasks))
    app.add_handler(CommandHandler("summary",    cmd_summary))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("🤖 AI-Завуч Telegram Bot started!")
    print("   Send /start to the bot to begin.")

    async with app:
        asyncio.create_task(poll_notifications(app))
        await app.start()
        await app.updater.start_polling(allowed_updates=Update.ALL_TYPES)
        await asyncio.Event().wait()  # run forever


def main():
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
