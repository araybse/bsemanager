// src/app/api/timesheets/pending-approvals/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireApiRoles } from '@/lib/auth/api-authorization'

export async function GET(request: NextRequest) {
  const auth = await requireApiRoles(['admin'])
  if (!auth.ok) return auth.response

  const supabase = await createClient()

  // Get all weeks with submitted entries, grouped by employee - cast to bypass strict typing
  const { data, error } = await (supabase
    .from('time_entries') as any)
    .select(`
      employee_id,
      employee_name,
      week_ending_date,
      status,
      hours
    `)
    .in('status', ['submitted', 'draft'])
    .order('week_ending_date', { ascending: false })
    .order('employee_name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Group by employee + week
  type EntryType = {
    employee_id: string | null
    employee_name: string
    week_ending_date: string
    status: string
    hours: number
  }
  
  const typedData = (data || []) as EntryType[]
  
  const grouped = new Map<string, {
    employeeId: string | null
    employeeName: string
    weekEndingDate: string
    totalHours: number
    entryCount: number
    hasSubmitted: boolean
    hasDraft: boolean
  }>()

  typedData.forEach(entry => {
    const key = `${entry.employee_id}|${entry.week_ending_date}`
    if (!grouped.has(key)) {
      grouped.set(key, {
        employeeId: entry.employee_id,
        employeeName: entry.employee_name,
        weekEndingDate: entry.week_ending_date,
        totalHours: 0,
        entryCount: 0,
        hasSubmitted: false,
        hasDraft: false
      })
    }
    const group = grouped.get(key)!
    group.totalHours += entry.hours || 0
    group.entryCount++
    if (entry.status === 'submitted') group.hasSubmitted = true
    if (entry.status === 'draft') group.hasDraft = true
  })

  // Filter to only show weeks with at least one submitted entry
  const pendingApprovals = Array.from(grouped.values())
    .filter(g => g.hasSubmitted)
    .map(g => ({
      ...g,
      status: g.hasDraft ? 'partial' : 'submitted',
      totalHours: Math.round(g.totalHours * 10) / 10 // Round to 1 decimal
    }))

  return NextResponse.json({ 
    pendingApprovals,
    count: pendingApprovals.length
  })
}
