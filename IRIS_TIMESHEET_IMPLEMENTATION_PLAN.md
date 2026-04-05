# IRIS Timesheet Feature Implementation Plan

**Feature:** Built-in Weekly Timesheet System  
**Version:** 2.0 Major Feature  
**Author:** Oliver (Strategic Planner)  
**Date:** April 5, 2026  
**Status:** Planning Complete

---

## Executive Summary

This document outlines the comprehensive implementation plan for replacing QuickBooks Time with IRIS's built-in timesheet system. The feature introduces:
- Weekly calendar-based time entry (Sun-Sat weeks)
- Draft → Submitted → Approved workflow
- Admin-only week approval
- Full integration with existing time_entries table

**Estimated Total Effort:** 45-55 hours  
**Complexity:** High (V2.0 level feature)

---

## A. Database Schema Changes

### A.1 Migration: Add Timesheet Fields

**File:** `supabase/migrations/YYYYMMDD_timesheet_status_fields.sql`

```sql
-- ============================================================================
-- Timesheet Status Fields Migration
-- Adds status and week_ending_date to time_entries for timesheet workflow
-- ============================================================================

-- 1. Add new columns
ALTER TABLE public.time_entries
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
CHECK (status IN ('draft', 'submitted', 'approved'));

ALTER TABLE public.time_entries
ADD COLUMN IF NOT EXISTS week_ending_date DATE;

-- 2. Add submitted_at and approved_at timestamps for audit trail
ALTER TABLE public.time_entries
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

ALTER TABLE public.time_entries
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE public.time_entries
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id);

-- 3. Create function to calculate week_ending_date (Saturday of the week)
-- Week is Sun (0) through Sat (6)
CREATE OR REPLACE FUNCTION public.calculate_week_ending_date(entry_date DATE)
RETURNS DATE AS $$
BEGIN
  -- Add days to get to Saturday (6 - day_of_week)
  -- PostgreSQL: 0=Sunday, 6=Saturday
  RETURN entry_date + (6 - EXTRACT(DOW FROM entry_date))::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Backfill week_ending_date for existing entries
UPDATE public.time_entries
SET week_ending_date = public.calculate_week_ending_date(entry_date)
WHERE week_ending_date IS NULL;

-- 5. Make week_ending_date NOT NULL after backfill
ALTER TABLE public.time_entries
ALTER COLUMN week_ending_date SET NOT NULL;

-- 6. Create trigger to auto-set week_ending_date on insert/update
CREATE OR REPLACE FUNCTION public.set_week_ending_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.week_ending_date := public.calculate_week_ending_date(NEW.entry_date);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_time_entries_set_week_ending ON public.time_entries;
CREATE TRIGGER tr_time_entries_set_week_ending
  BEFORE INSERT OR UPDATE OF entry_date ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_week_ending_date();

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS ix_time_entries_status
  ON public.time_entries (status);

CREATE INDEX IF NOT EXISTS ix_time_entries_week_ending_date
  ON public.time_entries (week_ending_date);

CREATE INDEX IF NOT EXISTS ix_time_entries_employee_week
  ON public.time_entries (employee_id, week_ending_date);

CREATE INDEX IF NOT EXISTS ix_time_entries_employee_status_week
  ON public.time_entries (employee_id, status, week_ending_date);

-- 8. Composite index for common timesheet queries
CREATE INDEX IF NOT EXISTS ix_time_entries_timesheet_lookup
  ON public.time_entries (employee_id, week_ending_date, status)
  INCLUDE (project_id, phase_name, hours, notes);

COMMENT ON COLUMN public.time_entries.status IS 
  'Timesheet workflow status: draft (editable), submitted (pending approval), approved (locked)';

COMMENT ON COLUMN public.time_entries.week_ending_date IS 
  'Saturday of the week containing entry_date. Used for weekly timesheet grouping.';
```

### A.2 Data Migration Strategy

**Existing Data Treatment:**
```sql
-- All existing time_entries should be marked as 'approved' 
-- since they came from QB Time (already through approval process)
UPDATE public.time_entries
SET 
  status = 'approved',
  approved_at = created_at,  -- Use creation date as approval date
  approved_by = NULL  -- Historical data, no specific approver
WHERE status IS NULL OR status = 'draft';
```

### A.3 RLS Policy Updates

**File:** `supabase/migrations/YYYYMMDD_timesheet_rls_policies.sql`

```sql
-- ============================================================================
-- Timesheet RLS Policies
-- Extends existing time_entries policies for status-based access control
-- ============================================================================

-- Drop existing policies to recreate with status awareness
DROP POLICY IF EXISTS "time_entries_own_entry_update" ON public.time_entries;

-- 1. Users can INSERT new draft entries (their own)
CREATE POLICY "time_entries_insert_own" ON public.time_entries
  AS PERMISSIVE FOR INSERT WITH CHECK (
    employee_id = auth.uid()
    AND status = 'draft'
  );

-- 2. Users can UPDATE their own entries IF not approved
CREATE POLICY "time_entries_update_own_not_approved" ON public.time_entries
  AS PERMISSIVE FOR UPDATE USING (
    employee_id = auth.uid()
    AND status != 'approved'
  ) WITH CHECK (
    employee_id = auth.uid()
    AND status != 'approved'
  );

-- 3. Users can DELETE their own draft entries only
CREATE POLICY "time_entries_delete_own_draft" ON public.time_entries
  AS PERMISSIVE FOR DELETE USING (
    employee_id = auth.uid()
    AND status = 'draft'
  );

-- 4. Admin can approve (update status to 'approved')
-- Note: Admin already has full access via time_entries_admin_full policy

-- 5. Create view for week approval status (helper for admin)
CREATE OR REPLACE VIEW public.timesheet_week_summary AS
SELECT 
  employee_id,
  week_ending_date,
  COUNT(*) as entry_count,
  SUM(hours) as total_hours,
  MIN(status) as status,  -- Will show 'draft' if any drafts exist
  COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
  COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted_count,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count
FROM public.time_entries
GROUP BY employee_id, week_ending_date;

GRANT SELECT ON public.timesheet_week_summary TO authenticated;
```

