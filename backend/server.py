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
from datetime import datetime, timezone, date, timedelta
from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
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
    name: str
    hire_date: str
    phone: str = ""
    email: str = ""
    berline: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EmployeeCreate(BaseModel):
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SchoolCreate(BaseModel):
    name: str
    color: str = "#4CAF50"

class Block(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    school_id: str
    school_name: str = ""
    school_color: str = "#4CAF50"
    start_time: str  # HH:MM format
    end_time: str    # HH:MM format
    hlp_before: int = 0  # minutes
    hlp_after: int = 0   # minutes

class Shift(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # AM, PM, MIDI
    blocks: List[Block] = []

class Assignment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    circuit_number: str
    shifts: List[Shift] = []
    employee_id: Optional[str] = None
    employee_name: str = ""
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AssignmentCreate(BaseModel):
    circuit_number: str
    shifts: List[dict] = []
    employee_id: Optional[str] = None
    start_date: str
    end_date: str

class TemporaryTask(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    date: str  # YYYY-MM-DD
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AbsenceCreate(BaseModel):
    employee_id: str
    start_date: str
    end_date: str
    reason: str = ""

class Holiday(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    date: str  # YYYY-MM-DD
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HolidayCreate(BaseModel):
    name: str
    date: str

class DailySchedule(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    employee_id: str
    assignment_id: Optional[str] = None
    shift_id: Optional[str] = None
    block_id: Optional[str] = None
    temporary_task_id: Optional[str] = None
    is_replacement: bool = False
    original_employee_id: Optional[str] = None

# ============== HELPER FUNCTIONS ==============

def time_to_minutes(time_str: str) -> int:
    """Convert HH:MM to minutes from midnight"""
    h, m = map(int, time_str.split(':'))
    return h * 60 + m

def minutes_to_time(minutes: int) -> str:
    """Convert minutes from midnight to HH:MM"""
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"

def calculate_shift_duration(shift: dict) -> int:
    """Calculate total minutes for a shift including HLP"""
    total = 0
    for block in shift.get('blocks', []):
        start = time_to_minutes(block['start_time'])
        end = time_to_minutes(block['end_time'])
        total += (end - start) + block.get('hlp_before', 0) + block.get('hlp_after', 0)
    return total

def calculate_daily_hours(assignments: list, temp_tasks: list, date_str: str) -> int:
    """Calculate total minutes worked on a specific date"""
    total = 0
    for assignment in assignments:
        if assignment.get('start_date') <= date_str <= assignment.get('end_date'):
            for shift in assignment.get('shifts', []):
                total += calculate_shift_duration(shift)
    for task in temp_tasks:
        if task.get('date') == date_str:
            start = time_to_minutes(task['start_time'])
            end = time_to_minutes(task['end_time'])
            total += (end - start)
    return total

def is_weekend(date_str: str) -> bool:
    """Check if date is Saturday or Sunday"""
    d = datetime.strptime(date_str, '%Y-%m-%d')
    return d.weekday() >= 5

def format_hours_minutes(total_minutes: int) -> str:
    """Format minutes as HH:MM"""
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
    employee = Employee(**data.model_dump())
    doc = employee.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.employees.insert_one(doc)
    return employee

@api_router.put("/employees/{employee_id}", response_model=Employee)
async def update_employee(employee_id: str, data: EmployeeCreate):
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
        end_date=data.end_date
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
        reason=data.reason
    )
    doc = absence.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.absences.insert_one(doc)
    return absence.model_dump()

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
    holiday = Holiday(**data.model_dump())
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
    """Get schedule for a specific date or week"""
    employees = await db.employees.find({}, {"_id": 0}).to_list(200)
    assignments = await db.assignments.find({}, {"_id": 0}).to_list(500)
    temp_tasks = await db.temporary_tasks.find({}, {"_id": 0}).to_list(500)
    absences = await db.absences.find({}, {"_id": 0}).to_list(500)
    holidays = await db.holidays.find({}, {"_id": 0}).to_list(100)
    
    holiday_dates = {h['date'] for h in holidays}
    
    # Calculate weekly hours for each employee
    schedule_data = []
    
    if week_start:
        week_start_date = datetime.strptime(week_start, '%Y-%m-%d')
        week_dates = []
        for i in range(7):
            d = week_start_date + timedelta(days=i)
            if d.weekday() < 5:  # Monday to Friday
                week_dates.append(d.strftime('%Y-%m-%d'))
    else:
        today = datetime.now()
        monday = today - timedelta(days=today.weekday())
        week_dates = [(monday + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(5)]
    
    for emp in employees:
        emp_id = emp['id']
        emp_assignments = [a for a in assignments if a.get('employee_id') == emp_id]
        emp_temp_tasks = [t for t in temp_tasks if t.get('employee_id') == emp_id]
        emp_absences = [a for a in absences if a.get('employee_id') == emp_id]
        
        daily_hours = {}
        weekly_total = 0
        
        for date_str in week_dates:
            if date_str in holiday_dates:
                daily_hours[date_str] = 0
                continue
            
            # Check if employee is absent
            is_absent = any(
                a['start_date'] <= date_str <= a['end_date']
                for a in emp_absences
            )
            
            if is_absent:
                daily_hours[date_str] = 0
                continue
            
            day_minutes = calculate_daily_hours(emp_assignments, emp_temp_tasks, date_str)
            daily_hours[date_str] = day_minutes
            weekly_total += day_minutes
        
        schedule_data.append({
            "employee": emp,
            "assignments": emp_assignments,
            "temporary_tasks": emp_temp_tasks,
            "absences": emp_absences,
            "daily_hours": daily_hours,
            "weekly_total": weekly_total,
            "weekly_total_formatted": format_hours_minutes(weekly_total)
        })
    
    # Get unassigned items for replacements
    unassigned_assignments = [a for a in assignments if not a.get('employee_id')]
    unassigned_tasks = [t for t in temp_tasks if not t.get('employee_id')]
    
    # Get items from absent employees
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
    """Check if there's a schedule conflict for an employee"""
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
                if overlap > 5:  # More than 5 minutes overlap
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
    employee_ids: str = ""
):
    """Generate PDF report of hours worked"""
    employees = await db.employees.find({}, {"_id": 0}).to_list(200)
    assignments = await db.assignments.find({}, {"_id": 0}).to_list(500)
    temp_tasks = await db.temporary_tasks.find({}, {"_id": 0}).to_list(500)
    absences = await db.absences.find({}, {"_id": 0}).to_list(500)
    holidays = await db.holidays.find({}, {"_id": 0}).to_list(100)
    
    holiday_dates = {h['date'] for h in holidays}
    
    # Filter employees if specified
    if employee_ids:
        emp_ids = employee_ids.split(',')
        employees = [e for e in employees if e['id'] in emp_ids]
    
    # Generate date range (excluding weekends)
    start = datetime.strptime(start_date, '%Y-%m-%d')
    end = datetime.strptime(end_date, '%Y-%m-%d')
    date_range = []
    current = start
    while current <= end:
        if current.weekday() < 5:  # Monday to Friday
            date_range.append(current.strftime('%Y-%m-%d'))
        current += timedelta(days=1)
    
    # Create PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
    elements = []
    styles = getSampleStyleSheet()
    
    # Title
    elements.append(Paragraph(
        f"Rapport des heures travaillées - {start_date} au {end_date}",
        styles['Title']
    ))
    elements.append(Spacer(1, 20))
    
    # Build table data
    headers = ["Employé"] + [d[5:] for d in date_range] + ["Total"]
    table_data = [headers]
    
    for emp in employees:
        emp_id = emp['id']
        emp_assignments = [a for a in assignments if a.get('employee_id') == emp_id]
        emp_temp_tasks = [t for t in temp_tasks if t.get('employee_id') == emp_id]
        emp_absences = [a for a in absences if a.get('employee_id') == emp_id]
        
        row = [emp['name']]
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
            
            day_minutes = calculate_daily_hours(emp_assignments, emp_temp_tasks, date_str)
            total_minutes += day_minutes
            row.append(format_hours_minutes(day_minutes))
        
        row.append(format_hours_minutes(total_minutes))
        table_data.append(row)
    
    # Create table
    table = Table(table_data)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),
    ]))
    elements.append(table)
    
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
    """Initialize default data (admins)"""
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
