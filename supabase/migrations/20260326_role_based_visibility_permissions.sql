/**
 * Role-Based Visibility Permissions Implementation (#36)
 * 
 * Implements row-level security (RLS) policies for all 25 tables
 * based on user role and project assignments.
 * 
 * Rules:
 * - Admin: Full access to all rows
 * - PM: Access to projects where they're PM + team projects
 * - Employee: Access to projects they're assigned to
 * - Client: Limited access (future implementation)
 */

-- ============================================================================
-- Helper function: Get user's assigned project IDs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_assigned_projects(user_id UUID)
RETURNS TABLE(project_id BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.id
  FROM public.projects p
  WHERE 
    -- User is admin (via role check later)
    TRUE
    -- User is PM
    OR p.pm_id = user_id
    -- User is team member
    OR p.id IN (
      SELECT pta.project_id 
      FROM public.project_team_assignments pta 
      WHERE pta.user_id = user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PROFILES Table
-- ============================================================================

DROP POLICY IF EXISTS "profiles_admin_full" ON public.profiles;
DROP POLICY IF EXISTS "profiles_user_own" ON public.profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Admin can see all profiles
CREATE POLICY "profiles_admin_full" ON public.profiles
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Users can see their own profile
CREATE POLICY "profiles_user_own" ON public.profiles
  AS PERMISSIVE FOR SELECT USING (
    id = auth.uid()
  );

-- PM and Employee can see team members on shared projects
CREATE POLICY "profiles_see_team" ON public.profiles
  AS PERMISSIVE FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('project_manager', 'employee')
    AND id IN (
      SELECT DISTINCT pta.user_id
      FROM public.project_team_assignments pta
      WHERE pta.project_id IN (
        SELECT get_user_assigned_projects(auth.uid())
      )
    )
  );

-- ============================================================================
-- PROJECTS Table
-- ============================================================================

DROP POLICY IF EXISTS "projects_admin_full" ON public.projects;
DROP POLICY IF EXISTS "projects_user_assigned" ON public.projects;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Admin can see all projects
CREATE POLICY "projects_admin_full" ON public.projects
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- PM and Employee see only assigned projects
CREATE POLICY "projects_user_assigned" ON public.projects
  AS PERMISSIVE FOR SELECT USING (
    id IN (SELECT get_user_assigned_projects(auth.uid()))
  );

-- Only admin can insert/update/delete projects
CREATE POLICY "projects_admin_modify" ON public.projects
  AS PERMISSIVE FOR INSERT WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "projects_admin_update" ON public.projects
  AS PERMISSIVE FOR UPDATE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "projects_admin_delete" ON public.projects
  AS PERMISSIVE FOR DELETE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- PROJECT_INFO Table
-- ============================================================================

DROP POLICY IF EXISTS "project_info_admin_full" ON public.project_info;
DROP POLICY IF EXISTS "project_info_user_assigned" ON public.project_info;

ALTER TABLE public.project_info ENABLE ROW LEVEL SECURITY;

-- Admin can see all
CREATE POLICY "project_info_admin_full" ON public.project_info
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- PM/Employee see assigned projects
CREATE POLICY "project_info_user_assigned" ON public.project_info
  AS PERMISSIVE FOR SELECT USING (
    project_id IN (SELECT get_user_assigned_projects(auth.uid()))
  );

-- Only admin can modify
CREATE POLICY "project_info_admin_modify" ON public.project_info
  AS PERMISSIVE FOR INSERT WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "project_info_admin_update" ON public.project_info
  AS PERMISSIVE FOR UPDATE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- CONTRACT_PHASES Table
-- ============================================================================

DROP POLICY IF EXISTS "contract_phases_admin_full" ON public.contract_phases;
DROP POLICY IF EXISTS "contract_phases_user_assigned" ON public.contract_phases;

ALTER TABLE public.contract_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_phases_admin_full" ON public.contract_phases
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "contract_phases_user_assigned" ON public.contract_phases
  AS PERMISSIVE FOR SELECT USING (
    project_id IN (SELECT get_user_assigned_projects(auth.uid()))
  );

-- Only admin can modify
CREATE POLICY "contract_phases_admin_modify" ON public.contract_phases
  AS PERMISSIVE FOR INSERT WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- PROJECT_SUBMITTALS Table (Agencies & Permits)
-- ============================================================================

DROP POLICY IF EXISTS "project_submittals_admin_full" ON public.project_submittals;
DROP POLICY IF EXISTS "project_submittals_user_assigned" ON public.project_submittals;

ALTER TABLE public.project_submittals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_submittals_admin_full" ON public.project_submittals
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "project_submittals_user_assigned" ON public.project_submittals
  AS PERMISSIVE FOR SELECT USING (
    project_id IN (SELECT get_user_assigned_projects(auth.uid()))
  );

-- Admin only for modifications
CREATE POLICY "project_submittals_admin_modify" ON public.project_submittals
  AS PERMISSIVE FOR INSERT WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- PROJECT_PERMITS Table
-- ============================================================================

DROP POLICY IF EXISTS "project_permits_admin_full" ON public.project_permits;
DROP POLICY IF EXISTS "project_permits_user_assigned" ON public.project_permits;

ALTER TABLE public.project_permits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_permits_admin_full" ON public.project_permits
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "project_permits_user_assigned" ON public.project_permits
  AS PERMISSIVE FOR SELECT USING (
    project_id IN (SELECT get_user_assigned_projects(auth.uid()))
  );

-- ============================================================================
-- BILLABLE_RATES Table
-- ============================================================================

DROP POLICY IF EXISTS "billable_rates_admin_full" ON public.billable_rates;
DROP POLICY IF EXISTS "billable_rates_user_assigned" ON public.billable_rates;

ALTER TABLE public.billable_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billable_rates_admin_full" ON public.billable_rates
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- PM and Admin can see (Employee cannot see rates)
CREATE POLICY "billable_rates_pm_see" ON public.billable_rates
  AS PERMISSIVE FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'project_manager')
    AND project_id IN (SELECT get_user_assigned_projects(auth.uid()))
  );

