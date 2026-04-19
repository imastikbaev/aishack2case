"""
Schedule management: conflict detection, generation, substitution logic, heatmap data.
"""
from datetime import date, datetime
from math import ceil
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

SUBJECT_REQUIREMENTS = {
    1: [
        ("Математика", 5), ("Казахский язык", 5), ("Чтение", 4),
        ("Окружающий мир", 2), ("Английский", 2), ("Физкультура", 2),
        ("Музыка", 1), ("Рисование", 1),
    ],
    2: [
        ("Математика", 5), ("Казахский язык", 4), ("Русский язык", 4),
        ("Чтение", 3), ("Окружающий мир", 2), ("Английский", 2),
        ("Физкультура", 2), ("Музыка", 1), ("Рисование", 1),
    ],
    3: [
        ("Математика", 5), ("Казахский язык", 4), ("Русский язык", 3),
        ("Наука", 3), ("Английский", 2), ("Физкультура", 2),
        ("Музыка", 1), ("Рисование", 1), ("Логика", 1),
    ],
    4: [
        ("Математика", 5), ("Казахский язык", 4), ("Русский язык", 4),
        ("Наука", 3), ("Английский", 3), ("Физкультура", 2),
        ("Музыка", 1), ("Рисование", 1), ("Логика", 1),
    ],
}

SUBJECT_TAGS = {
    "Математика": {"mathematics", "primary"},
    "Казахский язык": {"kazakh", "primary"},
    "Русский язык": {"russian", "primary"},
    "Чтение": {"russian", "primary"},
    "Окружающий мир": {"science", "primary"},
    "Наука": {"science", "primary"},
    "Английский": {"english"},
    "Физкультура": {"physical_education"},
    "Музыка": {"music"},
    "Рисование": {"art", "music", "primary"},
    "Логика": {"logic", "mathematics", "primary"},
}

SUBJECT_PRIORITY = {
    "Математика": 100,
    "Казахский язык": 90,
    "Русский язык": 85,
    "Чтение": 78,
    "Английский": 75,
    "Наука": 72,
    "Окружающий мир": 70,
    "Логика": 62,
    "Физкультура": 50,
    "Музыка": 34,
    "Рисование": 32,
}


def get_subject_color(subject: str) -> str:
    for key in SUBJECT_COLORS:
        if key in subject:
            return SUBJECT_COLORS[key]
    return SUBJECT_COLORS["default"]


def _subject_tags(subject: str) -> set[str]:
    return SUBJECT_TAGS.get(subject, {"primary"})


def _teacher_matches_subject(teacher: Staff, subject: str) -> bool:
    if teacher.role not in ("teacher", "vice_principal"):
        return False
    teacher_subjects = set(teacher.subjects or [])
    tags = _subject_tags(subject)
    return bool(teacher_subjects & tags)


def _rooms_for_subject(rooms: list[Room], subject: str, class_group: ClassGroup) -> list[Room]:
    subject_l = subject.lower()
    preferred: list[Room] = []

    if "физкультур" in subject_l:
        preferred = [r for r in rooms if r.room_type == "gym"]
    elif "музык" in subject_l:
        preferred = [r for r in rooms if r.room_type == "music"]
    elif "англий" in subject_l:
        preferred = [r for r in rooms if r.room_type == "lab"]
    elif "наука" in subject_l:
        preferred = [r for r in rooms if r.room_type in ("lab", "classroom")]

    home = next((r for r in rooms if r.id == class_group.home_room_id), None)
    classrooms = [r for r in rooms if r.room_type == "classroom" and r.capacity >= class_group.students_count]
    ordered = []
    for room in preferred + ([home] if home else []) + classrooms + rooms:
        if room and room.id not in {r.id for r in ordered} and room.capacity >= class_group.students_count:
            ordered.append(room)
    return ordered


