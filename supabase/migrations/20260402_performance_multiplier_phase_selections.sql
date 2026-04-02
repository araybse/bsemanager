-- Performance Multiplier Phase Selections
-- Stores which phases are included in the performance multiplier calculation per project

CREATE TABLE IF NOT EXISTS public.project_performance_phase_selections (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id BIGINT NOT NULL REFERENCES public.contract_phases(id) ON DELETE CASCADE,
  included BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, phase_id)
);

-- Index for fast lookups by project
CREATE INDEX IF NOT EXISTS idx_perf_phase_sel_project_id ON public.project_performance_phase_selections(project_id);

-- RLS policies
ALTER TABLE public.project_performance_phase_selections ENABLE ROW LEVEL SECURITY;

-- Admin and PM can manage selections
CREATE POLICY "performance_phase_selections_admin_pm_full" ON public.project_performance_phase_selections
  AS PERMISSIVE FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'project_manager')
  );

-- Employees can view
CREATE POLICY "performance_phase_selections_employee_read" ON public.project_performance_phase_selections
  AS PERMISSIVE FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'employee'
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_performance_phase_selections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER performance_phase_selections_updated_at
  BEFORE UPDATE ON public.project_performance_phase_selections
  FOR EACH ROW
  EXECUTE FUNCTION update_performance_phase_selections_updated_at();