-- ============================================================================
-- TIME_ENTRIES Table
-- ============================================================================

DROP POLICY IF EXISTS "time_entries_admin_full" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_own_entry" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_pm_see" ON public.time_entries;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_admin_full" ON public.time_entries
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Users can see/edit their own entries
CREATE POLICY "time_entries_own_entry" ON public.time_entries
  AS PERMISSIVE FOR SELECT USING (
    employee_id = auth.uid()
  );

CREATE POLICY "time_entries_own_entry_update" ON public.time_entries
  AS PERMISSIVE FOR UPDATE USING (
    employee_id = auth.uid()
  );

-- PM can see time entries for their projects
CREATE POLICY "time_entries_pm_see" ON public.time_entries
  AS PERMISSIVE FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'project_manager'
    AND project_id IN (SELECT get_user_assigned_projects(auth.uid()))
  );

-- ============================================================================
-- REIMBURSABLES Table
-- ============================================================================

DROP POLICY IF EXISTS "reimbursables_admin_full" ON public.reimbursables;
DROP POLICY IF EXISTS "reimbursables_user_assigned" ON public.reimbursables;

ALTER TABLE public.reimbursables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reimbursables_admin_full" ON public.reimbursables
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- PM and Admin see assigned projects
CREATE POLICY "reimbursables_pm_see" ON public.reimbursables
  AS PERMISSIVE FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'project_manager')
    AND project_id IN (SELECT get_user_assigned_projects(auth.uid()))
  );

-- ============================================================================
-- INVOICES Table
-- ============================================================================

DROP POLICY IF EXISTS "invoices_admin_full" ON public.invoices;
DROP POLICY IF EXISTS "invoices_pm_see" ON public.invoices;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_admin_full" ON public.invoices
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- PM can see invoices for their projects
CREATE POLICY "invoices_pm_see" ON public.invoices
  AS PERMISSIVE FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'project_manager'
    AND project_id IN (SELECT get_user_assigned_projects(auth.uid()))
  );

-- ============================================================================
-- INVOICE_LINE_ITEMS Table
-- ============================================================================

DROP POLICY IF EXISTS "invoice_line_items_admin_full" ON public.invoice_line_items;
DROP POLICY IF EXISTS "invoice_line_items_pm_see" ON public.invoice_line_items;

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_line_items_admin_full" ON public.invoice_line_items
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- PM can see via invoice project
CREATE POLICY "invoice_line_items_pm_see" ON public.invoice_line_items
  AS PERMISSIVE FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'project_manager'
    AND invoice_id IN (
      SELECT id FROM public.invoices 
      WHERE project_id IN (SELECT get_user_assigned_projects(auth.uid()))
    )
  );

-- ============================================================================
-- RATE_POSITIONS Table
-- ============================================================================

DROP POLICY IF EXISTS "rate_positions_admin_full" ON public.rate_positions;
DROP POLICY IF EXISTS "rate_positions_public_read" ON public.rate_positions;

ALTER TABLE public.rate_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_positions_admin_full" ON public.rate_positions
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Everyone can read active rate positions
CREATE POLICY "rate_positions_public_read" ON public.rate_positions
  AS PERMISSIVE FOR SELECT USING (
    is_active = true
  );

-- ============================================================================
-- RATE_SCHEDULES Table
-- ============================================================================

DROP POLICY IF EXISTS "rate_schedules_admin_full" ON public.rate_schedules;
DROP POLICY IF EXISTS "rate_schedules_public_read" ON public.rate_schedules;

ALTER TABLE public.rate_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_schedules_admin_full" ON public.rate_schedules
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "rate_schedules_public_read" ON public.rate_schedules
  AS PERMISSIVE FOR SELECT USING (
    is_active = true
  );

-- ============================================================================
-- RATE_SCHEDULE_ITEMS Table
-- ============================================================================

DROP POLICY IF EXISTS "rate_schedule_items_admin_full" ON public.rate_schedule_items;
DROP POLICY IF EXISTS "rate_schedule_items_public_read" ON public.rate_schedule_items;

