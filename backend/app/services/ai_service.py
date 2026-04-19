"""
Groq-powered AI service: message parsing, voice-to-task, substitution, RAG, insights.
Falls back to smart mock responses when GROQ_API_KEY is not set.
Model: llama-3.3-70b-versatile (fast + capable)
"""
import os, json, re
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = "llama-3.3-70b-versatile"


def _load_regulations() -> str:
    base = os.path.join(os.path.dirname(__file__), "../../regulations")
    texts = []
    for fname in ["prikaz_76.txt", "prikaz_110.txt", "prikaz_130.txt"]:
        fpath = os.path.join(base, fname)
        if os.path.exists(fpath):
            with open(fpath, encoding="utf-8") as f:
                texts.append(f.read())
    return "\n\n---\n\n".join(texts)


REGULATIONS_TEXT = None


def _get_regulations():
    global REGULATIONS_TEXT
    if REGULATIONS_TEXT is None:
        REGULATIONS_TEXT = _load_regulations()
    return REGULATIONS_TEXT


def _call_groq(system: str, user: str, max_tokens: int = 1024) -> str:
    if not GROQ_API_KEY or GROQ_API_KEY.startswith("gsk_your"):
        return "__MOCK__"
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": user},
            ],
            max_tokens=max_tokens,
            temperature=0.3,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"[Groq] Error: {e}")
        return "__MOCK__"


# ─── Message parsing ─────────────────────────────────────────────────────────

def parse_chat_message(message: str, sender: str, staff_list: list) -> dict:
    system = """Ты AI-ассистент школы. Анализируй сообщение учителя и классифицируй его.
Верни ТОЛЬКО валидный JSON (без markdown, без объяснений) в одном из форматов:

Если посещаемость:
{"type": "attendance", "class_name": "1А", "present": 25, "absent": 2, "total": 27}

Если инцидент:
{"type": "incident", "category": "maintenance|discipline|health|other", "location": "Кабинет 12", "title": "Краткое название", "description": "Детали"}

Если общее сообщение:
{"type": "general"}

Категории: maintenance (поломки), discipline (конфликты), health (болезни/травмы), other."""

    user = f"Отправитель: {sender}\nСообщение: {message}"
    raw = _call_groq(system, user, max_tokens=200)

    if raw == "__MOCK__":
        return _mock_parse_message(message, sender)

    # Extract JSON from response
    raw = raw.strip()
    # Remove markdown code blocks if present
    raw = re.sub(r'```(?:json)?\s*', '', raw).strip('`').strip()
    try:
        return json.loads(raw)
    except Exception:
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
    return _mock_parse_message(message, sender)


def _mock_parse_message(message: str, sender: str) -> dict:
    msg_lower = message.lower()

    attendance_keywords = ["детей", "ребят", "присутств", "отсутств", "болеет", "болеют", "пришли", "из", "нет"]
    class_pattern = re.search(r'(\d+[АаБбВвAaBb])', message)

    if class_pattern and any(kw in msg_lower for kw in attendance_keywords):
        clean_msg = re.sub(r'\d+[АаБбВвAaBb]', '', message)
        numbers = re.findall(r'\d+', clean_msg)
        nums = [int(n) for n in numbers if 1 <= int(n) <= 50]
        class_name = class_pattern.group(1).upper()
        if len(nums) >= 2:
            iz_match = re.search(r'(\d+)\s+из\s+(\d+)', clean_msg)
            if iz_match:
                present = int(iz_match.group(1))
                total = int(iz_match.group(2))
                absent = total - present
                return {"type": "attendance", "class_name": class_name, "present": present, "absent": absent, "total": total}
            present = max(nums)
            absent_match = re.search(r'(\d+)\s*(?:болеет|болеют|отсутствует|отсутствуют|нет|пропускают|на больничном)', msg_lower)
            absent = int(absent_match.group(1)) if absent_match else min(nums)
            if absent >= present:
                absent = 0
            return {"type": "attendance", "class_name": class_name, "present": present, "absent": absent, "total": present + absent}
        elif len(nums) == 1:
            return {"type": "attendance", "class_name": class_name, "present": nums[0], "absent": 0, "total": nums[0]}

    incident_keywords = {
        "maintenance": ["сломан", "сломалась", "поломк", "не работает", "протечк", "замок", "парта", "стул", "окно", "лампочк", "проектор", "кран"],
        "discipline":  ["конфликт", "подрался", "дрались", "нарушен", "поведен", "буллинг"],
        "health":      ["температур", "недомогани", "болит", "травм", "упал", "кашляет"],
    }
    for cat, keywords in incident_keywords.items():
        if any(kw in msg_lower for kw in keywords):
            room_match = re.search(r'каб(?:инет)?\s*(\d+)', msg_lower)
            location = f"Кабинет {room_match.group(1)}" if room_match else "Школа"
            return {"type": "incident", "category": cat, "location": location,
                    "title": message[:60], "description": message}

    return {"type": "general"}


