-- Fix proposal_phases RLS to allow PM role to insert/update/delete
-- Issue: PMs cannot add phases when creating proposals

-- Drop existing policy
DROP POLICY IF EXISTS "proposal_phases_admin_full" ON public.proposal_phases;

-- Create new policies for both admin and PM roles
CREATE POLICY "proposal_phases_admin_pm_full" ON public.proposal_phases
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'project_manager')
  );

-- Employee read-only access (can view proposals they're assigned to)
CREATE POLICY "proposal_phases_employee_read" ON public.proposal_phases
  AS PERMISSIVE FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'employee'
  );