---

## B. API Endpoints

### B.1 GET /api/timesheets/[week]/route.ts

Fetches all time entries for a specific week.

```typescript
// src/app/api/timesheets/[week]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/api-authorization'

export async function GET(
  request: NextRequest,
  { params }: { params: { week: string } }
) {
  const auth = await requireApiAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()
  const weekEndingDate = params.week // Format: YYYY-MM-DD (must be a Saturday)
  
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

  // Fetch entries for the week
  const { data: entries, error } = await supabase
    .from('time_entries')
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
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const gridData = transformToGrid(entries, weekStart)

  // Check week status
  const weekStatus = determineWeekStatus(entries)

  return NextResponse.json({
    weekEndingDate,
    weekStartDate: weekStart.toISOString().split('T')[0],
    employeeId: targetEmployee,
    entries,
    gridData,
    weekStatus,
    totals: calculateTotals(entries)
  })
}

function determineWeekStatus(entries: any[]) {
  if (entries.length === 0) return 'empty'
  if (entries.every(e => e.status === 'approved')) return 'approved'
  if (entries.every(e => e.status === 'submitted' || e.status === 'approved')) return 'submitted'
  return 'draft'
}

function transformToGrid(entries: any[], weekStart: Date) {
  // Group by project_number + phase_name
  const rows: Map<string, any> = new Map()
  
  entries.forEach(entry => {
    const key = `${entry.project_number}|${entry.phase_name}`
    if (!rows.has(key)) {
      rows.set(key, {
        project_id: entry.project_id,
        project_number: entry.project_number,
        project_name: entry.projects?.name,
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
    row.total += parseFloat(entry.hours) || 0
  })

  return Array.from(rows.values())
}

function calculateTotals(entries: any[]) {
  const byDay: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 }
  let total = 0

  entries.forEach(entry => {
    const date = new Date(entry.entry_date + 'T00:00:00')
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
    const hours = parseFloat(entry.hours) || 0
    byDay[dayName] += hours
    total += hours
  })

  return { byDay, total }
}
```

### B.2 POST /api/timesheets/entry/route.ts

Creates or updates a single time entry.

```typescript
// src/app/api/timesheets/entry/route.ts

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
    notes         // REQUIRED - validation enforced
  } = body

  // Validation: notes required
  if (!notes || notes.trim().length === 0) {
    return NextResponse.json(
      { error: 'Work description is required' },
      { status: 400 }
    )
  }

  // Calculate week_ending_date
  const date = new Date(entry_date + 'T00:00:00')
  const weekEndingDate = new Date(date)
  weekEndingDate.setDate(date.getDate() + (6 - date.getDay()))

  // Check if this week is already approved (for updates)
  if (id) {
    const { data: existing } = await supabase
      .from('time_entries')
      .select('status, employee_id')
      .eq('id', id)
      .single()

    if (existing?.status === 'approved') {
      return NextResponse.json(
        { error: 'Cannot edit approved time entries' },
        { status: 403 }
      )
    }

    if (existing?.employee_id !== auth.user.id && auth.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Cannot edit another user\'s time entries' },
        { status: 403 }
      )
    }
  }

  // Get employee name from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', auth.user.id)
    .single()

  const entryData = {
    employee_id: auth.user.id,
    employee_name: profile?.full_name || 'Unknown',
    project_id,
    project_number,
    phase_name,
    entry_date,
    hours: parseFloat(hours) || 0,
    notes: notes.trim(),
    status: 'draft',
    week_ending_date: weekEndingDate.toISOString().split('T')[0],
    is_billable: true
  }

  let result
  if (id) {
    // Update existing
    const { data, error } = await supabase
      .from('time_entries')
      .update({
        hours: entryData.hours,
        notes: entryData.notes,
        // Don't change status on edit
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    result = data
  } else {
    // Insert new
    const { data, error } = await supabase
      .from('time_entries')
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
  const { data: existing } = await supabase
    .from('time_entries')
    .select('status, employee_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }

  if (existing.status !== 'draft') {
    return NextResponse.json(
      { error: 'Can only delete draft entries' },
      { status: 403 }
    )
  }

  if (existing.employee_id !== auth.user.id && auth.user.role !== 'admin') {
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
```

### B.3 POST /api/timesheets/submit/route.ts

Submits a week for approval.

```typescript
// src/app/api/timesheets/submit/route.ts

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

  // Get all draft entries for this week
  const { data: entries, error: fetchError } = await supabase
    .from('time_entries')
    .select('id, notes, status')
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

  // Validate all entries have descriptions
  const missingNotes = entries.filter(e => !e.notes || e.notes.trim() === '')
  if (missingNotes.length > 0) {
    return NextResponse.json(
      { error: `${missingNotes.length} entries are missing work descriptions` },
      { status: 400 }
    )
  }

  // Update all draft entries to submitted
  const { error: updateError } = await supabase
    .from('time_entries')
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
```

### B.4 POST /api/timesheets/approve/route.ts

Admin approves a week (all entries for an employee).

```typescript
// src/app/api/timesheets/approve/route.ts

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

  // Get all submitted entries for this employee/week
  const { data: entries, error: fetchError } = await supabase
    .from('time_entries')
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

  // Approve all entries for this week
  const { error: updateError } = await supabase
    .from('time_entries')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: auth.user.id
    })
    .eq('employee_id', employeeId)
    .eq('week_ending_date', weekEndingDate)
    .in('status', ['submitted', 'draft'])

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `Approved ${entries.length} entries`,
    entriesApproved: entries.length
  })
}
```

### B.5 POST /api/timesheets/copy-week/route.ts

Copies entries from previous week.

