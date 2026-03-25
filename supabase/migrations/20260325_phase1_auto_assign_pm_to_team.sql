-- Auto-assign PM to project_team_assignments when project is created or pm_id changes
-- This ensures PMs always have visibility to their projects via the team assignments table

CREATE OR REPLACE FUNCTION sync_pm_to_team_assignments()
RETURNS TRIGGER AS $$
BEGIN
  -- When a project is created with a pm_id, or pm_id is updated
  IF (TG_OP = 'INSERT' AND NEW.pm_id IS NOT NULL) OR 
     (TG_OP = 'UPDATE' AND NEW.pm_id IS DISTINCT FROM OLD.pm_id AND NEW.pm_id IS NOT NULL) THEN
    
    -- Insert or update the PM in project_team_assignments
    INSERT INTO public.project_team_assignments (project_id, user_id, role)
    VALUES (NEW.id, NEW.pm_id, 'project_manager')
    ON CONFLICT (project_id, user_id) 
    DO UPDATE SET role = 'project_manager', updated_at = NOW();
    
  END IF;
  
  -- If pm_id was removed (set to NULL), optionally remove from team assignments
  -- Commenting this out for now - keeping historical assignments is safer
  -- IF (TG_OP = 'UPDATE' AND OLD.pm_id IS NOT NULL AND NEW.pm_id IS NULL) THEN
  --   DELETE FROM public.project_team_assignments 
  --   WHERE project_id = NEW.id AND user_id = OLD.pm_id AND role = 'project_manager';
  -- END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on projects table
DROP TRIGGER IF EXISTS trigger_sync_pm_to_team ON public.projects;
CREATE TRIGGER trigger_sync_pm_to_team
  AFTER INSERT OR UPDATE OF pm_id ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION sync_pm_to_team_assignments();

-- Backfill existing projects: add all current PMs to project_team_assignments
INSERT INTO public.project_team_assignments (project_id, user_id, role)
SELECT id, pm_id, 'project_manager'
FROM public.projects
WHERE pm_id IS NOT NULL
ON CONFLICT (project_id, user_id) DO NOTHING;
