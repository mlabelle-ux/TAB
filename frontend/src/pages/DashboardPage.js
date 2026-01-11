import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { 
  getSchedule, getEmployees, getSchools, getAssignments, 
  getTemporaryTasks, getAbsences, getHolidays
} from '../lib/api';
import api from '../lib/api';
import { 
  formatHoursMinutes, getWeekDates, getMonday, timeToMinutes, 
  getContrastColor, formatDate 
} from '../lib/utils';
import { Button } from '../components/ui/button';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter 
} from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '../components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar as CalendarComponent } from '../components/ui/calendar';
import { 
  Sun, Moon, LogOut, ChevronLeft, ChevronRight, Calendar,
  Users, School, Settings, FileText, Plus, AlertTriangle,
  Bus, UserX, Info, CalendarDays, ArrowUpDown, Accessibility, GripVertical, ClipboardList, CalendarOff
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable
} from '@dnd-kit/core';

import EmployeesPage from './EmployeesPage';
import SchoolsPage from './SchoolsPage';
import AssignmentsPage from './AssignmentsPage';
import AbsencesPage from './AbsencesPage';
import HolidaysPage from './HolidaysPage';
import ReportsPage from './ReportsPage';
import TemporaryTaskModal from '../components/TemporaryTaskModal';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_route-manager-27/artifacts/sd598o43_LogoBerlinesTAB.png';

const SCHEDULE_START_HOUR = 5;
const SCHEDULE_END_HOUR = 19;
const TOTAL_HOURS = SCHEDULE_END_HOUR - SCHEDULE_START_HOUR;

const DRIVER_COL_WIDTH = 200;
const CIRCUIT_COL_WIDTH = 80;
const DAY_HOURS_COL_WIDTH = 60;
const WEEK_HOURS_COL_WIDTH = 80;
const FIXED_LEFT_WIDTH = DRIVER_COL_WIDTH + CIRCUIT_COL_WIDTH;
const FIXED_RIGHT_WIDTH = DAY_HOURS_COL_WIDTH + WEEK_HOURS_COL_WIDTH;
const ROW_HEIGHT = 40;

const generateTimeMarkers = (pixelsPerHour) => {
  const markers = [];
  for (let h = SCHEDULE_START_HOUR; h < SCHEDULE_END_HOUR; h++) {
    markers.push({ hour: h, label: `${h}h`, position: (h - SCHEDULE_START_HOUR) * pixelsPerHour });
  }
  return markers;
};

const getDayLetter = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return ['D', 'L', 'M', 'W', 'J', 'V', 'S'][d.getDay()];
};

// Draggable block component
function DraggableBlock({ id, data, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 1000,
  } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children(isDragging)}
    </div>
  );
}

