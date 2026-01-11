import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { 
  getSchedule, getEmployees, getSchools, getAssignments, 
  getTemporaryTasks, getAbsences, getHolidays, updateAssignment,
  updateTemporaryTask, checkConflict
} from '../lib/api';
import { 
  formatHoursMinutes, getWeekDates, getMonday, timeToMinutes, 
  getContrastColor, formatDate 
} from '../lib/utils';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ScrollArea, ScrollBar } from '../components/ui/scroll-area';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter 
} from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Sun, Moon, LogOut, ChevronLeft, ChevronRight, Calendar,
  Users, School, Settings, FileText, Plus, AlertTriangle,
  Clock, Bus
} from 'lucide-react';
import { toast } from 'sonner';

import EmployeesPage from './EmployeesPage';
import SchoolsPage from './SchoolsPage';
import AssignmentsPage from './AssignmentsPage';
import HolidaysPage from './HolidaysPage';
import ReportsPage from './ReportsPage';
import TemporaryTaskModal from '../components/TemporaryTaskModal';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_route-manager-27/artifacts/sd598o43_LogoBerlinesTAB.png';

// Time configuration
const SCHEDULE_START_HOUR = 5; // 5:00
const SCHEDULE_END_HOUR = 20; // 20:00
const DEFAULT_VIEW_START = 6.5; // 6:30
const DEFAULT_VIEW_END = 16.5; // 16:30
const PIXELS_PER_HOUR = 80;
const TOTAL_HOURS = SCHEDULE_END_HOUR - SCHEDULE_START_HOUR;
const TOTAL_SCHEDULE_WIDTH = TOTAL_HOURS * PIXELS_PER_HOUR;

// Column widths
const DRIVER_COL_WIDTH = 160;
const CIRCUIT_COL_WIDTH = 70;
const DAY_HOURS_COL_WIDTH = 70;
const WEEK_HOURS_COL_WIDTH = 90;
const FIXED_LEFT_WIDTH = DRIVER_COL_WIDTH + CIRCUIT_COL_WIDTH;
const FIXED_RIGHT_WIDTH = DAY_HOURS_COL_WIDTH + WEEK_HOURS_COL_WIDTH;

// Generate time markers (every hour from 5h to 20h)
const generateTimeMarkers = () => {
  const markers = [];
  for (let h = SCHEDULE_START_HOUR; h <= SCHEDULE_END_HOUR; h++) {
    markers.push({ hour: h, label: `${h}h00`, position: (h - SCHEDULE_START_HOUR) * PIXELS_PER_HOUR });
  }
  return markers;
};

const TIME_MARKERS = generateTimeMarkers();

const TimeHeader = ({ scrollLeft }) => {
  return (
    <div 
      className="relative h-10 border-b border-border bg-muted/50"
      style={{ width: TOTAL_SCHEDULE_WIDTH }}
    >
      {TIME_MARKERS.map((marker) => (
        <div 
          key={marker.hour}
          className="absolute top-0 h-full flex items-center border-l border-border"
          style={{ left: marker.position }}
        >
          <span className="px-2 text-xs font-medium text-muted-foreground whitespace-nowrap">
            {marker.label}
          </span>
        </div>
      ))}
    </div>
  );
};

