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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { 
  Sun, Moon, LogOut, ChevronLeft, ChevronRight, Calendar,
  Users, School, Settings, FileText, Plus, AlertTriangle,
  Bus, UserX, Info, CalendarDays, ArrowUpDown, Accessibility, GripVertical
} from 'lucide-react';
import { toast } from 'sonner';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors, useDroppable, useDraggable } from '@dnd-kit/core';

import EmployeesPage from './EmployeesPage';
import SchoolsPage from './SchoolsPage';
import AssignmentsPage from './AssignmentsPage';
import AbsencesPage from './AbsencesPage';
import HolidaysPage from './HolidaysPage';
import ReportsPage from './ReportsPage';
import TemporaryTaskModal from '../components/TemporaryTaskModal';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_route-manager-27/artifacts/sd598o43_LogoBerlinesTAB.png';

// Time configuration
const SCHEDULE_START_HOUR = 5;
const SCHEDULE_END_HOUR = 19;
const TOTAL_HOURS = SCHEDULE_END_HOUR - SCHEDULE_START_HOUR;

// Column widths
const DRIVER_COL_WIDTH = 200;
const CIRCUIT_COL_WIDTH = 70;
const DAY_HOURS_COL_WIDTH = 60;
const WEEK_HOURS_COL_WIDTH = 80;
const FIXED_LEFT_WIDTH = DRIVER_COL_WIDTH + CIRCUIT_COL_WIDTH;
const FIXED_RIGHT_WIDTH = DAY_HOURS_COL_WIDTH + WEEK_HOURS_COL_WIDTH;
const ROW_HEIGHT = 36;

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