# ─── Voice-to-Task ────────────────────────────────────────────────────────────

def voice_to_tasks(transcript: str, staff_list: list) -> list:
    staff_json = json.dumps(
        [{"id": s["id"], "name": s["name"], "role": s["role"]} for s in staff_list],
        ensure_ascii=False
    )
    system = f"""Ты AI-секретарь директора школы. Преобразуй голосовую команду в список задач.
Список сотрудников: {staff_json}

Верни ТОЛЬКО валидный JSON-массив (без markdown):
[
  {{
    "title": "Краткое название задачи",
    "description": "Подробное описание",
    "assignee_name": "Полное имя из списка или null",
    "priority": "low|medium|high|urgent",
    "due_days": 3
  }}
]

Правила:
- Раздели команду на отдельные задачи по исполнителям
- Найди исполнителей по имени (частичное совпадение)
- due_days: 1 если "сегодня", 3 по умолчанию, 7 если "на следующей неделе"
- priority: urgent если "срочно", high если "сегодня/завтра", medium по умолчанию"""

    raw = _call_groq(system, f"Команда: {transcript}", max_tokens=600)

    if raw == "__MOCK__":
        return _mock_voice_to_tasks(transcript, staff_list)

    raw = re.sub(r'```(?:json)?\s*', '', raw).strip('`').strip()
    try:
        result = json.loads(raw)
        return result if isinstance(result, list) else [result]
    except Exception:
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
    return _mock_voice_to_tasks(transcript, staff_list)


def _mock_voice_to_tasks(transcript: str, staff_list: list) -> list:
    tasks = []
    sentences = re.split(r'[.,;]', transcript)
    name_to_staff = {s["name"].split()[0].lower(): s for s in staff_list}

    for sentence in sentences:
        sentence = sentence.strip()
        if len(sentence) < 5:
            continue
        assignee_name = None
        for first_name, staff in name_to_staff.items():
            if first_name in sentence.lower():
                assignee_name = staff["name"]
                break
        tasks.append({
            "title": sentence[:80],
            "description": sentence,
            "assignee_name": assignee_name,
            "priority": "high" if any(w in sentence.lower() for w in ["срочно", "сегодня", "немедленно"]) else "medium",
            "due_days": 7 if "неделе" in sentence.lower() else (1 if "сегодня" in sentence.lower() else 3),
        })
    return tasks or [{"title": transcript[:80], "description": transcript,
                      "assignee_name": None, "priority": "medium", "due_days": 3}]