```typescript
// src/app/api/timesheets/copy-week/route.ts

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

  // Fetch previous week's entries (unique project/phase combos)
  const { data: previousEntries, error: fetchError } = await supabase
    .from('time_entries')
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
  const uniqueCombos = new Map<string, any>()
  previousEntries.forEach(entry => {
    const key = `${entry.project_number}|${entry.phase_name}`
    if (!uniqueCombos.has(key)) {
      uniqueCombos.set(key, entry)
    }
  })

  // Check for existing entries in target week
  const { data: existingEntries } = await supabase
    .from('time_entries')
    .select('project_number, phase_name')
    .eq('employee_id', auth.user.id)
    .eq('week_ending_date', targetWeekEndingDate)

  const existingKeys = new Set(
    (existingEntries || []).map(e => `${e.project_number}|${e.phase_name}`)
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
    employee_name: profile?.full_name || 'Unknown',
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

  const { error: insertError } = await supabase
    .from('time_entries')
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
```

### B.6 GET /api/timesheets/pending-approvals/route.ts

Admin endpoint to see all pending timesheets.

```typescript
// src/app/api/timesheets/pending-approvals/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireApiRoles } from '@/lib/auth/api-authorization'

export async function GET(request: NextRequest) {
  const auth = await requireApiRoles(['admin'])
  if (!auth.ok) return auth.response

  const supabase = await createClient()

  // Get all weeks with submitted entries, grouped by employee
  const { data, error } = await supabase
    .from('time_entries')
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
  const grouped = new Map<string, any>()
  data?.forEach(entry => {
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
    group.totalHours += parseFloat(entry.hours) || 0
    group.entryCount++
    if (entry.status === 'submitted') group.hasSubmitted = true
    if (entry.status === 'draft') group.hasDraft = true
  })

  const pendingApprovals = Array.from(grouped.values())
    .filter(g => g.hasSubmitted) // Only show weeks with at least one submitted entry
    .map(g => ({
      ...g,
      status: g.hasDraft ? 'partial' : 'submitted'
    }))

  return NextResponse.json({ pendingApprovals })
}
```

---

## C. UI Components

### C.1 Component Architecture

```
src/app/(authenticated)/time/
├── page.tsx                    # Main page with tabs (existing + new Timesheet)
├── components/
│   ├── TimesheetTab.tsx        # Main timesheet tab container
│   ├── WeeklyCalendarGrid.tsx  # The calendar grid UI
│   ├── TimeEntryRow.tsx        # Single project/phase row
│   ├── TimeEntryCell.tsx       # Single day cell (click to edit)
│   ├── DescriptionEditor.tsx   # Sidebar for editing notes
│   ├── WeekNavigator.tsx       # Prev/Next week controls
│   ├── ProjectPhaseSelector.tsx # Add new row with typeahead
│   ├── TimesheetActions.tsx    # Submit/Approve buttons
│   └── AdminApprovalPanel.tsx  # Admin view of pending approvals
└── hooks/
    ├── useTimesheet.ts         # Main data fetching hook
    ├── useTimesheetMutations.ts # Create/update/delete/submit
    └── useWeekNavigation.ts    # Week calculation helpers
```

### C.2 TimesheetTab.tsx

Main container component for the timesheet view.

```tsx
// src/app/(authenticated)/time/components/TimesheetTab.tsx

'use client'

import { useState } from 'react'
import { useTimesheet } from '../hooks/useTimesheet'
import { useWeekNavigation } from '../hooks/useWeekNavigation'
import { WeekNavigator } from './WeekNavigator'
import { WeeklyCalendarGrid } from './WeeklyCalendarGrid'
import { DescriptionEditor } from './DescriptionEditor'
import { ProjectPhaseSelector } from './ProjectPhaseSelector'
import { TimesheetActions } from './TimesheetActions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface TimesheetTabProps {
  currentUserId: string
  userRole: 'admin' | 'project_manager' | 'employee'
}

export function TimesheetTab({ currentUserId, userRole }: TimesheetTabProps) {
  const { currentWeek, goToPreviousWeek, goToNextWeek, goToCurrentWeek } = useWeekNavigation()
  const [selectedCell, setSelectedCell] = useState<{
    entryId: number | null
    projectNumber: string
    phaseName: string
    date: string
    hours: number
    notes: string
  } | null>(null)

  const { 
    data: timesheet, 
    isLoading, 
    error,
    refetch 
  } = useTimesheet(currentWeek.weekEndingDate, currentUserId)

  const handleCellClick = (cell: typeof selectedCell) => {
    if (timesheet?.weekStatus === 'approved') return // Can't edit approved weeks
    setSelectedCell(cell)
  }

  const handleEditorClose = () => {
    setSelectedCell(null)
    refetch()
  }

  const isEditable = timesheet?.weekStatus !== 'approved'

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <WeekNavigator
          weekStart={currentWeek.weekStartDate}
          weekEnd={currentWeek.weekEndingDate}
          onPrevious={goToPreviousWeek}
          onNext={goToNextWeek}
          onToday={goToCurrentWeek}
        />
        
        <div className="flex items-center gap-2">
          <Badge variant={
            timesheet?.weekStatus === 'approved' ? 'default' :
            timesheet?.weekStatus === 'submitted' ? 'secondary' :
            'outline'
          }>
            {timesheet?.weekStatus === 'approved' && '✓ Approved'}
            {timesheet?.weekStatus === 'submitted' && '⏳ Submitted'}
            {timesheet?.weekStatus === 'draft' && '📝 Draft'}
            {timesheet?.weekStatus === 'empty' && 'No Entries'}
          </Badge>
          
          {timesheet?.totals && (
            <span className="text-lg font-semibold">
              {timesheet.totals.total.toFixed(1)} hrs
            </span>
          )}
        </div>
      </div>

      {/* Main Grid Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Weekly Timesheet</CardTitle>
            {isEditable && (
              <ProjectPhaseSelector 
                onAdd={(project, phase) => {
                  // Add new row logic
                  refetch()
                }}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : error ? (
            <div className="text-red-500 p-4">Error loading timesheet: {error.message}</div>
          ) : (
            <WeeklyCalendarGrid
              gridData={timesheet?.gridData || []}
              totals={timesheet?.totals || { byDay: {}, total: 0 }}
              weekStartDate={currentWeek.weekStartDate}
              onCellClick={handleCellClick}
              isEditable={isEditable}
            />
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {timesheet && (
        <TimesheetActions
          weekStatus={timesheet.weekStatus}
          weekEndingDate={currentWeek.weekEndingDate}
          employeeId={currentUserId}
          userRole={userRole}
          onActionComplete={refetch}
        />
      )}

      {/* Description Editor Sidebar */}
      {selectedCell && (
        <DescriptionEditor
          entryId={selectedCell.entryId}
          projectNumber={selectedCell.projectNumber}
          phaseName={selectedCell.phaseName}
          date={selectedCell.date}
          initialHours={selectedCell.hours}
          initialNotes={selectedCell.notes}
          onClose={handleEditorClose}
          onSave={handleEditorClose}
        />
      )}
    </div>
  )
}
```