// Draggable Assignment Block
const DraggableBlock = ({ assignment, shift, block, viewMode, pixelsPerHour, selectedDate }) => {
  const dragId = `${assignment.id}-${shift.id}-${block?.id || 'main'}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { type: 'assignment', assignment, shift, block }
  });

  const scheduleStartMinutes = SCHEDULE_START_HOUR * 60;
  const dayLetter = getDayLetter(selectedDate);
  
  // Check if block applies to this day
  if (block?.days && !block.days.includes(dayLetter)) return null;
  
  let startMinutes, endMinutes, bgColor, label;
  
  if (shift.is_admin) {
    startMinutes = 6 * 60;
    endMinutes = startMinutes + (shift.admin_hours || 8) * 60;
    bgColor = shift.name === 'MECANO' ? '#795548' : '#607D8B';
    label = shift.name;
  } else if (block) {
    startMinutes = timeToMinutes(block.start_time) - (block.hlp_before || 0);
    endMinutes = timeToMinutes(block.end_time) + (block.hlp_after || 0);
    bgColor = block.school_color || '#9E9E9E';
    label = block.school_name || 'École';
  } else {
    return null;
  }
  
  const left = ((startMinutes - scheduleStartMinutes) / 60) * pixelsPerHour;
  const width = ((endMinutes - startMinutes) / 60) * pixelsPerHour;
  const textColor = getContrastColor(bgColor);
  
  const style = {
    position: 'absolute',
    left: Math.max(0, left),
    width: Math.max(40, width),
    top: 3,
    height: ROW_HEIGHT - 6,
    backgroundColor: bgColor,
    color: textColor,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
    cursor: 'grab',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className="rounded text-[10px] flex items-center gap-1 px-1 overflow-hidden border border-black/20 font-medium hover:shadow-lg transition-shadow select-none"
            style={style}
          >
            <GripVertical className="h-3 w-3 flex-shrink-0 opacity-50" />
            <span className="truncate">{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-xs space-y-1">
            <div className="font-bold">Circuit {assignment.circuit_number} - {shift.name}</div>
            {block && <div>École: {block.school_name}</div>}
            {block && <div>Horaire: {block.start_time} - {block.end_time}</div>}
            <div className="text-muted-foreground mt-1">Glissez pour réassigner</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Droppable Row
const DroppableRow = ({ employeeId, children, isOver }) => {
  const { setNodeRef } = useDroppable({ id: employeeId });
  
  return (
    <div 
      ref={setNodeRef} 
      className={`relative h-full transition-colors ${isOver ? 'bg-green-100 dark:bg-green-900/30' : ''}`}
    >
      {children}
    </div>
  );
};

// Temporary Task Block (also draggable)
const DraggableTask = ({ task, pixelsPerHour }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: { type: 'task', task }
  });

  const scheduleStartMinutes = SCHEDULE_START_HOUR * 60;
  const startMinutes = timeToMinutes(task.start_time);
  const endMinutes = timeToMinutes(task.end_time);
  
  const left = ((startMinutes - scheduleStartMinutes) / 60) * pixelsPerHour;
  const width = ((endMinutes - startMinutes) / 60) * pixelsPerHour;
  const bgColor = task.school_color || '#FF69B4';
  const textColor = getContrastColor(bgColor);

  const style = {
    position: 'absolute',
    left: Math.max(0, left),
    width: Math.max(40, width),
    top: 3,
    height: ROW_HEIGHT - 6,
    backgroundColor: bgColor,
    color: textColor,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
    cursor: 'grab',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className="rounded text-[10px] flex items-center gap-1 px-1 overflow-hidden border-2 border-dashed font-medium hover:shadow-lg transition-shadow select-none"
            style={style}
          >
            <GripVertical className="h-3 w-3 flex-shrink-0 opacity-50" />
            <span className="truncate">{task.name}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-xs">
            <div className="font-bold">{task.name}</div>
            <div>Horaire: {task.start_time} - {task.end_time}</div>
            <div className="text-muted-foreground mt-1">Glissez pour réassigner</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Replacements Section
const ReplacementsSection = ({ replacements, onAssign, selectedDate }) => {
  const { unassigned_assignments = [], unassigned_tasks = [], absent_items = [] } = replacements || {};
  const todayAbsentItems = absent_items.filter(item => item.date === selectedDate);
  const totalReplacements = unassigned_assignments.length + unassigned_tasks.length + todayAbsentItems.length;
  
  return (
    <div 
      className={`mb-3 p-3 rounded-lg border-2 shadow-sm ${totalReplacements > 0 ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/50' : 'border-green-300 bg-green-50 dark:bg-green-950/50'}`}
      data-testid="replacements-section"
    >
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-full ${totalReplacements > 0 ? 'bg-amber-200 dark:bg-amber-800' : 'bg-green-200 dark:bg-green-800'}`}>
          {totalReplacements > 0 ? <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" /> : <Info className="h-4 w-4 text-green-700 dark:text-green-300" />}
        </div>
        <span className={`font-semibold text-sm ${totalReplacements > 0 ? 'text-amber-900 dark:text-amber-100' : 'text-green-900 dark:text-green-100'}`}>
          {totalReplacements > 0 ? `${totalReplacements} remplacement(s) requis` : 'Aucun remplacement requis'}
        </span>
        {totalReplacements > 0 && <Badge className="bg-amber-500 text-white px-2">{totalReplacements}</Badge>}
      </div>
      {totalReplacements > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {unassigned_assignments.map(a => (
            <Badge key={a.id} variant="outline" className="cursor-pointer text-xs bg-white dark:bg-gray-800 hover:bg-amber-100 border-amber-400" onClick={() => onAssign(a, 'assignment')}>
              <Bus className="h-3 w-3 mr-1" />{a.circuit_number}
            </Badge>
          ))}
          {unassigned_tasks.map(t => (
            <Badge key={t.id} variant="outline" className="cursor-pointer text-xs bg-white dark:bg-gray-800 hover:bg-amber-100 border-dashed border-amber-400" onClick={() => onAssign(t, 'task')}>
              {t.name}
            </Badge>
          ))}
          {todayAbsentItems.map((item, idx) => (
            <Badge key={`absent-${idx}`} variant="outline" className="cursor-pointer text-xs bg-red-50 dark:bg-red-900/30 hover:bg-red-100 border-red-400" onClick={() => onAssign(item.data, 'assignment')}>
              <UserX className="h-3 w-3 mr-1" />{item.data.circuit_number}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

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
  
  const [loading, setLoading] = useState(true);
  const [showTempTaskModal, setShowTempTaskModal] = useState(false);
  
  // Drag and drop state
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [overEmployeeId, setOverEmployeeId] = useState(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignData, setReassignData] = useState(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  
  const topScrollRef = useRef(null);
  const bottomScrollRef = useRef(null);
  const headerScrollRef = useRef(null);
  const bodyScrollRef = useRef(null);
  const containerRef = useRef(null);
  
  const [pixelsPerHour, setPixelsPerHour] = useState(80);
  const totalScheduleWidth = useMemo(() => TOTAL_HOURS * pixelsPerHour, [pixelsPerHour]);
  const timeMarkers = useMemo(() => generateTimeMarkers(pixelsPerHour), [pixelsPerHour]);
  
  useEffect(() => {
    const calculateWidth = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const availableWidth = containerWidth - FIXED_LEFT_WIDTH - FIXED_RIGHT_WIDTH - 40;
        const calculatedPixelsPerHour = Math.max(75, (availableWidth / TOTAL_HOURS) * 1.25);
        setPixelsPerHour(calculatedPixelsPerHour);
      }
    };
    calculateWidth();
    window.addEventListener('resize', calculateWidth);
    return () => window.removeEventListener('resize', calculateWidth);
  }, []);
  
  const handleScroll = (source) => (e) => {
    const scrollLeft = e.target.scrollLeft;
    [topScrollRef, bottomScrollRef, headerScrollRef, bodyScrollRef].forEach(ref => {
      if (ref.current && ref.current !== e.target) ref.current.scrollLeft = scrollLeft;
    });
  };
  
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
  
  const goToPreviousWeek = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 7); setSelectedDate(d.toISOString().split('T')[0]); };
  const goToNextWeek = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 7); setSelectedDate(d.toISOString().split('T')[0]); };
  const goToToday = () => {
    const today = new Date();
    const day = today.getDay();
    if (day === 0) today.setDate(today.getDate() + 1);
    if (day === 6) today.setDate(today.getDate() + 2);
    setSelectedDate(today.toISOString().split('T')[0]);
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
  
  // Drag and Drop handlers
  const handleDragStart = (event) => {
    setActiveDragItem(event.active.data.current);
  };
  
  const handleDragOver = (event) => {
    const { over } = event;
    if (over) {
      setOverEmployeeId(over.id);
    } else {
      setOverEmployeeId(null);
    }
  };
  
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragItem(null);
    setOverEmployeeId(null);
    
    if (!over || !active.data.current) return;
    
    const dragData = active.data.current;
    const targetEmployeeId = over.id;
    
    // Don't do anything if dropped on same employee
    if (dragData.type === 'assignment' && dragData.assignment.employee_id === targetEmployeeId) return;
    if (dragData.type === 'task' && dragData.task.employee_id === targetEmployeeId) return;
    
    // Open confirmation modal
    setReassignData({
      dragData,
      targetEmployeeId,
      targetEmployee: employees.find(e => e.id === targetEmployeeId)
    });
    setShowReassignModal(true);
  };
  
  const handleConfirmReassign = async () => {
    if (!reassignData) return;
    
    const { dragData, targetEmployeeId, targetEmployee } = reassignData;
    
    try {
      if (dragData.type === 'assignment') {
        // Reassign the assignment to new employee
        await api.put(`/assignments/${dragData.assignment.id}`, {
          ...dragData.assignment,
          employee_id: targetEmployeeId
        });
        toast.success(`Circuit ${dragData.assignment.circuit_number} réassigné à ${targetEmployee.name}`);
      } else if (dragData.type === 'task') {
        // Reassign temporary task
        await api.put(`/temporary-tasks/${dragData.task.id}`, {
          ...dragData.task,
          employee_id: targetEmployeeId
        });
        toast.success(`Tâche "${dragData.task.name}" réassignée à ${targetEmployee.name}`);
      }
      
      setShowReassignModal(false);
      setReassignData(null);
      fetchData();
    } catch (error) {
      console.error('Error reassigning:', error);
      toast.error('Erreur lors de la réassignation');
    }
  };
  
  const handleAssign = (item, type) => {
    toast.info('Utilisez le glisser-déposer pour assigner un conducteur');
  };
  
  const handleTempTaskCreated = () => {
    setShowTempTaskModal(false);
    fetchData();
    toast.success('Tâche temporaire créée');
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
            <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="theme-toggle">
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="logout-button">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="px-4 pb-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-7 w-full max-w-3xl">
              <TabsTrigger value="schedule" className="flex items-center gap-1"><Calendar className="h-4 w-4" /><span className="hidden sm:inline">Horaires</span></TabsTrigger>
              <TabsTrigger value="employees" className="flex items-center gap-1"><Users className="h-4 w-4" /><span className="hidden sm:inline">Employés</span></TabsTrigger>
              <TabsTrigger value="schools" className="flex items-center gap-1"><School className="h-4 w-4" /><span className="hidden sm:inline">Écoles</span></TabsTrigger>
              <TabsTrigger value="assignments" className="flex items-center gap-1"><Bus className="h-4 w-4" /><span className="hidden sm:inline">Assignations</span></TabsTrigger>
              <TabsTrigger value="absences" className="flex items-center gap-1"><UserX className="h-4 w-4" /><span className="hidden sm:inline">Absences</span></TabsTrigger>
              <TabsTrigger value="holidays" className="flex items-center gap-1"><Settings className="h-4 w-4" /><span className="hidden sm:inline">Jours fériés</span></TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-1"><FileText className="h-4 w-4" /><span className="hidden sm:inline">Rapports</span></TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>
      
      <main className="p-4" ref={containerRef}>
        {activeTab === 'schedule' && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPreviousWeek}><ChevronLeft className="h-4 w-4" /></Button>
                <div className="flex gap-1">
                  {weekDates.map(date => (
                    <Button key={date} variant={date === selectedDate ? 'default' : 'outline'} size="sm" onClick={() => setSelectedDate(date)} className={date === selectedDate ? 'bg-[#4CAF50] hover:bg-[#43A047]' : ''}>
                      {formatDate(date)}
                    </Button>
                  ))}
                </div>
                <Button variant="outline" size="icon" onClick={goToNextWeek}><ChevronRight className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={goToToday} className="ml-2" data-testid="today-btn"><CalendarDays className="h-4 w-4 mr-1" />Aujourd'hui</Button>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild><Button variant="outline" size="icon"><Calendar className="h-4 w-4" /></Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent mode="single" selected={new Date(selectedDate)} onSelect={handleCalendarSelect} disabled={(date) => date.getDay() === 0 || date.getDay() === 6} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={toggleSortMode} data-testid="sort-toggle-btn"><ArrowUpDown className="h-4 w-4 mr-1" />{sortMode === 'circuit' ? 'Tri: Circuit' : 'Tri: Nom'}</Button>
                <div className="flex rounded-md border border-input overflow-hidden">
                  {['detailed', 'complete', 'abbreviated'].map((mode, idx) => (
                    <button key={mode} className={`px-3 py-1.5 text-sm font-medium transition-colors ${idx > 0 ? 'border-l border-input' : ''} ${viewMode === mode ? 'bg-[#4CAF50] text-white' : 'bg-background hover:bg-muted'}`} onClick={() => setViewMode(mode)}>
                      {mode === 'detailed' ? 'Détaillé' : mode === 'complete' ? 'Complet' : 'Abrégé'}
                    </button>
                  ))}
                </div>
                <Button onClick={() => setShowTempTaskModal(true)} className="bg-[#4CAF50] hover:bg-[#43A047]" data-testid="add-temp-task-btn"><Plus className="h-4 w-4 mr-1" />Tâche temp.</Button>
              </div>
            </div>

            <ReplacementsSection replacements={replacements} onAssign={handleAssign} selectedDate={selectedDate} />

            {/* Drag instruction */}
            <div className="mb-2 text-sm text-muted-foreground flex items-center gap-2">
              <GripVertical className="h-4 w-4" />
              <span>Glissez-déposez les blocs pour réassigner à un autre conducteur</span>
            </div>

            {/* Schedule Grid */}
            <div className="border border-border rounded-lg overflow-hidden bg-card">
              {/* Top scrollbar */}
              <div className="flex border-b border-border bg-muted/30">
                <div style={{ width: FIXED_LEFT_WIDTH }} className="flex-shrink-0" />
                <div ref={topScrollRef} className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin" onScroll={handleScroll('top')} style={{ minWidth: 0, height: 12 }}>
                  <div style={{ width: totalScheduleWidth, height: 1 }} />
                </div>
                <div style={{ width: FIXED_RIGHT_WIDTH }} className="flex-shrink-0" />
              </div>

              {/* Header */}
              <div className="flex border-b-2 border-border bg-muted/70">
                <div className="flex-shrink-0 flex" style={{ width: FIXED_LEFT_WIDTH }}>
                  <div className="font-semibold text-sm px-2 py-2 border-r border-border flex items-center" style={{ width: DRIVER_COL_WIDTH }}>Conducteur</div>
                  <div className="font-semibold text-sm px-1 py-2 border-r-2 border-border flex items-center justify-center" style={{ width: CIRCUIT_COL_WIDTH }}>Circuit</div>
                </div>
                <div ref={headerScrollRef} className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-none" onScroll={handleScroll('header')} style={{ minWidth: 0 }}>
                  <div className="relative h-9" style={{ width: totalScheduleWidth }}>
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

              {/* Body */}
              <div ref={bodyScrollRef} className="max-h-[calc(100vh-420px)] overflow-auto" onScroll={handleScroll('body')}>
                {sortedEmployees.map((emp) => {
                  const empSchedule = scheduleData.find(s => s.employee?.id === emp.id);
                  const dailyMinutes = empSchedule?.daily_hours?.[selectedDate] || 0;
                  const weeklyMinutes = empSchedule?.weekly_total || 0;
                  const isAbsent = isEmployeeAbsent(emp.id);
                  const isDropTarget = overEmployeeId === emp.id;
                  
                  const dayAssignments = isAbsent ? [] : assignments.filter(a => a.employee_id === emp.id && a.start_date <= selectedDate && a.end_date >= selectedDate);
                  const dayTasks = isAbsent ? [] : tempTasks.filter(t => t.employee_id === emp.id && t.date === selectedDate);
                  
                  const isOvertime = weeklyMinutes > 39 * 60;
                  const isUndertime = weeklyMinutes < 15 * 60 && weeklyMinutes > 0;
                  
                  return (
                    <div key={emp.id} className={`flex border-b border-border transition-colors ${isAbsent ? 'bg-red-50/50 dark:bg-red-950/20' : isDropTarget ? 'bg-green-100 dark:bg-green-900/30' : 'hover:bg-muted/30'}`} style={{ height: ROW_HEIGHT }} data-testid={`schedule-row-${emp.id}`}>
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
                      
                      <DroppableRow employeeId={emp.id} isOver={isDropTarget}>
                        <div className="flex-1 overflow-hidden" style={{ minWidth: 0 }}>
                          <div className="relative h-full" style={{ width: totalScheduleWidth }}>
                            {timeMarkers.map((marker) => <div key={marker.hour} className="absolute top-0 bottom-0 border-l border-border/40" style={{ left: marker.position }} />)}
                            
                            {dayAssignments.map(assignment => 
                              assignment.shifts?.map(shift => 
                                shift.is_admin ? (
                                  <DraggableBlock key={`${assignment.id}-${shift.id}`} assignment={assignment} shift={shift} block={null} viewMode={viewMode} pixelsPerHour={pixelsPerHour} selectedDate={selectedDate} />
                                ) : (
                                  shift.blocks?.map(block => (
                                    <DraggableBlock key={`${assignment.id}-${shift.id}-${block.id}`} assignment={assignment} shift={shift} block={block} viewMode={viewMode} pixelsPerHour={pixelsPerHour} selectedDate={selectedDate} />
                                  ))
                                )
                              )
                            )}
                            
                            {dayTasks.map(task => <DraggableTask key={task.id} task={task} pixelsPerHour={pixelsPerHour} />)}
                            
                            {isAbsent && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-red-500 text-xs font-medium bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded">Absent</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </DroppableRow>
                      
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
                    </div>
                  );
                })}
                {sortedEmployees.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">Aucun employé. Ajoutez des employés dans l'onglet "Employés".</div>
                )}
              </div>

              {/* Bottom scrollbar */}
              <div className="flex border-t border-border bg-muted/30">
                <div style={{ width: FIXED_LEFT_WIDTH }} className="flex-shrink-0" />
                <div ref={bottomScrollRef} className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin" onScroll={handleScroll('bottom')} style={{ minWidth: 0, height: 12 }}>
                  <div style={{ width: totalScheduleWidth, height: 1 }} />
                </div>
                <div style={{ width: FIXED_RIGHT_WIDTH }} className="flex-shrink-0" />
              </div>
            </div>
            
            {/* Drag Overlay */}
            <DragOverlay>
              {activeDragItem && (
                <div className="bg-primary text-primary-foreground px-3 py-2 rounded shadow-lg text-sm font-medium">
                  {activeDragItem.type === 'assignment' ? `Circuit ${activeDragItem.assignment.circuit_number}` : activeDragItem.task?.name}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
        
        {activeTab === 'employees' && <EmployeesPage employees={employees} onUpdate={fetchData} />}
        {activeTab === 'schools' && <SchoolsPage schools={schools} onUpdate={fetchData} />}
        {activeTab === 'assignments' && <AssignmentsPage assignments={assignments} employees={employees} schools={schools} onUpdate={fetchData} />}
        {activeTab === 'absences' && <AbsencesPage absences={absences} employees={employees} onUpdate={fetchData} />}
        {activeTab === 'holidays' && <HolidaysPage holidays={holidays} onUpdate={fetchData} />}
        {activeTab === 'reports' && <ReportsPage employees={employees} />}
      </main>
      
      <TemporaryTaskModal open={showTempTaskModal} onClose={() => setShowTempTaskModal(false)} onSuccess={handleTempTaskCreated} employees={employees} schools={schools} selectedDate={selectedDate} />
      
      {/* Reassign Confirmation Modal */}
      <Dialog open={showReassignModal} onOpenChange={setShowReassignModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la réassignation</DialogTitle>
            <DialogDescription>
              {reassignData?.dragData?.type === 'assignment' 
                ? `Réassigner le circuit ${reassignData?.dragData?.assignment?.circuit_number} à ${reassignData?.targetEmployee?.name}?`
                : `Réassigner la tâche "${reassignData?.dragData?.task?.name}" à ${reassignData?.targetEmployee?.name}?`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Note:</strong> Cette action va modifier l'assignation de façon permanente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReassignModal(false)}>Annuler</Button>
            <Button onClick={handleConfirmReassign} className="bg-[#4CAF50] hover:bg-[#43A047]">Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
