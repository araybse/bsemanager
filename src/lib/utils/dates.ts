import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parseDateInput(date: Date | string): Date {
  if (typeof date !== 'string') return date

  // Parse YYYY-MM-DD as a local calendar date to avoid timezone day-shift.
  if (DATE_ONLY_PATTERN.test(date)) {
    const [year, month, day] = date.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  return new Date(date)
}

/**
 * Get the first day of last month
 */
export function getFirstOfLastMonth(date: Date = new Date()): Date {
  return startOfMonth(subMonths(date, 1))
}

/**
 * Get the last day of last month
 */
export function getLastOfLastMonth(date: Date = new Date()): Date {
  return endOfMonth(subMonths(date, 1))
}

/**
 * Get billing period date range as formatted string
 * e.g., "December 1, 2025 to December 31, 2025"
 */
export function getBillingPeriodRange(date: Date = new Date()): string {
  const first = getFirstOfLastMonth(date)
  const last = getLastOfLastMonth(date)
  return `${format(first, 'MMMM d, yyyy')} to ${format(last, 'MMMM d, yyyy')}`
}

/**
 * Get budget date (1st of month after invoice date)
 */
export function getBudgetDate(invoiceDate: Date): Date {
  return startOfMonth(addMonths(invoiceDate, 1))
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = parseDateInput(date)
  return format(d, 'M/d/yyyy')
}

/**
 * Format date/time for display
 */
export function formatDateTime(date: Date | string): string {
  const d = parseDateInput(date)
  return format(d, 'M/d/yyyy h:mm a')
}

/**
 * Format date for invoice display (e.g., "January 15, 2026")
 */
export function formatInvoiceDate(date: Date | string): string {
  const d = parseDateInput(date)
  return format(d, 'MMMM d, yyyy')
}

/**
 * Get billing month name (last month)
 */
export function getBillingMonthName(date: Date = new Date()): string {
  return format(subMonths(date, 1), 'MMMM')
}
