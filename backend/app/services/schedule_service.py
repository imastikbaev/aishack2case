"""
Schedule management: conflict detection, substitution logic, heatmap data.
"""
from datetime import date, datetime
from typing import Optional
from sqlalchemy.orm import Session
from ..models import Schedule, Staff, ClassGroup, Room, Attendance


PERIOD_TIMES = {
    1: {"start": "08:00", "end": "08:40"},
    2: {"start": "08:50", "end": "09:30"},
    3: {"start": "09:40", "end": "10:20"},
    4: {"start": "10:40", "end": "11:20"},
    5: {"start": "11:30", "end": "12:10"},
    6: {"start": "12:20", "end": "13:00"},
}

DAY_NAMES = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница"]
SUBJECT_COLORS = {
    "Математика": "#3B82F6",
    "Казахский язык": "#10B981",
    "Русский язык": "#8B5CF6",
    "Английский": "#F59E0B",
    "Английский (Upper)": "#F59E0B",
    "Английский (Int)": "#F59E0B",
    "Английский (Pre)": "#F59E0B",
    "Физкультура": "#EF4444",
    "Музыка": "#EC4899",
    "Рисование": "#14B8A6",
    "Окружающий мир": "#84CC16",
    "Наука": "#06B6D4",
    "Чтение": "#6366F1",
    "Логика": "#F97316",
    "default": "#6B7280",
}


def get_subject_color(subject: str) -> str:
    for key in SUBJECT_COLORS:
        if key in subject:
            return SUBJECT_COLORS[key]
    return SUBJECT_COLORS["default"]


def _active_substitute(schedule: Schedule, target_date: date):
    if schedule.date_override == target_date.isoformat() and schedule.substitute_teacher_id:
        return schedule.substitute
    return None


def get_today_schedule(db: Session, target_date: Optional[date] = None) -> list:
    """Return today's full schedule enriched with teacher/class/room info."""
    if target_date is None:
        target_date = date.today()

    day_of_week = target_date.weekday()
    if day_of_week >= 5:
        day_of_week = 0  # Default to Monday for weekends

    schedules = db.query(Schedule).filter(
        Schedule.day_of_week == day_of_week,
        Schedule.is_active == True,
        Schedule.is_cancelled == False,
    ).all()

    result = []
    for s in schedules:
        teacher = s.teacher
        cls = s.class_group
        room = s.room
        substitute = _active_substitute(s, target_date)

        result.append({
            "id": s.id,
            "class_name": cls.name if cls else "—",
            "class_id": s.class_group_id,
            "teacher_id": s.teacher_id,
            "teacher_name": teacher.name if teacher else "—",
            "substitute_id": substitute.id if substitute else None,
            "substitute_name": substitute.name if substitute else None,
            "room_number": room.number if room else "—",
            "room_id": s.room_id,
            "subject": s.subject,
            "day": day_of_week,
            "day_name": DAY_NAMES[day_of_week],
            "period": s.period,
            "period_time": PERIOD_TIMES.get(s.period, {}),
            "is_lenta": s.is_lenta,
            "lenta_group_id": s.lenta_group_id,
            "color": get_subject_color(s.subject),
        })

    result.sort(key=lambda x: (x["period"], x["class_name"]))
    return result


def get_week_schedule(db: Session) -> dict:
    """Return full week schedule grouped by day."""
    schedules = db.query(Schedule).filter(
        Schedule.is_active == True,
        Schedule.is_cancelled == False,
    ).all()

    week = {i: [] for i in range(5)}
    for s in schedules:
        teacher = s.teacher
        cls = s.class_group
        room = s.room

        entry = {
            "id": s.id,
            "class_name": cls.name if cls else "—",
            "class_id": s.class_group_id,
            "teacher_id": s.teacher_id,
            "teacher_name": teacher.name if teacher else "—",
            "substitute_id": None,
            "substitute_name": None,
            "room_number": room.number if room else "—",
            "room_id": s.room_id,
            "subject": s.subject,
            "period": s.period,
            "period_time": PERIOD_TIMES.get(s.period, {}),
            "is_lenta": s.is_lenta,
            "color": get_subject_color(s.subject),
        }
        week[s.day_of_week].append(entry)

    for day in week:
        week[day].sort(key=lambda x: (x["period"], x["class_name"]))

    return {
        "days": [{"day": i, "name": DAY_NAMES[i], "lessons": week[i]} for i in range(5)],
        "period_times": PERIOD_TIMES,
    }


def get_teacher_schedule(db: Session, teacher_id: int) -> list:
    """Return all lessons for a specific teacher across the week."""
    schedules = db.query(Schedule).filter(
        Schedule.teacher_id == teacher_id,
        Schedule.is_active == True,
    ).all()

    result = []
    for s in schedules:
        cls = s.class_group
        room = s.room
        result.append({
            "id": s.id,
            "day": s.day_of_week,
            "day_name": DAY_NAMES[s.day_of_week],
            "period": s.period,
            "period_time": PERIOD_TIMES.get(s.period, {}),
            "class_name": cls.name if cls else "—",
            "subject": s.subject,
            "room_number": room.number if room else "—",
            "is_lenta": s.is_lenta,
            "color": get_subject_color(s.subject),
        })
    result.sort(key=lambda x: (x["day"], x["period"]))
    return result


