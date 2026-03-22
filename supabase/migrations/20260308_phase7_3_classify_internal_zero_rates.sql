begin;

-- ---------------------------------------------------------------------------
-- Phase 7.3 - Classify expected zero-rate internal non-project entries
-- ---------------------------------------------------------------------------
-- Intent:
-- - Preserve unresolved classification for true defects (e.g. billable/project rows)
-- - Reclassify known internal/non-project overhead rows so unresolved counts
--   represent actionable issues.

update public.time_entry_bill_rates tbr
set rate_source = 'non_project_internal'
from public.time_entries te
where te.id = tbr.time_entry_id
  and coalesce(tbr.resolved_hourly_rate, 0) = 0
  and coalesce(tbr.rate_source, 'unresolved') = 'unresolved'
  and te.project_id is null
  and coalesce(te.is_billable, false) = false
  and lower(coalesce(te.project_number, '')) in (
    'general',
    'business',
    'proposals',
    'go',
    'paid',
    'sonoc',
    'holiday',
    'training',
    'westland',
    'evrdev',
    'kcs',
    'san'
  );

commit;