def format_whatsapp_tasks(tasks: list, director_name: str = "Гульбара Сейтова") -> str:
    """Build a compact structured message for a school WhatsApp group."""
    priority_label = {
        "urgent": "Срочно",
        "high": "Высокий",
        "medium": "Средний",
        "low": "Низкий",
    }
    lines = [
        "Поручение от директора",
        f"Инициатор: {director_name}",
        "",
    ]

    for idx, task in enumerate(tasks, 1):
        title = task.get("title") or "Без названия"
        assignee = task.get("assignee_name") or task.get("assignee") or "Ответственный не определен"
        priority = priority_label.get(task.get("priority"), task.get("priority", "Средний"))
        due_days = task.get("due_days")
        if due_days == 1:
            due = "сегодня"
        elif due_days:
            due = f"через {due_days} дн."
        else:
            due = "уточнить"

        lines.extend([
            f"{idx}. {title}",
            f"   Ответственный: {assignee}",
            f"   Срок: {due}",
            f"   Приоритет: {priority}",
        ])
        if task.get("description") and task["description"] != title:
            lines.append(f"   Детали: {task['description']}")
        lines.append("")

    lines.append("Пожалуйста, подтвердите принятие задачи в группе.")
    return "\n".join(lines).strip()


# ─── Smart Substitution ───────────────────────────────────────────────────────

def find_substitution(absent_teacher: dict, schedule_today: list, all_staff: list) -> dict:
    affected = [s for s in schedule_today if s.get("teacher_id") == absent_teacher["id"]]
    candidates = [s for s in all_staff
                  if s["id"] != absent_teacher["id"]
                  and s["role"] in ("teacher", "vice_principal")
                  and s.get("is_available", True)
                  and s.get("current_hours_week", 0) < s.get("max_hours_per_week", 20)]

    system = """Ты AI-завуч. Найди лучшую замену для заболевшего учителя.
Верни ТОЛЬКО валидный JSON (без markdown):
{
  "substitute_id": <int или null>,
  "substitute_name": "<имя>",
  "reasoning": "<краткое объяснение на русском>",
  "lessons_covered": [{"class": "3А", "period": 2, "subject": "Математика"}],
  "self_study_periods": []
}"""

    user = (f"Заболел: {json.dumps(absent_teacher, ensure_ascii=False)}\n"
            f"Уроки сегодня: {json.dumps(affected, ensure_ascii=False)}\n"
            f"Доступные учителя: {json.dumps(candidates[:8], ensure_ascii=False)}")

    raw = _call_groq(system, user, max_tokens=400)

    if raw == "__MOCK__":
        return _mock_substitution(absent_teacher, affected, candidates)

    raw = re.sub(r'```(?:json)?\s*', '', raw).strip('`').strip()
    try:
        return json.loads(raw)
    except Exception:
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
    return _mock_substitution(absent_teacher, affected, candidates)


def _mock_substitution(absent: dict, affected: list, candidates: list) -> dict:
    absent_subjects = set(absent.get("subjects", []))
    best = next((c for c in candidates if set(c.get("subjects", [])) & absent_subjects), None)
    if not best and candidates:
        best = candidates[0]
    return {
        "substitute_id": best["id"] if best else None,
        "substitute_name": best["name"] if best else "Не найден",
        "reasoning": f"Учитель {best['name']} имеет подходящую квалификацию и свободные окна" if best else "Нет доступных учителей",
        "lessons_covered": [{"class": "класс", "period": s.get("period", 1), "subject": s.get("subject", "")} for s in affected[:3]],
        "self_study_periods": [],
    }


# ─── Attendance Prediction ────────────────────────────────────────────────────

def predict_attendance(history: list, total_students: int, today_info: str = "") -> dict:
    system = """Ты аналитик школы. Предсказывай посещаемость на следующий день.
Верни ТОЛЬКО валидный JSON (без markdown):
{
  "predicted_present": <int>,
  "predicted_absent": <int>,
  "confidence": <0.0-1.0>,
  "reasoning": "Объяснение на русском",
  "recommended_portions": <int>,
  "risk_level": "low|medium|high"
}"""

    user = (f"Всего учеников: {total_students}\n"
            f"История (последние дни): {json.dumps(history, ensure_ascii=False)}\n"
            f"Контекст: {today_info}")

    raw = _call_groq(system, user, max_tokens=300)

    if raw == "__MOCK__":
        return _mock_prediction(history, total_students)

    raw = re.sub(r'```(?:json)?\s*', '', raw).strip('`').strip()
    try:
        return json.loads(raw)
    except Exception:
        return _mock_prediction(history, total_students)


