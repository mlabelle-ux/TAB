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
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('fr-CA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
};

export const formatDateShort = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('fr-CA', {
    day: 'numeric',
    month: 'short'
  });
};

export const getWeekDates = (startDate) => {
  const dates = [];
  const start = new Date(startDate);
  
  // Find Monday of the week
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(start.setDate(diff));
  
  for (let i = 0; i < 5; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  
  return dates;
};

export const getMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
};

export const isWeekend = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
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
