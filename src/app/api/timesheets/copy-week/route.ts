// src/app/api/timesheets/copy-week/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/api-authorization'

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()
  const { targetWeekEndingDate } = await request.json()

  // Calculate previous week
  const targetDate = new Date(targetWeekEndingDate + 'T00:00:00')
  const previousWeekEnd = new Date(targetDate)
  previousWeekEnd.setDate(targetDate.getDate() - 7)

  // Fetch previous week's entries (unique project/phase combos) - cast to bypass strict typing
  const { data: previousEntries, error: fetchError } = await (supabase
    .from('time_entries') as any)
    .select('project_id, project_number, phase_name')
    .eq('employee_id', auth.user.id)
    .eq('week_ending_date', previousWeekEnd.toISOString().split('T')[0])

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!previousEntries || previousEntries.length === 0) {
    return NextResponse.json(
      { error: 'No entries found in previous week to copy' },
      { status: 400 }
    )
  }

  // Get unique project/phase combinations
  type EntryType = { project_id: number | null; project_number: string; phase_name: string }
  const typedEntries = previousEntries as EntryType[]
  const uniqueCombos = new Map<string, EntryType>()
  typedEntries.forEach(entry => {
    const key = `${entry.project_number}|${entry.phase_name}`
    if (!uniqueCombos.has(key)) {
      uniqueCombos.set(key, entry)
    }
  })

  // Check for existing entries in target week - cast to bypass strict typing
  const { data: existingEntries } = await (supabase
    .from('time_entries') as any)
    .select('project_number, phase_name')
    .eq('employee_id', auth.user.id)
    .eq('week_ending_date', targetWeekEndingDate)

  type ExistingType = { project_number: string; phase_name: string }
  const typedExisting = (existingEntries || []) as ExistingType[]
  const existingKeys = new Set(
    typedExisting.map(e => `${e.project_number}|${e.phase_name}`)
  )

  // Filter out already existing combinations
  const toCopy = Array.from(uniqueCombos.values()).filter(
    entry => !existingKeys.has(`${entry.project_number}|${entry.phase_name}`)
  )

  if (toCopy.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'All project/phase combinations already exist in target week',
      entriesCopied: 0
    })
  }

  // Get employee name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', auth.user.id)
    .single()

  // Create placeholder entries (0 hours, empty notes) for Monday of target week
  const mondayDate = new Date(targetDate)
  mondayDate.setDate(targetDate.getDate() - 5) // Saturday - 5 = Monday

  const newEntries = toCopy.map(entry => ({
    employee_id: auth.user.id,
    employee_name: (profile as any)?.full_name || 'Unknown',
    project_id: entry.project_id,
    project_number: entry.project_number,
    phase_name: entry.phase_name,
    entry_date: mondayDate.toISOString().split('T')[0],
    hours: 0,
    notes: '',  // Will require filling in before submit
    status: 'draft',
    week_ending_date: targetWeekEndingDate,
    is_billable: true
  }))

  // Insert new entries - cast to bypass strict typing
  const { error: insertError } = await (supabase
    .from('time_entries') as any)
    .insert(newEntries)

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `Copied ${toCopy.length} project/phase rows from previous week`,
    entriesCopied: toCopy.length
  })
}
