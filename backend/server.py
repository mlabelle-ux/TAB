from fastapi import FastAPI, APIRouter, HTTPException, Response
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, LongTable
from reportlab.lib.styles import getSampleStyleSheet

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ============== MODELS ==============

class Admin(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AdminLogin(BaseModel):
    password: str

class Employee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    matricule: str = ""
    name: str
    hire_date: str
    phone: str = ""
    email: str = ""
    berline: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EmployeeCreate(BaseModel):
    matricule: str = ""
    name: str
    hire_date: str
    phone: str = ""
    email: str = ""
    berline: str = ""

class School(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    color: str = "#4CAF50"
    type: str = ""  # Primaire, Secondaire, Autre
    commission: str = ""  # Commission scolaire
    ville: str = ""  # Ville
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SchoolCreate(BaseModel):
    name: str
    color: str = "#4CAF50"
    type: str = ""
    commission: str = ""
    ville: str = ""

class Block(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    school_id: str
    school_name: str = ""
    school_color: str = "#4CAF50"
    start_time: str
    end_time: str
    hlp_before: int = 0
    hlp_after: int = 0
    days: List[str] = ["L", "M", "W", "J", "V"]  # Jours applicables

class Shift(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # AM, PM, MIDI, ADMIN
    blocks: List[Block] = []
    is_admin: bool = False  # Quart admin = 8h/jour fixe

class Assignment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    circuit_number: str
    shifts: List[Shift] = []
    employee_id: Optional[str] = None
    employee_name: str = ""
    start_date: str
    end_date: str
    is_adapted: bool = False  # Circuit adapté (handicapé)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AssignmentCreate(BaseModel):
    circuit_number: str
    shifts: List[dict] = []
    employee_id: Optional[str] = None
    start_date: str
    end_date: str
    is_adapted: bool = False

class TemporaryTask(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    date: str
    start_time: str
    end_time: str
    employee_id: Optional[str] = None
    employee_name: str = ""
    school_id: Optional[str] = None
    school_name: str = ""
    school_color: str = "#9E9E9E"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TemporaryTaskCreate(BaseModel):
    name: str
    date: str
    start_time: str
    end_time: str
    employee_id: Optional[str] = None
    school_id: Optional[str] = None

class Absence(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    employee_name: str = ""
    start_date: str
    end_date: str
    reason: str = ""
    shift_types: List[str] = []  # Quarts concernés: AM, PM, MIDI, ADMIN ou vide = tous
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AbsenceCreate(BaseModel):
    employee_id: str
    start_date: str
    end_date: str
    reason: str = ""
    shift_types: List[str] = []

class AbsenceUpdate(BaseModel):
    start_date: str
    end_date: str
    reason: str = ""
    shift_types: List[str] = []

class Holiday(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    date: str
    type: str = "ferie"  # 'ferie' or 'conge'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HolidayCreate(BaseModel):
    name: str
    date: str
    type: str = "ferie"

# Réassignation temporaire - pour le Drag & Drop
class TemporaryReassignment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str  # Date spécifique de la réassignation
    assignment_id: str  # ID de l'assignation originale
    shift_id: str  # ID du quart
    block_id: Optional[str] = None  # ID du bloc (null pour admin/mecano)
    original_employee_id: Optional[str] = None
    new_employee_id: Optional[str] = None  # None = non assigné (dans remplacements)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TemporaryReassignmentCreate(BaseModel):
    date: str
    assignment_id: str
    shift_id: str
    block_id: Optional[str] = None
    original_employee_id: Optional[str] = None
    new_employee_id: Optional[str] = None

# ============== HELPER FUNCTIONS ==============

def time_to_minutes(time_str: str) -> int:
    if not time_str:
        return 0
    h, m = map(int, time_str.split(':'))
    return h * 60 + m

def minutes_to_time(minutes: int) -> str:
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"

def get_day_letter(date_str: str) -> str:
    """Get day letter from date (L, M, W, J, V)"""
    d = datetime.strptime(date_str, '%Y-%m-%d')
    days = ['L', 'M', 'W', 'J', 'V', 'S', 'D']
    return days[d.weekday()]

def calculate_shift_duration(shift: dict, date_str: str = None, is_admin: bool = False) -> int:
    """Calculate total minutes for a shift"""
    if is_admin or shift.get('is_admin'):
        return 8 * 60  # 8 heures fixes pour admin
    
    total = 0
    day_letter = get_day_letter(date_str) if date_str else None
    
    for block in shift.get('blocks', []):
        # Vérifier si le bloc s'applique à ce jour
        if day_letter and day_letter not in block.get('days', ['L', 'M', 'W', 'J', 'V']):
            continue
        start = time_to_minutes(block['start_time'])
        end = time_to_minutes(block['end_time'])
        total += (end - start) + block.get('hlp_before', 0) + block.get('hlp_after', 0)
    return total

def merge_time_intervals(intervals: list) -> list:
    """Merge overlapping time intervals to avoid double counting"""
    if not intervals:
        return []
    
    # Sort by start time
    sorted_intervals = sorted(intervals, key=lambda x: x[0])
    merged = [sorted_intervals[0]]
    
    for start, end in sorted_intervals[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end:  # Overlap detected
            # Merge by extending the end time
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    
    return merged

def calculate_daily_hours_no_overlap(assignments: list, temp_tasks: list, date_str: str, holidays: set = None) -> int:
    """Calculate total minutes worked on a specific date without counting overlaps twice"""
    day_letter = get_day_letter(date_str)
    
    # Collect all time intervals
    intervals = []
    has_admin_shift = False
    
    for assignment in assignments:
        if not (assignment.get('start_date') <= date_str <= assignment.get('end_date')):
            continue
        
        for shift in assignment.get('shifts', []):
            if shift.get('is_admin'):
                has_admin_shift = True
                # Admin shifts are 8h fixed, add as 6:00-14:00 interval for merging purposes
                intervals.append((6 * 60, 14 * 60))
            else:
                for block in shift.get('blocks', []):
                    # Check if block applies to this day
                    if day_letter not in block.get('days', ['L', 'M', 'W', 'J', 'V']):
                        continue
                    
                    start = time_to_minutes(block['start_time']) - block.get('hlp_before', 0)
                    end = time_to_minutes(block['end_time']) + block.get('hlp_after', 0)
                    intervals.append((start, end))
    
    # Add temporary tasks
    for task in temp_tasks:
        if task.get('date') == date_str:
            start = time_to_minutes(task['start_time'])
            end = time_to_minutes(task['end_time'])
            intervals.append((start, end))
    
    # Check if holiday (admin shifts are not affected)
    if holidays and date_str in holidays:
        if has_admin_shift:
            return 8 * 60  # Only admin hours count on holidays
        return 0
    
    # Merge overlapping intervals
    merged = merge_time_intervals(intervals)
    
    # Calculate total minutes
    total = sum(end - start for start, end in merged)
    
    return total

def calculate_daily_hours(assignments: list, temp_tasks: list, date_str: str, holidays: set = None, is_admin_exempt: bool = False) -> int:
    """Calculate total minutes worked on a specific date (legacy function for PDF reports)"""
    # Check if holiday and not admin
    if holidays and date_str in holidays and not is_admin_exempt:
        return 0
    
    total = 0
    for assignment in assignments:
        if assignment.get('start_date') <= date_str <= assignment.get('end_date'):
            for shift in assignment.get('shifts', []):
                if shift.get('is_admin'):
                    total += 8 * 60  # Admin = 8h fixe
                else:
                    total += calculate_shift_duration(shift, date_str)
    
    for task in temp_tasks:
        if task.get('date') == date_str:
            start = time_to_minutes(task['start_time'])
            end = time_to_minutes(task['end_time'])
            total += (end - start)
    return total

def is_weekend(date_str: str) -> bool:
    d = datetime.strptime(date_str, '%Y-%m-%d')
    return d.weekday() >= 5

def format_hours_minutes(total_minutes: int) -> str:
    hours = total_minutes // 60
    minutes = total_minutes % 60
    return f"{hours:02d}:{minutes:02d}"

# ============== AUTH ROUTES ==============

@api_router.post("/auth/login")
async def login(data: AdminLogin):
    admin = await db.admins.find_one({"code": data.password}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=401, detail="Mot de passe invalide")
    return {"success": True, "admin": admin}

@api_router.get("/admins", response_model=List[Admin])
async def get_admins():
    admins = await db.admins.find({}, {"_id": 0}).to_list(100)
    return admins

# ============== EMPLOYEE ROUTES ==============

@api_router.get("/employees", response_model=List[Employee])
async def get_employees():
    employees = await db.employees.find({}, {"_id": 0}).to_list(200)
    return employees

@api_router.post("/employees", response_model=Employee)
async def create_employee(data: EmployeeCreate):
    # Vérifier les doublons
    if data.matricule:
        existing = await db.employees.find_one({"matricule": data.matricule}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Ce matricule existe déjà")
    
    if data.email:
        existing = await db.employees.find_one({"email": data.email}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Ce courriel existe déjà")
    
    if data.phone:
        existing = await db.employees.find_one({"phone": data.phone}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Ce téléphone existe déjà")
    
    if data.berline:
        existing = await db.employees.find_one({"berline": data.berline}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Cette berline existe déjà")
    
    employee = Employee(**data.model_dump())
    doc = employee.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.employees.insert_one(doc)
    return employee

@api_router.put("/employees/{employee_id}", response_model=Employee)
async def update_employee(employee_id: str, data: EmployeeCreate):
    # Vérifier les doublons (sauf pour l'employé actuel)
    if data.matricule:
        existing = await db.employees.find_one({"matricule": data.matricule, "id": {"$ne": employee_id}}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Ce matricule existe déjà")
    
    if data.email:
        existing = await db.employees.find_one({"email": data.email, "id": {"$ne": employee_id}}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Ce courriel existe déjà")
    
    if data.phone:
        existing = await db.employees.find_one({"phone": data.phone, "id": {"$ne": employee_id}}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Ce téléphone existe déjà")
    
    if data.berline:
        existing = await db.employees.find_one({"berline": data.berline, "id": {"$ne": employee_id}}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Cette berline existe déjà")
    
    result = await db.employees.update_one(
        {"id": employee_id},
        {"$set": data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    employee = await db.employees.find_one({"id": employee_id}, {"_id": 0})
    return employee

@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str):
    result = await db.employees.delete_one({"id": employee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    return {"success": True}

# ============== SCHOOL ROUTES ==============

@api_router.get("/schools", response_model=List[School])
async def get_schools():
    schools = await db.schools.find({}, {"_id": 0}).to_list(200)
    return schools

@api_router.post("/schools", response_model=School)
async def create_school(data: SchoolCreate):
    school = School(**data.model_dump())
    doc = school.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.schools.insert_one(doc)
    return school

@api_router.put("/schools/{school_id}", response_model=School)
async def update_school(school_id: str, data: SchoolCreate):
    result = await db.schools.update_one(
        {"id": school_id},
        {"$set": data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="École non trouvée")
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    return school

@api_router.delete("/schools/{school_id}")
async def delete_school(school_id: str):
    result = await db.schools.delete_one({"id": school_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="École non trouvée")
    return {"success": True}

# ============== ASSIGNMENT ROUTES ==============

@api_router.get("/assignments")
async def get_assignments():
    assignments = await db.assignments.find({}, {"_id": 0}).to_list(500)
    return assignments

@api_router.post("/assignments")
async def create_assignment(data: AssignmentCreate):
    employee_name = ""
    if data.employee_id:
        employee = await db.employees.find_one({"id": data.employee_id}, {"_id": 0})
        if employee:
            employee_name = employee.get('name', '')
    
    assignment = Assignment(
        circuit_number=data.circuit_number,
        shifts=[Shift(**s) for s in data.shifts] if data.shifts else [],
        employee_id=data.employee_id,
        employee_name=employee_name,
        start_date=data.start_date,
        end_date=data.end_date,
        is_adapted=data.is_adapted
    )
    doc = assignment.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.assignments.insert_one(doc)
    return assignment.model_dump()

@api_router.put("/assignments/{assignment_id}")
async def update_assignment(assignment_id: str, data: dict):
    if 'employee_id' in data and data['employee_id']:
        employee = await db.employees.find_one({"id": data['employee_id']}, {"_id": 0})
        if employee:
            data['employee_name'] = employee.get('name', '')
    
    result = await db.assignments.update_one(
        {"id": assignment_id},
        {"$set": data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Assignation non trouvée")
    assignment = await db.assignments.find_one({"id": assignment_id}, {"_id": 0})
    return assignment

@api_router.delete("/assignments/{assignment_id}")
async def delete_assignment(assignment_id: str):
    result = await db.assignments.delete_one({"id": assignment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assignation non trouvée")
    return {"success": True}

# ============== TEMPORARY TASK ROUTES ==============

@api_router.get("/temporary-tasks")
async def get_temporary_tasks():
    tasks = await db.temporary_tasks.find({}, {"_id": 0}).to_list(500)
    return tasks

@api_router.post("/temporary-tasks")
async def create_temporary_task(data: TemporaryTaskCreate):
    employee_name = ""
    school_name = ""
    school_color = "#9E9E9E"
    
    if data.employee_id:
        employee = await db.employees.find_one({"id": data.employee_id}, {"_id": 0})
        if employee:
            employee_name = employee.get('name', '')
    
    if data.school_id:
        school = await db.schools.find_one({"id": data.school_id}, {"_id": 0})
        if school:
            school_name = school.get('name', '')
            school_color = school.get('color', '#9E9E9E')
    
    task = TemporaryTask(
        name=data.name,
        date=data.date,
        start_time=data.start_time,
        end_time=data.end_time,
        employee_id=data.employee_id,
        employee_name=employee_name,
        school_id=data.school_id,
        school_name=school_name,
        school_color=school_color
    )
    doc = task.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.temporary_tasks.insert_one(doc)
    return task.model_dump()

@api_router.put("/temporary-tasks/{task_id}")
async def update_temporary_task(task_id: str, data: dict):
    if 'employee_id' in data and data['employee_id']:
        employee = await db.employees.find_one({"id": data['employee_id']}, {"_id": 0})
        if employee:
            data['employee_name'] = employee.get('name', '')
    
    result = await db.temporary_tasks.update_one(
        {"id": task_id},
        {"$set": data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tâche non trouvée")
    task = await db.temporary_tasks.find_one({"id": task_id}, {"_id": 0})
    return task

@api_router.delete("/temporary-tasks/{task_id}")
async def delete_temporary_task(task_id: str):
    result = await db.temporary_tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tâche non trouvée")
    return {"success": True}

# ============== ABSENCE ROUTES ==============

@api_router.get("/absences")
async def get_absences():
    absences = await db.absences.find({}, {"_id": 0}).to_list(500)
    return absences

@api_router.post("/absences")
async def create_absence(data: AbsenceCreate):
    employee = await db.employees.find_one({"id": data.employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    absence = Absence(
        employee_id=data.employee_id,
        employee_name=employee.get('name', ''),
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason,
        shift_types=data.shift_types
    )
    doc = absence.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.absences.insert_one(doc)
    return absence.model_dump()

@api_router.put("/absences/{absence_id}")
async def update_absence(absence_id: str, data: AbsenceUpdate):
    result = await db.absences.update_one(
        {"id": absence_id},
        {"$set": data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Absence non trouvée")
    absence = await db.absences.find_one({"id": absence_id}, {"_id": 0})
    return absence

@api_router.delete("/absences/{absence_id}")
async def delete_absence(absence_id: str):
    result = await db.absences.delete_one({"id": absence_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Absence non trouvée")
    return {"success": True}

# ============== HOLIDAY ROUTES ==============

@api_router.get("/holidays")
async def get_holidays():
    holidays = await db.holidays.find({}, {"_id": 0}).to_list(100)
    return holidays

@api_router.post("/holidays")
async def create_holiday(data: HolidayCreate):
    holiday = Holiday(name=data.name, date=data.date, type=data.type)
    doc = holiday.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.holidays.insert_one(doc)
    return holiday.model_dump()

@api_router.delete("/holidays/{holiday_id}")
async def delete_holiday(holiday_id: str):
    result = await db.holidays.delete_one({"id": holiday_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Jour férié non trouvé")
    return {"success": True}

# ============== SCHEDULE ROUTES ==============

@api_router.get("/schedule")
async def get_schedule(date: str = None, week_start: str = None):
    employees = await db.employees.find({}, {"_id": 0}).to_list(200)
    assignments = await db.assignments.find({}, {"_id": 0}).to_list(500)
    temp_tasks = await db.temporary_tasks.find({}, {"_id": 0}).to_list(500)
    absences = await db.absences.find({}, {"_id": 0}).to_list(500)
    holidays = await db.holidays.find({}, {"_id": 0}).to_list(100)
    
    holiday_dates = {h['date'] for h in holidays}
    
    if week_start:
        week_start_date = datetime.strptime(week_start, '%Y-%m-%d')
        # Trouver le lundi de la semaine
        day_of_week = week_start_date.weekday()
        monday = week_start_date - timedelta(days=day_of_week)
        week_dates = [(monday + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(5)]
    else:
        today = datetime.now()
        day_of_week = today.weekday()
        monday = today - timedelta(days=day_of_week)
        week_dates = [(monday + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(5)]
    
    schedule_data = []
    
    for emp in employees:
        emp_id = emp['id']
        emp_assignments = [a for a in assignments if a.get('employee_id') == emp_id]
        emp_temp_tasks = [t for t in temp_tasks if t.get('employee_id') == emp_id]
        emp_absences = [a for a in absences if a.get('employee_id') == emp_id]
        
        # Get circuit numbers for this employee
        circuit_numbers = [a['circuit_number'] for a in emp_assignments]
        
        daily_hours = {}
        weekly_total = 0
        
        for date_str in week_dates:
            if date_str in holiday_dates:
                # Check if employee has admin shift (not affected by holidays)
                has_admin = any(
                    any(s.get('is_admin') for s in a.get('shifts', []))
                    for a in emp_assignments
                    if a.get('start_date') <= date_str <= a.get('end_date')
                )
                if not has_admin:
                    daily_hours[date_str] = 0
                    continue
            
            # Check absence for specific shifts
            emp_absence_today = [a for a in emp_absences if a['start_date'] <= date_str <= a['end_date']]
            
            # Filter assignments and tasks based on absence
            active_assignments = []
            for assignment in emp_assignments:
                if not (assignment.get('start_date') <= date_str <= assignment.get('end_date')):
                    continue
                
                filtered_shifts = []
                for shift in assignment.get('shifts', []):
                    # Check if absent for this shift type
                    is_absent_for_shift = any(
                        not abs_entry.get('shift_types') or shift.get('name') in abs_entry.get('shift_types', [])
                        for abs_entry in emp_absence_today
                    )
                    if not (is_absent_for_shift and emp_absence_today):
                        filtered_shifts.append(shift)
                
                if filtered_shifts:
                    active_assignments.append({**assignment, 'shifts': filtered_shifts})
            
            active_tasks = []
            if not emp_absence_today:  # No tasks if absent
                for task in emp_temp_tasks:
                    if task.get('date') == date_str:
                        active_tasks.append(task)
            
            # Calculate hours without double counting overlaps
            day_minutes = calculate_daily_hours_no_overlap(active_assignments, active_tasks, date_str, holiday_dates)
            
            daily_hours[date_str] = day_minutes
            weekly_total += day_minutes
        
        schedule_data.append({
            "employee": emp,
            "assignments": emp_assignments,
            "circuit_numbers": circuit_numbers,
            "temporary_tasks": emp_temp_tasks,
            "absences": emp_absences,
            "daily_hours": daily_hours,
            "weekly_total": weekly_total,
            "weekly_total_formatted": format_hours_minutes(weekly_total)
        })
    
    # Sort by circuit number (employees with assignments first, then by circuit number)
    def sort_key(item):
        circuits = item.get('circuit_numbers', [])
        if not circuits:
            return (1, '', item['employee']['name'])
        return (0, min(circuits), item['employee']['name'])
    
    schedule_data.sort(key=sort_key)
    
    # Unassigned items
    unassigned_assignments = [a for a in assignments if not a.get('employee_id')]
    unassigned_tasks = [t for t in temp_tasks if not t.get('employee_id')]
    
    # Items from absent employees
    replacement_items = []
    for emp in employees:
        emp_id = emp['id']
        emp_absences = [a for a in absences if a.get('employee_id') == emp_id]
        
        for date_str in week_dates:
            is_absent = any(
                a['start_date'] <= date_str <= a['end_date']
                for a in emp_absences
            )
            if is_absent:
                emp_assignments = [a for a in assignments if a.get('employee_id') == emp_id]
                for assignment in emp_assignments:
                    if assignment.get('start_date') <= date_str <= assignment.get('end_date'):
                        replacement_items.append({
                            "type": "assignment",
                            "data": assignment,
                            "date": date_str,
                            "original_employee": emp['name']
                        })
    
    return {
        "schedule": schedule_data,
        "replacements": {
            "unassigned_assignments": unassigned_assignments,
            "unassigned_tasks": unassigned_tasks,
            "absent_items": replacement_items
        },
        "week_dates": week_dates,
        "holidays": list(holiday_dates)
    }

# ============== CONFLICT CHECK ==============

@api_router.post("/check-conflict")
async def check_conflict(data: dict):
    employee_id = data.get('employee_id')
    date_str = data.get('date')
    start_time = data.get('start_time')
    end_time = data.get('end_time')
    exclude_id = data.get('exclude_id')
    
    if not all([employee_id, date_str, start_time, end_time]):
        return {"conflict": False}
    
    new_start = time_to_minutes(start_time)
    new_end = time_to_minutes(end_time)
    
    assignments = await db.assignments.find(
        {"employee_id": employee_id},
        {"_id": 0}
    ).to_list(500)
    
    temp_tasks = await db.temporary_tasks.find(
        {"employee_id": employee_id, "date": date_str},
        {"_id": 0}
    ).to_list(100)
    
    conflicts = []
    
    for assignment in assignments:
        if assignment.get('id') == exclude_id:
            continue
        if not (assignment.get('start_date') <= date_str <= assignment.get('end_date')):
            continue
        
        for shift in assignment.get('shifts', []):
            for block in shift.get('blocks', []):
                block_start = time_to_minutes(block['start_time']) - block.get('hlp_before', 0)
                block_end = time_to_minutes(block['end_time']) + block.get('hlp_after', 0)
                
                overlap = min(new_end, block_end) - max(new_start, block_start)
                if overlap > 5:
                    conflicts.append({
                        "type": "assignment",
                        "assignment_id": assignment['id'],
                        "circuit": assignment['circuit_number'],
                        "shift": shift['name'],
                        "block_time": f"{block['start_time']}-{block['end_time']}",
                        "overlap_minutes": overlap
                    })
    
    for task in temp_tasks:
        if task.get('id') == exclude_id:
            continue
        task_start = time_to_minutes(task['start_time'])
        task_end = time_to_minutes(task['end_time'])
        
        overlap = min(new_end, task_end) - max(new_start, task_start)
        if overlap > 5:
            conflicts.append({
                "type": "temporary_task",
                "task_id": task['id'],
                "task_name": task['name'],
                "task_time": f"{task['start_time']}-{task['end_time']}",
                "overlap_minutes": overlap
            })
    
    return {"conflict": len(conflicts) > 0, "conflicts": conflicts}

# ============== PDF REPORT ==============

@api_router.get("/reports/hours-pdf")
async def generate_hours_report(
    start_date: str,
    end_date: str,
    employee_ids: str = "",
    sort_by: str = "name"  # name, matricule, hire_date
):
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import LongTable
    
    employees = await db.employees.find({}, {"_id": 0}).to_list(200)
    assignments = await db.assignments.find({}, {"_id": 0}).to_list(500)
    temp_tasks = await db.temporary_tasks.find({}, {"_id": 0}).to_list(500)
    absences = await db.absences.find({}, {"_id": 0}).to_list(500)
    holidays = await db.holidays.find({}, {"_id": 0}).to_list(100)
    
    holiday_dates = {h['date'] for h in holidays}
    
    if employee_ids:
        emp_ids = employee_ids.split(',')
        employees = [e for e in employees if e['id'] in emp_ids]
    
    # Sort employees
    if sort_by == "matricule":
        employees.sort(key=lambda e: e.get('matricule', '') or 'ZZZZ')
    elif sort_by == "hire_date":
        employees.sort(key=lambda e: e.get('hire_date', '9999-99-99'))
    else:  # name (alphabetical)
        employees.sort(key=lambda e: e.get('name', ''))
    
    # Generate date range (excluding weekends)
    start = datetime.strptime(start_date, '%Y-%m-%d')
    end = datetime.strptime(end_date, '%Y-%m-%d')
    date_range = []
    current = start
    while current <= end:
        if current.weekday() < 5:
            date_range.append(current.strftime('%Y-%m-%d'))
        current += timedelta(days=1)
    
    # Always use portrait orientation
    page_size = letter
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=page_size, leftMargin=15, rightMargin=15, topMargin=30, bottomMargin=30)
    elements = []
    styles = getSampleStyleSheet()
    
    # Title
    elements.append(Paragraph(
        f"Rapport des heures travaillées",
        styles['Title']
    ))
    elements.append(Paragraph(
        f"Période: {start_date} au {end_date}",
        styles['Normal']
    ))
    elements.append(Spacer(1, 15))
    
    # Format date headers (shorter format)
    def format_date_header(d):
        dt = datetime.strptime(d, '%Y-%m-%d')
        days_fr = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
        return f"{days_fr[dt.weekday()]}\n{dt.day}"
    
    # Build headers: Matricule, Nom, [dates...], Total
    headers = ["Mat.", "Employé"] + [format_date_header(d) for d in date_range] + ["TOTAL"]
    table_data = [headers]
    
    for emp in employees:
        emp_id = emp['id']
        emp_assignments = [a for a in assignments if a.get('employee_id') == emp_id]
        emp_temp_tasks = [t for t in temp_tasks if t.get('employee_id') == emp_id]
        emp_absences = [a for a in absences if a.get('employee_id') == emp_id]
        
        row = [emp.get('matricule', '-')[:6], emp['name'][:18]]
        total_minutes = 0
        
        for date_str in date_range:
            if date_str in holiday_dates:
                row.append("F")
                continue
            
            is_absent = any(
                a['start_date'] <= date_str <= a['end_date']
                for a in emp_absences
            )
            
            if is_absent:
                row.append("A")
                continue
            
            day_minutes = calculate_daily_hours(emp_assignments, emp_temp_tasks, date_str, holiday_dates)
            total_minutes += day_minutes
            
            if day_minutes > 0:
                row.append(format_hours_minutes(day_minutes))
            else:
                row.append("-")
        
        row.append(format_hours_minutes(total_minutes))
        table_data.append(row)
    
    # Calculate column widths based on number of days
    num_days = len(date_range)
    page_width = letter[0] - 30  # Account for margins
    mat_width = 32
    name_width = 80
    total_width = 40
    
    # Calculate day column width to fit all columns
    available_for_days = page_width - mat_width - name_width - total_width
    day_width = max(22, available_for_days / max(1, num_days))
    
    col_widths = [mat_width, name_width] + [day_width] * num_days + [total_width]
    
    # Use LongTable for headers on each page
    table = LongTable(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4CAF50')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (1, 1), (1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 6),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
        # Highlight total column
        ('BACKGROUND', (-1, 0), (-1, 0), colors.HexColor('#388E3C')),
        ('FONTNAME', (-1, 1), (-1, -1), 'Helvetica-Bold'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(table)
    
    # Legend
    elements.append(Spacer(1, 15))
    elements.append(Paragraph(
        "Légende: F = Jour férié | A = Absent | - = Aucune heure",
        styles['Normal']
    ))
    
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=rapport_heures_{start_date}_{end_date}.pdf"}
    )

# ============== INIT DATA ==============

@api_router.post("/init-data")
async def init_data():
    admins_data = [
        {"code": "1600", "name": "Fernand Alary"},
        {"code": "2201", "name": "Chantal Lachapelle"},
        {"code": "2202", "name": "Mélissa Aubuchon"},
        {"code": "2203", "name": "Benoit Dallaire"},
        {"code": "2204", "name": "Maxime Labelle"},
    ]
    
    existing = await db.admins.count_documents({})
    if existing == 0:
        for admin_data in admins_data:
            admin = Admin(**admin_data)
            doc = admin.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.admins.insert_one(doc)
    
    return {"success": True, "message": "Données initialisées"}

@api_router.get("/")
async def root():
    return {"message": "Les Berlines Trip à Bord - API de gestion des horaires"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