def get_heatmap_data(db: Session) -> list:
    """
    Teacher workload heatmap: for each teacher, count lessons per day.
    Returns list of {teacher_id, name, daily_loads: [mon..fri], weekly_total, max_hours, overloaded}
    """
    teachers = db.query(Staff).filter(Staff.role.in_(["teacher", "vice_principal"])).all()
    result = []

    for t in teachers:
        daily = [0] * 5
        schedules = db.query(Schedule).filter(
            Schedule.teacher_id == t.id,
            Schedule.is_active == True,
        ).all()
        for s in schedules:
            if s.day_of_week < 5:
                daily[s.day_of_week] += 1

        weekly = sum(daily)
        result.append({
            "teacher_id": t.id,
            "name": t.name,
            "daily_loads": daily,
            "weekly_total": weekly,
            "max_hours": t.max_hours_per_week,
            "overloaded": t.current_hours_week > t.max_hours_per_week,
            "risk_score": t.risk_score,
        })

    result.sort(key=lambda x: -x["weekly_total"])
    return result


def check_conflicts(db: Session) -> list:
    """Detect scheduling conflicts: room double-booking, teacher double-booking."""
    conflicts = []
    schedules = db.query(Schedule).filter(Schedule.is_active == True).all()

    by_slot: dict = {}
    by_teacher_slot: dict = {}

    for s in schedules:
        if s.day_of_week >= len(DAY_NAMES):
            continue

        room_key = (s.room_id, s.day_of_week, s.period)
        if room_key in by_slot:
            other = by_slot[room_key]
            if s.class_group_id != other.class_group_id:
                conflicts.append({
                    "type": "room_conflict",
                    "message": f"Кабинет {s.room.number if s.room else '?'}: два урока в {DAY_NAMES[s.day_of_week]}, период {s.period}",
                    "schedule_ids": [s.id, other.id],
                    "severity": "high",
                })
        else:
            by_slot[room_key] = s

        teacher_key = (s.teacher_id, s.day_of_week, s.period)
        if teacher_key in by_teacher_slot:
            other = by_teacher_slot[teacher_key]
            if s.class_group_id != other.class_group_id:
                conflicts.append({
                    "type": "teacher_conflict",
                    "message": f"Учитель {s.teacher.name if s.teacher else '?'}: два урока в {DAY_NAMES[s.day_of_week]}, период {s.period}",
                    "schedule_ids": [s.id, other.id],
                    "severity": "high",
                })
        else:
            by_teacher_slot[teacher_key] = s

    return conflicts


def apply_substitution(db: Session, absent_teacher_id: int, substitute_id: int, target_date: date) -> list:
    """Apply a substitution for all lessons of absent teacher on target_date."""
    day_of_week = target_date.weekday()
    if day_of_week >= 5:
        return []

    schedules = db.query(Schedule).filter(
        Schedule.teacher_id == absent_teacher_id,
        Schedule.day_of_week == day_of_week,
        Schedule.is_active == True,
    ).all()

    updated = []
    for s in schedules:
        s.substitute_teacher_id = substitute_id
        s.date_override = target_date.isoformat()
        updated.append(s.id)

    # Mark absent teacher as unavailable today
    absent = db.query(Staff).filter(Staff.id == absent_teacher_id).first()
    if absent:
        absent.is_available = False
        absent.absence_count = (absent.absence_count or 0) + 1
        absent.risk_score = min(1.0, (absent.risk_score or 0) + 0.15)

    # Increase substitute workload
    substitute = db.query(Staff).filter(Staff.id == substitute_id).first()
    if substitute:
        substitute.current_hours_week = (substitute.current_hours_week or 0) + len(updated)

    db.commit()
    return updated


def get_teacher_free_slots(db: Session, teacher_id: int, day_of_week: int) -> list:
    """Return list of period numbers where teacher is free on given day."""
    busy = db.query(Schedule.period).filter(
        Schedule.teacher_id == teacher_id,
        Schedule.day_of_week == day_of_week,
        Schedule.is_active == True,
        Schedule.is_cancelled == False,
    ).all()
    busy_periods = {b[0] for b in busy}
    return [p for p in range(1, 7) if p not in busy_periods]


def generate_daily_summary(db: Session, target_date: Optional[date] = None) -> dict:
    """Generate a morning summary for the director."""
    if target_date is None:
        target_date = date.today()

    date_str = target_date.isoformat()
    day_name = DAY_NAMES[min(target_date.weekday(), 4)]

    # Attendance
    attendances = db.query(Attendance).filter(Attendance.date == date_str).all()
    classes = db.query(ClassGroup).all()

    reported_classes = {a.class_group_id for a in attendances}
    total_reported = sum(a.present for a in attendances)
    total_absent = sum(a.absent for a in attendances)
    unreported = [c.name for c in classes if c.id not in reported_classes]

    # Overloaded teachers
    overloaded = db.query(Staff).filter(
        Staff.current_hours_week > Staff.max_hours_per_week,
        Staff.role == "teacher",
    ).all()

    # Open incidents
    from ..models import Incident
    open_incidents = db.query(Incident).filter(Incident.status.in_(["open", "in_progress"])).count()

    # Overdue tasks
    from ..models import Task
    overdue_tasks = db.query(Task).filter(
        Task.status != "done",
        Task.due_date < datetime.utcnow(),
    ).count()

    return {
        "date": date_str,
        "day_name": day_name,
        "attendance": {
            "reported_count": len(attendances),
            "total_classes": len(classes),
            "unreported_classes": unreported,
            "present_so_far": total_reported,
            "absent_so_far": total_absent,
        },
        "risks": {
            "overloaded_teachers": [t.name for t in overloaded],
            "open_incidents": open_incidents,
            "overdue_tasks": overdue_tasks,
        },
        "unavailable_teachers": [s.name for s in db.query(Staff).filter(Staff.is_available == False).all()],
    }