### C.3 WeeklyCalendarGrid.tsx

The main grid showing days as columns, project/phase as rows.

```tsx
// src/app/(authenticated)/time/components/WeeklyCalendarGrid.tsx

'use client'

import { TimeEntryRow } from './TimeEntryRow'
import { TimeEntryCell } from './TimeEntryCell'

interface GridRow {
  project_id: number
  project_number: string
  project_name: string | null
  phase_name: string
  days: {
    Sun: { id: number; hours: number; notes: string; status: string } | null
    Mon: { id: number; hours: number; notes: string; status: string } | null
    Tue: { id: number; hours: number; notes: string; status: string } | null
    Wed: { id: number; hours: number; notes: string; status: string } | null
    Thu: { id: number; hours: number; notes: string; status: string } | null
    Fri: { id: number; hours: number; notes: string; status: string } | null
    Sat: { id: number; hours: number; notes: string; status: string } | null
  }
  total: number
}

interface WeeklyCalendarGridProps {
  gridData: GridRow[]
  totals: { byDay: Record<string, number>; total: number }
  weekStartDate: string
  onCellClick: (cell: any) => void
  isEditable: boolean
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export function WeeklyCalendarGrid({
  gridData,
  totals,
  weekStartDate,
  onCellClick,
  isEditable
}: WeeklyCalendarGridProps) {
  // Calculate dates for each day
  const startDate = new Date(weekStartDate + 'T00:00:00')
  const dayDates = DAYS.map((_, i) => {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    return date.toISOString().split('T')[0]
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="p-2 text-left font-medium w-48">Project</th>
            <th className="p-2 text-left font-medium w-32">Phase</th>
            {DAYS.map((day, i) => (
              <th key={day} className="p-2 text-center font-medium w-20">
                <div>{day}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(dayDates[i] + 'T00:00:00').toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </div>
              </th>
            ))}
            <th className="p-2 text-right font-medium w-16">Total</th>
          </tr>
        </thead>
        <tbody>
          {gridData.length === 0 ? (
            <tr>
              <td colSpan={9} className="p-8 text-center text-muted-foreground">
                No time entries for this week. Use "Add Project" to start tracking time.
              </td>
            </tr>
          ) : (
            gridData.map((row, rowIndex) => (
              <tr key={`${row.project_number}-${row.phase_name}`} className="border-b hover:bg-muted/30">
                <td className="p-2 font-medium">
                  <div className="truncate" title={row.project_name || row.project_number}>
                    {row.project_number}
                  </div>
                  {row.project_name && (
                    <div className="text-xs text-muted-foreground truncate">
                      {row.project_name}
                    </div>
                  )}
                </td>
                <td className="p-2 text-muted-foreground">
                  {row.phase_name}
                </td>
                {DAYS.map((day, dayIndex) => {
                  const entry = row.days[day]
                  return (
                    <td key={day} className="p-1">
                      <TimeEntryCell
                        entry={entry}
                        date={dayDates[dayIndex]}
                        projectNumber={row.project_number}
                        phaseName={row.phase_name}
                        projectId={row.project_id}
                        onClick={onCellClick}
                        isEditable={isEditable}
                      />
                    </td>
                  )
                })}
                <td className="p-2 text-right font-semibold">
                  {row.total.toFixed(1)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {/* Totals Footer */}
        <tfoot>
          <tr className="bg-muted/80 font-semibold">
            <td className="p-2" colSpan={2}>Daily Totals</td>
            {DAYS.map(day => (
              <td key={day} className="p-2 text-center">
                {(totals.byDay[day] || 0).toFixed(1)}
              </td>
            ))}
            <td className="p-2 text-right text-lg">
              {totals.total.toFixed(1)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
```

### C.4 TimeEntryCell.tsx

Individual cell for a day's hours.

```tsx
// src/app/(authenticated)/time/components/TimeEntryCell.tsx

'use client'

import { cn } from '@/lib/utils'

interface TimeEntryCellProps {
  entry: { id: number; hours: number; notes: string; status: string } | null
  date: string
  projectNumber: string
  phaseName: string
  projectId: number
  onClick: (cell: any) => void
  isEditable: boolean
}

export function TimeEntryCell({
  entry,
  date,
  projectNumber,
  phaseName,
  projectId,
  onClick,
  isEditable
}: TimeEntryCellProps) {
  const handleClick = () => {
    if (!isEditable) return
    
    onClick({
      entryId: entry?.id || null,
      projectNumber,
      phaseName,
      projectId,
      date,
      hours: entry?.hours || 0,
      notes: entry?.notes || ''
    })
  }

  const hasNotes = entry?.notes && entry.notes.trim().length > 0
  const hours = entry?.hours || 0

  return (
    <button
      onClick={handleClick}
      disabled={!isEditable}
      className={cn(
        'w-full h-12 rounded border transition-colors text-center',
        'flex flex-col items-center justify-center gap-0.5',
        isEditable && 'hover:bg-blue-50 hover:border-blue-300 cursor-pointer',
        !isEditable && 'cursor-not-allowed opacity-75',
        entry ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200',
        !hasNotes && hours > 0 && 'ring-2 ring-yellow-400' // Missing description warning
      )}
      title={hasNotes ? entry.notes : (hours > 0 ? '⚠️ Missing description' : 'Click to add time')}
    >
      {hours > 0 ? (
        <>
          <span className="font-semibold text-sm">{hours.toFixed(1)}</span>
          {!hasNotes && <span className="text-[10px] text-yellow-600">⚠️</span>}
        </>
      ) : (
        <span className="text-gray-400 text-xs">—</span>
      )}
    </button>
  )
}
```

