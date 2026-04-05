// src/app/api/timesheets/[week]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/api-authorization'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ week: string }> }
) {
  const auth = await requireApiAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()
  const { week: weekEndingDate } = await params
  
  // Validate it's a Saturday
  const date = new Date(weekEndingDate + 'T00:00:00')
  if (date.getDay() !== 6) {
    return NextResponse.json(
      { error: 'Week parameter must be a Saturday date' },
      { status: 400 }
    )
  }

  // Calculate Sunday (start of week)
  const weekStart = new Date(date)
  weekStart.setDate(weekStart.getDate() - 6)

  // Determine which employee's data to fetch
  const employeeId = request.nextUrl.searchParams.get('employee_id')
  const targetEmployee = auth.user.role === 'admin' && employeeId 
    ? employeeId 
    : auth.user.id

  // Fetch entries for the week - cast to bypass strict typing
  const { data: entries, error } = await (supabase
    .from('time_entries') as any)
    .select(`
      id,
      employee_id,
      employee_name,
      entry_date,
      project_id,
      project_number,
      phase_name,
      hours,
      notes,
      status,
      is_billable,
      projects (
        id,
        name,
        project_number
      )
    `)
    .eq('employee_id', targetEmployee)
    .eq('week_ending_date', weekEndingDate)
    .order('project_number')
    .order('phase_name')
    .order('entry_date')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Transform into grid format
  const gridData = transformToGrid(entries || [], weekStart)

  // Check week status
  const weekStatus = determineWeekStatus(entries || [])

  return NextResponse.json({
    weekEndingDate,
    weekStartDate: weekStart.toISOString().split('T')[0],
    employeeId: targetEmployee,
    entries,
    gridData,
    weekStatus,
    totals: calculateTotals(entries || [])
  })
}

interface TimeEntry {
  id: number
  project_id: number | null
  project_number: string
  phase_name: string
  entry_date: string
  hours: number
  notes: string | null
  status: string
  projects?: { id: number; name: string; project_number: string } | null
}

function determineWeekStatus(entries: TimeEntry[]) {
  if (entries.length === 0) return 'empty'
  if (entries.every(e => e.status === 'approved')) return 'approved'
  if (entries.every(e => e.status === 'submitted' || e.status === 'approved')) return 'submitted'
  return 'draft'
}

function transformToGrid(entries: TimeEntry[], weekStart: Date) {
  // Group by project_number + phase_name
  const rows = new Map<string, {
    project_id: number | null
    project_number: string
    project_name: string | null
    phase_name: string
    days: Record<string, { id: number; hours: number; notes: string | null; status: string } | null>
    total: number
  }>()
  
  entries.forEach(entry => {
    const key = `${entry.project_number}|${entry.phase_name}`
    if (!rows.has(key)) {
      rows.set(key, {
        project_id: entry.project_id,
        project_number: entry.project_number,
        project_name: entry.projects?.name || null,
        phase_name: entry.phase_name,
        days: { Sun: null, Mon: null, Tue: null, Wed: null, Thu: null, Fri: null, Sat: null },
        total: 0
      })
    }
    
    const row = rows.get(key)!
    const entryDate = new Date(entry.entry_date + 'T00:00:00')
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][entryDate.getDay()]
    
    row.days[dayName] = {
      id: entry.id,
      hours: entry.hours,
      notes: entry.notes,
      status: entry.status
    }
    row.total += entry.hours || 0
  })

  return Array.from(rows.values())
}

function calculateTotals(entries: TimeEntry[]) {
  const byDay: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 }
  let total = 0

  entries.forEach(entry => {
    const date = new Date(entry.entry_date + 'T00:00:00')
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
    const hours = entry.hours || 0
    byDay[dayName] += hours
    total += hours
  })

  return { byDay, total }
}