// Droppable row component
function DroppableRow({ id, employeeId, children, isReplacement = false }) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { employeeId, isReplacement }
  });

  return (
    <div 
      ref={setNodeRef} 
      className={`flex border-b border-border transition-all duration-200 ${isOver ? 'bg-green-100 dark:bg-green-900/40 ring-2 ring-green-500 ring-inset' : isReplacement ? 'bg-amber-50/50 dark:bg-amber-950/30' : 'hover:bg-muted/30'}`}
      style={{ height: ROW_HEIGHT }}
    >
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { admin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('schedule');
  const [viewMode, setViewMode] = useState('detailed');
  const [sortMode, setSortMode] = useState('circuit');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    if (day === 0) today.setDate(today.getDate() + 1);
    if (day === 6) today.setDate(today.getDate() + 2);
    return today.toISOString().split('T')[0];
  });
  const [weekDates, setWeekDates] = useState([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const [employees, setEmployees] = useState([]);
  const [schools, setSchools] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [tempTasks, setTempTasks] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [scheduleData, setScheduleData] = useState([]);
  const [replacements, setReplacements] = useState({});
  
  // Daily overrides - temporary reassignments for a specific day only
  const [dailyOverrides, setDailyOverrides] = useState({});
  
  const [loading, setLoading] = useState(true);
  const [showTempTaskModal, setShowTempTaskModal] = useState(false);
  
  // Drag state
  const [activeId, setActiveId] = useState(null);
  const [activeDragData, setActiveDragData] = useState(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignData, setReassignData] = useState(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } })
  );
  
  const containerRef = useRef(null);
  const [pixelsPerHour, setPixelsPerHour] = useState(100);
  const totalScheduleWidth = useMemo(() => TOTAL_HOURS * pixelsPerHour, [pixelsPerHour]);
  const timeMarkers = useMemo(() => generateTimeMarkers(pixelsPerHour), [pixelsPerHour]);
  
  useEffect(() => {
    const calculateWidth = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const availableWidth = containerWidth - FIXED_LEFT_WIDTH - FIXED_RIGHT_WIDTH - 40;
        // Élargir de 25% supplémentaires
        const calculatedPixelsPerHour = Math.max(80, (availableWidth / TOTAL_HOURS) * 1.5);
        setPixelsPerHour(calculatedPixelsPerHour);
      }
    };
    calculateWidth();
    window.addEventListener('resize', calculateWidth);
    return () => window.removeEventListener('resize', calculateWidth);
  }, []);
  
  const fetchData = useCallback(async () => {
    try {
      const monday = getMonday(selectedDate);
      const [empRes, schRes, assRes, taskRes, absRes, holRes, schedRes] = await Promise.all([
        getEmployees(), getSchools(), getAssignments(), getTemporaryTasks(), getAbsences(), getHolidays(), getSchedule({ week_start: monday })
      ]);
      setEmployees(empRes.data);
      setSchools(schRes.data);
      setAssignments(assRes.data);
      setTempTasks(taskRes.data);
      setAbsences(absRes.data);
      setHolidays(holRes.data);
      setScheduleData(schedRes.data.schedule || []);
      setReplacements(schedRes.data.replacements || {});
      setWeekDates(schedRes.data.week_dates || getWeekDates(monday));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);
  
  useEffect(() => { fetchData(); }, [fetchData]);
  
  // Get daily override key
  const getOverrideKey = (assignmentId, shiftId, blockId) => `${selectedDate}-${assignmentId}-${shiftId}-${blockId || 'main'}`;
  
  // Get effective employee for a block (considering daily overrides)
  const getEffectiveEmployeeId = (assignment, shiftId, blockId) => {
    const key = getOverrideKey(assignment.id, shiftId, blockId);
    return dailyOverrides[key] || assignment.employee_id;
  };
  
  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      const aAssignments = assignments.filter(ass => ass.employee_id === a.id);
      const bAssignments = assignments.filter(ass => ass.employee_id === b.id);
      const getMinCircuit = (list) => {
        if (list.length === 0) return Infinity;
        return Math.min(...list.map(ass => parseInt(ass.circuit_number, 10) || Infinity));
      };
      const aCircuit = getMinCircuit(aAssignments);
      const bCircuit = getMinCircuit(bAssignments);
      if (aCircuit !== bCircuit) return aCircuit - bCircuit;
      return a.name.localeCompare(b.name);
    });
  }, [employees, assignments, sortMode]);
  
  // Get all unassigned items for the replacement row
  const unassignedItems = useMemo(() => {
    const items = [];
    const { unassigned_assignments = [], absent_items = [] } = replacements || {};
    
    // Add unassigned assignments
    unassigned_assignments.forEach(a => {
      items.push({ type: 'unassigned_assignment', data: a, id: `unassigned-${a.id}` });
    });
    
    // Add absent items for today
    absent_items.filter(item => item.date === selectedDate).forEach((item, idx) => {
      items.push({ type: 'absent_assignment', data: item.data, id: `absent-${idx}` });
    });
    
    // Add unassigned temp tasks
    tempTasks.filter(t => !t.employee_id && t.date === selectedDate).forEach(t => {
      items.push({ type: 'unassigned_task', data: t, id: `unassigned-task-${t.id}` });
    });
    
    return items;
  }, [replacements, tempTasks, selectedDate]);
  
  const goToPreviousWeek = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 7); setSelectedDate(d.toISOString().split('T')[0]); };
  const goToNextWeek = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 7); setSelectedDate(d.toISOString().split('T')[0]); };
  const goToToday = () => {
    const today = new Date();
    const day = today.getDay();
    if (day === 0) today.setDate(today.getDate() + 1);
    if (day === 6) today.setDate(today.getDate() + 2);
    setSelectedDate(today.toISOString().split('T')[0]);
  };
  
  const handleDateClick = (date) => {
    setSelectedDate(date);
  };
  
  const handleCalendarSelect = (date) => {
    if (date) {
      const day = date.getDay();
      if (day === 0) date.setDate(date.getDate() + 1);
      if (day === 6) date.setDate(date.getDate() + 2);
      setSelectedDate(date.toISOString().split('T')[0]);
      setCalendarOpen(false);
    }
  };
  
  const handleLogout = () => { logout(); navigate('/'); };
  const toggleSortMode = () => setSortMode(prev => prev === 'circuit' ? 'name' : 'circuit');
  
  const isEmployeeAbsent = (employeeId) => absences.some(a => a.employee_id === employeeId && a.start_date <= selectedDate && a.end_date >= selectedDate);
  
  // DnD Handlers
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
    setActiveDragData(event.active.data.current);
  };
  
  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveDragData(null);
    
    if (!over) return;
    
    const dragData = active.data.current;
    const dropData = over.data.current;
    
    if (!dragData || !dropData) return;
    
    const targetEmployeeId = dropData.employeeId;
    
    // If dropping on replacement row, unassign for the day
    if (dropData.isReplacement) {
      if (dragData.type === 'assignment') {
        const key = getOverrideKey(dragData.assignment.id, dragData.shift.id, dragData.block?.id);
        setDailyOverrides(prev => ({ ...prev, [key]: null }));
        toast.success(`Circuit ${dragData.assignment.circuit_number} désassigné pour ${selectedDate}`);
      }
      return;
    }
    
    if (!targetEmployeeId) return;
    
    // Get source employee
    let sourceEmployeeId = null;
    if (dragData.type === 'assignment') {
      sourceEmployeeId = getEffectiveEmployeeId(dragData.assignment, dragData.shift.id, dragData.block?.id);
    } else if (dragData.type === 'task') {
      sourceEmployeeId = dragData.task.employee_id;
    } else if (dragData.type === 'unassigned_assignment' || dragData.type === 'absent_assignment') {
      sourceEmployeeId = null;
    }
    
    if (sourceEmployeeId === targetEmployeeId) return;
    
    const targetEmployee = employees.find(e => e.id === targetEmployeeId);
    if (!targetEmployee) return;
    
    // Apply daily override (temporary reassignment for today only)
    if (dragData.type === 'assignment') {
      const key = getOverrideKey(dragData.assignment.id, dragData.shift.id, dragData.block?.id);
      setDailyOverrides(prev => ({ ...prev, [key]: targetEmployeeId }));
      toast.success(`Circuit ${dragData.assignment.circuit_number} assigné à ${targetEmployee.name} pour ${selectedDate}`);
    } else if (dragData.type === 'unassigned_assignment' || dragData.type === 'absent_assignment') {
      // Create a temporary assignment for the day
      const assignment = dragData.data;
      assignment.shifts?.forEach(shift => {
        if (shift.is_admin) {
          const key = getOverrideKey(assignment.id, shift.id, null);
          setDailyOverrides(prev => ({ ...prev, [key]: targetEmployeeId }));
        } else {
          shift.blocks?.forEach(block => {
            const key = getOverrideKey(assignment.id, shift.id, block.id);
            setDailyOverrides(prev => ({ ...prev, [key]: targetEmployeeId }));
          });
        }
      });
      toast.success(`Circuit ${assignment.circuit_number} assigné à ${targetEmployee.name} pour ${selectedDate}`);
    }
  };
  
  const handleTempTaskCreated = () => {
    setShowTempTaskModal(false);
    fetchData();
    toast.success('Tâche temporaire créée');
  };

  // Render block based on view mode
  const renderBlock = (assignment, shift, block, isDragging, effectiveEmployeeId) => {
    const scheduleStartMinutes = SCHEDULE_START_HOUR * 60;
    const dayLetter = getDayLetter(selectedDate);
    
    if (block?.days && block.days.length > 0 && !block.days.includes(dayLetter)) return null;
    
    let startMinutes, endMinutes, bgColor, label, showHlp = false;
    
    if (shift.is_admin) {
      startMinutes = 6 * 60;
      endMinutes = startMinutes + (shift.admin_hours || 8) * 60;
      bgColor = shift.name === 'MECANO' ? '#795548' : '#607D8B';
      label = shift.name;
    } else if (block) {
      const hlpBefore = block.hlp_before || 0;
      const hlpAfter = block.hlp_after || 0;
      
      if (viewMode === 'complete') {
        // Mode complet: HLP inclus dans la couleur
        startMinutes = timeToMinutes(block.start_time) - hlpBefore;
        endMinutes = timeToMinutes(block.end_time) + hlpAfter;
        bgColor = block.school_color || '#9E9E9E';
        label = block.school_name || 'École';
      } else if (viewMode === 'abbreviated') {
        // Mode abrégé: juste le circuit
        startMinutes = timeToMinutes(block.start_time) - hlpBefore;
        endMinutes = timeToMinutes(block.end_time) + hlpAfter;
        bgColor = '#6B7280';
        label = assignment.circuit_number;
      } else {
        // Mode détaillé: HLP séparés
        startMinutes = timeToMinutes(block.start_time);
        endMinutes = timeToMinutes(block.end_time);
        bgColor = block.school_color || '#9E9E9E';
        label = block.school_name || 'École';
        showHlp = hlpBefore > 0 || hlpAfter > 0;
      }
    } else {
      return null;
    }
    
    const left = ((startMinutes - scheduleStartMinutes) / 60) * pixelsPerHour;
    const width = ((endMinutes - startMinutes) / 60) * pixelsPerHour;
    const textColor = getContrastColor(bgColor);
    
    // Check if this block is temporarily reassigned (show indicator)
    const isOverridden = effectiveEmployeeId !== assignment.employee_id;
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`absolute rounded text-[10px] flex items-center gap-1 px-1 overflow-hidden border font-medium transition-all select-none ${isDragging ? 'opacity-50 scale-105 shadow-xl cursor-grabbing' : 'cursor-grab hover:shadow-lg'} ${isOverridden ? 'border-2 border-dashed border-orange-500' : 'border-black/20'}`}
              style={{
                left: Math.max(0, left),
                width: Math.max(45, width),
                top: 4,
                height: ROW_HEIGHT - 8,
                backgroundColor: bgColor,
                color: textColor,
              }}
            >
              <GripVertical className="h-3 w-3 flex-shrink-0 opacity-60" />
              <span className="truncate">{label}</span>
              {isOverridden && <span className="text-[8px] ml-auto">*</span>}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="text-xs space-y-1">
              <div className="font-bold">Circuit {assignment.circuit_number} - {shift.name}</div>
              {block && <div>École: {block.school_name}</div>}
              {block && <div>Horaire: {block.start_time} - {block.end_time}</div>}
              {isOverridden && <div className="text-orange-500">* Réassigné temporairement pour aujourd'hui</div>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const renderTaskBlock = (task, isDragging) => {
    const scheduleStartMinutes = SCHEDULE_START_HOUR * 60;
    const startMinutes = timeToMinutes(task.start_time);
    const endMinutes = timeToMinutes(task.end_time);
    
    const left = ((startMinutes - scheduleStartMinutes) / 60) * pixelsPerHour;
    const width = ((endMinutes - startMinutes) / 60) * pixelsPerHour;
    const bgColor = task.school_color || '#FF69B4';
    const textColor = getContrastColor(bgColor);

    return (
      <div
        className={`absolute rounded text-[10px] flex items-center gap-1 px-1 overflow-hidden border-2 border-dashed font-medium transition-all select-none ${isDragging ? 'opacity-50 cursor-grabbing' : 'cursor-grab hover:shadow-lg'}`}
        style={{
          left: Math.max(0, left),
          width: Math.max(45, width),
          top: 4,
          height: ROW_HEIGHT - 8,
          backgroundColor: bgColor,
          color: textColor,
          borderColor: textColor,
        }}
      >
        <GripVertical className="h-3 w-3 flex-shrink-0 opacity-60" />
        <span className="truncate">{task.name}</span>
      </div>
    );
  };

  // Render unassigned item in replacement row
  const renderUnassignedItem = (item, isDragging) => {
    let bgColor, label, icon;
    
    if (item.type === 'unassigned_assignment' || item.type === 'absent_assignment') {
      bgColor = item.type === 'absent_assignment' ? '#EF4444' : '#F59E0B';
      label = item.data.circuit_number;
      icon = item.type === 'absent_assignment' ? <UserX className="h-3 w-3" /> : <Bus className="h-3 w-3" />;
    } else {
      bgColor = '#EC4899';
      label = item.data.name;
      icon = <Plus className="h-3 w-3" />;
    }
    
    return (
      <div
        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-white text-xs font-medium mr-2 ${isDragging ? 'opacity-50 cursor-grabbing' : 'cursor-grab hover:shadow-lg'}`}
        style={{ backgroundColor: bgColor }}
      >
        <GripVertical className="h-3 w-3 opacity-60" />
        {icon}
        <span>{label}</span>
      </div>
    );
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4CAF50]"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background" data-testid="dashboard-page">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="Logo" className="h-10" />
            <h1 className="text-lg font-semibold hidden md:block">Gestion des horaires</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden md:inline">{admin?.name}</span>
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="px-4 pb-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-7 w-full max-w-3xl">
              <TabsTrigger value="schedule"><Calendar className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Horaires</span></TabsTrigger>
              <TabsTrigger value="employees"><Users className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Employés</span></TabsTrigger>
              <TabsTrigger value="schools"><School className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Écoles</span></TabsTrigger>
              <TabsTrigger value="assignments"><ClipboardList className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Assignations</span></TabsTrigger>
              <TabsTrigger value="absences"><UserX className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Absences</span></TabsTrigger>
              <TabsTrigger value="holidays"><CalendarOff className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Jours fériés</span></TabsTrigger>
              <TabsTrigger value="reports"><FileText className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Rapports</span></TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>
      
      <main className="p-4" ref={containerRef}>
        {activeTab === 'schedule' && (
          <>
            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPreviousWeek}><ChevronLeft className="h-4 w-4" /></Button>
                <div className="flex gap-1">
                  {weekDates.map(date => (
                    <Button 
                      key={date} 
                      variant={date === selectedDate ? 'default' : 'outline'} 
                      size="sm" 
                      onClick={() => handleDateClick(date)} 
                      className={date === selectedDate ? 'bg-[#4CAF50] hover:bg-[#43A047]' : ''}
                    >
                      {formatDate(date)}
                    </Button>
                  ))}
                </div>
                <Button variant="outline" size="icon" onClick={goToNextWeek}><ChevronRight className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={goToToday} className="ml-2"><CalendarDays className="h-4 w-4 mr-1" />Aujourd'hui</Button>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild><Button variant="outline" size="icon"><Calendar className="h-4 w-4" /></Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent mode="single" selected={new Date(selectedDate + 'T12:00:00')} onSelect={handleCalendarSelect} disabled={(date) => date.getDay() === 0 || date.getDay() === 6} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={toggleSortMode}><ArrowUpDown className="h-4 w-4 mr-1" />{sortMode === 'circuit' ? 'Tri: Circuit' : 'Tri: Nom'}</Button>
                <div className="flex rounded-md border border-input overflow-hidden">
                  <button className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'detailed' ? 'bg-[#4CAF50] text-white' : 'bg-background hover:bg-muted'}`} onClick={() => setViewMode('detailed')}>Détaillé</button>
                  <button className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-input ${viewMode === 'complete' ? 'bg-[#4CAF50] text-white' : 'bg-background hover:bg-muted'}`} onClick={() => setViewMode('complete')}>Complet</button>
                  <button className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-input ${viewMode === 'abbreviated' ? 'bg-[#4CAF50] text-white' : 'bg-background hover:bg-muted'}`} onClick={() => setViewMode('abbreviated')}>Abrégé</button>
                </div>
                <Button onClick={() => setShowTempTaskModal(true)} className="bg-[#4CAF50] hover:bg-[#43A047]"><Plus className="h-4 w-4 mr-1" />Tâche temp.</Button>
              </div>
            </div>

            {/* Schedule Grid with DnD */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                {/* Header */}
                <div className="flex border-b-2 border-border bg-muted/70">
                  <div className="flex-shrink-0 flex" style={{ width: FIXED_LEFT_WIDTH }}>
                    <div className="font-semibold text-sm px-2 py-2 border-r border-border flex items-center" style={{ width: DRIVER_COL_WIDTH }}>Conducteur</div>
                    <div className="font-semibold text-sm px-1 py-2 border-r-2 border-border flex items-center justify-center" style={{ width: CIRCUIT_COL_WIDTH }}>Circuit</div>
                  </div>
                  <div className="flex-1 overflow-x-auto" style={{ minWidth: 0 }}>
                    <div className="relative h-10" style={{ width: totalScheduleWidth }}>
                      {timeMarkers.map((marker, idx) => (
                        <div key={marker.hour} className="absolute top-0 h-full flex items-center border-l border-border/70" style={{ left: marker.position, width: idx < timeMarkers.length - 1 ? pixelsPerHour : 'auto' }}>
                          <span className="pl-1 text-xs font-semibold">{marker.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex" style={{ width: FIXED_RIGHT_WIDTH }}>
                    <div className="font-semibold text-xs px-1 py-2 border-l-2 border-border flex items-center justify-center" style={{ width: DAY_HOURS_COL_WIDTH }}>Jour</div>
                    <div className="font-semibold text-xs px-1 py-2 border-l border-border flex items-center justify-center" style={{ width: WEEK_HOURS_COL_WIDTH }}>Semaine</div>
                  </div>
                </div>

                {/* Replacement Row - Fixed at top */}
                <DroppableRow id="replacement-row" employeeId={null} isReplacement={true}>
                  <div className="flex-shrink-0 flex bg-amber-50 dark:bg-amber-950/30" style={{ width: FIXED_LEFT_WIDTH }}>
                    <div className="px-2 border-r border-border flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300" style={{ width: DRIVER_COL_WIDTH }}>
                      <AlertTriangle className="h-4 w-4" />
                      Remplacement(s)
                      {unassignedItems.length > 0 && <Badge className="bg-amber-500 text-white text-xs">{unassignedItems.length}</Badge>}
                    </div>
                    <div className="px-1 border-r-2 border-border flex items-center justify-center" style={{ width: CIRCUIT_COL_WIDTH }}>-</div>
                  </div>
                  <div className="flex-1 overflow-x-auto py-1 px-2" style={{ minWidth: 0 }}>
                    <div className="flex items-center h-full" style={{ minWidth: totalScheduleWidth }}>
                      {unassignedItems.map(item => (
                        <DraggableBlock key={item.id} id={item.id} data={item}>
                          {(isDragging) => renderUnassignedItem(item, isDragging)}
                        </DraggableBlock>
                      ))}
                      {unassignedItems.length === 0 && (
                        <span className="text-sm text-muted-foreground">Aucun remplacement requis</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex bg-amber-50 dark:bg-amber-950/30" style={{ width: FIXED_RIGHT_WIDTH }}>
                    <div className="px-1 border-l-2 border-border flex items-center justify-center" style={{ width: DAY_HOURS_COL_WIDTH }}>-</div>
                    <div className="px-1 border-l border-border flex items-center justify-center" style={{ width: WEEK_HOURS_COL_WIDTH }}>-</div>
                  </div>
                </DroppableRow>

                {/* Body */}
                <div className="max-h-[calc(100vh-400px)] overflow-auto">
                  {sortedEmployees.map((emp) => {
                    const empSchedule = scheduleData.find(s => s.employee?.id === emp.id);
                    const dailyMinutes = empSchedule?.daily_hours?.[selectedDate] || 0;
                    const weeklyMinutes = empSchedule?.weekly_total || 0;
                    const isAbsent = isEmployeeAbsent(emp.id);
                    
                    // Get assignments for this employee (including daily overrides)
                    const dayAssignments = isAbsent ? [] : assignments.filter(a => {
                      if (!(a.start_date <= selectedDate && a.end_date >= selectedDate)) return false;
                      // Check if any shift/block is assigned to this employee (original or overridden)
                      return a.shifts?.some(shift => {
                        if (shift.is_admin) {
                          return getEffectiveEmployeeId(a, shift.id, null) === emp.id;
                        }
                        return shift.blocks?.some(block => getEffectiveEmployeeId(a, shift.id, block.id) === emp.id);
                      });
                    });
                    
                    const dayTasks = isAbsent ? [] : tempTasks.filter(t => t.employee_id === emp.id && t.date === selectedDate);
                    
                    const isOvertime = weeklyMinutes > 39 * 60;
                    const isUndertime = weeklyMinutes < 15 * 60 && weeklyMinutes > 0;
                    
                    return (
                      <DroppableRow key={emp.id} id={`employee-${emp.id}`} employeeId={emp.id}>
                        <div className="flex-shrink-0 flex bg-background" style={{ width: FIXED_LEFT_WIDTH }}>
                          <div className={`px-2 border-r border-border flex items-center gap-1 ${isAbsent ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`} style={{ width: DRIVER_COL_WIDTH }}>
                            <span className={`font-medium text-sm truncate ${isAbsent ? 'text-red-600 dark:text-red-400' : ''}`}>{emp.name}</span>
                            {isAbsent && <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">ABS</Badge>}
                          </div>
                          <div className={`px-1 border-r-2 border-border flex items-center justify-center gap-1 ${isAbsent ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`} style={{ width: CIRCUIT_COL_WIDTH }}>
                            <span className="text-xs text-muted-foreground font-medium">{dayAssignments.map(a => a.circuit_number).join(', ') || '-'}</span>
                            {dayAssignments.some(a => a.is_adapted) && <Accessibility className="h-3 w-3 text-blue-600 flex-shrink-0" />}
                          </div>
                        </div>
                        
                        <div className="flex-1 overflow-x-auto" style={{ minWidth: 0 }}>
                          <div className="relative h-full" style={{ width: totalScheduleWidth }}>
                            {timeMarkers.map((marker) => (
                              <div key={marker.hour} className="absolute top-0 bottom-0 border-l border-border/40" style={{ left: marker.position }} />
                            ))}
                            
                            {/* Assignment blocks */}
                            {dayAssignments.map(assignment => 
                              assignment.shifts?.map(shift => {
                                if (shift.is_admin) {
                                  const effectiveEmpId = getEffectiveEmployeeId(assignment, shift.id, null);
                                  if (effectiveEmpId !== emp.id) return null;
                                  return (
                                    <DraggableBlock
                                      key={`${assignment.id}-${shift.id}`}
                                      id={`${assignment.id}-${shift.id}`}
                                      data={{ type: 'assignment', assignment, shift, block: null }}
                                    >
                                      {(isDragging) => renderBlock(assignment, shift, null, isDragging, effectiveEmpId)}
                                    </DraggableBlock>
                                  );
                                }
                                return shift.blocks?.map(block => {
                                  const effectiveEmpId = getEffectiveEmployeeId(assignment, shift.id, block.id);
                                  if (effectiveEmpId !== emp.id) return null;
                                  return (
                                    <DraggableBlock
                                      key={`${assignment.id}-${shift.id}-${block.id}`}
                                      id={`${assignment.id}-${shift.id}-${block.id}`}
                                      data={{ type: 'assignment', assignment, shift, block }}
                                    >
                                      {(isDragging) => renderBlock(assignment, shift, block, isDragging, effectiveEmpId)}
                                    </DraggableBlock>
                                  );
                                });
                              })
                            )}
                            
                            {/* Task blocks */}
                            {dayTasks.map(task => (
                              <DraggableBlock key={`task-${task.id}`} id={`task-${task.id}`} data={{ type: 'task', task }}>
                                {(isDragging) => renderTaskBlock(task, isDragging)}
                              </DraggableBlock>
                            ))}
                            
                            {isAbsent && (
                              <div className="absolute inset-0 flex items-center justify-center bg-red-100/30 dark:bg-red-900/20">
                                <span className="text-red-500 text-xs font-medium bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded">Absent</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex-shrink-0 flex bg-background" style={{ width: FIXED_RIGHT_WIDTH }}>
                          <div className={`px-1 border-l-2 border-border flex items-center justify-center tabular-nums text-xs ${isAbsent ? 'bg-red-50/50 dark:bg-red-950/20 text-muted-foreground' : ''}`} style={{ width: DAY_HOURS_COL_WIDTH }}>
                            {isAbsent ? '-' : formatHoursMinutes(dailyMinutes)}
                          </div>
                          <div className={`px-1 border-l border-border flex items-center justify-center gap-0.5 ${isAbsent ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`} style={{ width: WEEK_HOURS_COL_WIDTH }}>
                            <span className="tabular-nums text-xs font-medium">{formatHoursMinutes(weeklyMinutes)}</span>
                            {isOvertime && <AlertTriangle className="h-3 w-3 text-red-500" />}
                            {isUndertime && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                          </div>
                        </div>
                      </DroppableRow>
                    );
                  })}
                  {sortedEmployees.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">Aucun employé.</div>
                  )}
                </div>
              </div>
              
              {/* Drag Overlay */}
              <DragOverlay>
                {activeId && activeDragData && (
                  <div className="bg-[#4CAF50] text-white px-4 py-2 rounded-lg shadow-2xl font-medium text-sm flex items-center gap-2">
                    <GripVertical className="h-4 w-4" />
                    {activeDragData.type === 'assignment' 
                      ? `Circuit ${activeDragData.assignment.circuit_number}` 
                      : activeDragData.type === 'task'
                        ? activeDragData.task?.name
                        : activeDragData.data?.circuit_number || activeDragData.data?.name}
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </>
        )}
        
        {activeTab === 'employees' && <EmployeesPage employees={employees} onUpdate={fetchData} />}
        {activeTab === 'schools' && <SchoolsPage schools={schools} onUpdate={fetchData} />}
        {activeTab === 'assignments' && <AssignmentsPage assignments={assignments} employees={employees} schools={schools} onUpdate={fetchData} />}
        {activeTab === 'absences' && <AbsencesPage absences={absences} employees={employees} onUpdate={fetchData} />}
        {activeTab === 'holidays' && <HolidaysPage holidays={holidays} onUpdate={fetchData} />}
        {activeTab === 'reports' && <ReportsPage employees={employees} />}
      </main>
      
      <TemporaryTaskModal open={showTempTaskModal} onClose={() => setShowTempTaskModal(false)} onSuccess={handleTempTaskCreated} employees={employees} schools={schools} selectedDate={selectedDate} />
    </div>
  );
}