const ScheduleBlock = ({ block, shift, assignment, viewMode, onClick }) => {
  const startMinutes = timeToMinutes(block.start_time);
  const endMinutes = timeToMinutes(block.end_time);
  const scheduleStartMinutes = SCHEDULE_START_HOUR * 60;
  
  // Calculate position based on schedule start
  const left = ((startMinutes - scheduleStartMinutes) / 60) * PIXELS_PER_HOUR;
  const width = ((endMinutes - startMinutes) / 60) * PIXELS_PER_HOUR;
  
  if (left + width < 0 || left > TOTAL_SCHEDULE_WIDTH) return null;
  
  const bgColor = block.school_color || '#9E9E9E';
  const textColor = getContrastColor(bgColor);
  
  // HLP blocks before/after
  const hlpBeforeWidth = (block.hlp_before / 60) * PIXELS_PER_HOUR;
  const hlpAfterWidth = (block.hlp_after / 60) * PIXELS_PER_HOUR;
  
  return (
    <>
      {viewMode === 'detailed' && block.hlp_before > 0 && (
        <div
          className="absolute rounded text-xs flex items-center justify-center bg-gray-500 text-white"
          style={{
            left: Math.max(0, left - hlpBeforeWidth),
            width: hlpBeforeWidth,
            top: 4,
            height: 'calc(100% - 8px)'
          }}
        >
          HLP
        </div>
      )}
      <div
        className="absolute rounded cursor-pointer text-xs flex items-center px-1 overflow-hidden border border-black/10 hover:shadow-lg hover:z-10 transition-shadow"
        style={{
          left: Math.max(0, left),
          width: Math.max(30, width),
          backgroundColor: bgColor,
          color: textColor,
          top: 4,
          height: 'calc(100% - 8px)'
        }}
        onClick={onClick}
        data-testid={`block-${block.id}`}
      >
        {viewMode === 'detailed' && (
          <span className="truncate font-medium">{block.school_name || 'École'}</span>
        )}
        {viewMode === 'complete' && (
          <span className="truncate font-medium">{block.school_name || 'École'}</span>
        )}
      </div>
      {viewMode === 'detailed' && block.hlp_after > 0 && (
        <div
          className="absolute rounded text-xs flex items-center justify-center bg-gray-500 text-white"
          style={{
            left: Math.max(0, left + width),
            width: hlpAfterWidth,
            top: 4,
            height: 'calc(100% - 8px)'
          }}
        >
          HLP
        </div>
      )}
    </>
  );
};

const ShiftBlock = ({ shift, assignment, viewMode, onClick }) => {
  if (!shift.blocks || shift.blocks.length === 0) return null;
  
  const scheduleStartMinutes = SCHEDULE_START_HOUR * 60;
  
  // Get start and end time from blocks
  const allTimes = shift.blocks.flatMap(b => [
    timeToMinutes(b.start_time) - (b.hlp_before || 0),
    timeToMinutes(b.end_time) + (b.hlp_after || 0)
  ]);
  const startMinutes = Math.min(...allTimes);
  const endMinutes = Math.max(...allTimes);
  
  const left = ((startMinutes - scheduleStartMinutes) / 60) * PIXELS_PER_HOUR;
  const width = ((endMinutes - startMinutes) / 60) * PIXELS_PER_HOUR;
  
  if (left + width < 0 || left > TOTAL_SCHEDULE_WIDTH) return null;
  
  if (viewMode === 'abbreviated') {
    return (
      <div
        className="absolute rounded cursor-pointer bg-gray-600 text-white text-xs flex items-center justify-center px-2 font-medium hover:shadow-lg transition-shadow"
        style={{
          left: Math.max(0, left),
          width: Math.max(60, width),
          top: 4,
          height: 'calc(100% - 8px)'
        }}
        onClick={onClick}
        data-testid={`shift-${shift.id}`}
      >
        {assignment.circuit_number} {shift.name}
      </div>
    );
  }
  
  return shift.blocks.map((block) => (
    <ScheduleBlock 
      key={block.id} 
      block={block} 
      shift={shift}
      assignment={assignment}
      viewMode={viewMode}
      onClick={onClick}
    />
  ));
};

const TemporaryTaskBlock = ({ task, onClick }) => {
  const startMinutes = timeToMinutes(task.start_time);
  const endMinutes = timeToMinutes(task.end_time);
  const scheduleStartMinutes = SCHEDULE_START_HOUR * 60;
  
  const left = ((startMinutes - scheduleStartMinutes) / 60) * PIXELS_PER_HOUR;
  const width = ((endMinutes - startMinutes) / 60) * PIXELS_PER_HOUR;
  
  if (left + width < 0 || left > TOTAL_SCHEDULE_WIDTH) return null;
  
  const bgColor = task.school_color || '#9E9E9E';
  const textColor = getContrastColor(bgColor);
  
  return (
    <div
      className="absolute rounded cursor-pointer text-xs flex items-center px-1 overflow-hidden border-2 border-dashed hover:shadow-lg transition-shadow"
      style={{
        left: Math.max(0, left),
        width: Math.max(30, width),
        backgroundColor: bgColor,
        color: textColor,
        borderColor: textColor,
        top: 4,
        height: 'calc(100% - 8px)'
      }}
      onClick={onClick}
      data-testid={`temp-task-${task.id}`}
    >
      <span className="truncate font-medium">{task.name}</span>
    </div>
  );
};

