import { useQuery } from '@tanstack/react-query'

export interface TimesheetEntry {
  id: number
  hours: number
  notes: string
  status: 'draft' | 'submitted' | 'approved'
}

export interface TimesheetGridRow {
  project_id: number
  project_number: string
  project_name: string | null
  phase_name: string
  days: {
    Sun: TimesheetEntry | null
    Mon: TimesheetEntry | null
    Tue: TimesheetEntry | null
    Wed: TimesheetEntry | null
    Thu: TimesheetEntry | null
    Fri: TimesheetEntry | null
    Sat: TimesheetEntry | null
  }
  total: number
}

export interface TimesheetTotals {
  byDay: {
    Sun: number
    Mon: number
    Tue: number
    Wed: number
    Thu: number
    Fri: number
    Sat: number
  }
  total: number
}

export interface TimesheetData {
  weekEndingDate: string
  weekStartDate: string
  employeeId: string
  entries: any[]
  gridData: TimesheetGridRow[]
  weekStatus: 'empty' | 'draft' | 'submitted' | 'approved'
  totals: TimesheetTotals
}

export function useTimesheet(weekEndingDate: string, employeeId: string) {
  return useQuery<TimesheetData>({
    queryKey: ['timesheet', weekEndingDate, employeeId],
    queryFn: async () => {
      const params = new URLSearchParams({ employee_id: employeeId })
      const res = await fetch(`/api/timesheets/${weekEndingDate}?${params}`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch timesheet')
      }
      return res.json()
    },
    enabled: !!employeeId && !!weekEndingDate
  })
}