### C.5 DescriptionEditor.tsx

Sidebar for editing entry details.

```tsx
// src/app/(authenticated)/time/components/DescriptionEditor.tsx

'use client'

import { useState, useEffect } from 'react'
import { useTimesheetMutations } from '../hooks/useTimesheetMutations'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Trash2 } from 'lucide-react'

interface DescriptionEditorProps {
  entryId: number | null
  projectNumber: string
  phaseName: string
  projectId: number
  date: string
  initialHours: number
  initialNotes: string
  onClose: () => void
  onSave: () => void
}

export function DescriptionEditor({
  entryId,
  projectNumber,
  phaseName,
  projectId,
  date,
  initialHours,
  initialNotes,
  onClose,
  onSave
}: DescriptionEditorProps) {
  const [hours, setHours] = useState(initialHours.toString())
  const [notes, setNotes] = useState(initialNotes)
  const [error, setError] = useState<string | null>(null)

  const { saveEntry, deleteEntry, isSaving, isDeleting } = useTimesheetMutations()

  const handleSave = async () => {
    setError(null)

    // Validation: notes required if hours > 0
    const hoursNum = parseFloat(hours) || 0
    if (hoursNum > 0 && (!notes || notes.trim().length === 0)) {
      setError('Work description is required')
      return
    }

    try {
      await saveEntry({
        id: entryId,
        project_id: projectId,
        project_number: projectNumber,
        phase_name: phaseName,
        entry_date: date,
        hours: hoursNum,
        notes: notes.trim()
      })
      onSave()
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    }
  }

  const handleDelete = async () => {
    if (!entryId) return
    if (!confirm('Delete this time entry?')) return

    try {
      await deleteEntry(entryId)
      onSave()
    } catch (e: any) {
      setError(e.message || 'Failed to delete')
    }
  }

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>
            {entryId ? 'Edit Time Entry' : 'Add Time Entry'}
          </SheetTitle>
        </SheetHeader>

        <div className="py-6 space-y-4">
          <div className="text-sm text-muted-foreground">
            {projectNumber} • {phaseName}
          </div>
          <div className="text-sm font-medium">
            {formattedDate}
          </div>

          <div className="space-y-2">
            <Label htmlFor="hours">Hours</Label>
            <Input
              id="hours"
              type="number"
              step="0.25"
              min="0"
              max="24"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-32"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">
              Work Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the work performed..."
              rows={6}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>

        <SheetFooter className="flex justify-between">
          <div>
            {entryId && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

### C.6 ProjectPhaseSelector.tsx

Typeahead for adding new project/phase rows.

```tsx
// src/app/(authenticated)/time/components/ProjectPhaseSelector.tsx

'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from '@/components/ui/command'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus } from 'lucide-react'

interface ProjectPhaseSelectorProps {
  onAdd: (project: { id: number; number: string; name: string }, phase: string) => void
}