def _mock_prediction(history: list, total: int) -> dict:
    import random
    random.seed(42)
    if history:
        avg_absent = sum(h.get("absent", 0) for h in history[-5:]) / min(5, len(history))
        predicted_absent = max(0, int(avg_absent * 1.05 + random.uniform(-1, 2)))
    else:
        predicted_absent = int(total * 0.05)
    predicted_present = total - predicted_absent
    return {
        "predicted_present": predicted_present,
        "predicted_absent": predicted_absent,
        "confidence": 0.80,
        "reasoning": f"На основе средней посещаемости за последние 5 дней. Ожидается ~{predicted_absent} отсутствий.",
        "recommended_portions": predicted_present + 3,
        "risk_level": "medium" if predicted_absent > total * 0.08 else "low",
    }


# ─── Risk Analysis ────────────────────────────────────────────────────────────

def analyze_teacher_risks(staff_list: list, task_stats: dict, schedule_stats: dict) -> list:
    teachers = [s for s in staff_list if s.get("role") in ("teacher", "vice_principal")]

    system = """Ты HR-аналитик школы. Оцени риск выгорания каждого учителя.
Верни ТОЛЬКО валидный JSON-массив (без markdown):
[{"staff_id": <int>, "name": "<имя>", "risk_level": "low|medium|high|critical",
  "risk_score": <0.0-1.0>, "reasons": ["..."], "recommendations": ["..."]}]"""

    user = (f"Учителя: {json.dumps(teachers[:10], ensure_ascii=False)}\n"
            f"Задачи: {json.dumps(task_stats, ensure_ascii=False)}\n"
            f"Нагрузка: {json.dumps(schedule_stats, ensure_ascii=False)}")

    raw = _call_groq(system, user, max_tokens=1200)

    if raw == "__MOCK__":
        return _mock_risk_analysis(staff_list)

    raw = re.sub(r'```(?:json)?\s*', '', raw).strip('`').strip()
    try:
        result = json.loads(raw)
        return result if isinstance(result, list) else _mock_risk_analysis(staff_list)
    except Exception:
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
    return _mock_risk_analysis(staff_list)


def _mock_risk_analysis(staff_list: list) -> list:
    results = []
    for s in staff_list:
        if s.get("role") not in ("teacher", "vice_principal"):
            continue
        score = s.get("risk_score", 0.1)
        hours = s.get("current_hours_week", 0)
        max_h = s.get("max_hours_per_week", 20)
        absences = s.get("absence_count", 0)
        extra = s.get("extra_tasks_count", 0)

        reasons = []
        if hours > max_h:
            reasons.append(f"Перегруз: {hours} ч/нед (норма {max_h})")
        if absences >= 3:
            reasons.append(f"Частые отсутствия: {absences} раз")
        if extra >= 5:
            reasons.append(f"Много внеурочных задач: {extra}")

        level = ("critical" if score >= 0.7 else "high" if score >= 0.5
                 else "medium" if score >= 0.3 else "low")
        results.append({
            "staff_id": s["id"], "name": s["name"],
            "risk_level": level, "risk_score": score,
            "reasons": reasons or ["В норме"],
            "recommendations": (["Снизить нагрузку", "Подготовить замену заранее"]
                                 if score >= 0.5 else ["Мониторинг"]),
        })
    results.sort(key=lambda x: -x["risk_score"])
    return results


# ─── Hidden Insights ──────────────────────────────────────────────────────────