const ScheduleGrid = ({ 
  employees, scheduleData, assignments, tempTasks, 
  viewMode, selectedDate, weekDates,
  onAssignmentClick, onTaskClick 
}) => {
  const scheduleScrollRef = useRef(null);
  const headerScrollRef = useRef(null);
  
  // Scroll to default view on mount
  useEffect(() => {
    if (scheduleScrollRef.current) {
      const defaultScrollLeft = (DEFAULT_VIEW_START - SCHEDULE_START_HOUR) * PIXELS_PER_HOUR;
      scheduleScrollRef.current.scrollLeft = defaultScrollLeft;
    }
  }, []);
  
  // Sync header scroll with schedule scroll
  const handleScheduleScroll = (e) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = e.target.scrollLeft;
    }
  };
  
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Header Row */}
      <div className="flex border-b-2 border-border bg-muted/70">
        {/* Fixed Left Header */}
        <div className="flex-shrink-0 flex" style={{ width: FIXED_LEFT_WIDTH }}>
          <div 
            className="font-semibold text-sm px-3 py-2 border-r border-border flex items-center"
            style={{ width: DRIVER_COL_WIDTH }}
          >
            Conducteur
          </div>
          <div 
            className="font-semibold text-sm px-2 py-2 border-r border-border flex items-center justify-center"
            style={{ width: CIRCUIT_COL_WIDTH }}
          >
            Circuit
          </div>
        </div>
        
        {/* Scrollable Time Header */}
        <div 
          ref={headerScrollRef}
          className="flex-1 overflow-hidden"
          style={{ minWidth: 0 }}
        >
          <TimeHeader />
        </div>
        
        {/* Fixed Right Header */}
        <div className="flex-shrink-0 flex" style={{ width: FIXED_RIGHT_WIDTH }}>
          <div 
            className="font-semibold text-sm px-2 py-2 border-l border-border flex items-center justify-center"
            style={{ width: DAY_HOURS_COL_WIDTH }}
          >
            Jour
          </div>
          <div 
            className="font-semibold text-sm px-2 py-2 border-l border-border flex items-center justify-center"
            style={{ width: WEEK_HOURS_COL_WIDTH }}
          >
            Semaine
          </div>
        </div>
      </div>
      
      {/* Data Rows */}
      <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
        {employees.map(emp => {
          const empSchedule = scheduleData.find(s => s.employee?.id === emp.id);
          const dailyMinutes = empSchedule?.daily_hours?.[selectedDate] || 0;
          const weeklyMinutes = empSchedule?.weekly_total || 0;
          
          // Filter assignments for selected date
          const dayAssignments = assignments.filter(a => 
            a.employee_id === emp.id &&
            a.start_date <= selectedDate &&
            a.end_date >= selectedDate
          );
          
          const dayTasks = tempTasks.filter(t => 
            t.employee_id === emp.id &&
            t.date === selectedDate
          );
          
          // Alerts
          const isOvertime = weeklyMinutes > 39 * 60;
          const isUndertime = weeklyMinutes < 15 * 60 && weeklyMinutes > 0;
          
          return (
            <div 
              key={emp.id} 
              className="flex border-b border-border hover:bg-muted/30 transition-colors"
              data-testid={`driver-row-${emp.id}`}
            >
              {/* Fixed Left Columns */}
              <div className="flex-shrink-0 flex bg-background" style={{ width: FIXED_LEFT_WIDTH }}>
                <div 
                  className="px-3 py-2 border-r border-border flex items-center"
                  style={{ width: DRIVER_COL_WIDTH }}
                >
                  <span className="font-medium text-sm truncate">{emp.name}</span>
                </div>
                <div 
                  className="px-2 py-2 border-r border-border flex items-center justify-center"
                  style={{ width: CIRCUIT_COL_WIDTH }}
                >
                  <span className="text-xs text-muted-foreground">
                    {dayAssignments.map(a => a.circuit_number).join(', ') || '-'}
                  </span>
                </div>
              </div>
              
              {/* Scrollable Schedule Area */}
              <div 
                ref={emp === employees[0] ? scheduleScrollRef : null}
                className="flex-1 overflow-x-auto overflow-y-hidden"
                style={{ minWidth: 0 }}
                onScroll={emp === employees[0] ? handleScheduleScroll : undefined}
              >
                <div 
                  className="relative min-h-[48px]"
                  style={{ width: TOTAL_SCHEDULE_WIDTH }}
                >
                  {/* Time grid lines */}
                  {TIME_MARKERS.map((marker) => (
                    <div
                      key={marker.hour}
                      className="absolute top-0 bottom-0 border-l border-border/50"
                      style={{ left: marker.position }}
                    />
                  ))}
                  
                  {/* Half-hour markers */}
                  {TIME_MARKERS.slice(0, -1).map((marker) => (
                    <div
                      key={`half-${marker.hour}`}
                      className="absolute top-0 bottom-0 border-l border-dashed border-border/30"
                      style={{ left: marker.position + PIXELS_PER_HOUR / 2 }}
                    />
                  ))}
                  
                  {/* Assignments */}
                  {dayAssignments.map(assignment => 
                    assignment.shifts?.map(shift => (
                      <ShiftBlock
                        key={`${assignment.id}-${shift.id}`}
                        shift={shift}
                        assignment={assignment}
                        viewMode={viewMode}
                        onClick={() => onAssignmentClick(assignment)}
                      />
                    ))
                  )}
                  
                  {/* Temporary tasks */}
                  {dayTasks.map(task => (
                    <TemporaryTaskBlock
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task)}
                    />
                  ))}
                </div>
              </div>
              
              {/* Fixed Right Columns */}
              <div className="flex-shrink-0 flex bg-background" style={{ width: FIXED_RIGHT_WIDTH }}>
                <div 
                  className="px-2 py-2 border-l border-border flex items-center justify-center tabular-nums text-sm"
                  style={{ width: DAY_HOURS_COL_WIDTH }}
                >
                  {formatHoursMinutes(dailyMinutes)}
                </div>
                <div 
                  className="px-2 py-2 border-l border-border flex items-center justify-center gap-1"
                  style={{ width: WEEK_HOURS_COL_WIDTH }}
                >
                  <span className="tabular-nums text-sm font-medium">
                    {formatHoursMinutes(weeklyMinutes)}
                  </span>
                  {isOvertime && (
                    <span className="text-red-500" title="Plus de 39h/semaine">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                  )}
                  {isUndertime && (
                    <span className="text-amber-500" title="Moins de 15h/semaine">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        {employees.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            Aucun employé. Ajoutez des employés dans l'onglet "Employés".
          </div>
        )}
      </div>
    </div>
  );
};

const ReplacementsSection = ({ replacements, onAssign }) => {
  const { unassigned_assignments = [], unassigned_tasks = [], absent_items = [] } = replacements || {};
  
  const hasReplacements = unassigned_assignments.length > 0 || 
                          unassigned_tasks.length > 0 || 
                          absent_items.length > 0;
  
  if (!hasReplacements) return null;
  
  return (
    <div className="mb-4 p-4 rounded-lg border-2 border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <h3 className="font-semibold text-amber-800 dark:text-amber-200">Remplacements requis</h3>
        <Badge variant="secondary" className="bg-amber-200 text-amber-800">
          {unassigned_assignments.length + unassigned_tasks.length + absent_items.length}
        </Badge>
      </div>
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2">
          {unassigned_assignments.map(a => (
            <Badge 
              key={a.id} 
              variant="outline" 
              className="cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-800 whitespace-nowrap"
              onClick={() => onAssign(a, 'assignment')}
              data-testid={`replacement-${a.id}`}
            >
              Circuit {a.circuit_number}
            </Badge>
          ))}
          {unassigned_tasks.map(t => (
            <Badge 
              key={t.id} 
              variant="outline" 
              className="cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-800 whitespace-nowrap border-dashed"
              onClick={() => onAssign(t, 'task')}
              data-testid={`replacement-task-${t.id}`}
            >
              {t.name}
            </Badge>
          ))}
          {absent_items.map((item, idx) => (
            <Badge 
              key={`absent-${idx}`} 
              variant="outline" 
              className="cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-800 whitespace-nowrap"
              onClick={() => onAssign(item.data, 'assignment')}
            >
              {item.data.circuit_number} ({item.original_employee})
            </Badge>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};

export default function DashboardPage() {
  const { admin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('schedule');
  const [viewMode, setViewMode] = useState('detailed'); // detailed, complete, abbreviated
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    // If weekend, go to Monday
    if (day === 0) today.setDate(today.getDate() + 1);
    if (day === 6) today.setDate(today.getDate() + 2);
    return today.toISOString().split('T')[0];
  });
  const [weekDates, setWeekDates] = useState([]);
  
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
  const [conflictDialog, setConflictDialog] = useState({ open: false, conflicts: [], pending: null });
  
  // Fetch all data
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
  
  // Navigation
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
  
  const handleLogout = () => {
    logout();
    navigate('/');
  };
  
  const handleAssign = async (item, type) => {
    toast.info('Fonctionnalité d\'assignation à venir');
  };
  
  const handleAssignmentClick = (assignment) => {
    toast.info(`Assignation ${assignment.circuit_number}`);
  };
  
  const handleTaskClick = (task) => {
    toast.info(`Tâche: ${task.name}`);
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
            <span className="text-sm text-muted-foreground hidden md:inline">
              {admin?.name}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              data-testid="theme-toggle"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              data-testid="logout-button"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="px-4 pb-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-6 w-full max-w-2xl">
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
      
      {/* Main Content */}
      <main className="p-4">
        {activeTab === 'schedule' && (
          <>
            {/* Schedule Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
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
                <Button variant="outline" size="icon" onClick={goToNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex rounded-md border border-input overflow-hidden">
                  <button
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'detailed' ? 'bg-[#4CAF50] text-white' : 'bg-background hover:bg-muted'}`}
                    onClick={() => setViewMode('detailed')}
                    data-testid="view-detailed"
                  >
                    Détaillé
                  </button>
                  <button
                    className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-input ${viewMode === 'complete' ? 'bg-[#4CAF50] text-white' : 'bg-background hover:bg-muted'}`}
                    onClick={() => setViewMode('complete')}
                    data-testid="view-complete"
                  >
                    Complet
                  </button>
                  <button
                    className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-input ${viewMode === 'abbreviated' ? 'bg-[#4CAF50] text-white' : 'bg-background hover:bg-muted'}`}
                    onClick={() => setViewMode('abbreviated')}
                    data-testid="view-abbreviated"
                  >
                    Abrégé
                  </button>
                </div>
                
                <Button 
                  onClick={() => setShowTempTaskModal(true)}
                  className="bg-[#4CAF50] hover:bg-[#43A047]"
                  data-testid="add-temp-task"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Tâche temporaire
                </Button>
              </div>
            </div>
            
            {/* Replacements Section */}
            <ReplacementsSection replacements={replacements} onAssign={handleAssign} />
            
            {/* Schedule Grid */}
            <ScheduleGrid
              employees={employees}
              scheduleData={scheduleData}
              assignments={assignments}
              tempTasks={tempTasks}
              viewMode={viewMode}
              selectedDate={selectedDate}
              weekDates={weekDates}
              onAssignmentClick={handleAssignmentClick}
              onTaskClick={handleTaskClick}
            />
          </>
        )}
        
        {activeTab === 'employees' && (
          <EmployeesPage employees={employees} onUpdate={fetchData} />
        )}
        
        {activeTab === 'schools' && (
          <SchoolsPage schools={schools} onUpdate={fetchData} />
        )}
        
        {activeTab === 'assignments' && (
          <AssignmentsPage 
            assignments={assignments} 
            employees={employees} 
            schools={schools}
            onUpdate={fetchData} 
          />
        )}
        
        {activeTab === 'holidays' && (
          <HolidaysPage holidays={holidays} onUpdate={fetchData} />
        )}
        
        {activeTab === 'reports' && (
          <ReportsPage employees={employees} />
        )}
      </main>
      
      {/* Temporary Task Modal */}
      <TemporaryTaskModal
        open={showTempTaskModal}
        onClose={() => setShowTempTaskModal(false)}
        onSuccess={handleTempTaskCreated}
        employees={employees}
        schools={schools}
        selectedDate={selectedDate}
      />
      
      {/* Conflict Dialog */}
      <Dialog open={conflictDialog.open} onOpenChange={(open) => setConflictDialog({ ...conflictDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Conflit d'horaire détecté
            </DialogTitle>
            <DialogDescription>
              Les quarts de travail suivants se chevauchent de plus de 5 minutes:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {conflictDialog.conflicts.map((c, idx) => (
              <div key={idx} className="p-2 bg-muted rounded text-sm">
                {c.type === 'assignment' ? (
                  <span>Circuit {c.circuit} - {c.shift}: {c.block_time} ({c.overlap_minutes} min)</span>
                ) : (
                  <span>Tâche {c.task_name}: {c.task_time} ({c.overlap_minutes} min)</span>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConflictDialog({ open: false, conflicts: [], pending: null })}>
              Annuler
            </Button>
            <Button 
              className="bg-amber-500 hover:bg-amber-600"
              onClick={() => {
                setConflictDialog({ open: false, conflicts: [], pending: null });
                toast.info('Conflit accepté');
              }}
            >
              Accepter le conflit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
