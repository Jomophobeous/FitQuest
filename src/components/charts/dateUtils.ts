/**
 * Date utilities for charts
 * 
 * Simple date formatting without external dependencies.
 * Uses native Intl and Date APIs.
 */

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Parse ISO date string to Date object
 */
export function parseISO(dateStr: string): Date {
  return new Date(dateStr);
}

/**
 * Format date using specified format string
 * Supports: EEE (day short), d (day num), MMM d, yyyy-MM-dd, MMMM yyyy
 */
export function formatDate(date: Date, pattern: string): string {
  switch (pattern) {
    case 'EEE':
      return DAY_NAMES_SHORT[date.getDay()];
    case 'd':
      return String(date.getDate());
    case 'MMM d':
      return `${MONTH_NAMES_SHORT[date.getMonth()]} ${date.getDate()}`;
    case 'yyyy-MM-dd':
      return date.toISOString().split('T')[0];
    case 'MMMM yyyy':
      return `${MONTH_NAMES_FULL[date.getMonth()]} ${date.getFullYear()}`;
    default:
      return date.toLocaleDateString();
  }
}

/**
 * Get start of month (first day at 00:00:00)
 */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get number of days in month
 */
export function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Get day of week (0-6, Sunday = 0)
 */
export function getDay(date: Date): number {
  return date.getDay();
}

/**
 * Add days to date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Difference in days between two dates
 */
export function differenceInDays(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}