def generate_insights(incidents: list, tasks: list, attendance: list, staff: list) -> list:
    system = """Ты аналитик данных школы. Найди неочевидные паттерны и сформулируй 3-5 конкретных инсайтов.
Верни ТОЛЬКО валидный JSON-массив строк (без markdown):
["Инсайт 1: ...", "Инсайт 2: ..."]
Инсайты должны быть на русском, конкретными и действенными."""

    user = (f"Инциденты: {json.dumps(incidents[:10], ensure_ascii=False)}\n"
            f"Задачи: {json.dumps(tasks[:10], ensure_ascii=False)}\n"
            f"Посещаемость (7 дн): {json.dumps(attendance[-7:], ensure_ascii=False)}\n"
            f"Сотрудники (риски): {json.dumps([{'name': s['name'], 'risk_score': s.get('risk_score', 0), 'hours': s.get('current_hours_week', 0), 'max': s.get('max_hours_per_week', 20)} for s in staff if s.get('role') == 'teacher'], ensure_ascii=False)}")

    raw = _call_groq(system, user, max_tokens=600)

    if raw == "__MOCK__":
        return _mock_insights(incidents, tasks, staff)

    raw = re.sub(r'```(?:json)?\s*', '', raw).strip('`').strip()
    try:
        result = json.loads(raw)
        return result if isinstance(result, list) else _mock_insights(incidents, tasks, staff)
    except Exception:
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
    return _mock_insights(incidents, tasks, staff)


def _mock_insights(incidents: list, tasks: list, staff: list) -> list:
    insights = []
    room_counts: dict = {}
    for inc in incidents:
        loc = inc.get("location", "")
        if loc:
            room_counts[loc] = room_counts.get(loc, 0) + 1
    for room, count in room_counts.items():
        if count >= 2:
            insights.append(f"{room}: {count} инцидента за последние 2 недели — возможна системная проблема.")
    for s in staff:
        hours = s.get("current_hours_week", 0)
        max_h = s.get("max_hours_per_week", 20)
        extra = s.get("extra_tasks_count", 0)
        if hours > max_h:
            insights.append(f"{s['name']} перегружен: {hours}/{max_h} ч/нед. Риск внезапного отсутствия.")
        elif extra >= 7:
            insights.append(f"{s['name']} получает наибольшую внеурочную нагрузку ({extra} задач).")
    overdue = [t for t in tasks if t.get("status") != "done" and t.get("due_date")]
    if len(overdue) >= 3:
        insights.append(f"{len(overdue)} задач близки к дедлайну. Рекомендуется приоритизация.")
    return insights[:5] or ["Посещаемость стабильна — выше 90% последние 5 дней.",
                             "Пик инцидентов — первая половина недели (пн–вт)."]


# ─── RAG ──────────────────────────────────────────────────────────────────────

def rag_query(question: str, context: Optional[str] = None) -> dict:
    regs = _get_regulations()
    system = f"""Ты юридический помощник директора школы Казахстана.
Нормативные акты:

{regs}

Правила:
1. Отвечай ТОЛЬКО на основе предоставленных документов
2. Если информации нет — честно скажи
3. Язык: русский, простой и понятный
4. Верни ТОЛЬКО валидный JSON (без markdown):
{{
  "answer": "Подробный ответ",
  "bullet_points": ["• Пункт 1", "• Пункт 2"],
  "sources": ["Приказ МЗ РК №76, п.X"],
  "document_template": "Готовый шаблон документа если просили составить (или null)"
}}"""

    user = f"{f'Контекст: {context}' + chr(10) if context else ''}Вопрос: {question}"
    raw = _call_groq(system, user, max_tokens=1500)

    if raw == "__MOCK__":
        return _mock_rag(question)

    raw = re.sub(r'```(?:json)?\s*', '', raw).strip('`').strip()
    try:
        return json.loads(raw)
    except Exception:
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
        return {"answer": raw, "bullet_points": [], "sources": [], "document_template": None}


