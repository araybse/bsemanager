begin;

-- Remove labor_cost_rate from profiles table (not needed - using timeline instead)
alter table public.profiles
  drop column if exists labor_cost_rate;

commit;