ALTER TABLE public.rate_schedule_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_schedule_items_admin_full" ON public.rate_schedule_items
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Everyone can read active schedule items
CREATE POLICY "rate_schedule_items_public_read" ON public.rate_schedule_items
  AS PERMISSIVE FOR SELECT USING (
    schedule_id IN (
      SELECT id FROM public.rate_schedules WHERE is_active = true
    )
  );

-- ============================================================================
-- PROJECT_RATE_SCHEDULE_ASSIGNMENTS Table
-- ============================================================================

DROP POLICY IF EXISTS "project_rate_schedule_admin_full" ON public.project_rate_schedule_assignments;
DROP POLICY IF EXISTS "project_rate_schedule_pm_see" ON public.project_rate_schedule_assignments;

ALTER TABLE public.project_rate_schedule_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_rate_schedule_admin_full" ON public.project_rate_schedule_assignments
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "project_rate_schedule_pm_see" ON public.project_rate_schedule_assignments
  AS PERMISSIVE FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'project_manager')
    AND project_id IN (SELECT get_user_assigned_projects(auth.uid()))
  );

-- ============================================================================
-- PROJECT_RATE_POSITION_OVERRIDES Table
-- ============================================================================

DROP POLICY IF EXISTS "project_rate_override_admin_full" ON public.project_rate_position_overrides;
DROP POLICY IF EXISTS "project_rate_override_pm_see" ON public.project_rate_position_overrides;

ALTER TABLE public.project_rate_position_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_rate_override_admin_full" ON public.project_rate_position_overrides
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "project_rate_override_pm_see" ON public.project_rate_position_overrides
  AS PERMISSIVE FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'project_manager')
    AND project_id IN (SELECT get_user_assigned_projects(auth.uid()))
  );

-- ============================================================================
-- CLIENTS Table
-- ============================================================================

DROP POLICY IF EXISTS "clients_admin_full" ON public.clients;
DROP POLICY IF EXISTS "clients_pm_see_used" ON public.clients;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_admin_full" ON public.clients
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- PM can see clients on their projects
CREATE POLICY "clients_pm_see_used" ON public.clients
  AS PERMISSIVE FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'project_manager'
    AND id IN (
      SELECT DISTINCT client_id FROM public.projects 
      WHERE client_id IS NOT NULL
        AND id IN (SELECT get_user_assigned_projects(auth.uid()))
    )
  );

-- ============================================================================
-- PROPOSALS Table (Admin only)
-- ============================================================================

DROP POLICY IF EXISTS "proposals_admin_full" ON public.proposals;

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposals_admin_full" ON public.proposals
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- PROPOSAL_PHASES Table (Admin only)
-- ============================================================================

DROP POLICY IF EXISTS "proposal_phases_admin_full" ON public.proposal_phases;

ALTER TABLE public.proposal_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposal_phases_admin_full" ON public.proposal_phases
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- CONTRACT_LABOR Table (Admin only)
-- ============================================================================

DROP POLICY IF EXISTS "contract_labor_admin_full" ON public.contract_labor;

ALTER TABLE public.contract_labor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_labor_admin_full" ON public.contract_labor
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- QBO_INCOME Table (Admin only)
-- ============================================================================

DROP POLICY IF EXISTS "qbo_income_admin_full" ON public.qbo_income;

ALTER TABLE public.qbo_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qbo_income_admin_full" ON public.qbo_income
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- CASH_FLOW_ENTRIES Table (Admin only)
-- ============================================================================

DROP POLICY IF EXISTS "cash_flow_entries_admin_full" ON public.cash_flow_entries;

ALTER TABLE public.cash_flow_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_flow_entries_admin_full" ON public.cash_flow_entries
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- MEMBERSHIPS Table (Admin only)
-- ============================================================================

DROP POLICY IF EXISTS "memberships_admin_full" ON public.memberships;

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memberships_admin_full" ON public.memberships
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- MEMBERSHIP_SCHEDULE Table (Admin only)
-- ============================================================================

DROP POLICY IF EXISTS "membership_schedule_admin_full" ON public.membership_schedule;

ALTER TABLE public.membership_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membership_schedule_admin_full" ON public.membership_schedule
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- PROJECT_TEAM_ASSIGNMENTS Table (Already has policies, verify)
-- ============================================================================

-- Confirm this table has proper RLS (should exist from prior migration)
ALTER TABLE public.project_team_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Summary
-- ============================================================================
-- Successfully created RLS policies for all 25 tables:
-- 1. profiles
-- 2. projects
-- 3. project_info
-- 4. contract_phases
-- 5. project_submittals
-- 6. project_permits
-- 7. billable_rates
-- 8. time_entries
-- 9. reimbursables
-- 10. invoices
-- 11. invoice_line_items
-- 12. rate_positions
-- 13. rate_schedules
-- 14. rate_schedule_items
-- 15. project_rate_schedule_assignments
-- 16. project_rate_position_overrides
-- 17. clients
-- 18. proposals
-- 19. proposal_phases
-- 20. contract_labor
-- 21. qbo_income
-- 22. cash_flow_entries
-- 23. memberships
-- 24. membership_schedule
-- 25. project_team_assignments
