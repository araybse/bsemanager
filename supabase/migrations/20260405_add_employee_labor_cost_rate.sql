begin;

-- Add labor cost rate column to profiles table
alter table public.profiles
  add column if not exists labor_cost_rate numeric(12,2) default 0 check (labor_cost_rate >= 0);

comment on column public.profiles.labor_cost_rate is 'Hourly labor cost rate for internal cost calculations (different from billable rate)';

-- Set some reasonable defaults based on position (these are COST rates, not billing rates)
-- These should be updated by Austin before launch
update public.profiles p
set labor_cost_rate = case
  when p.rate_position_id in (select id from rate_positions where code = 'PRINCIPAL_ENGINEER') then 150
  when p.rate_position_id in (select id from rate_positions where code = 'SENIOR_PROJECT_MANAGER') then 100
  when p.rate_position_id in (select id from rate_positions where code = 'PROJECT_MANAGER') then 85
  when p.rate_position_id in (select id from rate_positions where code = 'PROJECT_ENGINEER') then 75
  when p.rate_position_id in (select id from rate_positions where code = 'SENIOR_DESIGNER') then 65
  when p.rate_position_id in (select id from rate_positions where code = 'DESIGNER') then 55
  when p.rate_position_id in (select id from rate_positions where code = 'SENIOR_TECHNICIAN') then 50
  when p.rate_position_id in (select id from rate_positions where code = 'TECHNICIAN') then 45
  when p.rate_position_id in (select id from rate_positions where code = 'PROJECT_INSPECTOR') then 50
  else 50  -- Default fallback
end
where labor_cost_rate = 0 or labor_cost_rate is null;

-- Also add to employee_title_history for historical tracking
alter table public.employee_title_history
  add column if not exists labor_cost_rate numeric(12,2) default 0 check (labor_cost_rate >= 0);

comment on column public.employee_title_history.labor_cost_rate is 'Historical labor cost rate for this title/period';

commit;
