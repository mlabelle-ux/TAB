import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth
export const login = (password) => api.post('/auth/login', { password });
export const getAdmins = () => api.get('/admins');
export const initData = () => api.post('/init-data');

// Employees
export const getEmployees = () => api.get('/employees');
export const createEmployee = (data) => api.post('/employees', data);
export const updateEmployee = (id, data) => api.put(`/employees/${id}`, data);
export const deleteEmployee = (id) => api.delete(`/employees/${id}`);

// Schools
export const getSchools = () => api.get('/schools');
export const createSchool = (data) => api.post('/schools', data);
export const updateSchool = (id, data) => api.put(`/schools/${id}`, data);
export const deleteSchool = (id) => api.delete(`/schools/${id}`);

// Assignments
export const getAssignments = () => api.get('/assignments');
export const createAssignment = (data) => api.post('/assignments', data);
export const updateAssignment = (id, data) => api.put(`/assignments/${id}`, data);
export const deleteAssignment = (id) => api.delete(`/assignments/${id}`);

// Temporary Tasks
export const getTemporaryTasks = () => api.get('/temporary-tasks');
export const createTemporaryTask = (data) => api.post('/temporary-tasks', data);
export const updateTemporaryTask = (id, data) => api.put(`/temporary-tasks/${id}`, data);
export const deleteTemporaryTask = (id) => api.delete(`/temporary-tasks/${id}`);

// Absences
export const getAbsences = () => api.get('/absences');
export const createAbsence = (data) => api.post('/absences', data);
export const updateAbsence = (id, data) => api.put(`/absences/${id}`, data);
export const deleteAbsence = (id) => api.delete(`/absences/${id}`);

// Holidays
export const getHolidays = () => api.get('/holidays');
export const createHoliday = (data) => api.post('/holidays', data);
export const deleteHoliday = (id) => api.delete(`/holidays/${id}`);

// Schedule
export const getSchedule = (params) => api.get('/schedule', { params });
export const checkConflict = (data) => api.post('/check-conflict', data);

// Temporary Reassignments (Drag & Drop)
export const getTemporaryReassignments = (date) => 
  api.get('/temporary-reassignments', { params: date ? { date } : {} });
export const createTemporaryReassignment = (data) => 
  api.post('/temporary-reassignments', data);
export const deleteTemporaryReassignment = (id) => 
  api.delete(`/temporary-reassignments/${id}`);
export const deleteReassignmentsByDate = (date) => 
  api.delete(`/temporary-reassignments/by-date/${date}`);

// Reports
export const getHoursReportPDF = (startDate, endDate, employeeIds = '', sortBy = 'name') => {
  return `${API}/reports/hours-pdf?start_date=${startDate}&end_date=${endDate}&employee_ids=${employeeIds}&sort_by=${sortBy}`;
};

export default api;
