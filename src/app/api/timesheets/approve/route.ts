// src/app/api/timesheets/approve/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireApiRoles } from '@/lib/auth/api-authorization'

export async function POST(request: NextRequest) {
  // Admin only
  const auth = await requireApiRoles(['admin'])
  if (!auth.ok) return auth.response

  const supabase = await createClient()
  const { employeeId, weekEndingDate } = await request.json()

  // Validate weekEndingDate is a Saturday
  const date = new Date(weekEndingDate + 'T00:00:00')
  if (date.getDay() !== 6) {
    return NextResponse.json(
      { error: 'Week ending date must be a Saturday' },
      { status: 400 }
    )
  }

  // Get all submitted entries for this employee/week - cast to bypass strict typing
  const { data: entries, error: fetchError } = await (supabase
    .from('time_entries') as any)
    .select('id, status')
    .eq('employee_id', employeeId)
    .eq('week_ending_date', weekEndingDate)
    .in('status', ['submitted', 'draft'])

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!entries || entries.length === 0) {
    return NextResponse.json(
      { error: 'No pending entries found for this week' },
      { status: 400 }
    )
  }

  // Approve all entries for this week - cast to bypass strict typing
  const { error: updateError, data: updatedEntries } = await (supabase
    .from('time_entries') as any)
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: auth.user.id
    })
    .eq('employee_id', employeeId)
    .eq('week_ending_date', weekEndingDate)
    .in('status', ['submitted', 'draft'])
    .select()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `Approved ${entries.length} entries`,
    entriesApproved: entries.length,
    entries: updatedEntries
  })
}
