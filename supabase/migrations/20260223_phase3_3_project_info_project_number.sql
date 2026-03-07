begin;

alter table public.project_info
  add column if not exists project_number text null;

update public.project_info pi
set project_number = p.project_number
from public.projects p
where p.id = pi.project_id
  and (pi.project_number is null or btrim(pi.project_number) = '');

commit;
