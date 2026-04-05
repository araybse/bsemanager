// src/app/api/timesheets/entry/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/api-authorization'

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()
  const body = await request.json()

  const {
    id,           // null for new, number for update
    project_id,
    project_number,
    phase_name,
    entry_date,
    hours,
    notes,        // REQUIRED - validation enforced
    employee_id   // Optional - for admin creating entries for other users
  } = body

  const hoursNum = parseFloat(hours) || 0
  const notesText = (notes || '').trim()

  // Validation: notes required if hours > 0
  if (hoursNum > 0 && notesText.length === 0) {
    return NextResponse.json(
      { error: 'Work description is required' },
      { status: 400 }
    )
  }

  // Calculate week_ending_date
  const date = new Date(entry_date + 'T00:00:00')
  const weekEndingDate = new Date(date)
  weekEndingDate.setDate(date.getDate() + (6 - date.getDay()))

  // Determine target employee - admin can specify, otherwise use current user
  let targetEmployeeId = auth.user.id
  
  if (id) {
    // For updates, check existing entry
    const { data: existingEntry } = await supabase
      .from('time_entries')
      .select('status, employee_id')
      .eq('id', id)
      .single()

    if ((existingEntry as any)?.status === 'approved') {
      return NextResponse.json(
        { error: 'Cannot edit approved time entries' },
        { status: 403 }
      )
    }

    if ((existingEntry as any)?.employee_id !== auth.user.id && auth.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Cannot edit another user\'s time entries' },
        { status: 403 }
      )
    }
    
    // For updates, keep the original employee_id
    targetEmployeeId = (existingEntry as any)?.employee_id || auth.user.id
  } else {
    // For new entries, admin can specify employee_id
    if (employee_id && auth.user.role === 'admin') {
      targetEmployeeId = employee_id
    }
  }

  // Get employee name from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', targetEmployeeId)
    .single()

  // Look up employee's cost rate from timeline assignment for the entry date
  // Query: WHERE employee_id = X AND entry_date BETWEEN effective_from AND effective_to
  const { data: timelineAssignment } = await supabase
    .from('employee_title_history')
    .select('labor_cost_rate')
    .eq('employee_id', targetEmployeeId)
    .lte('effective_from', entry_date)
    .or(`effective_to.is.null,effective_to.gte.${entry_date}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Calculate labor cost: hours × timeline cost rate (or 0 if no assignment/rate)
  const laborCostRate = (timelineAssignment as any)?.labor_cost_rate || 0
  const laborCost = hoursNum * laborCostRate

  const entryData = {
    employee_id: targetEmployeeId,
    employee_name: (profile as any)?.full_name || 'Unknown',
    project_id,
    project_number,
    phase_name,
    entry_date,
    hours: hoursNum,
    notes: notesText,
    status: 'draft',
    week_ending_date: weekEndingDate.toISOString().split('T')[0],
    is_billable: true,
    labor_cost: laborCost
  }

  let result
  if (id) {
    // Update existing - cast to bypass strict typing
    // Recalculate labor_cost on update in case hours changed
    const { data, error } = await (supabase
      .from('time_entries') as any)
      .update({
        hours: entryData.hours,
        notes: entryData.notes,
        labor_cost: laborCost,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    result = data
  } else {
    // Insert new - cast to bypass strict typing
    const { data, error } = await (supabase
      .from('time_entries') as any)
      .insert(entryData)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    result = data
  }

  return NextResponse.json({ success: true, entry: result })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()
  const { id } = await request.json()

  // Verify ownership and status
  const { data: existingEntry } = await supabase
    .from('time_entries')
    .select('status, employee_id')
    .eq('id', id)
    .single()

  if (!existingEntry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }

  if ((existingEntry as any).status !== 'draft') {
    return NextResponse.json(
      { error: 'Can only delete draft entries' },
      { status: 403 }
    )
  }

  if ((existingEntry as any).employee_id !== auth.user.id && auth.user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Cannot delete another user\'s entries' },
      { status: 403 }
    )
  }

  const { error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