def _lesson_to_dict(s: Schedule) -> dict:
    teacher = s.teacher
    cls = s.class_group
    room = s.room
    return {
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


def generate_school_schedule(db: Session, strategy: str = "balanced") -> dict:
    """
    Generate a conflict-free weekly timetable.

    Hard constraints:
    - one lesson per class in a slot
    - one teacher per slot
    - one room per slot
    - subject-compatible teacher whenever possible
    - profile rooms for PE/music/English before fallback rooms
    """
    classes = db.query(ClassGroup).order_by(ClassGroup.grade, ClassGroup.name).all()
    rooms = db.query(Room).order_by(Room.id).all()
    teachers = db.query(Staff).filter(Staff.role.in_(["teacher", "vice_principal"])).all()

    if not classes or not rooms or not teachers:
        return {
            "ok": False,
            "created": 0,
            "message": "Недостаточно данных для генерации расписания",
            "conflicts": [],
            "warnings": ["Нужны классы, кабинеты и учителя"],
        }

    teacher_busy: set[tuple[int, int, int]] = set()
    room_busy: set[tuple[int, int, int]] = set()
    class_busy: set[tuple[int, int, int]] = set()
    teacher_weekly_load = {t.id: 0 for t in teachers}
    teacher_daily_load = {(t.id, day): 0 for t in teachers for day in range(5)}
    subject_day_count: dict[tuple[int, int, str], int] = {}
    assignments: list[dict] = []
    warnings: list[str] = []
    unscheduled: list[dict] = []

    def pick_teacher(subject: str, class_group: ClassGroup, day: int, period: int) -> Optional[Staff]:
        qualified = [t for t in teachers if _teacher_matches_subject(t, subject)]
        if not qualified and "primary" in _subject_tags(subject):
            qualified = [t for t in teachers if "primary" in (t.subjects or [])]
        if not qualified:
            qualified = [t for t in teachers if t.role == "vice_principal"] or teachers

        free = [t for t in qualified if (t.id, day, period) not in teacher_busy]
        with_capacity = [
            t for t in free
            if not t.max_hours_per_week or teacher_weekly_load[t.id] < t.max_hours_per_week
        ]
        if with_capacity:
            free = with_capacity
        if not free:
            emergency = [
                t for t in teachers
                if t.role == "vice_principal"
                and (t.id, day, period) not in teacher_busy
                and (not t.max_hours_per_week or teacher_weekly_load[t.id] < t.max_hours_per_week)
            ]
            fallback = [
                t for t in teachers
                if (t.id, day, period) not in teacher_busy
                and (not t.max_hours_per_week or teacher_weekly_load[t.id] < t.max_hours_per_week)
            ]
            free = emergency or fallback or [t for t in teachers if (t.id, day, period) not in teacher_busy]
        if not free:
            return None

        def score(t: Staff):
            home_bonus = -3 if class_group.home_teacher_id == t.id else 0
            overload = max(0, teacher_weekly_load[t.id] - (t.max_hours_per_week or 20))
            return (
                teacher_daily_load[(t.id, day)],
                teacher_weekly_load[t.id] + overload * 4,
                t.risk_score or 0,
                home_bonus,
                t.id,
            )

        return min(free, key=score)

    def pick_room(subject: str, class_group: ClassGroup, day: int, period: int) -> Optional[Room]:
        for room in _rooms_for_subject(rooms, subject, class_group):
            if (room.id, day, period) not in room_busy:
                return room
        return None

    def candidate_subjects(remaining: dict[str, int], class_group: ClassGroup, day: int, period: int) -> list[str]:
        subjects = [s for s, left in remaining.items() if left > 0]
        preferred = []
        for subject in subjects:
            taught_today = subject_day_count.get((class_group.id, day, subject), 0)
            if taught_today and len(subjects) > 1:
                continue
            early_bonus = 18 if period <= 3 and subject in ("Математика", "Казахский язык", "Русский язык") else 0
            late_bonus = 14 if period >= 4 and subject in ("Физкультура", "Музыка", "Рисование") else 0
            avoid_first_pe = -80 if period == 1 and subject == "Физкультура" else 0
            preferred.append((
                SUBJECT_PRIORITY.get(subject, 40) + early_bonus + late_bonus + avoid_first_pe + remaining[subject] * 5,
                subject,
            ))
        preferred.sort(reverse=True)
        return [subject for _, subject in preferred] or subjects

    def place_lesson(class_group: ClassGroup, subject: str, day: int, period: int) -> bool:
        if (class_group.id, day, period) in class_busy:
            return False
        teacher = pick_teacher(subject, class_group, day, period)
        room = pick_room(subject, class_group, day, period)
        if not teacher or not room:
            return False
        teacher_busy.add((teacher.id, day, period))
        room_busy.add((room.id, day, period))
        class_busy.add((class_group.id, day, period))
        teacher_weekly_load[teacher.id] += 1
        teacher_daily_load[(teacher.id, day)] += 1
        subject_day_count[(class_group.id, day, subject)] = subject_day_count.get((class_group.id, day, subject), 0) + 1
        assignments.append({
            "class_group_id": class_group.id,
            "teacher_id": teacher.id,
            "room_id": room.id,
            "subject": subject,
            "day_of_week": day,
            "period": period,
            "is_lenta": subject == "Английский",
            "lenta_group_id": class_group.id if subject == "Английский" else None,
        })
        return True

    for class_group in classes:
        requirements = SUBJECT_REQUIREMENTS.get(class_group.grade, SUBJECT_REQUIREMENTS[4])
        remaining = {subject: count for subject, count in requirements}
        max_daily = 5 if class_group.grade == 1 else 6

        for day in range(5):
            remaining_total = sum(remaining.values())
            if remaining_total <= 0:
                break
            target_today = min(max_daily, ceil(remaining_total / (5 - day)))

            for period in range(1, target_today + 1):
                placed = False
                for subject in candidate_subjects(remaining, class_group, day, period):
                    if place_lesson(class_group, subject, day, period):
                        remaining[subject] -= 1
                        placed = True
                        break
                if not placed:
                    unscheduled.append({"class": class_group.name, "day": DAY_NAMES[day], "period": period})

        # Fill leftovers into any free class slot.
        for subject, left in list(remaining.items()):
            while left > 0:
                placed = False
                for day in range(5):
                    for period in range(1, 7):
                        if place_lesson(class_group, subject, day, period):
                            left -= 1
                            remaining[subject] = left
                            placed = True
                            break
                    if placed:
                        break
                if not placed:
                    unscheduled.append({"class": class_group.name, "subject": subject, "left": left})
                    warnings.append(f"{class_group.name}: не удалось поставить {left} урок(а) «{subject}» без конфликта")
                    break

    # Replace schedule atomically enough for the local demo DB.
    db.query(Schedule).delete()
    db.flush()
    for item in assignments:
        db.add(Schedule(**item))

    for teacher in teachers:
        teacher.current_hours_week = teacher_weekly_load.get(teacher.id, 0)

    db.commit()

    conflicts = check_conflicts(db)
    validation = validate_schedule_quality(db)
    if conflicts:
        warnings.append(f"После генерации найдено конфликтов: {len(conflicts)}")

    return {
        "ok": len(conflicts) == 0,
        "strategy": strategy,
        "created": len(assignments),
        "classes": len(classes),
        "teachers_used": len([v for v in teacher_weekly_load.values() if v > 0]),
        "rooms_used": len({a["room_id"] for a in assignments}),
        "conflicts": conflicts,
        "warnings": warnings,
        "unscheduled": unscheduled[:20],
        "validation": validation,
        "workload": [
            {"teacher_id": tid, "lessons": load}
            for tid, load in sorted(teacher_weekly_load.items(), key=lambda x: -x[1])
            if load > 0
        ],
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
    """Detect hard scheduling conflicts: room, teacher and class double-booking."""
    conflicts = []
    schedules = db.query(Schedule).filter(Schedule.is_active == True).all()

    by_room_slot: dict = {}
    by_teacher_slot: dict = {}
    by_class_slot: dict = {}

    for s in schedules:
        if s.day_of_week >= len(DAY_NAMES):
            continue

        room_key = (s.room_id, s.day_of_week, s.period)
        if room_key in by_room_slot:
            other = by_room_slot[room_key]
            if s.class_group_id != other.class_group_id:
                message = f"Кабинет {s.room.number if s.room else '?'}: два урока в {DAY_NAMES[s.day_of_week]}, период {s.period}"
                conflicts.append({
                    "type": "room_conflict",
                    "message": message,
                    "description": message,
                    "schedule_ids": [s.id, other.id],
                    "severity": "high",
                })
        else:
            by_room_slot[room_key] = s

        teacher_key = (s.teacher_id, s.day_of_week, s.period)
        if teacher_key in by_teacher_slot:
            other = by_teacher_slot[teacher_key]
            if s.class_group_id != other.class_group_id:
                message = f"Учитель {s.teacher.name if s.teacher else '?'}: два урока в {DAY_NAMES[s.day_of_week]}, период {s.period}"
                conflicts.append({
                    "type": "teacher_conflict",
                    "message": message,
                    "description": message,
                    "schedule_ids": [s.id, other.id],
                    "severity": "high",
                })
        else:
            by_teacher_slot[teacher_key] = s

        class_key = (s.class_group_id, s.day_of_week, s.period)
        if class_key in by_class_slot:
            other = by_class_slot[class_key]
            if s.id != other.id:
                message = f"Класс {s.class_group.name if s.class_group else '?'}: два урока в {DAY_NAMES[s.day_of_week]}, период {s.period}"
                conflicts.append({
                    "type": "class_conflict",
                    "message": message,
                    "description": message,
                    "schedule_ids": [s.id, other.id],
                    "severity": "high",
                })
        else:
            by_class_slot[class_key] = s

    return conflicts


def validate_schedule_quality(db: Session) -> dict:
    """Return human-readable quality checks for generated timetable."""
    schedules = db.query(Schedule).filter(Schedule.is_active == True).all()
    classes = db.query(ClassGroup).all()
    teachers = db.query(Staff).filter(Staff.role.in_(["teacher", "vice_principal"])).all()

    class_daily: dict[tuple[int, int], int] = {}
    subject_counts: dict[tuple[int, str], int] = {}
    teacher_load: dict[int, int] = {t.id: 0 for t in teachers}
    warnings = []

    for s in schedules:
        class_daily[(s.class_group_id, s.day_of_week)] = class_daily.get((s.class_group_id, s.day_of_week), 0) + 1
        subject_counts[(s.class_group_id, s.subject)] = subject_counts.get((s.class_group_id, s.subject), 0) + 1
        teacher_load[s.teacher_id] = teacher_load.get(s.teacher_id, 0) + 1

    for class_group in classes:
        max_daily = 5 if class_group.grade == 1 else 6
        for day in range(5):
            lessons = class_daily.get((class_group.id, day), 0)
            if lessons > max_daily:
                warnings.append(f"{class_group.name}: {lessons} уроков в {DAY_NAMES[day]} при лимите {max_daily}")
        for subject, expected in SUBJECT_REQUIREMENTS.get(class_group.grade, SUBJECT_REQUIREMENTS[4]):
            actual = subject_counts.get((class_group.id, subject), 0)
            if actual != expected:
                warnings.append(f"{class_group.name}: «{subject}» {actual}/{expected} уроков")

    overloaded = []
    for teacher in teachers:
        load = teacher_load.get(teacher.id, 0)
        if teacher.max_hours_per_week and load > teacher.max_hours_per_week:
            overloaded.append({
                "teacher_id": teacher.id,
                "name": teacher.name,
                "lessons": load,
                "max_hours": teacher.max_hours_per_week,
            })

    conflicts = check_conflicts(db)
    return {
        "hard_conflicts": len(conflicts),
        "warnings_count": len(warnings),
        "warnings": warnings[:20],
        "overloaded_teachers": overloaded,
        "coverage_ok": len(warnings) == 0,
        "conflicts_ok": len(conflicts) == 0,
    }


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
