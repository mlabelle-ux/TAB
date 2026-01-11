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
import { ScrollArea, ScrollBar } from '../components/ui/scroll-area';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter 
} from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar as CalendarComponent } from '../components/ui/calendar';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '../components/ui/select';
import { Label } from '../components/ui/label';
import { 
  Sun, Moon, LogOut, ChevronLeft, ChevronRight, Calendar,
  Users, School, Settings, FileText, Plus, AlertTriangle,
  Bus, UserX, Info, CalendarDays, ArrowUpDown, Accessibility, GripVertical
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
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

// Time configuration - 5h00 à 18h59
const SCHEDULE_START_HOUR = 5;
const SCHEDULE_END_HOUR = 19; // 19h00 = 18h59 max
const TOTAL_HOURS = SCHEDULE_END_HOUR - SCHEDULE_START_HOUR; // 14 heures

// Column widths - Conducteur élargi
const DRIVER_COL_WIDTH = 200;
const CIRCUIT_COL_WIDTH = 70;
const DAY_HOURS_COL_WIDTH = 60;
const WEEK_HOURS_COL_WIDTH = 80;
const FIXED_LEFT_WIDTH = DRIVER_COL_WIDTH + CIRCUIT_COL_WIDTH;
const FIXED_RIGHT_WIDTH = DAY_HOURS_COL_WIDTH + WEEK_HOURS_COL_WIDTH;

// Row height - réduite d'un tiers
const ROW_HEIGHT = 36;

// Generate time markers dynamically
const generateTimeMarkers = (pixelsPerHour) => {
  const markers = [];
  for (let h = SCHEDULE_START_HOUR; h < SCHEDULE_END_HOUR; h++) {
    markers.push({ 
      hour: h, 
      label: `${h}h`, 
      position: (h - SCHEDULE_START_HOUR) * pixelsPerHour 
    });
  }
  return markers;
};

// Block with tooltip - now accepts pixelsPerHour as prop
const ScheduleBlock = ({ block, viewMode, showHlpInColor = false, pixelsPerHour, totalScheduleWidth }) => {
  const startMinutes = timeToMinutes(block.start_time);
  const endMinutes = timeToMinutes(block.end_time);
  const scheduleStartMinutes = SCHEDULE_START_HOUR * 60;
  
  const hlpBeforeMinutes = block.hlp_before || 0;
  const hlpAfterMinutes = block.hlp_after || 0;
  
  // Position with HLP included for "complete" view
  const effectiveStart = showHlpInColor ? startMinutes - hlpBeforeMinutes : startMinutes;
  const effectiveEnd = showHlpInColor ? endMinutes + hlpAfterMinutes : endMinutes;
  
  const left = ((effectiveStart - scheduleStartMinutes) / 60) * pixelsPerHour;
  const width = ((effectiveEnd - effectiveStart) / 60) * pixelsPerHour;
  
  if (left + width < 0 || left > totalScheduleWidth) return null;
  
  const bgColor = block.school_color || '#9E9E9E';
  const textColor = getContrastColor(bgColor);
  
  const tooltipContent = (
    <div className="text-xs space-y-1">
      <div className="font-bold">{block.school_name || 'École'}</div>
      <div>Horaire: {block.start_time} - {block.end_time}</div>
      {block.hlp_before > 0 && <div>HLP avant: {block.hlp_before} min</div>}
      {block.hlp_after > 0 && <div>HLP après: {block.hlp_after} min</div>}
      {block.days && <div>Jours: {block.days.join(', ')}</div>}
    </div>
  );
  
  // Mode détaillé: HLP séparés
  if (viewMode === 'detailed' && !showHlpInColor) {
    const hlpBeforeWidth = (hlpBeforeMinutes / 60) * pixelsPerHour;
    const hlpAfterWidth = (hlpAfterMinutes / 60) * pixelsPerHour;
    const mainLeft = ((startMinutes - scheduleStartMinutes) / 60) * pixelsPerHour;
    const mainWidth = ((endMinutes - startMinutes) / 60) * pixelsPerHour;
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute" style={{ left: Math.max(0, mainLeft - hlpBeforeWidth), top: 3, height: ROW_HEIGHT - 6 }}>
              {hlpBeforeMinutes > 0 && (
                <div
                  className="absolute rounded-l text-[9px] flex items-center justify-center bg-gray-400 text-white font-medium"
                  style={{ left: 0, width: hlpBeforeWidth, top: 0, height: '100%' }}
                >
                  HLP
                </div>
              )}
              <div
                className="absolute text-[10px] flex items-center px-1 overflow-hidden border border-black/20 font-medium cursor-pointer hover:shadow-md transition-shadow"
                style={{
                  left: hlpBeforeWidth,
                  width: Math.max(25, mainWidth),
                  backgroundColor: bgColor,
                  color: textColor,
                  top: 0,
                  height: '100%',
                  borderRadius: hlpBeforeMinutes > 0 ? '0' : '4px 0 0 4px',
                }}
              >
                <span className="truncate">{block.school_name || 'École'}</span>
              </div>
              {hlpAfterMinutes > 0 && (
                <div
                  className="absolute rounded-r text-[9px] flex items-center justify-center bg-gray-400 text-white font-medium"
                  style={{ left: hlpBeforeWidth + mainWidth, width: hlpAfterWidth, top: 0, height: '100%' }}
                >
                  HLP
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltipContent}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // Mode complet: HLP inclus dans la couleur de l'école
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="absolute rounded text-[10px] flex items-center px-1 overflow-hidden border border-black/20 font-medium cursor-pointer hover:shadow-md transition-shadow"
            style={{
              left: Math.max(0, left),
              width: Math.max(25, width),
              backgroundColor: bgColor,
              color: textColor,
              top: 3,
              height: ROW_HEIGHT - 6
            }}
          >
            <span className="truncate">{block.school_name || 'École'}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltipContent}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ShiftBlock = ({ shift, assignment, viewMode, selectedDate, pixelsPerHour, totalScheduleWidth }) => {
  if (!shift.blocks || shift.blocks.length === 0) return null;
  
  const scheduleStartMinutes = SCHEDULE_START_HOUR * 60;
  const dayLetter = getDayLetter(selectedDate);
  
  // Filter blocks for this day
  const dayBlocks = shift.blocks.filter(b => 
    !b.days || b.days.length === 0 || b.days.includes(dayLetter)
  );
  
  if (dayBlocks.length === 0) return null;
  
  const showHlpInColor = viewMode === 'complete';
  
  if (viewMode === 'abbreviated') {
    const allTimes = dayBlocks.flatMap(b => [
      timeToMinutes(b.start_time) - (b.hlp_before || 0),
      timeToMinutes(b.end_time) + (b.hlp_after || 0)
    ]);
    const startMinutes = Math.min(...allTimes);
    const endMinutes = Math.max(...allTimes);
    
    const left = ((startMinutes - scheduleStartMinutes) / 60) * pixelsPerHour;
    const width = ((endMinutes - startMinutes) / 60) * pixelsPerHour;
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="absolute rounded cursor-pointer bg-gray-600 text-white text-[10px] flex items-center justify-center px-1 font-semibold hover:shadow-md transition-shadow"
              style={{
                left: Math.max(0, left),
                width: Math.max(50, width),
                top: 3,
                height: ROW_HEIGHT - 6
              }}
            >
              {assignment.circuit_number} {shift.name}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="text-xs">
              <div className="font-bold">Circuit {assignment.circuit_number} - {shift.name}</div>
              <div>{dayBlocks.length} bloc(s)</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return dayBlocks.map((block) => (
    <ScheduleBlock 
      key={block.id} 
      block={block}
      viewMode={viewMode}
      showHlpInColor={showHlpInColor}
      pixelsPerHour={pixelsPerHour}
      totalScheduleWidth={totalScheduleWidth}
    />
  ));
};

const TemporaryTaskBlock = ({ task, pixelsPerHour, totalScheduleWidth }) => {
  const startMinutes = timeToMinutes(task.start_time);
  const endMinutes = timeToMinutes(task.end_time);
  const scheduleStartMinutes = SCHEDULE_START_HOUR * 60;
  
  const left = ((startMinutes - scheduleStartMinutes) / 60) * pixelsPerHour;
  const width = ((endMinutes - startMinutes) / 60) * pixelsPerHour;
  
  if (left + width < 0 || left > totalScheduleWidth) return null;
  
  const bgColor = task.school_color || '#FF69B4';
  const textColor = getContrastColor(bgColor);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="absolute rounded cursor-pointer text-[10px] flex items-center px-1 overflow-hidden border-2 border-dashed hover:shadow-md transition-shadow font-medium"
            style={{
              left: Math.max(0, left),
              width: Math.max(25, width),
              backgroundColor: bgColor,
              color: textColor,
              borderColor: textColor,
              top: 3,
              height: ROW_HEIGHT - 6
            }}
          >
            <span className="truncate">{task.name}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-xs">
            <div className="font-bold">{task.name}</div>
            <div>Horaire: {task.start_time} - {task.end_time}</div>
            {task.school_name && <div>École: {task.school_name}</div>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Get day letter from date
const getDayLetter = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['D', 'L', 'M', 'W', 'J', 'V', 'S'];
  return days[d.getDay()];
};

// Section Remplacements
const ReplacementsSection = ({ replacements, onAssign, selectedDate }) => {
  const { unassigned_assignments = [], unassigned_tasks = [], absent_items = [] } = replacements || {};
  
  const todayAbsentItems = absent_items.filter(item => item.date === selectedDate);
  const totalReplacements = unassigned_assignments.length + unassigned_tasks.length + todayAbsentItems.length;
  
  return (
    <div 
      className={`mb-3 p-3 rounded-lg border-2 shadow-sm ${
        totalReplacements > 0 
          ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-700' 
          : 'border-green-300 bg-green-50 dark:bg-green-950/50 dark:border-green-700'
      }`}
      data-testid="replacements-section"
    >
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-full ${totalReplacements > 0 ? 'bg-amber-200 dark:bg-amber-800' : 'bg-green-200 dark:bg-green-800'}`}>
          {totalReplacements > 0 ? (
            <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
          ) : (
            <Info className="h-4 w-4 text-green-700 dark:text-green-300" />
          )}
        </div>
        <div className="flex-1">
          <span className={`font-semibold text-sm ${totalReplacements > 0 ? 'text-amber-900 dark:text-amber-100' : 'text-green-900 dark:text-green-100'}`}>
            {totalReplacements > 0 ? `${totalReplacements} remplacement(s) requis` : 'Aucun remplacement requis'}
          </span>
        </div>
        {totalReplacements > 0 && (
          <Badge className="bg-amber-500 text-white px-2">
            {totalReplacements}
          </Badge>
        )}
      </div>
      
      {totalReplacements > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {unassigned_assignments.map(a => (
            <Badge 
              key={a.id} 
              variant="outline" 
              className="cursor-pointer text-xs bg-white dark:bg-gray-800 hover:bg-amber-100 dark:hover:bg-amber-900 border-amber-400"
              onClick={() => onAssign(a, 'assignment')}
            >
              <Bus className="h-3 w-3 mr-1" />
              {a.circuit_number}
            </Badge>
          ))}
          {unassigned_tasks.map(t => (
            <Badge 
              key={t.id} 
              variant="outline" 
              className="cursor-pointer text-xs bg-white dark:bg-gray-800 hover:bg-amber-100 dark:hover:bg-amber-900 border-dashed border-amber-400"
              onClick={() => onAssign(t, 'task')}
            >
              {t.name}
            </Badge>
          ))}
          {todayAbsentItems.map((item, idx) => (
            <Badge 
              key={`absent-${idx}`} 
              variant="outline" 
              className="cursor-pointer text-xs bg-red-50 dark:bg-red-900/30 hover:bg-red-100 border-red-400"
              onClick={() => onAssign(item.data, 'assignment')}
            >
              <UserX className="h-3 w-3 mr-1" />
              {item.data.circuit_number}
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
  const [sortMode, setSortMode] = useState('circuit'); // 'circuit' or 'name'
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
  
  // Refs for synchronized scrolling and dynamic width calculation
  const topScrollRef = useRef(null);
  const bottomScrollRef = useRef(null);
  const headerScrollRef = useRef(null);
  const bodyScrollRef = useRef(null);
  const containerRef = useRef(null);
  
  // Calculate dynamic pixels per hour based on available width
  const [pixelsPerHour, setPixelsPerHour] = useState(80);
  const totalScheduleWidth = useMemo(() => TOTAL_HOURS * pixelsPerHour, [pixelsPerHour]);
  const timeMarkers = useMemo(() => generateTimeMarkers(pixelsPerHour), [pixelsPerHour]);
  
  useEffect(() => {
    const calculateWidth = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const availableWidth = containerWidth - FIXED_LEFT_WIDTH - FIXED_RIGHT_WIDTH - 40; // 40px for padding/borders
        // Élargir les colonnes de 25% (multiplier par 1.25)
        const calculatedPixelsPerHour = Math.max(75, (availableWidth / TOTAL_HOURS) * 1.25);
        setPixelsPerHour(calculatedPixelsPerHour);
      }
    };
    
    calculateWidth();
    window.addEventListener('resize', calculateWidth);
    return () => window.removeEventListener('resize', calculateWidth);
  }, []);
  
  // Synchronize all horizontal scrolls
  const handleScroll = (source) => (e) => {
    const scrollLeft = e.target.scrollLeft;
    const refs = [topScrollRef, bottomScrollRef, headerScrollRef, bodyScrollRef];
    refs.forEach(ref => {
      if (ref.current && ref.current !== e.target) {
        ref.current.scrollLeft = scrollLeft;
      }
    });
  };
  
  const fetchData = useCallback(async () => {
    try {
      const monday = getMonday(selectedDate);
      const [empRes, schRes, assRes, taskRes, absRes, holRes, schedRes] = await Promise.all([
        getEmployees(),
        getSchools(),
        getAssignments(),
        getTemporaryTasks(),
        getAbsences(),
        getHolidays(),
        getSchedule({ week_start: monday })
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
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Sort employees based on sortMode
  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => {
      if (sortMode === 'name') {
        return a.name.localeCompare(b.name);
      }
      
      // Sort by circuit number (numeric comparison)
      const aAssignments = assignments.filter(ass => ass.employee_id === a.id);
      const bAssignments = assignments.filter(ass => ass.employee_id === b.id);
      
      // Parse circuit numbers as integers for proper sorting
      const getMinCircuit = (assignmentList) => {
        if (assignmentList.length === 0) return Infinity;
        const nums = assignmentList.map(ass => {
          const num = parseInt(ass.circuit_number, 10);
          return isNaN(num) ? Infinity : num;
        });
        return Math.min(...nums);
      };
      
      const aCircuit = getMinCircuit(aAssignments);
      const bCircuit = getMinCircuit(bAssignments);
      
      if (aCircuit !== bCircuit) return aCircuit - bCircuit;
      return a.name.localeCompare(b.name);
    });
  }, [employees, assignments, sortMode]);
  
  const goToPreviousWeek = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() - 7);
    setSelectedDate(current.toISOString().split('T')[0]);
  };
  
  const goToNextWeek = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + 7);
    setSelectedDate(current.toISOString().split('T')[0]);
  };
  
  const goToToday = () => {
    const today = new Date();
    const day = today.getDay();
    // Si c'est samedi ou dimanche, aller au lundi suivant
    if (day === 0) today.setDate(today.getDate() + 1);
    if (day === 6) today.setDate(today.getDate() + 2);
    setSelectedDate(today.toISOString().split('T')[0]);
  };
  
  const handleCalendarSelect = (date) => {
    if (date) {
      const day = date.getDay();
      // Si fin de semaine, ajuster au jour ouvrable le plus proche
      if (day === 0) date.setDate(date.getDate() + 1);
      if (day === 6) date.setDate(date.getDate() + 2);
      setSelectedDate(date.toISOString().split('T')[0]);
      setCalendarOpen(false);
    }
  };
  
  const handleLogout = () => {
    logout();
    navigate('/');
  };
  
  const handleAssign = async (item, type) => {
    toast.info('Utilisez l\'onglet Assignations pour assigner un conducteur');
  };
  
  const handleTempTaskCreated = () => {
    setShowTempTaskModal(false);
    fetchData();
    toast.success('Tâche temporaire créée');
  };
  
  const isEmployeeAbsent = (employeeId, shiftType = null) => {
    return absences.some(a => {
      if (a.employee_id !== employeeId) return false;
      if (!(a.start_date <= selectedDate && a.end_date >= selectedDate)) return false;
      // If shift_types is empty, absent for all
      if (!a.shift_types || a.shift_types.length === 0) return true;
      // If shiftType provided, check if in list
      if (shiftType) return a.shift_types.includes(shiftType);
      return true;
    });
  };
  
  const toggleSortMode = () => {
    setSortMode(prev => prev === 'circuit' ? 'name' : 'circuit');
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
            <span className="text-sm text-muted-foreground hidden md:inline">
              {admin?.name}
            </span>
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
              <TabsTrigger value="schedule" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Horaires</span>
              </TabsTrigger>
              <TabsTrigger value="employees" className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Employés</span>
              </TabsTrigger>
              <TabsTrigger value="schools" className="flex items-center gap-1">
                <School className="h-4 w-4" />
                <span className="hidden sm:inline">Écoles</span>
              </TabsTrigger>
              <TabsTrigger value="assignments" className="flex items-center gap-1">
                <Bus className="h-4 w-4" />
                <span className="hidden sm:inline">Assignations</span>
              </TabsTrigger>
              <TabsTrigger value="absences" className="flex items-center gap-1">
                <UserX className="h-4 w-4" />
                <span className="hidden sm:inline">Absences</span>
              </TabsTrigger>
              <TabsTrigger value="holidays" className="flex items-center gap-1">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Jours fériés</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Rapports</span>
              </TabsTrigger>
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
                <Button variant="outline" size="icon" onClick={goToPreviousWeek} data-testid="prev-week-btn">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex gap-1">
                  {weekDates.map(date => (
                    <Button
                      key={date}
                      variant={date === selectedDate ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedDate(date)}
                      className={date === selectedDate ? 'bg-[#4CAF50] hover:bg-[#43A047]' : ''}
                      data-testid={`date-btn-${date}`}
                    >
                      {formatDate(date)}
                    </Button>
                  ))}
                </div>
                <Button variant="outline" size="icon" onClick={goToNextWeek} data-testid="next-week-btn">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                {/* Bouton Aujourd'hui */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={goToToday}
                  className="ml-2"
                  data-testid="today-btn"
                >
                  <CalendarDays className="h-4 w-4 mr-1" />
                  Aujourd'hui
                </Button>
                
                {/* Calendrier pour sélection de date */}
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" data-testid="calendar-picker-btn">
                      <Calendar className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={new Date(selectedDate)}
                      onSelect={handleCalendarSelect}
                      disabled={(date) => date.getDay() === 0 || date.getDay() === 6}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Bouton de tri */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={toggleSortMode}
                  className="flex items-center gap-1"
                  data-testid="sort-toggle-btn"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {sortMode === 'circuit' ? 'Tri: Circuit' : 'Tri: Nom'}
                </Button>
                
                <div className="flex rounded-md border border-input overflow-hidden">
                  {['detailed', 'complete', 'abbreviated'].map((mode, idx) => (
                    <button
                      key={mode}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${idx > 0 ? 'border-l border-input' : ''} ${viewMode === mode ? 'bg-[#4CAF50] text-white' : 'bg-background hover:bg-muted'}`}
                      onClick={() => setViewMode(mode)}
                      data-testid={`view-mode-${mode}`}
                    >
                      {mode === 'detailed' ? 'Détaillé' : mode === 'complete' ? 'Complet' : 'Abrégé'}
                    </button>
                  ))}
                </div>
                
                <Button onClick={() => setShowTempTaskModal(true)} className="bg-[#4CAF50] hover:bg-[#43A047]" data-testid="add-temp-task-btn">
                  <Plus className="h-4 w-4 mr-1" />
                  Tâche temp.
                </Button>
              </div>
            </div>
            
            {/* Replacements */}
            <ReplacementsSection replacements={replacements} onAssign={handleAssign} selectedDate={selectedDate} />
            
            {/* Schedule Grid */}
            <div className="border border-border rounded-lg overflow-hidden bg-card">
              {/* Top scrollbar */}
              <div className="flex border-b border-border bg-muted/30">
                <div style={{ width: FIXED_LEFT_WIDTH }} className="flex-shrink-0" />
                <div 
                  ref={topScrollRef}
                  className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin"
                  onScroll={handleScroll('top')}
                  style={{ minWidth: 0, height: 12 }}
                >
                  <div style={{ width: totalScheduleWidth, height: 1 }} />
                </div>
                <div style={{ width: FIXED_RIGHT_WIDTH }} className="flex-shrink-0" />
              </div>
              
              {/* Header */}
              <div className="flex border-b-2 border-border bg-muted/70">
                <div className="flex-shrink-0 flex" style={{ width: FIXED_LEFT_WIDTH }}>
                  <div className="font-semibold text-sm px-2 py-2 border-r border-border flex items-center" style={{ width: DRIVER_COL_WIDTH }}>
                    Conducteur
                  </div>
                  <div className="font-semibold text-sm px-1 py-2 border-r-2 border-border flex items-center justify-center" style={{ width: CIRCUIT_COL_WIDTH }}>
                    Circuit
                  </div>
                </div>
                
                <div 
                  ref={headerScrollRef}
                  className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-none"
                  onScroll={handleScroll('header')}
                  style={{ minWidth: 0 }}
                >
                  <div className="relative h-9" style={{ width: totalScheduleWidth }}>
                    {timeMarkers.map((marker, idx) => (
                      <div 
                        key={marker.hour}
                        className="absolute top-0 h-full flex items-center border-l border-border/70"
                        style={{ left: marker.position, width: idx < timeMarkers.length - 1 ? pixelsPerHour : 'auto' }}
                      >
                        <span className="pl-1 text-xs font-semibold">{marker.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex-shrink-0 flex" style={{ width: FIXED_RIGHT_WIDTH }}>
                  <div className="font-semibold text-xs px-1 py-2 border-l-2 border-border flex items-center justify-center" style={{ width: DAY_HOURS_COL_WIDTH }}>
                    Jour
                  </div>
                  <div className="font-semibold text-xs px-1 py-2 border-l border-border flex items-center justify-center" style={{ width: WEEK_HOURS_COL_WIDTH }}>
                    Semaine
                  </div>
                </div>
              </div>
              
              {/* Body */}
              <div 
                ref={bodyScrollRef}
                className="max-h-[calc(100vh-380px)] overflow-auto"
                onScroll={handleScroll('body')}
              >
                {sortedEmployees.map((emp) => {
                  const empSchedule = scheduleData.find(s => s.employee?.id === emp.id);
                  const dailyMinutes = empSchedule?.daily_hours?.[selectedDate] || 0;
                  const weeklyMinutes = empSchedule?.weekly_total || 0;
                  const isAbsent = isEmployeeAbsent(emp.id);
                  
                  const dayAssignments = isAbsent ? [] : assignments.filter(a => 
                    a.employee_id === emp.id &&
                    a.start_date <= selectedDate &&
                    a.end_date >= selectedDate
                  );
                  
                  const dayTasks = isAbsent ? [] : tempTasks.filter(t => 
                    t.employee_id === emp.id &&
                    t.date === selectedDate
                  );
                  
                  const isOvertime = weeklyMinutes > 39 * 60;
                  const isUndertime = weeklyMinutes < 15 * 60 && weeklyMinutes > 0;
                  
                  return (
                    <div 
                      key={emp.id} 
                      className={`flex border-b border-border transition-colors ${isAbsent ? 'bg-red-50/50 dark:bg-red-950/20' : 'hover:bg-muted/30'}`}
                      style={{ height: ROW_HEIGHT }}
                      data-testid={`schedule-row-${emp.id}`}
                    >
                      <div className="flex-shrink-0 flex bg-background" style={{ width: FIXED_LEFT_WIDTH }}>
                        <div 
                          className={`px-2 border-r border-border flex items-center gap-1 ${isAbsent ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}
                          style={{ width: DRIVER_COL_WIDTH }}
                        >
                          <span className={`font-medium text-sm truncate ${isAbsent ? 'text-red-600 dark:text-red-400' : ''}`}>
                            {emp.name}
                          </span>
                          {isAbsent && <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">ABS</Badge>}
                        </div>
                        <div 
                          className={`px-1 border-r-2 border-border flex items-center justify-center gap-1 ${isAbsent ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}
                          style={{ width: CIRCUIT_COL_WIDTH }}
                        >
                          <span className="text-xs text-muted-foreground font-medium">
                            {dayAssignments.map(a => a.circuit_number).join(', ') || '-'}
                          </span>
                          {dayAssignments.some(a => a.is_adapted) && (
                            <Accessibility className="h-3 w-3 text-blue-600 flex-shrink-0" title="Circuit adapté" />
                          )}
                        </div>
                      </div>
                      
                      <div className="flex-1 overflow-hidden" style={{ minWidth: 0 }}>
                        <div className="relative h-full" style={{ width: totalScheduleWidth }}>
                          {timeMarkers.map((marker) => (
                            <div key={marker.hour} className="absolute top-0 bottom-0 border-l border-border/40" style={{ left: marker.position }} />
                          ))}
                          {timeMarkers.slice(0, -1).map((marker) => (
                            <div key={`half-${marker.hour}`} className="absolute top-0 bottom-0 border-l border-dashed border-border/20" style={{ left: marker.position + pixelsPerHour / 2 }} />
                          ))}
                          
                          {dayAssignments.map(assignment => 
                            assignment.shifts?.map(shift => (
                              <ShiftBlock
                                key={`${assignment.id}-${shift.id}`}
                                shift={shift}
                                assignment={assignment}
                                viewMode={viewMode}
                                selectedDate={selectedDate}
                                pixelsPerHour={pixelsPerHour}
                                totalScheduleWidth={totalScheduleWidth}
                              />
                            ))
                          )}
                          
                          {dayTasks.map(task => (
                            <TemporaryTaskBlock 
                              key={task.id} 
                              task={task} 
                              pixelsPerHour={pixelsPerHour}
                              totalScheduleWidth={totalScheduleWidth}
                            />
                          ))}
                          
                          {isAbsent && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-red-500 text-xs font-medium bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded">
                                Absent
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex-shrink-0 flex bg-background" style={{ width: FIXED_RIGHT_WIDTH }}>
                        <div 
                          className={`px-1 border-l-2 border-border flex items-center justify-center tabular-nums text-xs ${isAbsent ? 'bg-red-50/50 dark:bg-red-950/20 text-muted-foreground' : ''}`}
                          style={{ width: DAY_HOURS_COL_WIDTH }}
                        >
                          {isAbsent ? '-' : formatHoursMinutes(dailyMinutes)}
                        </div>
                        <div 
                          className={`px-1 border-l border-border flex items-center justify-center gap-0.5 ${isAbsent ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}
                          style={{ width: WEEK_HOURS_COL_WIDTH }}
                        >
                          <span className="tabular-nums text-xs font-medium">{formatHoursMinutes(weeklyMinutes)}</span>
                          {isOvertime && <AlertTriangle className="h-3 w-3 text-red-500" />}
                          {isUndertime && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {sortedEmployees.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    Aucun employé. Ajoutez des employés dans l'onglet "Employés".
                  </div>
                )}
              </div>
              
              {/* Bottom scrollbar */}
              <div className="flex border-t border-border bg-muted/30">
                <div style={{ width: FIXED_LEFT_WIDTH }} className="flex-shrink-0" />
                <div 
                  ref={bottomScrollRef}
                  className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin"
                  onScroll={handleScroll('bottom')}
                  style={{ minWidth: 0, height: 12 }}
                >
                  <div style={{ width: totalScheduleWidth, height: 1 }} />
                </div>
                <div style={{ width: FIXED_RIGHT_WIDTH }} className="flex-shrink-0" />
              </div>
            </div>
          </>
        )}
        
        {activeTab === 'employees' && <EmployeesPage employees={employees} onUpdate={fetchData} />}
        {activeTab === 'schools' && <SchoolsPage schools={schools} onUpdate={fetchData} />}
        {activeTab === 'assignments' && <AssignmentsPage assignments={assignments} employees={employees} schools={schools} onUpdate={fetchData} />}
        {activeTab === 'absences' && <AbsencesPage absences={absences} employees={employees} onUpdate={fetchData} />}
        {activeTab === 'holidays' && <HolidaysPage holidays={holidays} onUpdate={fetchData} />}
        {activeTab === 'reports' && <ReportsPage employees={employees} />}
      </main>
      
      <TemporaryTaskModal
        open={showTempTaskModal}
        onClose={() => setShowTempTaskModal(false)}
        onSuccess={handleTempTaskCreated}
        employees={employees}
        schools={schools}
        selectedDate={selectedDate}
      />
    </div>
  );
}
