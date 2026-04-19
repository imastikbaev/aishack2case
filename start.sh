#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🏫 AI-Завуч — Aqbobek Lyceum"
echo "================================"

# ── 1. Backend setup ────────────────────────────────────────────────────────
cd "$ROOT/backend"

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "⚠️  Created backend/.env from template. Edit it to add your API keys."
fi

if [ ! -d ".venv" ]; then
  echo "📦 Creating Python venv..."
  python3 -m venv .venv
fi

source .venv/bin/activate
echo "📦 Installing backend dependencies..."
pip install -q -r requirements.txt

echo "🌱 Seeding database..."
python -m app.seed_data

# ── 2. Start backend ────────────────────────────────────────────────────────
echo "🚀 Starting FastAPI backend on http://localhost:8000 ..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

sleep 2

# ── 3. Frontend setup ───────────────────────────────────────────────────────
cd "$ROOT/frontend"

if [ ! -d "node_modules" ]; then
  echo "📦 Installing frontend dependencies (npm)..."
  npm install
fi

# ── 4. Start frontend ───────────────────────────────────────────────────────
echo "🚀 Starting React frontend on http://localhost:5173 ..."
npm run dev &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

# ── 5. Optional: Telegram bot ───────────────────────────────────────────────
cd "$ROOT/telegram_bot"
BOT_TOKEN=$(grep TELEGRAM_BOT_TOKEN "$ROOT/backend/.env" | cut -d= -f2)

if [ -n "$BOT_TOKEN" ] && [ "$BOT_TOKEN" != "your-telegram-bot-token" ]; then
  if [ ! -d ".venv" ]; then
    python3 -m venv .venv
  fi
  source .venv/bin/activate
  pip install -q -r requirements.txt
  echo "🤖 Starting Telegram bot..."
  TELEGRAM_BOT_TOKEN="$BOT_TOKEN" BACKEND_URL=http://localhost:8000 python bot.py &
  BOT_PID=$!
  echo "   Bot PID: $BOT_PID"
else
  echo "ℹ️  Telegram bot skipped (TELEGRAM_BOT_TOKEN not set)"
fi

echo ""
echo "════════════════════════════════"
echo "✅ All services started!"
echo "   Dashboard: http://localhost:5173"
echo "   API docs:  http://localhost:8000/docs"
echo "════════════════════════════════"
echo "Press Ctrl+C to stop all services"

# Wait and cleanup
trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID ${BOT_PID:-} 2>/dev/null; exit" INT TERM
wait