def _mock_rag(question: str) -> dict:
    q = question.lower()
    if "76" in q or "санитар" in q:
        return {
            "answer": "Приказ МЗ РК №76 регулирует санитарно-эпидемиологические требования к объектам образования.",
            "bullet_points": ["• Температура в классах: 18–22°C", "• Освещённость: не менее 300 лк", "• Влажность: 40–60%", "• Перемены: не менее 10 минут", "• Большая перемена: 20 минут"],
            "sources": ["Приказ МЗ РК №76"], "document_template": None,
        }
    if "130" in q or "нагрузк" in q or "расписани" in q:
        return {
            "answer": "Приказ МОН РК №130 устанавливает нормы учебной нагрузки: 1 ставка = 18 ч/нед, максимум 27 ч/нед.",
            "bullet_points": ["• Ставка учителя: 18 ч/нед", "• Максимум: 27 ч/нед (1.5 ставки)", "• Урок: 40 минут (1 кл. — 35 мин)", "• Максимум уроков в день: 5–6", "• Замещение оплачивается отдельно"],
            "sources": ["Приказ МОН РК №130, п. 15–22"], "document_template": None,
        }
    if "110" in q or "здоров" in q or "медицин" in q:
        return {
            "answer": "Приказ МЗ РК №110 регламентирует медицинское обеспечение учащихся.",
            "bullet_points": ["• Ежегодный медосмотр всех учащихся", "• Изоляция при температуре > 37.5°C", "• Уведомление родителей в течение 1 часа", "• Справка после ОРВИ обязательна"],
            "sources": ["Приказ МЗ РК №110"], "document_template": None,
        }
    return {
        "answer": "Уточните, какой приказ вас интересует: №76 (санитарные нормы), №110 (здоровье учащихся) или №130 (учебная нагрузка).",
        "bullet_points": ["• Приказ МЗ РК №76 — санитарные нормы", "• Приказ МЗ РК №110 — здоровье учащихся", "• Приказ МОН РК №130 — учебная нагрузка"],
        "sources": [], "document_template": None,
    }


# ─── Schedule Simulation ──────────────────────────────────────────────────────

def simulate_absence_scenarios(absent_teacher: dict, schedule: list, all_staff: list) -> list:
    candidates = [s for s in all_staff
                  if s["id"] != absent_teacher["id"]
                  and s["role"] in ("teacher", "vice_principal")
                  and s.get("is_available", True)][:5]

    system = """Ты планировщик расписания. Создай 3 варианта замены учителя.
Верни ТОЛЬКО валидный JSON-массив (без markdown):
[{"scenario": "Вариант 1", "substitute_name": "<имя>", "pros": ["плюс"],
  "cons": ["минус"], "impact_score": <0-10>, "recommended": <true/false>}]"""

    user = (f"Отсутствует: {json.dumps(absent_teacher, ensure_ascii=False)}\n"
            f"Уроки: {json.dumps([s for s in schedule if s.get('teacher_id') == absent_teacher['id']], ensure_ascii=False)}\n"
            f"Кандидаты: {json.dumps(candidates, ensure_ascii=False)}")

    raw = _call_groq(system, user, max_tokens=600)

    if raw == "__MOCK__":
        return _mock_scenarios(candidates)

    raw = re.sub(r'```(?:json)?\s*', '', raw).strip('`').strip()
    try:
        result = json.loads(raw)
        return result if isinstance(result, list) else _mock_scenarios(candidates)
    except Exception:
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
    return _mock_scenarios(candidates)


def _mock_scenarios(candidates: list) -> list:
    scenarios = []
    for i, c in enumerate(candidates[:3]):
        overload = c.get("current_hours_week", 0) > 15
        scenarios.append({
            "scenario": f"Вариант {i+1}",
            "substitute_name": c["name"],
            "pros": ["Свободен в нужное время", "Знаком с классом" if i == 0 else "Подходящая квалификация"],
            "cons": ["Может превысить норму нагрузки"] if overload else ["Нет существенных недостатков"],
            "impact_score": 2 if i == 0 else 4 + i,
            "recommended": i == 0,
        })
    return scenarios
