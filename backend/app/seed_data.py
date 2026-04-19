"""
Seed the database with realistic mock data for Aqbobek Lyceum.
Run: python -m app.seed_data  (from backend/)
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timedelta
from app.database import engine, SessionLocal
from app import models
from app.models import (
    Staff, ClassGroup, Room, Schedule, Task,
    Attendance, Incident, ChatMessage, Notification
)

models.Base.metadata.create_all(bind=engine)

STAFF = [
    dict(id=1,  name="Гульнара Сейтова",    role="director",          subjects=[],                           max_hours_per_week=0,  telegram_username="gulnara_s",   is_available=True,  risk_score=0.05),
    dict(id=2,  name="Назкен Ахметова",      role="vice_principal",    subjects=["administration"],           max_hours_per_week=8,  telegram_username="nazken_a",    is_available=True,  risk_score=0.10),
    dict(id=3,  name="Аскар Бекенов",        role="teacher",           subjects=["mathematics"],              max_hours_per_week=22, telegram_username="askar_b",     is_available=True,  risk_score=0.72, absence_count=3, current_hours_week=27),
    dict(id=4,  name="Бахытжан Қасымов",     role="teacher",           subjects=["mathematics","logic"],      max_hours_per_week=20, telegram_username="bakhyt_k",    is_available=True,  risk_score=0.25),
    dict(id=5,  name="Айгерим Нурланова",    role="teacher",           subjects=["english"],                  max_hours_per_week=20, telegram_username="aigerim_n",   is_available=True,  risk_score=0.15),
    dict(id=6,  name="Малика Дюсенова",      role="teacher",           subjects=["english"],                  max_hours_per_week=20, telegram_username="malika_d",    is_available=True,  risk_score=0.18),
    dict(id=7,  name="Динара Жаксыбекова",   role="teacher",           subjects=["english"],                  max_hours_per_week=20, telegram_username="dinara_zh",   is_available=True,  risk_score=0.20),
    dict(id=8,  name="Алия Сарсенова",       role="teacher",           subjects=["english"],                  max_hours_per_week=18, telegram_username="aliya_s",     is_available=True,  risk_score=0.12),
    dict(id=9,  name="Жанар Омарова",        role="teacher",           subjects=["primary","mathematics","kazakh"], max_hours_per_week=24, telegram_username="zhanar_o",  is_available=True, risk_score=0.20),
    dict(id=10, name="Сауле Бекова",         role="teacher",           subjects=["primary","mathematics","kazakh"], max_hours_per_week=24, telegram_username="saule_b",   is_available=True, risk_score=0.22),
    dict(id=11, name="Лаура Ибрагимова",     role="teacher",           subjects=["primary","mathematics","russian"], max_hours_per_week=24, telegram_username="laura_i",  is_available=True, risk_score=0.30, extra_tasks_count=8),
    dict(id=12, name="Дина Тулегенова",      role="teacher",           subjects=["primary","mathematics"],    max_hours_per_week=22, telegram_username="dina_t",      is_available=True,  risk_score=0.24),
    dict(id=13, name="Асель Мусина",         role="teacher",           subjects=["primary","science"],        max_hours_per_week=24, telegram_username="asel_m",      is_available=True,  risk_score=0.18),
    dict(id=14, name="Гүлдана Нұрова",       role="teacher",           subjects=["primary","kazakh"],         max_hours_per_week=24, telegram_username="guldana_n",   is_available=True,  risk_score=0.15),
    dict(id=15, name="Айжан Серікова",       role="teacher",           subjects=["primary","art"],            max_hours_per_week=22, telegram_username="aizhan_se",   is_available=True,  risk_score=0.16),
    dict(id=16, name="Болат Рахимов",        role="teacher",           subjects=["physical_education"],       max_hours_per_week=28, telegram_username="bolat_r",     is_available=True,  risk_score=0.10),
    dict(id=17, name="Зарина Исаева",        role="teacher",           subjects=["music","art"],              max_hours_per_week=20, telegram_username="zarina_i",    is_available=True,  risk_score=0.08),
    dict(id=18, name="Медина Алиева",        role="secretary",         subjects=[],                           max_hours_per_week=0,  telegram_username="medina_a",    is_available=True,  risk_score=0.05),
    dict(id=19, name="Самат Дюсенов",        role="maintenance_chief", subjects=[],                           max_hours_per_week=0,  telegram_username="samat_d",     is_available=True,  risk_score=0.08),
    dict(id=20, name="Берик Сатыбалдиев",    role="technician",        subjects=[],                           max_hours_per_week=0,  telegram_username="berik_sat",   is_available=True,  risk_score=0.12),
]

ROOMS = [
    dict(id=1,  number="1",   name="Кабинет 1А",       capacity=32, room_type="classroom"),
    dict(id=2,  number="2",   name="Кабинет 1Б",       capacity=32, room_type="classroom"),
    dict(id=3,  number="3",   name="Кабинет 2А",       capacity=32, room_type="classroom"),
    dict(id=4,  number="4",   name="Кабинет 2Б",       capacity=32, room_type="classroom"),
    dict(id=5,  number="5",   name="Кабинет 3А",       capacity=35, room_type="classroom"),
    dict(id=6,  number="6",   name="Кабинет 3Б",       capacity=35, room_type="classroom"),
    dict(id=7,  number="7",   name="Кабинет 3В",       capacity=35, room_type="classroom"),
    dict(id=8,  number="8",   name="Кабинет 4А",       capacity=38, room_type="classroom"),
    dict(id=9,  number="9",   name="Кабинет 4Б",       capacity=38, room_type="classroom"),
    dict(id=10, number="10",  name="Кабинет 4В",       capacity=38, room_type="classroom"),
    dict(id=11, number="11",  name="Лингафонный каб.", capacity=28, room_type="lab"),
    dict(id=12, number="12",  name="Кабинет 12",       capacity=30, room_type="classroom"),
    dict(id=13, number="13",  name="Кабинет 13",       capacity=30, room_type="classroom"),
    dict(id=14, number="14",  name="Актовый зал",      capacity=200, room_type="assembly"),
    dict(id=15, number="15",  name="Спортивный зал",   capacity=80,  room_type="gym"),
    dict(id=16, number="16",  name="Музыкальный каб.", capacity=30,  room_type="music"),
]

CLASSES = [
    dict(id=1, name="1А", grade=1, students_count=30, home_room_id=1,  home_teacher_id=9),
    dict(id=2, name="1Б", grade=1, students_count=28, home_room_id=2,  home_teacher_id=10),
    dict(id=3, name="2А", grade=2, students_count=32, home_room_id=3,  home_teacher_id=11),
    dict(id=4, name="2Б", grade=2, students_count=30, home_room_id=4,  home_teacher_id=12),
    dict(id=5, name="3А", grade=3, students_count=33, home_room_id=5,  home_teacher_id=13),
    dict(id=6, name="3Б", grade=3, students_count=31, home_room_id=6,  home_teacher_id=14),
    dict(id=7, name="3В", grade=3, students_count=32, home_room_id=7,  home_teacher_id=15),
    dict(id=8, name="4А", grade=4, students_count=38, home_room_id=8,  home_teacher_id=None),
    dict(id=9, name="4Б", grade=4, students_count=37, home_room_id=9,  home_teacher_id=None),
    dict(id=10, name="4В", grade=4, students_count=35, home_room_id=10, home_teacher_id=None),
]

# Week schedule: (class_id, teacher_id, room_id, subject, day, period, is_lenta, lenta_group_id)
SCHEDULES = [
    # ─── 1А ─── teacher: Жанар(9), Math teacher: Аскар(3), PE: Болат(16), Music: Зарина(17), Eng: lenta group
    (1,9,1,"Математика",0,1,False,None),(1,9,1,"Казахский язык",0,2,False,None),(1,3,12,"Математика",0,3,False,None),(1,9,1,"Чтение",0,4,False,None),(1,16,15,"Физкультура",0,5,False,None),
    (1,9,1,"Казахский язык",1,1,False,None),(1,3,12,"Математика",1,2,False,None),(1,5,11,"Английский",1,3,True,1),(1,9,1,"Чтение",1,4,False,None),(1,17,16,"Музыка",1,5,False,None),
    (1,9,1,"Математика",2,1,False,None),(1,9,1,"Казахский язык",2,2,False,None),(1,9,1,"Окружающий мир",2,3,False,None),(1,16,15,"Физкультура",2,4,False,None),
    (1,3,12,"Математика",3,1,False,None),(1,9,1,"Казахский язык",3,2,False,None),(1,5,11,"Английский",3,3,True,1),(1,9,1,"Чтение",3,4,False,None),
    (1,9,1,"Математика",4,1,False,None),(1,17,16,"Рисование",4,2,False,None),(1,9,1,"Казахский язык",4,3,False,None),(1,9,1,"Чтение",4,4,False,None),

    # ─── 1Б ─── teacher: Сауле(10)
    (2,10,2,"Математика",0,1,False,None),(2,10,2,"Казахский язык",0,2,False,None),(2,4,13,"Математика",0,3,False,None),(2,10,2,"Чтение",0,4,False,None),(2,16,15,"Физкультура",0,5,False,None),
    (2,10,2,"Казахский язык",1,1,False,None),(2,4,13,"Математика",1,2,False,None),(2,6,12,"Английский",1,3,True,2),(2,10,2,"Чтение",1,4,False,None),(2,17,16,"Музыка",1,5,False,None),
    (2,10,2,"Математика",2,1,False,None),(2,10,2,"Казахский язык",2,2,False,None),(2,10,2,"Окружающий мир",2,3,False,None),(2,16,15,"Физкультура",2,4,False,None),
    (2,4,13,"Математика",3,1,False,None),(2,10,2,"Казахский язык",3,2,False,None),(2,6,12,"Английский",3,3,True,2),(2,10,2,"Чтение",3,4,False,None),
    (2,10,2,"Математика",4,1,False,None),(2,17,16,"Рисование",4,2,False,None),(2,10,2,"Казахский язык",4,3,False,None),(2,10,2,"Чтение",4,4,False,None),

    # ─── 2А ─── teacher: Лаура(11)
    (3,11,3,"Математика",0,1,False,None),(3,11,3,"Русский язык",0,2,False,None),(3,3,12,"Математика",0,3,False,None),(3,11,3,"Казахский язык",0,4,False,None),(3,16,15,"Физкультура",0,5,False,None),
    (3,11,3,"Русский язык",1,1,False,None),(3,3,12,"Математика",1,2,False,None),(3,7,13,"Английский",1,3,True,3),(3,11,3,"Казахский язык",1,4,False,None),(3,17,16,"Музыка",1,5,False,None),
    (3,11,3,"Математика",2,1,False,None),(3,11,3,"Русский язык",2,2,False,None),(3,11,3,"Окружающий мир",2,3,False,None),(3,16,15,"Физкультура",2,4,False,None),
    (3,3,12,"Математика",3,1,False,None),(3,11,3,"Русский язык",3,2,False,None),(3,7,13,"Английский",3,3,True,3),(3,11,3,"Казахский язык",3,4,False,None),
    (3,11,3,"Математика",4,1,False,None),(3,17,16,"Рисование",4,2,False,None),(3,11,3,"Русский язык",4,3,False,None),(3,11,3,"Казахский язык",4,4,False,None),

    # ─── 2Б ─── teacher: Дина(12)
    (4,12,4,"Математика",0,1,False,None),(4,12,4,"Казахский язык",0,2,False,None),(4,4,13,"Математика",0,3,False,None),(4,12,4,"Чтение",0,4,False,None),(4,16,15,"Физкультура",0,5,False,None),
    (4,12,4,"Казахский язык",1,1,False,None),(4,4,13,"Математика",1,2,False,None),(4,8,11,"Английский",1,3,True,4),(4,12,4,"Чтение",1,4,False,None),(4,17,16,"Музыка",1,5,False,None),
    (4,12,4,"Математика",2,1,False,None),(4,12,4,"Казахский язык",2,2,False,None),(4,12,4,"Окружающий мир",2,3,False,None),(4,16,15,"Физкультура",2,4,False,None),
    (4,4,13,"Математика",3,1,False,None),(4,12,4,"Казахский язык",3,2,False,None),(4,8,11,"Английский",3,3,True,4),(4,12,4,"Чтение",3,4,False,None),
    (4,12,4,"Математика",4,1,False,None),(4,17,16,"Рисование",4,2,False,None),(4,12,4,"Казахский язык",4,3,False,None),(4,12,4,"Чтение",4,4,False,None),

    # ─── 3А ─── teacher: Асель(13)
    (5,13,5,"Математика",0,1,False,None),(5,13,5,"Казахский язык",0,2,False,None),(5,3,12,"Математика",0,3,False,None),(5,13,5,"Окружающий мир",0,4,False,None),(5,16,15,"Физкультура",0,5,False,None),
    (5,13,5,"Казахский язык",1,1,False,None),(5,3,12,"Математика",1,2,False,None),(5,5,11,"Английский (Upper)",1,3,True,5),(5,13,5,"Наука",1,4,False,None),(5,17,16,"Музыка",1,5,False,None),
    (5,13,5,"Математика",2,1,False,None),(5,13,5,"Казахский язык",2,2,False,None),(5,13,5,"Окружающий мир",2,3,False,None),(5,16,15,"Физкультура",2,4,False,None),
    (5,3,12,"Математика",3,1,False,None),(5,13,5,"Казахский язык",3,2,False,None),(5,5,11,"Английский (Upper)",3,3,True,5),(5,13,5,"Наука",3,4,False,None),
    (5,13,5,"Математика",4,1,False,None),(5,17,16,"Рисование",4,2,False,None),(5,13,5,"Казахский язык",4,3,False,None),(5,13,5,"Окружающий мир",4,4,False,None),

    # ─── 3Б ─── teacher: Гүлдана(14)
    (6,14,6,"Математика",0,1,False,None),(6,14,6,"Казахский язык",0,2,False,None),(6,3,12,"Математика",0,3,False,None),(6,14,6,"Окружающий мир",0,4,False,None),(6,16,15,"Физкультура",0,5,False,None),
    (6,14,6,"Казахский язык",1,1,False,None),(6,3,12,"Математика",1,2,False,None),(6,6,13,"Английский (Int)",1,3,True,6),(6,14,6,"Наука",1,4,False,None),(6,17,16,"Музыка",1,5,False,None),
    (6,14,6,"Математика",2,1,False,None),(6,14,6,"Казахский язык",2,2,False,None),(6,14,6,"Окружающий мир",2,3,False,None),(6,16,15,"Физкультура",2,4,False,None),
    (6,3,12,"Математика",3,1,False,None),(6,14,6,"Казахский язык",3,2,False,None),(6,6,13,"Английский (Int)",3,3,True,6),(6,14,6,"Наука",3,4,False,None),
    (6,14,6,"Математика",4,1,False,None),(6,17,16,"Рисование",4,2,False,None),(6,14,6,"Казахский язык",4,3,False,None),(6,14,6,"Окружающий мир",4,4,False,None),

    # ─── 3В ─── teacher: Айжан(15)
    (7,15,7,"Математика",0,1,False,None),(7,15,7,"Казахский язык",0,2,False,None),(7,4,13,"Математика",0,3,False,None),(7,15,7,"Окружающий мир",0,4,False,None),(7,16,15,"Физкультура",0,5,False,None),
    (7,15,7,"Казахский язык",1,1,False,None),(7,4,13,"Математика",1,2,False,None),(7,7,1,"Английский (Pre)",1,3,True,7),(7,15,7,"Наука",1,4,False,None),(7,17,16,"Музыка",1,5,False,None),
    (7,15,7,"Математика",2,1,False,None),(7,15,7,"Казахский язык",2,2,False,None),(7,15,7,"Окружающий мир",2,3,False,None),(7,16,15,"Физкультура",2,4,False,None),
    (7,4,13,"Математика",3,1,False,None),(7,15,7,"Казахский язык",3,2,False,None),(7,7,1,"Английский (Pre)",3,3,True,7),(7,15,7,"Наука",3,4,False,None),
    (7,15,7,"Математика",4,1,False,None),(7,17,16,"Рисование",4,2,False,None),(7,15,7,"Казахский язык",4,3,False,None),(7,15,7,"Окружающий мир",4,4,False,None),
]

PERIOD_TIMES = {1: "08:00", 2: "08:50", 3: "09:40", 4: "10:40", 5: "11:30", 6: "12:20"}
DAY_NAMES = {0: "Понедельник", 1: "Вторник", 2: "Среда", 3: "Четверг", 4: "Пятница"}


def _subject_tags(subject: str) -> set[str]:
    subject_l = subject.lower()
    if "англий" in subject_l:
        return {"english"}
    if "математ" in subject_l:
        return {"mathematics", "primary"}
    if "казах" in subject_l:
        return {"kazakh", "primary"}
    if "рус" in subject_l:
        return {"russian", "primary"}
    if "физкультур" in subject_l:
        return {"physical_education"}
    if "музык" in subject_l:
        return {"music"}
    if "рисован" in subject_l or "арт" in subject_l:
        return {"art"}
    if "наука" in subject_l or "окружа" in subject_l:
        return {"science", "primary"}
    return {"primary"}


def _normalize_seed_schedule() -> list[tuple]:
    """Keep demo data conflict-free while preserving the visible timetable shape."""
    staff_by_id = {s["id"]: s for s in STAFF}
    rooms_by_id = {r["id"]: r for r in ROOMS}
    class_by_id = {c["id"]: c for c in CLASSES}
    used_teachers: set[tuple[int, int, int]] = set()
    used_rooms: set[tuple[int, int, int]] = set()
    normalized = []

    for class_id, teacher_id, room_id, subject, day, period, is_lenta, lenta_grp in SCHEDULES:
        tags = _subject_tags(subject)
        teacher_key = (teacher_id, day, period)
        if teacher_key in used_teachers:
            candidates = [
                s for s in STAFF
                if s["role"] in ("teacher", "vice_principal")
                and (set(s.get("subjects", [])) & tags or "primary" in tags and "primary" in s.get("subjects", []))
                and (s["id"], day, period) not in used_teachers
            ]
            if not candidates:
                candidates = [
                    s for s in STAFF
                    if s["role"] in ("teacher", "vice_principal")
                    and (s["id"], day, period) not in used_teachers
                ]
            if candidates:
                teacher_id = min(candidates, key=lambda s: s.get("current_hours_week", 0))["id"]

        room_key = (room_id, day, period)
        if room_key in used_rooms:
            preferred_room = class_by_id[class_id].get("home_room_id")
            if preferred_room and (preferred_room, day, period) not in used_rooms:
                room_id = preferred_room
            else:
                free_rooms = [
                    r for r in ROOMS
                    if (r["id"], day, period) not in used_rooms
                    and r.get("capacity", 0) >= class_by_id[class_id].get("students_count", 0)
                ]
                if free_rooms:
                    room_id = free_rooms[0]["id"]

        used_teachers.add((teacher_id, day, period))
        used_rooms.add((room_id, day, period))
        normalized.append((class_id, teacher_id, room_id, subject, day, period, is_lenta, lenta_grp))

    return normalized


def seed():
    db = SessionLocal()
    try:
        # Clear existing data
        for model in [Notification, ChatMessage, Incident, Attendance, Task, Schedule, ClassGroup, Room, Staff]:
            db.query(model).delete()
        db.commit()

        # Staff
        for s in STAFF:
            db.add(Staff(**s))
        db.commit()

        # Rooms
        for r in ROOMS:
            db.add(Room(**r))
        db.commit()

        # Classes
        for c in CLASSES:
            db.add(ClassGroup(**c))
        db.commit()

        # Schedules
        normalized_schedules = _normalize_seed_schedule()
        for i, sch in enumerate(normalized_schedules, start=1):
            class_id, teacher_id, room_id, subject, day, period, is_lenta, lenta_grp = sch
            db.add(Schedule(
                id=i, class_group_id=class_id, teacher_id=teacher_id, room_id=room_id,
                subject=subject, day_of_week=day, period=period, is_lenta=is_lenta,
                lenta_group_id=lenta_grp
            ))
        db.commit()

        # Attendance for the past 7 days
        today = datetime.now().date()
        class_capacities = {c["id"]: c["students_count"] for c in CLASSES}
        import random
        random.seed(42)
        for days_ago in range(7, 0, -1):
            d = today - timedelta(days=days_ago)
            if d.weekday() >= 5:
                continue
            for cls in CLASSES:
                total = cls["students_count"]
                absent = random.randint(1, 5)
                present = total - absent
                db.add(Attendance(
                    class_group_id=cls["id"],
                    date=d.isoformat(),
                    present=present,
                    absent=absent,
                    total=total,
                    meal_portions=present,
                    reported_by=f"Учитель {cls['name']}",
                ))
        # Today's partial attendance (only some classes reported)
        for cid in [1, 2, 3, 5, 6]:
            cls = next(c for c in CLASSES if c["id"] == cid)
            absent = random.randint(0, 4)
            present = cls["students_count"] - absent
            db.add(Attendance(
                class_group_id=cid,
                date=today.isoformat(),
                present=present, absent=absent,
                total=cls["students_count"],
                meal_portions=present,
                reported_by=f"Учитель {cls['name']}",
                raw_message=f"{cls['name']} - {present} детей, {absent} отсутствует",
            ))
        db.commit()

        # Tasks
        tasks_data = [
            dict(id=1,  title="Подготовить актовый зал к хакатону",     description="Расставить столы, проверить проектор и микрофон",                  assignee_id=2,  status="todo",        priority="high",   source="voice",    created_at=datetime.now()-timedelta(hours=2),  due_date=datetime.now()+timedelta(days=3)),
            dict(id=2,  title="Заказать воду и бейджи для хакатона",     description="Воды 50 бутылок 0.5л, бейджи для 30 участников",                  assignee_id=18, status="in_progress", priority="high",   source="voice",    created_at=datetime.now()-timedelta(hours=2),  due_date=datetime.now()+timedelta(days=3)),
            dict(id=3,  title="Сдать отчёт по посещаемости за апрель",   description="Сводная таблица по всем классам в МОН",                           assignee_id=18, status="todo",        priority="medium", source="manual",   created_at=datetime.now()-timedelta(days=1),   due_date=datetime.now()+timedelta(days=7)),
            dict(id=4,  title="Провести родительское собрание 3А",       description="Повестка: успеваемость, подготовка к олимпиаде",                   assignee_id=13, status="todo",        priority="medium", source="manual",   created_at=datetime.now()-timedelta(days=2),   due_date=datetime.now()+timedelta(days=5)),
            dict(id=5,  title="Починить парту в кабинете 12",            description="Автоматически создано из инцидента #1",                            assignee_id=20, status="in_progress", priority="medium", source="ai",       created_at=datetime.now()-timedelta(hours=5),  due_date=datetime.now()+timedelta(days=1)),
            dict(id=6,  title="Заменить лампочки в коридоре 2 этажа",    description="Перегорело 3 лампочки",                                           assignee_id=20, status="todo",        priority="low",    source="manual",   created_at=datetime.now()-timedelta(days=3),   due_date=datetime.now()+timedelta(days=2)),
            dict(id=7,  title="Обновить стенд у входа",                  description="Расписание на следующую неделю + объявления",                      assignee_id=2,  status="done",        priority="low",    source="manual",   created_at=datetime.now()-timedelta(days=4),   due_date=datetime.now()-timedelta(days=1)),
            dict(id=8,  title="Подготовить документы по Приказу №130",   description="Сформировать отчёт о соблюдении учебной нагрузки",                 assignee_id=18, status="todo",        priority="urgent", source="ai",       created_at=datetime.now()-timedelta(hours=1),  due_date=datetime.now()+timedelta(days=2)),
            dict(id=9,  title="Закупить методические пособия для 3А",    description="Учебники по сингапурской математике, 33 экз.",                     assignee_id=13, status="todo",        priority="medium", source="manual",   created_at=datetime.now()-timedelta(days=2),   due_date=datetime.now()+timedelta(days=10)),
            dict(id=10, title="Написать план методического совещания",    description="Тема: анализ успеваемости за 3-ю четверть",                        assignee_id=2,  status="in_progress", priority="high",   source="manual",   created_at=datetime.now()-timedelta(hours=3),  due_date=datetime.now()+timedelta(days=1)),
        ]
        for t in tasks_data:
            db.add(Task(**t))
        db.commit()

        # Incidents
        incidents_data = [
            dict(id=1, title="Сломана парта в кабинете 12",         description="Ученик сообщил, что парта шатается и может упасть",         category="maintenance", location="Кабинет 12", priority="medium", status="in_progress", assigned_to_id=20, reported_by="Асель Мусина",  source="telegram", created_at=datetime.now()-timedelta(hours=5)),
            dict(id=2, title="Не работает проектор в кабинете 7",   description="Проектор не включается, нет сигнала",                       category="maintenance", location="Кабинет 7",  priority="high",   status="open",        assigned_to_id=20, reported_by="Айжан Серікова", source="telegram", created_at=datetime.now()-timedelta(hours=2)),
            dict(id=3, title="Конфликт между учениками 3Б",         description="Два ученика подрались на перемене, нужна беседа с родителями", category="discipline", location="Коридор",   priority="high",   status="in_progress", assigned_to_id=2,  reported_by="Гүлдана Нұрова", source="manual",   created_at=datetime.now()-timedelta(hours=1)),
            dict(id=4, title="Ребёнок 1А почувствовал недомогание", description="Жалуется на боль в животе, температура 37.2",               category="health",      location="Медпункт",  priority="urgent", status="open",        assigned_to_id=None, reported_by="Жанар Омарова", source="telegram", created_at=datetime.now()-timedelta(minutes=30)),
            dict(id=5, title="Протечка в туалете 1 этажа",          description="Кран неплотно закрывается, вода капает",                    category="maintenance", location="Туалет 1 эт", priority="medium", status="open",       assigned_to_id=19, reported_by="Медина Алиева",  source="manual",   created_at=datetime.now()-timedelta(days=1)),
            dict(id=6, title="Сломан замок на кабинете 3",          description="Ключ не поворачивается, класс пришлось перевести",          category="maintenance", location="Кабинет 3",  priority="high",   status="resolved",    assigned_to_id=19, reported_by="Лаура Ибрагимова", source="telegram", created_at=datetime.now()-timedelta(days=2), resolved_at=datetime.now()-timedelta(days=1)),
        ]
        for inc in incidents_data:
            db.add(Incident(**inc))
        db.commit()

        # Chat messages (simulating Telegram)
        msgs = [
            dict(sender_name="Жанар Омарова",     message="1А - 28 детей, 2 болеют",                                   parsed_type="attendance", created_at=datetime.now()-timedelta(minutes=50)),
            dict(sender_name="Сауле Бекова",      message="1Б - 26 детей, все пришли, 2 болеет",                       parsed_type="attendance", created_at=datetime.now()-timedelta(minutes=48)),
            dict(sender_name="Лаура Ибрагимова",  message="2А - 29 из 32. Трое отсутствуют",                           parsed_type="attendance", created_at=datetime.now()-timedelta(minutes=45)),
            dict(sender_name="Асель Мусина",      message="В кабинете 12 сломалась парта, ребенку едва не упал на голову", parsed_type="incident", created_at=datetime.now()-timedelta(hours=5)),
            dict(sender_name="Айжан Серікова",    message="3В - 30 детей. 2 на больничном.",                           parsed_type="attendance", created_at=datetime.now()-timedelta(minutes=40)),
            dict(sender_name="Гүлдана Нұрова",    message="3Б все 31 на месте",                                        parsed_type="attendance", created_at=datetime.now()-timedelta(minutes=38)),
            dict(sender_name="Болат Рахимов",     message="Спортзал свободен до 11:00, потом у 3А физра",              parsed_type="general",    created_at=datetime.now()-timedelta(hours=3)),
            dict(sender_name="Айжан Серікова",    message="Проектор в 7 кабинете не включается уже второй день",       parsed_type="incident",   created_at=datetime.now()-timedelta(hours=2)),
        ]
        for m in msgs:
            db.add(ChatMessage(**m))
        db.commit()

        # Notifications
        notifs = [
            dict(staff_id=3,  message="⚠️ Ваша нагрузка (27 ч/нед) превышает норму (22 ч/нед). Рекомендуется снизить.", notification_type="alert",        is_read=False),
            dict(staff_id=11, message="📋 Вам назначена новая задача: «Подготовить документы по Приказу №130»",          notification_type="task",         is_read=False),
            dict(staff_id=20, message="🔧 Новый инцидент: «Не работает проектор в кабинете 7». Приоритет: высокий",      notification_type="alert",        is_read=False),
            dict(staff_id=2,  message="📋 Задача «Написать план методического совещания» требует вашего внимания",        notification_type="task",         is_read=True),
            dict(staff_id=1,  message="🌅 Доброе утро! Сегодня 5 классов не отчитались по посещаемости. Ожидается 162 ученика.", notification_type="daily_summary", is_read=False),
        ]
        for n in notifs:
            db.add(Notification(**n))
        db.commit()

        print("✅ Database seeded successfully!")
        print(f"   Staff: {len(STAFF)}, Classes: {len(CLASSES)}, Rooms: {len(ROOMS)}, Schedules: {len(normalized_schedules)}")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
