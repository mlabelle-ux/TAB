import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Time utilities
export const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

export const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const formatHoursMinutes = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// Date utilities
export const formatDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return date.toLocaleDateString('fr-CA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
};

export const formatDateShort = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return date.toLocaleDateString('fr-CA', {
    day: 'numeric',
    month: 'short'
  });
};

export const getWeekDates = (startDate) => {
  const dates = [];
  // Parse date string properly to avoid timezone issues
  const [year, month, day] = startDate.split('-').map(Number);
  const start = new Date(year, month - 1, day, 12, 0, 0);
  
  // Find Monday of the week
  const dayOfWeek = start.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days, otherwise go to Monday
  const monday = new Date(start);
  monday.setDate(start.getDate() + diff);
  
  for (let i = 0; i < 5; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
  }
  
  return dates;
};

export const getMonday = (dateStr) => {
  // Parse date string properly to avoid timezone issues
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day, 12, 0, 0);
  const dayOfWeek = d.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

export const isWeekend = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return date.getDay() === 0 || date.getDay() === 6;
};

// Color utilities
export const getContrastColor = (hexColor) => {
  if (!hexColor) return '#000000';
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

// Generate time slots for schedule
export const generateTimeSlots = (startHour = 5, endHour = 20, intervalMinutes = 30) => {
  const slots = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let min = 0; min < 60; min += intervalMinutes) {
      if (hour === endHour && min > 0) break;
      slots.push({
        time: `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`,
        minutes: hour * 60 + min
      });
    }
  }
  return slots;
};

// Calculate position for time block
export const calculateBlockPosition = (startTime, endTime, viewStartHour = 6.5, pixelsPerHour = 60) => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const viewStartMinutes = viewStartHour * 60;
  
  const left = ((startMinutes - viewStartMinutes) / 60) * pixelsPerHour;
  const width = ((endMinutes - startMinutes) / 60) * pixelsPerHour;
  
  return { left: Math.max(0, left), width: Math.max(20, width) };
};

// School colors palette
export const schoolColorPalette = [
  '#8B00FF', // Purple
  '#00FF00', // Lime
  '#0000FF', // Blue
  '#FFFF00', // Yellow
  '#FF0000', // Red
  '#00CED1', // Dark Cyan
  '#FF69B4', // Hot Pink
  '#FFA500', // Orange
  '#808080', // Gray
  '#C4B454', // Olive
  '#D2B48C', // Tan
  '#00FF7F', // Spring Green
  '#4169E1', // Royal Blue
  '#DC143C', // Crimson
  '#8A2BE2', // Blue Violet
];
