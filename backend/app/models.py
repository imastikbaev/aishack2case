from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # director, vice_principal, teacher, secretary, maintenance_chief, technician
    subjects = Column(JSON, default=[])
    max_hours_per_week = Column(Integer, default=20)
    current_hours_week = Column(Integer, default=0)
    telegram_id = Column(String, nullable=True)
    telegram_username = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    constraints = Column(JSON, default={})  # {"unavailable": ["friday_afternoon"]}
    is_available = Column(Boolean, default=True)
    risk_score = Column(Float, default=0.0)  # 0-1 burnout/absence risk
    absence_count = Column(Integer, default=0)
    extra_tasks_count = Column(Integer, default=0)  # non-lesson tasks this month

    tasks_assigned = relationship("Task", foreign_keys="Task.assignee_id", back_populates="assignee")
    tasks_created = relationship("Task", foreign_keys="Task.created_by_id", back_populates="creator")
    notifications = relationship("Notification", back_populates="staff")


class ClassGroup(Base):
    __tablename__ = "class_groups"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)  # "1А", "3В"
    grade = Column(Integer, nullable=False)
    students_count = Column(Integer, default=30)
    home_room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    home_teacher_id = Column(Integer, ForeignKey("staff.id"), nullable=True)

    schedules = relationship("Schedule", back_populates="class_group")
    attendance = relationship("Attendance", back_populates="class_group")


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True)
    number = Column(String, nullable=False)
    name = Column(String, nullable=True)
    capacity = Column(Integer, default=32)
    room_type = Column(String, default="classroom")  # classroom, gym, assembly, lab, music

    schedules = relationship("Schedule", back_populates="room")


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True)
    class_group_id = Column(Integer, ForeignKey("class_groups.id"))
    teacher_id = Column(Integer, ForeignKey("staff.id"))
    room_id = Column(Integer, ForeignKey("rooms.id"))
    subject = Column(String, nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0=Mon … 4=Fri
    period = Column(Integer, nullable=False)  # 1–7
    is_lenta = Column(Boolean, default=False)
    lenta_group_id = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)

    # Substitution fields
    date_override = Column(String, nullable=True)  # YYYY-MM-DD
    substitute_teacher_id = Column(Integer, ForeignKey("staff.id"), nullable=True)
    is_cancelled = Column(Boolean, default=False)

    class_group = relationship("ClassGroup", back_populates="schedules")
    teacher = relationship("Staff", foreign_keys=[teacher_id])
    substitute = relationship("Staff", foreign_keys=[substitute_teacher_id])
    room = relationship("Room", back_populates="schedules")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    assignee_id = Column(Integer, ForeignKey("staff.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("staff.id"), nullable=True)
    status = Column(String, default="todo")  # todo, in_progress, done
    priority = Column(String, default="medium")  # low, medium, high, urgent
    due_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    source = Column(String, default="manual")  # manual, voice, telegram, ai
    telegram_notified = Column(Boolean, default=False)

    assignee = relationship("Staff", foreign_keys=[assignee_id], back_populates="tasks_assigned")
    creator = relationship("Staff", foreign_keys=[created_by_id], back_populates="tasks_created")


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True)
    class_group_id = Column(Integer, ForeignKey("class_groups.id"))
    date = Column(String, nullable=False)  # YYYY-MM-DD
    present = Column(Integer, default=0)
    absent = Column(Integer, default=0)
    total = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    reported_at = Column(DateTime, default=datetime.utcnow)
    reported_by = Column(String, nullable=True)
    meal_portions = Column(Integer, nullable=True)
    raw_message = Column(Text, nullable=True)

    class_group = relationship("ClassGroup", back_populates="attendance")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    category = Column(String)  # maintenance, discipline, health, other
    location = Column(String, nullable=True)
    priority = Column(String, default="medium")
    status = Column(String, default="open")  # open, in_progress, resolved
    assigned_to_id = Column(Integer, ForeignKey("staff.id"), nullable=True)
    reported_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    source = Column(String, default="manual")  # manual, telegram, ai
    raw_message = Column(Text, nullable=True)

    assigned_to = relationship("Staff")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True)
    sender_name = Column(String)
    sender_telegram_id = Column(String, nullable=True)
    message = Column(Text)
    parsed_type = Column(String, nullable=True)  # attendance, incident, general
    parsed_data = Column(JSON, nullable=True)
    telegram_message_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    staff_id = Column(Integer, ForeignKey("staff.id"))
    message = Column(Text)
    notification_type = Column(String)  # task, substitution, alert, daily_summary
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    staff = relationship("Staff", back_populates="notifications")


class AttendancePrediction(Base):
    __tablename__ = "attendance_predictions"

    id = Column(Integer, primary_key=True)
    date = Column(String, nullable=False)
    predicted_total = Column(Integer)
    predicted_absent = Column(Integer)
    confidence = Column(Float, default=0.7)
    reasoning = Column(Text, nullable=True)
    recommended_portions = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
