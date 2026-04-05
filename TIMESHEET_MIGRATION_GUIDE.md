# Timesheet V2.0 Database Migration Guide

**Created:** April 5, 2026  
**Feature:** Built-in Weekly Timesheet System  
**Status:** Ready for execution

---

## Overview

This migration adds the database foundation for IRIS Timesheet V2.0:
- Weekly timesheet workflow (draft → submitted → approved)
- Week-ending date calculation (Saturday-based weeks)
- Status-based RLS policies
- Performance indexes

---

## Migration Files

Two migration files have been created:

### 1. Schema Changes
**File:** `supabase/migrations/20260405_timesheet_status_fields.sql`

Adds to `time_entries` table:
- `status` (draft/submitted/approved) - default 'draft'
- `week_ending_date` (DATE) - calculated Saturday of the week
- `submitted_at`, `approved_at`, `approved_by` - audit trail
- Backfills all existing 2,614 entries as status='approved'
- Creates 5 performance indexes
- Creates trigger to auto-calculate week_ending_date

### 2. RLS Policies
**File:** `supabase/migrations/20260405_timesheet_rls_policies.sql`

Updates Row Level Security policies:
- Users can INSERT own draft entries
- Users can UPDATE own draft/submitted entries (not approved)
- Users can DELETE own draft entries only
- Admin can view/edit ALL entries
- PM can view entries on their projects
- Creates `timesheet_week_summary` view for admin

---

## Execution Steps

### Option A: Supabase SQL Editor (Recommended)

1. **Open Supabase SQL Editor:**
   ```
   https://supabase.com/dashboard/project/lqlyargzteskhsddbjpa/sql/new
   ```

2. **Run Migration 1 - Schema Changes:**
   - Copy entire contents of `supabase/migrations/20260405_timesheet_status_fields.sql`
   - Paste into SQL Editor
   - Click "Run" (bottom right)
   - Verify: Should see "Success" with no errors

3. **Run Migration 2 - RLS Policies:**
   - Copy entire contents of `supabase/migrations/20260405_timesheet_rls_policies.sql`
   - Paste into SQL Editor
   - Click "Run"
   - Verify: Should see "Success" with no errors

### Option B: psql CLI (Advanced)

If you have `psql` installed:

```bash
# Migration 1
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260405_timesheet_status_fields.sql

# Migration 2
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260405_timesheet_rls_policies.sql
```

---

## Verification Steps

After running both migrations, verify:

### 1. Check Columns Exist

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'time_entries'
  AND column_name IN ('status', 'week_ending_date', 'submitted_at', 'approved_at', 'approved_by')
ORDER BY column_name;
```

Expected result: 5 rows (all columns present)

### 2. Verify Backfill (2,614 entries)

```sql
SELECT 
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN week_ending_date IS NULL THEN 1 END) as null_week_dates
FROM time_entries
GROUP BY status;
```

Expected result:
- status='approved', count=2614, null_week_dates=0

### 3. Test Week Ending Date Calculation

```sql
-- Example: Monday April 7, 2026 → Saturday April 11, 2026
SELECT 
  '2026-04-07'::DATE as entry_date,
  calculate_week_ending_date('2026-04-07'::DATE) as week_ending_date,
  EXTRACT(DOW FROM calculate_week_ending_date('2026-04-07'::DATE)) as day_of_week;
```

Expected result:
- week_ending_date = 2026-04-11
- day_of_week = 6 (Saturday)

### 4. Check Indexes Created

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'time_entries'
  AND indexname LIKE 'ix_time_entries_%';
```

Expected result: 5 indexes
- ix_time_entries_status
- ix_time_entries_week_ending_date
- ix_time_entries_employee_week
- ix_time_entries_employee_status_week
- ix_time_entries_timesheet_lookup

### 5. Verify View Created

```sql
SELECT * FROM timesheet_week_summary LIMIT 5;
```

Expected result: Shows weekly summaries with employee_name, total_hours, week_status

### 6. Test RLS Policies

```sql
-- Show all policies on time_entries
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'time_entries'
ORDER BY policyname;
```

Expected result: Policies including:
- time_entries_admin_full
- time_entries_insert_own_draft
- time_entries_update_own_not_approved
- time_entries_delete_own_draft
- time_entries_select_own
- time_entries_pm_see

---

## Testing the Trigger

Test that the trigger auto-calculates week_ending_date:

```sql
-- Create a test entry (requires valid employee_id)
INSERT INTO time_entries (employee_id, project_id, entry_date, hours, phase_name, status)
VALUES (
  (SELECT id FROM profiles WHERE role = 'employee' LIMIT 1),
  (SELECT id FROM projects LIMIT 1),
  '2026-04-07',  -- Monday
  8.0,
  'Test Phase',
  'draft'
)
RETURNING id, entry_date, week_ending_date, status;

-- Verify: week_ending_date should be 2026-04-11 (Saturday)

-- Clean up test
DELETE FROM time_entries WHERE phase_name = 'Test Phase';
```

---

## Rollback (If Needed)

If you need to rollback the migration:

```sql
-- WARNING: This will lose timesheet status data

-- Drop new columns
ALTER TABLE public.time_entries
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS week_ending_date,
DROP COLUMN IF EXISTS submitted_at,
DROP COLUMN IF EXISTS approved_at,
DROP COLUMN IF EXISTS approved_by;

-- Drop function and trigger
DROP TRIGGER IF EXISTS tr_time_entries_set_week_ending ON public.time_entries;
DROP FUNCTION IF EXISTS public.set_week_ending_date();
DROP FUNCTION IF EXISTS public.calculate_week_ending_date(DATE);

-- Drop view
DROP VIEW IF EXISTS public.timesheet_week_summary;

-- Drop indexes
DROP INDEX IF EXISTS ix_time_entries_status;
DROP INDEX IF EXISTS ix_time_entries_week_ending_date;
DROP INDEX IF EXISTS ix_time_entries_employee_week;
DROP INDEX IF EXISTS ix_time_entries_employee_status_week;
DROP INDEX IF EXISTS ix_time_entries_timesheet_lookup;

-- Restore old policies
CREATE POLICY "time_entries_own_entry" ON public.time_entries
  AS PERMISSIVE FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY "time_entries_own_entry_update" ON public.time_entries
  AS PERMISSIVE FOR UPDATE USING (employee_id = auth.uid());
```

---

## Impact Assessment

### Data Safety
✅ **Safe** - All existing data preserved
- 2,614 existing entries marked as `status='approved'`
- `week_ending_date` backfilled for all entries
- No data loss

### Breaking Changes
❌ **None** - Fully backward compatible
- Existing queries continue to work
- New columns have defaults
- RLS policies extended, not replaced

### Performance Impact
✅ **Positive**
- 5 new indexes speed up timesheet queries
- Composite index optimizes week lookups

---

## Next Steps

After successful migration:

1. ✅ Verify all checks pass (see Verification Steps above)
2. ✅ Commit migration files to git
3. ✅ Update frontend to use new timesheet fields
4. ✅ Deploy API endpoints for timesheet workflow
5. ✅ Build timesheet UI components

---

## Support

If migration fails:
1. Check Supabase logs for detailed error messages
2. Verify you have admin/service role permissions
3. Ensure no active transactions are blocking table locks
4. Contact development team if issues persist

**Migration created by:** Sebastian (Backend Developer)  
**Date:** April 5, 2026