export function ProjectPhaseSelector({ onAdd }: ProjectPhaseSelectorProps) {
  const [open, setOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<{
    id: number
    project_number: string
    name: string
  } | null>(null)
  const [selectedPhase, setSelectedPhase] = useState<string>('')
  const [projectSearch, setProjectSearch] = useState('')

  const supabase = createClient()

  // Fetch active projects
  const { data: projects } = useQuery({
    queryKey: ['active-projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, project_number, name')
        .eq('status', 'active')
        .order('project_number', { ascending: false })
      return data || []
    }
  })

  // Fetch phases for selected project
  const { data: phases } = useQuery({
    queryKey: ['project-phases', selectedProject?.id],
    queryFn: async () => {
      if (!selectedProject) return []
      const { data } = await supabase
        .from('contract_phases')
        .select('phase_name')
        .eq('project_id', selectedProject.id)
        .order('phase_name')
      return data?.map(p => p.phase_name) || []
    },
    enabled: !!selectedProject
  })

  // Filter projects by search
  const filteredProjects = useMemo(() => {
    if (!projects) return []
    if (!projectSearch) return projects.slice(0, 20) // Show recent
    const search = projectSearch.toLowerCase()
    return projects.filter(p => 
      p.project_number.toLowerCase().includes(search) ||
      p.name?.toLowerCase().includes(search)
    ).slice(0, 20)
  }, [projects, projectSearch])

  const handleAdd = () => {
    if (selectedProject && selectedPhase) {
      onAdd(
        { id: selectedProject.id, number: selectedProject.project_number, name: selectedProject.name },
        selectedPhase
      )
      setOpen(false)
      setSelectedProject(null)
      setSelectedPhase('')
      setProjectSearch('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Add Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Project to Timesheet</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Project Search */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Project</label>
            <Command className="border rounded-md">
              <CommandInput 
                placeholder="Search by project number..." 
                value={projectSearch}
                onValueChange={setProjectSearch}
              />
              <CommandList>
                <CommandEmpty>No projects found</CommandEmpty>
                <CommandGroup>
                  {filteredProjects.map(project => (
                    <CommandItem
                      key={project.id}
                      onSelect={() => {
                        setSelectedProject(project)
                        setSelectedPhase('')
                      }}
                      className={selectedProject?.id === project.id ? 'bg-accent' : ''}
                    >
                      <span className="font-medium">{project.project_number}</span>
                      {project.name && (
                        <span className="ml-2 text-muted-foreground truncate">
                          {project.name}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>

          {/* Phase Selection */}
          {selectedProject && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Phase</label>
              <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a phase..." />
                </SelectTrigger>
                <SelectContent>
                  {phases?.map(phase => (
                    <SelectItem key={phase} value={phase}>
                      {phase}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAdd} 
            disabled={!selectedProject || !selectedPhase}
          >
            Add to Timesheet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### C.7 TimesheetActions.tsx

Submit and Approve buttons.

```tsx
// src/app/(authenticated)/time/components/TimesheetActions.tsx

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Check, Send } from 'lucide-react'

interface TimesheetActionsProps {
  weekStatus: 'empty' | 'draft' | 'submitted' | 'approved'
  weekEndingDate: string
  employeeId: string
  userRole: 'admin' | 'project_manager' | 'employee'
  onActionComplete: () => void
}

export function TimesheetActions({
  weekStatus,
  weekEndingDate,
  employeeId,
  userRole,
  onActionComplete
}: TimesheetActionsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [showConfirm, setShowConfirm] = useState<'submit' | 'approve' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/timesheets/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekEndingDate })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onActionComplete()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsSubmitting(false)
      setShowConfirm(null)
    }
  }

  const handleApprove = async () => {
    setIsApproving(true)
    setError(null)
    try {
      const res = await fetch('/api/timesheets/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, weekEndingDate })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onActionComplete()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsApproving(false)
      setShowConfirm(null)
    }
  }

  return (
    <div className="flex items-center justify-between py-4 border-t">
      <div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <div className="flex gap-2">
        {/* Submit Button - Show for draft status */}
        {weekStatus === 'draft' && (
          <Button
            onClick={() => setShowConfirm('submit')}
            disabled={isSubmitting}
          >
            <Send className="w-4 h-4 mr-2" />
            Submit Week
          </Button>
        )}

        {/* Approve Button - Admin only, show for submitted status */}
        {userRole === 'admin' && weekStatus === 'submitted' && (
          <Button
            onClick={() => setShowConfirm('approve')}
            disabled={isApproving}
            variant="default"
            className="bg-green-600 hover:bg-green-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Approve Week
          </Button>
        )}
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirm !== null} onOpenChange={() => setShowConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {showConfirm === 'submit' ? 'Submit Timesheet?' : 'Approve Timesheet?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {showConfirm === 'submit' 
                ? 'This will submit your timesheet for approval. You can still edit entries until they are approved.'
                : 'This will approve all entries for this week. Approved entries cannot be edited.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={showConfirm === 'submit' ? handleSubmit : handleApprove}
            >
              {showConfirm === 'submit' ? 'Submit' : 'Approve'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

### C.8 Hooks

```tsx
// src/app/(authenticated)/time/hooks/useTimesheet.ts

import { useQuery } from '@tanstack/react-query'

export function useTimesheet(weekEndingDate: string, employeeId: string) {
  return useQuery({
    queryKey: ['timesheet', weekEndingDate, employeeId],
    queryFn: async () => {
      const params = new URLSearchParams({ employee_id: employeeId })
      const res = await fetch(`/api/timesheets/${weekEndingDate}?${params}`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch timesheet')
      }
      return res.json()
    }
  })
}
```

```tsx
// src/app/(authenticated)/time/hooks/useWeekNavigation.ts

import { useState, useMemo } from 'react'

function getWeekEndingDate(date: Date): string {
  const d = new Date(date)
  // Get to Saturday (end of week)
  const day = d.getDay()
  d.setDate(d.getDate() + (6 - day))
  return d.toISOString().split('T')[0]
}

function getWeekStartDate(weekEndingDate: string): string {
  const d = new Date(weekEndingDate + 'T00:00:00')
  d.setDate(d.getDate() - 6)
  return d.toISOString().split('T')[0]
}

export function useWeekNavigation() {
  const [weekEndingDate, setWeekEndingDate] = useState(() => 
    getWeekEndingDate(new Date())
  )

  const currentWeek = useMemo(() => ({
    weekEndingDate,
    weekStartDate: getWeekStartDate(weekEndingDate)
  }), [weekEndingDate])

  const goToPreviousWeek = () => {
    const d = new Date(weekEndingDate + 'T00:00:00')
    d.setDate(d.getDate() - 7)
    setWeekEndingDate(d.toISOString().split('T')[0])
  }

  const goToNextWeek = () => {
    const d = new Date(weekEndingDate + 'T00:00:00')
    d.setDate(d.getDate() + 7)
    setWeekEndingDate(d.toISOString().split('T')[0])
  }

  const goToCurrentWeek = () => {
    setWeekEndingDate(getWeekEndingDate(new Date()))
  }

  return {
    currentWeek,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek
  }
}
```

```tsx
// src/app/(authenticated)/time/hooks/useTimesheetMutations.ts

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useTimesheetMutations() {
  const queryClient = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: async (entry: any) => {
      const res = await fetch('/api/timesheets/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error)
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (entryId: number) => {
      const res = await fetch('/api/timesheets/entry', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entryId })
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error)
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] })
    }
  })

  return {
    saveEntry: saveMutation.mutateAsync,
    deleteEntry: deleteMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending
  }
}
```

---

## D. Business Logic

### D.1 Week Calculation (Sun-Sat Boundaries)

```typescript
// src/lib/timesheet/week-utils.ts

/**
 * Calculate the Saturday (week ending date) for any given date.
 * Weeks run Sunday (0) through Saturday (6).
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
```

### D.2 Status Transitions

```
                    ┌──────────┐
                    │  DRAFT   │  ← New entries start here
                    └────┬─────┘
                         │
                    User clicks
                   "Submit Week"
                         │
                         ▼
                    ┌──────────┐
                    │SUBMITTED │  ← User CAN still edit
                    └────┬─────┘    (until approved)
                         │
                   Admin clicks
                   "Approve Week"
                         │
                         ▼
                    ┌──────────┐
                    │ APPROVED │  ← LOCKED - No edits allowed
                    └──────────┘
```

**State Transition Rules:**
1. `draft` → `submitted`: User action, requires all entries have notes
2. `submitted` → `approved`: Admin action only, locks all entries
3. `approved` → (none): Cannot transition back
4. Users can edit entries in `draft` and `submitted` states
5. Only `draft` entries can be deleted

### D.3 Permission Matrix

| Action | Admin | PM | Employee |
|--------|-------|-----|----------|
| View own timesheet | ✓ | ✓ | ✓ |
| View others' timesheet | ✓ | ✓ (team only) | ✗ |
| Create entries | ✓ | ✓ | ✓ (own only) |
| Edit draft entries | ✓ | ✓ | ✓ (own only) |
| Edit submitted entries | ✓ | ✓ | ✓ (own only) |
| Edit approved entries | ✗ | ✗ | ✗ |
| Delete draft entries | ✓ | ✓ | ✓ (own only) |
| Submit week | ✓ | ✓ | ✓ (own only) |
| Approve week | ✓ | ✗ | ✗ |
| View pending approvals | ✓ | ✗ | ✗ |

### D.4 Total Calculations

```typescript
interface WeekTotals {
  byDay: {
    Sun: number
    Mon: number
    Tue: number
    Wed: number
    Thu: number
    Fri: number
    Sat: number
  }
  byRow: Map<string, number> // key: project_number|phase_name
  total: number
}

function calculateTotals(entries: TimeEntry[]): WeekTotals {
  const totals: WeekTotals = {
    byDay: { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 },
    byRow: new Map(),
    total: 0
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  entries.forEach(entry => {
    const hours = parseFloat(entry.hours) || 0
    
    // By day
    const date = new Date(entry.entry_date + 'T00:00:00')
    const dayName = days[date.getDay()]
    totals.byDay[dayName] += hours
    
    // By row
    const rowKey = `${entry.project_number}|${entry.phase_name}`
    totals.byRow.set(rowKey, (totals.byRow.get(rowKey) || 0) + hours)
    
    // Grand total
    totals.total += hours
  })

  return totals
}
```

---

## E. Migration Strategy

### E.1 Database Migration

**Step 1:** Apply schema migration (status, week_ending_date fields)
```bash
# Run in Supabase Studio or via migration
supabase migration new timesheet_status_fields
# Paste SQL from section A.1
supabase db push
```

**Step 2:** Backfill existing data
```sql
-- All existing entries are from QB Time = already approved
UPDATE public.time_entries
SET 
  status = 'approved',
  approved_at = created_at,
  week_ending_date = public.calculate_week_ending_date(entry_date)
WHERE status IS NULL;
```

**Step 3:** Apply RLS policy updates (section A.3)

### E.2 QuickBooks Time Cutover

**Pre-Cutover (2 weeks before):**
1. Announce to all employees: "Starting [DATE], use IRIS Timesheet instead of QB Time"
2. Run final QB Time sync to ensure all historical data is in IRIS
3. Train users on new Timesheet tab

**Cutover Day:**
1. Run one final QB Time sync
2. Mark all existing entries as `status: 'approved'`
3. Disable QB Time sync cron job:
   ```typescript
   // Comment out in cron configuration
   // { domain: 'time', interval: '15m' }
   ```
4. Remove or hide QB Time connection in Settings

**Post-Cutover (1 week):**
1. Monitor for issues
2. Keep QB Time credentials valid (read-only) for 30 days in case of rollback
3. After 30 days: Remove QB Time OAuth connection completely

### E.3 User Training Plan

**Training Materials:**
1. **Video Tutorial (5 min):** Quick walkthrough of Timesheet tab
2. **Quick Reference Card (PDF):**
   - How to navigate weeks
   - How to add projects
   - How to enter hours and descriptions
   - How to submit
3. **FAQ Document:**
   - "Why can't I edit last week's entries?" → Approved
   - "Where did QB Time go?" → Replaced by IRIS
   - "What if I need to fix an approved entry?" → Contact admin

**Rollout:**
1. Week 1: Admin testing
2. Week 2: PM beta testing
3. Week 3: Full employee rollout
4. Week 4: Final QB Time cutover

---

## F. Testing Strategy

### F.1 Unit Tests

```typescript
// tests/timesheet/week-utils.test.ts

describe('Week Utilities', () => {
  describe('getWeekEndingDate', () => {
    it('should return Saturday for a Sunday input', () => {
      expect(getWeekEndingDate('2026-04-05')).toBe('2026-04-11') // Sunday → Saturday
    })

    it('should return same day for Saturday input', () => {
      expect(getWeekEndingDate('2026-04-11')).toBe('2026-04-11')
    })

    it('should return next Saturday for Wednesday input', () => {
      expect(getWeekEndingDate('2026-04-08')).toBe('2026-04-11')
    })
  })

  describe('getWeekDates', () => {
    it('should return 7 consecutive dates ending on Saturday', () => {
      const dates = getWeekDates('2026-04-11')
      expect(dates).toHaveLength(7)
      expect(dates[0]).toBe('2026-04-05') // Sunday
      expect(dates[6]).toBe('2026-04-11') // Saturday
    })
  })
})
```

### F.2 Integration Tests

```typescript
// tests/api/timesheets.test.ts

describe('Timesheet API', () => {
  describe('POST /api/timesheets/entry', () => {
    it('should reject entries without notes', async () => {
      const res = await fetch('/api/timesheets/entry', {
        method: 'POST',
        body: JSON.stringify({
          project_number: '26-01',
          phase_name: 'Design',
          entry_date: '2026-04-07',
          hours: 8,
          notes: '' // Empty!
        })
      })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('description is required')
    })

    it('should reject edits to approved entries', async () => {
      // Setup: Create and approve an entry
      // ...
      // Attempt to edit
      const res = await fetch('/api/timesheets/entry', {
        method: 'POST',
        body: JSON.stringify({ id: approvedEntryId, hours: 4 })
      })
      expect(res.status).toBe(403)
    })
  })

  describe('POST /api/timesheets/approve', () => {
    it('should only allow admin to approve', async () => {
      // Login as employee
      const res = await fetchAsEmployee('/api/timesheets/approve', {
        method: 'POST',
        body: JSON.stringify({ employeeId: 'xxx', weekEndingDate: '2026-04-11' })
      })
      expect(res.status).toBe(403)
    })
  })
})
```

### F.3 Edge Cases to Cover

1. **Week Boundaries:**
   - Entry on Saturday 11:59 PM → correct week
   - Entry on Sunday 12:00 AM → next week
   - Timezone handling (EST for Austin)

2. **Status Transitions:**
   - Cannot edit approved entries (403)
   - Can edit submitted entries (allowed until approved)
   - Cannot delete non-draft entries

3. **Permissions:**
   - Employee A cannot see Employee B's timesheet
   - PM can see team timesheets (read-only)
   - Admin can see/approve all

4. **Copy Week:**
   - Empty previous week → error message
   - Duplicate project/phase already exists → skip gracefully
   - Previous week had 5 projects → 5 rows created

5. **Validation:**
   - Hours = 0 and notes empty → allowed (no entry)
   - Hours > 0 and notes empty → reject on save
   - Hours > 0 and notes empty on submit → reject

6. **UI Edge Cases:**
   - Very long project names → truncate with tooltip
   - 20+ project rows → scrollable grid
   - Navigating to future weeks → allowed (can plan ahead)
   - Navigating to years-old weeks → allowed (view only if approved)

---

## G. Effort Estimate

### G.1 Task Breakdown

| Task | Hours | Complexity |
|------|-------|------------|
| **Database** | | |
| Schema migration (status, week_ending_date) | 2 | Low |
| Backfill existing data | 1 | Low |
| RLS policy updates | 2 | Medium |
| Testing migrations | 1 | Low |
| **Subtotal Database** | **6** | |
| | | |
| **API Endpoints** | | |
| GET /api/timesheets/[week] | 3 | Medium |
| POST /api/timesheets/entry | 3 | Medium |
| POST /api/timesheets/submit | 2 | Low |
| POST /api/timesheets/approve | 2 | Low |
| POST /api/timesheets/copy-week | 2 | Low |
| GET /api/timesheets/pending-approvals | 2 | Low |
| API error handling & validation | 2 | Medium |
| **Subtotal API** | **16** | |
| | | |
| **UI Components** | | |
| TimesheetTab main container | 3 | Medium |
| WeeklyCalendarGrid | 4 | High |
| TimeEntryCell | 2 | Low |
| TimeEntryRow | 2 | Low |
| DescriptionEditor sidebar | 3 | Medium |
| WeekNavigator | 1 | Low |
| ProjectPhaseSelector (typeahead) | 3 | Medium |
| TimesheetActions (submit/approve) | 2 | Low |
| AdminApprovalPanel | 3 | Medium |
| **Subtotal UI** | **23** | |
| | | |
| **Integration** | | |
| Update /time page with new tab | 1 | Low |
| Types/TypeScript definitions | 2 | Low |
| React Query hooks | 2 | Low |
| Week utility functions | 1 | Low |
| **Subtotal Integration** | **6** | |
| | | |
| **Testing** | | |
| Unit tests (week utils) | 1 | Low |
| Integration tests (API) | 3 | Medium |
| E2E tests (Playwright) | 3 | Medium |
| Manual QA testing | 2 | Low |
| **Subtotal Testing** | **9** | |
| | | |
| **Deployment** | | |
| Migration execution | 1 | Low |
| QB Time cutover | 1 | Low |
| User training materials | 2 | Low |
| Documentation | 1 | Low |
| **Subtotal Deployment** | **5** | |
| | | |
| **TOTAL** | **65 hours** | |

### G.2 Complexity Assessment

**Compared to Phase 1 Work:**
- Phase 1 (Dashboard improvements, 13 fixes): ~20-25 hours
- **Timesheet Feature: 2.5-3x larger** than Phase 1

**High Complexity Areas:**
1. **WeeklyCalendarGrid** - Most complex UI component (grid layout, cell interactions)
2. **RLS Policies** - Status-based access control adds complexity
3. **Status Workflow** - Multiple states, validation at each transition
4. **Week Boundaries** - Date math with timezone considerations

**Lower Complexity Areas:**
1. Most API endpoints are straightforward CRUD
2. Submit/Approve are simple status updates
3. Week navigation is pure client-side

### G.3 Risk Factors

| Risk | Impact | Mitigation |
|------|--------|------------|
| Timezone bugs | Medium | Use UTC internally, convert at display |
| RLS policy conflicts | High | Test thoroughly, keep QB Time as fallback |
| User confusion (QB Time → IRIS) | Medium | Training, 2-week overlap period |
| Performance with large datasets | Low | Indexes already planned |
| Mobile responsiveness | Medium | Grid may need horizontal scroll |

### G.4 Recommended Implementation Order

1. **Week 1:** Database schema + API endpoints (22 hrs)
2. **Week 2:** Core UI components (15 hrs)
3. **Week 3:** Admin features + remaining UI (13 hrs)
4. **Week 4:** Testing + documentation + deployment (15 hrs)

**Estimated Calendar Time:** 4 weeks (with parallel work possible)

---

## H. Summary

The IRIS Timesheet feature is a **significant undertaking** (~65 hours) representing a major V2.0 feature. It will:

1. **Replace QuickBooks Time** with a native IRIS solution
2. **Introduce workflow states** (draft → submitted → approved)
3. **Add admin approval** for time entry compliance
4. **Provide better UX** with calendar-style weekly view

**Key Success Factors:**
- Solid RLS policies for status-based access
- Clean QB Time cutover with overlap period
- User training to ensure adoption
- Comprehensive testing before launch

**Next Steps:**
1. Austin reviews and approves plan
2. Create GitHub issues for each task section
3. Begin database migrations
4. Implement API endpoints
5. Build UI components
6. Test and deploy

---

*Plan created by Oliver (Strategic Planner) - April 5, 2026*
