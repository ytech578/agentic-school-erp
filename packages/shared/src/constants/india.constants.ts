// ============================================================
// India-specific constants
// AI School ERP V1.0
// ============================================================

export const INDIA_CONFIG = {
  country: 'India',
  currency: 'INR',
  currencySymbol: '₹',
  timezone: 'Asia/Kolkata',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12h',
  locale: 'en-IN',
  academicYearStart: 4, // April (month number)
  academicYearEnd: 3,   // March
} as const;

export const GRADE_SCALE = [
  { grade: 'A+', minPercent: 90, maxPercent: 100, gradePoint: 10 },
  { grade: 'A',  minPercent: 80, maxPercent: 89,  gradePoint: 9 },
  { grade: 'B+', minPercent: 70, maxPercent: 79,  gradePoint: 8 },
  { grade: 'B',  minPercent: 60, maxPercent: 69,  gradePoint: 7 },
  { grade: 'C+', minPercent: 50, maxPercent: 59,  gradePoint: 6 },
  { grade: 'C',  minPercent: 40, maxPercent: 49,  gradePoint: 5 },
  { grade: 'D',  minPercent: 33, maxPercent: 39,  gradePoint: 4 },
  { grade: 'F',  minPercent: 0,  maxPercent: 32,  gradePoint: 0 },
] as const;

export const ATTENDANCE_THRESHOLD = 75; // Percentage below which alert is triggered

export const BLOOD_GROUPS = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
] as const;

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const;

export const BOARD_TYPES = [
  'CBSE', 'ICSE', 'ISC', 'State Board', 'IB', 'IGCSE', 'NIOS', 'Other'
] as const;

export const CLASS_LEVELS = [
  { name: 'Pre-KG', level: 0 },
  { name: 'LKG', level: 1 },
  { name: 'UKG', level: 2 },
  { name: 'Class 1', level: 3 },
  { name: 'Class 2', level: 4 },
  { name: 'Class 3', level: 5 },
  { name: 'Class 4', level: 6 },
  { name: 'Class 5', level: 7 },
  { name: 'Class 6', level: 8 },
  { name: 'Class 7', level: 9 },
  { name: 'Class 8', level: 10 },
  { name: 'Class 9', level: 11 },
  { name: 'Class 10', level: 12 },
  { name: 'Class 11', level: 13 },
  { name: 'Class 12', level: 14 },
] as const;

/**
 * Format number in Indian numbering system
 * 1000000 → "10,00,000"
 */
export function formatIndianNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num);
}

/**
 * Format amount in Indian Rupees
 * 100000 → "₹1,00,000"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get current Indian Academic Year string
 * e.g. if current date is August 2026, returns "2026-27"
 */
export function getCurrentAcademicYear(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-indexed
  const year = now.getFullYear();
  if (month >= INDIA_CONFIG.academicYearStart) {
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
}

export function getAcademicYearDates(yearString: string): { start: Date; end: Date } {
  const startYear = parseInt(yearString.split('-')[0]);
  return {
    start: new Date(startYear, 3, 1),        // April 1
    end: new Date(startYear + 1, 2, 31),     // March 31
  };
}
