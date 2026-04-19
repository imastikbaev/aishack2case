from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from typing import Optional, List
import os, json
from urllib.parse import quote
from dotenv import load_dotenv

load_dotenv()

from .database import engine, get_db
from . import models
from .models import Staff, ClassGroup, Room, Schedule, Task, Attendance, Incident, ChatMessage, Notification, AttendancePrediction
from .services import ai_service, schedule_service

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI-Завуч API", version="1.0.0")


def _allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS") or os.getenv("FRONTEND_URL", "http://localhost:5173")
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    return origins or ["http://localhost:5173"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Helpers ────────────────────────────────────────────────────────────────

def staff_to_dict(s: Staff) -> dict:
    return {
        "id": s.id, "name": s.name, "role": s.role, "subjects": s.subjects or [],
        "max_hours_per_week": s.max_hours_per_week, "current_hours_week": s.current_hours_week,
        "telegram_username": s.telegram_username, "phone": s.phone,
        "is_available": s.is_available, "risk_score": s.risk_score,
        "absence_count": s.absence_count, "extra_tasks_count": s.extra_tasks_count,
        "constraints": s.constraints or {},
    }


def task_to_dict(t: Task) -> dict:
    return {
        "id": t.id, "title": t.title, "description": t.description,
        "assignee_id": t.assignee_id,
        "assignee_name": t.assignee.name if t.assignee else None,
        "assignee_role": t.assignee.role if t.assignee else None,
        "created_by_id": t.created_by_id,
        "status": t.status, "priority": t.priority,
        "due_date": t.due_date.isoformat() if t.due_date else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "source": t.source,
    }


def incident_to_dict(i: Incident) -> dict:
    return {
        "id": i.id, "title": i.title, "description": i.description,
        "category": i.category, "location": i.location,
        "priority": i.priority, "status": i.status,
        "assigned_to_id": i.assigned_to_id,
        "assigned_to_name": i.assigned_to.name if i.assigned_to else None,
        "reported_by": i.reported_by,
        "created_at": i.created_at.isoformat() if i.created_at else None,
        "resolved_at": i.resolved_at.isoformat() if i.resolved_at else None,
        "source": i.source,
    }


def attendance_to_dict(a: Attendance) -> dict:
    return {
        "id": a.id, "date": a.date,
        "class_id": a.class_group_id,
        "class_name": a.class_group.name if a.class_group else "—",
        "present": a.present, "absent": a.absent, "total": a.total,
        "meal_portions": a.meal_portions,
        "reported_by": a.reported_by,
        "reported_at": a.reported_at.isoformat() if a.reported_at else None,
    }


# ─── Staff ───────────────────────────────────────────────────────────────────

@app.get("/api/staff")
def get_all_staff(db: Session = Depends(get_db)):
    staff = db.query(Staff).all()
    return [staff_to_dict(s) for s in staff]


@app.get("/api/staff/{staff_id}")
def get_staff(staff_id: int, db: Session = Depends(get_db)):
    s = db.query(Staff).filter(Staff.id == staff_id).first()
    if not s:
        raise HTTPException(404, "Сотрудник не найден")
    return staff_to_dict(s)


@app.get("/api/staff/{staff_id}/schedule")
def get_staff_schedule(staff_id: int, db: Session = Depends(get_db)):
    return schedule_service.get_teacher_schedule(db, staff_id)


@app.patch("/api/staff/{staff_id}/availability")
def update_availability(staff_id: int, body: dict, db: Session = Depends(get_db)):
    s = db.query(Staff).filter(Staff.id == staff_id).first()
    if not s:
        raise HTTPException(404)
    s.is_available = body.get("is_available", s.is_available)
    db.commit()
    return {"ok": True}


# ─── Schedule ────────────────────────────────────────────────────────────────

@app.get("/api/schedule/today")
def get_today(date_str: Optional[str] = None, db: Session = Depends(get_db)):
    target = date.fromisoformat(date_str) if date_str else date.today()
    return schedule_service.get_today_schedule(db, target)


@app.get("/api/schedule/week")
def get_week(db: Session = Depends(get_db)):
    return schedule_service.get_week_schedule(db)


@app.get("/api/schedule/heatmap")
def get_heatmap(db: Session = Depends(get_db)):
    return schedule_service.get_heatmap_data(db)


@app.get("/api/schedule/conflicts")
def get_conflicts(db: Session = Depends(get_db)):
    return schedule_service.check_conflicts(db)


@app.post("/api/schedule/substitution")
def apply_substitution(body: dict, db: Session = Depends(get_db)):
    absent_id = body.get("absent_teacher_id")
    substitute_id = body.get("substitute_id")
    date_str = body.get("date", date.today().isoformat())

    if not absent_id or not substitute_id:
        raise HTTPException(400, "absent_teacher_id и substitute_id обязательны")

    target_date = date.fromisoformat(date_str)
    updated = schedule_service.apply_substitution(db, absent_id, substitute_id, target_date)

    # Send Telegram notification
    substitute = db.query(Staff).filter(Staff.id == substitute_id).first()
    absent = db.query(Staff).filter(Staff.id == absent_id).first()
    if substitute:
        notif = Notification(
            staff_id=substitute_id,
            message=f"🔄 Срочная замена! Вы заменяете {absent.name if absent else 'учителя'} сегодня ({len(updated)} урок(а)). Проверьте расписание.",
            notification_type="substitution",
        )
        db.add(notif)

        # Trigger Telegram notification async
        _send_telegram_notification(substitute.telegram_username, notif.message)

    db.commit()
    return {"updated_lessons": updated, "substitute": substitute.name if substitute else None, "date": target_date.isoformat()}


@app.get("/api/schedule/summary")
def get_daily_summary(db: Session = Depends(get_db)):
    return schedule_service.generate_daily_summary(db)


# ─── Tasks ───────────────────────────────────────────────────────────────────

@app.get("/api/tasks")
def get_tasks(status: Optional[str] = None, assignee_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(Task)
    if status:
        q = q.filter(Task.status == status)
    if assignee_id:
        q = q.filter(Task.assignee_id == assignee_id)
    tasks = q.order_by(Task.created_at.desc()).all()
    return [task_to_dict(t) for t in tasks]


@app.post("/api/tasks")
def create_task(body: dict, db: Session = Depends(get_db)):
    due_date = None
    if body.get("due_date"):
        try:
            due_date = datetime.fromisoformat(body["due_date"])
        except Exception:
            pass

    task = Task(
        title=body.get("title", ""),
        description=body.get("description"),
        assignee_id=body.get("assignee_id"),
        created_by_id=body.get("created_by_id", 1),
        status=body.get("status", "todo"),
        priority=body.get("priority", "medium"),
        due_date=due_date,
        source=body.get("source", "manual"),
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # Notify assignee
    if task.assignee_id:
        notif = Notification(
            staff_id=task.assignee_id,
            message=f"📋 Новая задача: «{task.title}»",
            notification_type="task",
        )
        db.add(notif)
        assignee = db.query(Staff).filter(Staff.id == task.assignee_id).first()
        if assignee:
            _send_telegram_notification(assignee.telegram_username, notif.message)
            assignee.extra_tasks_count = (assignee.extra_tasks_count or 0) + 1
        db.commit()

    return task_to_dict(task)


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, body: dict, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404)
    for field in ["title", "description", "status", "priority", "assignee_id", "source"]:
        if field in body:
            setattr(task, field, body[field])
    if "due_date" in body and body["due_date"]:
        try:
            task.due_date = datetime.fromisoformat(body["due_date"])
        except Exception:
            pass
    task.updated_at = datetime.utcnow()
    db.commit()
    return task_to_dict(task)


@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404)
    db.delete(task)
    db.commit()
    return {"ok": True}


# ─── Attendance ───────────────────────────────────────────────────────────────

@app.get("/api/attendance/today")
def get_attendance_today(db: Session = Depends(get_db)):
    today = date.today().isoformat()
    records = db.query(Attendance).filter(Attendance.date == today).all()
    classes = db.query(ClassGroup).all()
    reported_ids = {r.class_group_id for r in records}

    result = []
    for r in records:
        result.append(attendance_to_dict(r))

    # Add unreported classes
    for c in classes:
        if c.id not in reported_ids:
            result.append({
                "id": None, "date": today,
                "class_id": c.id, "class_name": c.name,
                "present": None, "absent": None, "total": c.students_count,
                "meal_portions": None, "reported_by": None, "reported_at": None,
            })

    result.sort(key=lambda x: x["class_name"])
    return result


@app.get("/api/attendance/summary")
def get_attendance_summary(db: Session = Depends(get_db)):
    today = date.today().isoformat()
    records = db.query(Attendance).filter(Attendance.date == today).all()
    classes = db.query(ClassGroup).all()

    total_students = sum(c.students_count for c in classes)
    present = sum(r.present for r in records)
    absent = sum(r.absent for r in records)
    reported = len(records)
    meal_total = sum(r.meal_portions or r.present for r in records)

    return {
        "date": today,
        "total_students": total_students,
        "reported_classes": reported,
        "total_classes": len(classes),
        "present": present,
        "absent": absent,
        "meal_portions_needed": meal_total,
        "completion_pct": round(reported / len(classes) * 100) if classes else 0,
    }


@app.post("/api/attendance")
def create_attendance(body: dict, db: Session = Depends(get_db)):
    # Find class by name or id
    class_group = None
    if body.get("class_id"):
        class_group = db.query(ClassGroup).filter(ClassGroup.id == body["class_id"]).first()
    elif body.get("class_name"):
        class_group = db.query(ClassGroup).filter(ClassGroup.name == body["class_name"]).first()

    if not class_group:
        raise HTTPException(404, f"Класс не найден: {body.get('class_name') or body.get('class_id')}")

    today = date.today().isoformat()
    existing = db.query(Attendance).filter(
        Attendance.class_group_id == class_group.id,
        Attendance.date == today,
    ).first()

    if existing:
        existing.present = body.get("present", existing.present)
        existing.absent = body.get("absent", existing.absent)
        existing.meal_portions = body.get("meal_portions", existing.present)
        existing.reported_by = body.get("reported_by", existing.reported_by)
        existing.raw_message = body.get("raw_message", existing.raw_message)
        db.commit()
        return attendance_to_dict(existing)

    record = Attendance(
        class_group_id=class_group.id,
        date=today,
        present=body.get("present", 0),
        absent=body.get("absent", 0),
        total=body.get("total", class_group.students_count),
        meal_portions=body.get("meal_portions", body.get("present", 0)),
        reported_by=body.get("reported_by"),
        raw_message=body.get("raw_message"),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return attendance_to_dict(record)


@app.get("/api/attendance/history")
def get_attendance_history(days: int = 7, db: Session = Depends(get_db)):
    today = date.today()
    result = []
    for i in range(days, 0, -1):
        d = (today - timedelta(days=i)).isoformat()
        records = db.query(Attendance).filter(Attendance.date == d).all()
        if records:
            result.append({
                "date": d,
                "present": sum(r.present for r in records),
                "absent": sum(r.absent for r in records),
                "total": sum(r.total for r in records),
            })
    return result


@app.post("/api/attendance/send-canteen")
def send_canteen_request(body: dict, db: Session = Depends(get_db)):
    staff_id = body.get("staff_id", 1)
    today = date.today().isoformat()
    records = db.query(Attendance).filter(Attendance.date == today).all()
    portions = sum(r.meal_portions or r.present for r in records)

    notif = Notification(
        staff_id=staff_id,
        message=f"🍽 Заявка в столовую отправлена: {portions} порций на {today}.",
        notification_type="daily_summary",
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return {"ok": True, "date": today, "portions": portions, "notification_id": notif.id}


# ─── Incidents ───────────────────────────────────────────────────────────────

@app.get("/api/incidents")
def get_incidents(status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Incident)
    if status:
        q = q.filter(Incident.status == status)
    incidents = q.order_by(Incident.created_at.desc()).all()
    return [incident_to_dict(i) for i in incidents]


@app.post("/api/incidents")
def create_incident(body: dict, db: Session = Depends(get_db)):
    inc = Incident(
        title=body.get("title", ""),
        description=body.get("description", ""),
        category=body.get("category", "other"),
        location=body.get("location"),
        priority=body.get("priority", "medium"),
        status="open",
        assigned_to_id=body.get("assigned_to_id"),
        reported_by=body.get("reported_by"),
        source=body.get("source", "manual"),
        raw_message=body.get("raw_message"),
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)

    # Auto-create maintenance task
    if inc.category == "maintenance" and inc.assigned_to_id:
        task = Task(
            title=f"Устранить: {inc.title}",
            description=inc.description,
            assignee_id=inc.assigned_to_id,
            created_by_id=1,
            status="todo",
            priority=inc.priority,
            source="ai",
            due_date=datetime.utcnow() + timedelta(days=1),
        )
        db.add(task)
        db.commit()

    return incident_to_dict(inc)


@app.patch("/api/incidents/{incident_id}")
def update_incident(incident_id: int, body: dict, db: Session = Depends(get_db)):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(404)
    for field in ["title", "description", "status", "priority", "assigned_to_id", "category", "location"]:
        if field in body:
            setattr(inc, field, body[field])
    if body.get("status") == "resolved" and not inc.resolved_at:
        inc.resolved_at = datetime.utcnow()
    db.commit()
    return incident_to_dict(inc)


# ─── Chat Messages ────────────────────────────────────────────────────────────

@app.get("/api/messages")
def get_messages(limit: int = 50, db: Session = Depends(get_db)):
    msgs = db.query(ChatMessage).order_by(ChatMessage.created_at.desc()).limit(limit).all()
    return [{
        "id": m.id, "sender_name": m.sender_name, "message": m.message,
        "parsed_type": m.parsed_type, "parsed_data": m.parsed_data,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    } for m in reversed(msgs)]


@app.post("/api/messages/parse")
def parse_message(body: dict, db: Session = Depends(get_db)):
    """Parse a message from the Telegram bot chat and act on it."""
    message = body.get("message", "")
    sender = body.get("sender", "Учитель")
    telegram_id = body.get("telegram_id")

    all_staff = [staff_to_dict(s) for s in db.query(Staff).all()]
    parsed = ai_service.parse_chat_message(message, sender, all_staff)

    # Save message
    chat_msg = ChatMessage(
        sender_name=sender, sender_telegram_id=telegram_id,
        message=message, parsed_type=parsed.get("type"),
        parsed_data=parsed,
    )
    db.add(chat_msg)
    db.commit()

    action_result = None

    if parsed.get("type") == "attendance":
        data = parsed
        try:
            record = create_attendance({
                "class_name": data.get("class_name"),
                "present": data.get("present", 0),
                "absent": data.get("absent", 0),
                "total": data.get("total", data.get("present", 0) + data.get("absent", 0)),
                "reported_by": sender,
                "raw_message": message,
            }, db)
            action_result = {"action": "attendance_recorded", "record": record}
        except Exception as e:
            action_result = {"action": "attendance_error", "error": str(e)}

    elif parsed.get("type") == "incident":
        data = parsed
        # Find maintenance chief or technician to assign
        assignee = db.query(Staff).filter(Staff.role.in_(["maintenance_chief", "technician"])).first()
        try:
            inc = create_incident({
                "title": data.get("title", message[:60]),
                "description": data.get("description", message),
                "category": data.get("category", "other"),
                "location": data.get("location"),
                "priority": "medium",
                "assigned_to_id": assignee.id if assignee else None,
                "reported_by": sender,
                "source": "telegram",
                "raw_message": message,
            }, db)
            action_result = {"action": "incident_created", "incident": inc}
        except Exception as e:
            action_result = {"action": "incident_error", "error": str(e)}

    return {"parsed": parsed, "action_result": action_result}


# ─── AI Endpoints ─────────────────────────────────────────────────────────────

@app.post("/api/ai/voice-to-task")
def ai_voice_to_task(body: dict, db: Session = Depends(get_db)):
    """Convert director's voice/text command to structured tasks."""
    transcript = body.get("transcript", "")
    send_whatsapp = bool(body.get("send_whatsapp", False))
    director_name = body.get("director_name", "Гульбара Сейтова")
    whatsapp_group_name = body.get("whatsapp_group_name", "WhatsApp-группа школы")
    if not transcript:
        raise HTTPException(400, "transcript обязателен")

    staff_rows = db.query(Staff).all()
    all_staff = [staff_to_dict(s) for s in staff_rows]
    tasks_data = ai_service.voice_to_tasks(transcript, all_staff)

    created_tasks = []
    for td in tasks_data:
        # Find assignee by name
        assignee_id = None
        if td.get("assignee_name"):
            for s in staff_rows:
                if td["assignee_name"].split()[0].lower() in s.name.lower():
                    assignee_id = s.id
                    td["assignee_name"] = s.name
                    break

        due_date = datetime.utcnow() + timedelta(days=td.get("due_days", 3))
        task = Task(
            title=td.get("title", ""),
            description=td.get("description"),
            assignee_id=assignee_id,
            created_by_id=1,
            status="todo",
            priority=td.get("priority", "medium"),
            due_date=due_date,
            source="whatsapp_voice" if send_whatsapp else "voice",
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        if assignee_id:
            notif = Notification(
                staff_id=assignee_id,
                message=f"🎙 Задача от директора: «{task.title}»",
                notification_type="task",
            )
            db.add(notif)
            assignee = db.query(Staff).filter(Staff.id == assignee_id).first()
            if assignee:
                _send_telegram_notification(assignee.telegram_username, notif.message)
                assignee.extra_tasks_count = (assignee.extra_tasks_count or 0) + 1
        db.commit()
        created_tasks.append(task_to_dict(task))

    whatsapp = None
    if send_whatsapp:
        structured_tasks = []
        for td, created in zip(tasks_data, created_tasks):
            structured_tasks.append({
                **td,
                "title": created.get("title") or td.get("title"),
                "assignee_name": created.get("assignee_name") or td.get("assignee_name"),
                "priority": created.get("priority") or td.get("priority"),
            })
        message = ai_service.format_whatsapp_tasks(structured_tasks, director_name=director_name)
        notif = Notification(
            staff_id=1,
            message=f"WhatsApp-поручение подготовлено для группы «{whatsapp_group_name}»: {len(created_tasks)} задач(и).",
            notification_type="task",
        )
        db.add(notif)
        db.commit()
        whatsapp = {
            "status": "prepared",
            "group_name": whatsapp_group_name,
            "message": message,
            "share_url": f"https://wa.me/?text={quote(message)}",
            "note": "Откройте ссылку WhatsApp и выберите нужную группу. Для автопубликации можно подключить WhatsApp Business API webhook.",
        }

    return {"tasks_created": len(created_tasks), "tasks": created_tasks, "whatsapp": whatsapp}


@app.post("/api/ai/find-substitution")
def ai_find_substitution(body: dict, db: Session = Depends(get_db)):
    """AI finds best substitution for absent teacher."""
    absent_id = body.get("absent_teacher_id")
    message = body.get("message", "")

    # Parse teacher name from message if no ID
    if not absent_id and message:
        all_staff = db.query(Staff).filter(Staff.role == "teacher").all()
        for s in all_staff:
            first_name = s.name.split()[0].lower()
            if first_name in message.lower():
                absent_id = s.id
                break

    if not absent_id:
        raise HTTPException(400, "Учитель не найден")

    absent = db.query(Staff).filter(Staff.id == absent_id).first()
    if not absent:
        raise HTTPException(404, "Учитель не найден")

    today_schedule = schedule_service.get_today_schedule(db)
    all_staff = [staff_to_dict(s) for s in db.query(Staff).all()]
    absent_dict = staff_to_dict(absent)

    result = ai_service.find_substitution(absent_dict, today_schedule, all_staff)
    return {**result, "absent_teacher": absent_dict, "today_schedule": today_schedule}


@app.post("/api/ai/simulate-absence")
def ai_simulate_absence(body: dict, db: Session = Depends(get_db)):
    absent_id = body.get("absent_teacher_id")
    if not absent_id:
        raise HTTPException(400)
    absent = db.query(Staff).filter(Staff.id == absent_id).first()
    if not absent:
        raise HTTPException(404)

    today_schedule = schedule_service.get_today_schedule(db)
    all_staff = [staff_to_dict(s) for s in db.query(Staff).all()]
    scenarios = ai_service.simulate_absence_scenarios(staff_to_dict(absent), today_schedule, all_staff)
    return {"scenarios": scenarios, "absent_teacher": staff_to_dict(absent)}


@app.post("/api/ai/rag")
def ai_rag(body: dict):
    question = body.get("question", "")
    context = body.get("context")
    if not question:
        raise HTTPException(400, "question обязателен")
    result = ai_service.rag_query(question, context)
    return result


@app.get("/api/ai/insights")
def ai_insights(db: Session = Depends(get_db)):
    incidents = [incident_to_dict(i) for i in db.query(Incident).all()]
    tasks = [task_to_dict(t) for t in db.query(Task).all()]
    staff = [staff_to_dict(s) for s in db.query(Staff).all()]

    today = date.today().isoformat()
    attendance = [attendance_to_dict(a) for a in db.query(Attendance).filter(Attendance.date >= (date.today() - timedelta(days=7)).isoformat()).all()]

    insights = ai_service.generate_insights(incidents, tasks, attendance, staff)
    return {"insights": insights}


@app.get("/api/ai/risks")
def ai_risks(db: Session = Depends(get_db)):
    staff = [staff_to_dict(s) for s in db.query(Staff).all()]
    task_stats = {}
    for s in db.query(Staff).all():
        task_count = db.query(Task).filter(Task.assignee_id == s.id, Task.status != "done").count()
        task_stats[s.id] = {"pending_tasks": task_count, "extra_tasks": s.extra_tasks_count}

    schedule_stats = {}
    for s in db.query(Staff).filter(Staff.role == "teacher").all():
        schedule_stats[s.id] = {
            "weekly_lessons": db.query(Schedule).filter(Schedule.teacher_id == s.id).count(),
            "current_hours": s.current_hours_week,
            "max_hours": s.max_hours_per_week,
        }

    risks = ai_service.analyze_teacher_risks(staff, task_stats, schedule_stats)
    return {"risks": risks}


@app.get("/api/ai/prediction")
def ai_prediction(db: Session = Depends(get_db)):
    history = [{"date": h["date"], "present": h["present"], "absent": h["absent"]}
               for h in _get_attendance_history(7, db)]
    classes = db.query(ClassGroup).all()
    total = sum(c.students_count for c in classes)
    prediction = ai_service.predict_attendance(history, total)
    return prediction


def _get_attendance_history(days: int, db: Session) -> list:
    today = date.today()
    result = []
    for i in range(days, 0, -1):
        d = (today - timedelta(days=i)).isoformat()
        records = db.query(Attendance).filter(Attendance.date == d).all()
        if records:
            result.append({"date": d, "present": sum(r.present for r in records), "absent": sum(r.absent for r in records), "total": sum(r.total for r in records)})
    return result


# ─── Notifications ────────────────────────────────────────────────────────────

@app.get("/api/notifications")
def get_notifications(staff_id: int = 1, db: Session = Depends(get_db)):
    notifs = db.query(Notification).filter(
        Notification.staff_id == staff_id
    ).order_by(Notification.created_at.desc()).limit(20).all()
    return [{
        "id": n.id, "message": n.message, "type": n.notification_type,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    } for n in notifs]


@app.patch("/api/notifications/{notif_id}/read")
def mark_read(notif_id: int, db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notif_id).first()
    if n:
        n.is_read = True
        db.commit()
    return {"ok": True}


@app.post("/api/notifications/read-all")
def mark_all_read(body: dict, db: Session = Depends(get_db)):
    staff_id = body.get("staff_id", 1)
    db.query(Notification).filter(
        Notification.staff_id == staff_id, Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}


# ─── Dashboard ────────────────────────────────────────────────────────────────

@app.get("/api/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    summary = schedule_service.generate_daily_summary(db)
    today_attendance = db.query(Attendance).filter(Attendance.date == date.today().isoformat()).all()
    classes = db.query(ClassGroup).all()

    open_incidents = db.query(Incident).filter(Incident.status.in_(["open", "in_progress"])).count()
    urgent_incidents = db.query(Incident).filter(Incident.status == "open", Incident.priority.in_(["urgent", "high"])).count()

    pending_tasks = db.query(Task).filter(Task.status.in_(["todo", "in_progress"])).count()
    overdue_tasks = db.query(Task).filter(Task.status != "done", Task.due_date < datetime.utcnow()).count()

    high_risk_teachers = db.query(Staff).filter(Staff.risk_score >= 0.6, Staff.role == "teacher").count()

    return {
        "date": date.today().isoformat(),
        "attendance_summary": {
            "reported": len(today_attendance),
            "total_classes": len(classes),
            "present": sum(a.present for a in today_attendance),
            "absent": sum(a.absent for a in today_attendance),
            "meal_portions": sum(a.meal_portions or a.present for a in today_attendance),
        },
        "incidents": {"open": open_incidents, "urgent": urgent_incidents},
        "tasks": {"pending": pending_tasks, "overdue": overdue_tasks},
        "staff_risks": {"high_risk": high_risk_teachers},
        "unreported_classes": summary["attendance"]["unreported_classes"],
        "unavailable_teachers": summary["unavailable_teachers"],
    }


@app.post("/api/dashboard/optimize-day")
def optimize_day(body: dict, db: Session = Depends(get_db)):
    staff_id = body.get("staff_id", 1)
    conflicts = schedule_service.check_conflicts(db)
    summary = schedule_service.generate_daily_summary(db)
    actions = []

    if conflicts:
        actions.append(f"Найдено {len(conflicts)} конфликтов расписания для ручной проверки")
    if summary["attendance"]["unreported_classes"]:
        actions.append(f"Напомнить классам: {', '.join(summary['attendance']['unreported_classes'])}")
    if summary["risks"]["overdue_tasks"]:
        actions.append(f"Переприоритизировать просроченные задачи: {summary['risks']['overdue_tasks']}")
    if not actions:
        actions.append("Критических действий на сегодня нет")

    notif = Notification(
        staff_id=staff_id,
        message="⚡ День оптимизирован: " + "; ".join(actions),
        notification_type="daily_summary",
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return {"ok": True, "actions": actions, "notification_id": notif.id}


# ─── Telegram Webhook ─────────────────────────────────────────────────────────

@app.post("/api/telegram/webhook")
async def telegram_webhook(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    message_data = data.get("message", {})
    if not message_data:
        return {"ok": True}

    text = message_data.get("text", "")
    from_user = message_data.get("from", {})
    sender_name = f"{from_user.get('first_name', '')} {from_user.get('last_name', '')}".strip()
    telegram_id = str(from_user.get("id", ""))

    if text and sender_name:
        parse_message({
            "message": text,
            "sender": sender_name,
            "telegram_id": telegram_id,
        }, db)

    return {"ok": True}


# ─── Telegram notification helper ────────────────────────────────────────────

_telegram_queue: list = []


def _send_telegram_notification(username: Optional[str], message: str):
    """Queue a Telegram message. The bot polls this endpoint."""
    if username:
        _telegram_queue.append({"username": username, "message": message})


@app.get("/api/telegram/pending-notifications")
def get_pending_notifications():
    """Bot polls this to send queued notifications."""
    msgs = list(_telegram_queue)
    _telegram_queue.clear()
    return {"notifications": msgs}


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}


@app.get("/")
def root():
    return {"message": "AI-Завуч API", "docs": "/docs"}
