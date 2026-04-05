-- ============================================================================
-- Timesheet RLS Policies
-- Extends existing time_entries policies for status-based access control
-- ============================================================================

-- Drop existing policies to recreate with status awareness
DROP POLICY IF EXISTS "time_entries_own_entry_update" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_own_entry" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_select_own" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_insert_own_draft" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_update_own_not_approved" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_delete_own_draft" ON public.time_entries;

-- 1. Users can SELECT their own entries (any status)
CREATE POLICY "time_entries_select_own" ON public.time_entries
  AS PERMISSIVE FOR SELECT USING (
    employee_id = auth.uid()
  );

-- 2. Users can INSERT new draft entries (their own)
CREATE POLICY "time_entries_insert_own_draft" ON public.time_entries
  AS PERMISSIVE FOR INSERT WITH CHECK (
    employee_id = auth.uid()
    AND status = 'draft'
  );

-- 3. Users can UPDATE their own entries IF status is draft OR submitted (not approved)
CREATE POLICY "time_entries_update_own_not_approved" ON public.time_entries
  AS PERMISSIVE FOR UPDATE USING (
    employee_id = auth.uid()
    AND status IN ('draft', 'submitted')
  ) WITH CHECK (
    employee_id = auth.uid()
    AND status IN ('draft', 'submitted')
  );

-- 4. Users can DELETE their own draft entries only
CREATE POLICY "time_entries_delete_own_draft" ON public.time_entries
  AS PERMISSIVE FOR DELETE USING (
    employee_id = auth.uid()
    AND status = 'draft'
  );

-- 5. Admin can view/edit ALL entries (existing policy remains)
-- Already exists: time_entries_admin_full

-- 6. PM can see time entries for their projects (existing policy remains)
-- Already exists: time_entries_pm_see

-- 7. Create view for week approval status (helper for admin)
CREATE OR REPLACE VIEW public.timesheet_week_summary AS
SELECT 
  te.employee_id,
  te.week_ending_date,
  p.full_name as employee_name,
  COUNT(*) as entry_count,
  SUM(te.hours) as total_hours,
  -- Calculate overall week status (all must be same for submitted/approved)
  CASE 
    WHEN COUNT(CASE WHEN te.status = 'draft' THEN 1 END) > 0 THEN 'draft'
    WHEN COUNT(CASE WHEN te.status = 'submitted' THEN 1 END) > 0 
      AND COUNT(CASE WHEN te.status = 'approved' THEN 1 END) = 0 THEN 'submitted'
    WHEN COUNT(CASE WHEN te.status = 'approved' THEN 1 END) = COUNT(*) THEN 'approved'
    ELSE 'mixed'
  END as week_status,
  COUNT(CASE WHEN te.status = 'draft' THEN 1 END) as draft_count,
  COUNT(CASE WHEN te.status = 'submitted' THEN 1 END) as submitted_count,
  COUNT(CASE WHEN te.status = 'approved' THEN 1 END) as approved_count,
  MAX(te.submitted_at) as submitted_at,
  MAX(te.approved_at) as approved_at,
  (ARRAY_AGG(te.approved_by ORDER BY te.approved_at DESC NULLS LAST))[1] as approved_by
FROM public.time_entries te
LEFT JOIN public.profiles p ON te.employee_id = p.id
GROUP BY te.employee_id, te.week_ending_date, p.full_name;

-- Grant access to the summary view
GRANT SELECT ON public.timesheet_week_summary TO authenticated;

-- RLS policy for the summary view
ALTER VIEW public.timesheet_week_summary SET (security_invoker = on);

COMMENT ON VIEW public.timesheet_week_summary IS 
  'Weekly timesheet summary showing status and totals per employee per week';
