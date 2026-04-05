// src/app/api/timesheets/submit/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/api-authorization'

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()
  const { weekEndingDate } = await request.json()

  // Validate weekEndingDate is a Saturday
  const date = new Date(weekEndingDate + 'T00:00:00')
  if (date.getDay() !== 6) {
    return NextResponse.json(
      { error: 'Week ending date must be a Saturday' },
      { status: 400 }
    )
  }

  // Get all draft entries for this week - cast to bypass strict typing
  const { data: entries, error: fetchError } = await (supabase
    .from('time_entries') as any)
    .select('id, notes, status, hours')
    .eq('employee_id', auth.user.id)
    .eq('week_ending_date', weekEndingDate)
    .eq('status', 'draft')

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!entries || entries.length === 0) {
    return NextResponse.json(
      { error: 'No draft entries found for this week' },
      { status: 400 }
    )
  }

  // Validate all entries with hours > 0 have descriptions
  const missingNotes = entries.filter(
    (e: any) => (e.hours || 0) > 0 && (!e.notes || e.notes.trim() === '')
  )
  if (missingNotes.length > 0) {
    return NextResponse.json(
      { error: `${missingNotes.length} entries are missing work descriptions` },
      { status: 400 }
    )
  }

  // Update all draft entries to submitted - cast to bypass strict typing
  const { error: updateError } = await (supabase
    .from('time_entries') as any)
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString()
    })
    .eq('employee_id', auth.user.id)
    .eq('week_ending_date', weekEndingDate)
    .eq('status', 'draft')

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `Submitted ${entries.length} entries for approval`,
    entriesSubmitted: entries.length
  })
}
