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

-- 5. Backfill status='approved' for all existing entries (from QB Time)
UPDATE public.time_entries
SET 
  status = 'approved',
  approved_at = created_at,  -- Use creation date as approval date
  approved_by = NULL  -- Historical data, no specific approver
WHERE status = 'draft';

-- 6. Make week_ending_date NOT NULL after backfill
ALTER TABLE public.time_entries
ALTER COLUMN week_ending_date SET NOT NULL;

-- 7. Create trigger to auto-set week_ending_date on insert/update
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

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS ix_time_entries_status
  ON public.time_entries (status);

CREATE INDEX IF NOT EXISTS ix_time_entries_week_ending_date
  ON public.time_entries (week_ending_date);

CREATE INDEX IF NOT EXISTS ix_time_entries_employee_week
  ON public.time_entries (employee_id, week_ending_date);

CREATE INDEX IF NOT EXISTS ix_time_entries_employee_status_week
  ON public.time_entries (employee_id, status, week_ending_date);

-- 9. Composite index for common timesheet queries
CREATE INDEX IF NOT EXISTS ix_time_entries_timesheet_lookup
  ON public.time_entries (employee_id, week_ending_date, status)
  INCLUDE (project_id, phase_name, hours, notes);

COMMENT ON COLUMN public.time_entries.status IS 
  'Timesheet workflow status: draft (editable), submitted (pending approval), approved (locked)';

COMMENT ON COLUMN public.time_entries.week_ending_date IS 
  'Saturday of the week containing entry_date. Used for weekly timesheet grouping.';

COMMENT ON COLUMN public.time_entries.submitted_at IS 
  'Timestamp when timesheet week was submitted for approval';

COMMENT ON COLUMN public.time_entries.approved_at IS 
  'Timestamp when timesheet week was approved by admin';

COMMENT ON COLUMN public.time_entries.approved_by IS 
  'Profile ID of admin who approved the timesheet week';
