/**
 * Week Calculation Utilities for Timesheet
 * Weeks run Sunday (0) through Saturday (6)
 */

/**
 * Calculate the Saturday (week ending date) for any given date.
 */
export function getWeekEndingDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : new Date(date)
  const dayOfWeek = d.getDay() // 0 = Sunday, 6 = Saturday
  const daysUntilSaturday = 6 - dayOfWeek
  d.setDate(d.getDate() + daysUntilSaturday)
  return d.toISOString().split('T')[0]
}

/**
 * Calculate the Sunday (week start date) for a given week ending date.
 */
export function getWeekStartDate(weekEndingDate: string): string {
  const d = new Date(weekEndingDate + 'T00:00:00')
  d.setDate(d.getDate() - 6)
  return d.toISOString().split('T')[0]
}

/**
 * Get array of all dates in a week given the week ending date.
 * Returns dates from Sunday to Saturday.
 */
export function getWeekDates(weekEndingDate: string): string[] {
  const dates: string[] = []
  const endDate = new Date(weekEndingDate + 'T00:00:00')
  for (let i = 6; i >= 0; i--) {
    const d = new Date(endDate)
    d.setDate(endDate.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

/**
 * Validate that a date is a Saturday.
 */
export function isSaturday(date: string): boolean {
  const d = new Date(date + 'T00:00:00')
  return d.getDay() === 6
}

/**
 * Format a date for display (e.g., "Apr 5")
 */
export function formatShortDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Format week range for display (e.g., "Mar 30 - Apr 5, 2026")
 */
export function formatWeekRange(weekStartDate: string, weekEndingDate: string): string {
  const start = new Date(weekStartDate + 'T00:00:00')
  const end = new Date(weekEndingDate + 'T00:00:00')
  
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
  const startDay = start.getDate()
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
  const endDay = end.getDate()
  const year = end.getFullYear()
  
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${year}`
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`
}

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export type DayName = typeof DAYS[number]
