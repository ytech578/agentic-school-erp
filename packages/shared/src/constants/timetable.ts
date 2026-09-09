export type ClassCategory = 'PRIMARY' | 'UPPER_PRIMARY' | 'HIGH';

export const getClassCategory = (className: string): ClassCategory => {
  const name = className.toLowerCase();
  if (name.includes('10') || name.includes('11') || name.includes('12') || name.includes('9')) return 'HIGH';
  if (name.includes('6') || name.includes('7') || name.includes('8')) return 'UPPER_PRIMARY';
  return 'PRIMARY';
};

export const TIMETABLE_TEMPLATES = {
  PRIMARY: [
    { start: "09:00", end: "09:15", isBreak: true, name: "Prayer" },
    { start: "09:15", end: "10:00", num: 1 },
    { start: "10:00", end: "10:40", num: 2 },
    { start: "10:40", end: "10:50", isBreak: true, name: "Interval" },
    { start: "10:50", end: "11:30", num: 3 },
    { start: "11:30", end: "12:10", num: 4 },
    { start: "12:10", end: "13:10", isBreak: true, name: "Lunch" },
    { start: "13:10", end: "13:50", num: 5 },
    { start: "13:50", end: "14:30", num: 6 },
    { start: "14:30", end: "14:40", isBreak: true, name: "Interval" },
    { start: "14:40", end: "15:20", num: 7 },
    { start: "15:20", end: "16:00", num: 8 }
  ],
  UPPER_PRIMARY: [
    { start: "09:00", end: "09:15", isBreak: true, name: "Prayer" },
    { start: "09:15", end: "10:00", num: 1 },
    { start: "10:00", end: "10:40", num: 2 },
    { start: "10:40", end: "10:50", isBreak: true, name: "Interval" },
    { start: "10:50", end: "11:30", num: 3 },
    { start: "11:30", end: "12:10", num: 4 },
    { start: "12:10", end: "13:10", isBreak: true, name: "Lunch" },
    { start: "13:10", end: "13:50", num: 5 },
    { start: "13:50", end: "14:30", num: 6 },
    { start: "14:30", end: "14:40", isBreak: true, name: "Interval" },
    { start: "14:40", end: "15:20", num: 7 },
    { start: "15:20", end: "16:00", num: 8 },
    { start: "16:00", end: "16:30", num: 9 }
  ],
  HIGH: [
    { start: "09:00", end: "09:15", isBreak: true, name: "Prayer" },
    { start: "09:15", end: "10:00", num: 1 },
    { start: "10:00", end: "10:40", num: 2 },
    { start: "10:40", end: "11:20", num: 3 },
    { start: "11:20", end: "11:30", isBreak: true, name: "Interval" },
    { start: "11:30", end: "12:10", num: 4 },
    { start: "12:10", end: "12:50", num: 5 },
    { start: "12:50", end: "13:40", isBreak: true, name: "Lunch" },
    { start: "13:40", end: "14:20", num: 6 },
    { start: "14:20", end: "15:00", num: 7 },
    { start: "15:00", end: "15:10", isBreak: true, name: "Interval" },
    { start: "15:10", end: "15:50", num: 8 },
    { start: "15:50", end: "16:30", num: 9 }
  ]
};
