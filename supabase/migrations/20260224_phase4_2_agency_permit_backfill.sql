with mapped_permits as (
  select
    pp.project_id,
    pp.agency,
    pp.permit_type,
    pp.permit_identifier,
    case
      when upper(pp.agency) like '%JACKSONVILLE%' and upper(pp.permit_type) like '%PLAN%' then 'COJ::PLAN_APPROVAL'
      when upper(pp.agency) = 'JEA' and upper(pp.permit_type) like '%WATER%' then 'JEA::WATER_CONSTRUCTION'
      when upper(pp.agency) = 'JEA' and upper(pp.permit_type) like '%WASTEWATER%' then 'JEA::WASTEWATER_CONSTRUCTION'
      when upper(pp.agency) = 'FDOT' then 'FDOT::ACCESS'
      when upper(pp.agency) like '%ST. JOHNS%' and upper(pp.permit_type) = 'COMM' then 'SJC::COMM'
      when upper(pp.agency) like '%ST. JOHNS%' and upper(pp.permit_type) = 'MDP' then 'SJC::MDP'
      else null
    end as mapped_code
  from public.project_permits pp
),
selected_agencies as (
  select distinct
    mp.project_id,
    split_part(mp.mapped_code, '::', 1) as agency_code
  from mapped_permits mp
  where mp.mapped_code is not null
)
insert into public.project_agencies (project_id, agency_id, is_selected)
select
  sa.project_id,
  a.id,
  true
from selected_agencies sa
join public.agency_catalog a on a.code = sa.agency_code
on conflict (project_id, agency_id) do update
set
  is_selected = true,
  updated_at = timezone('utc', now());

with mapped_permits as (
  select
    pp.project_id,
    pp.permit_identifier,
    case
      when upper(pp.agency) like '%JACKSONVILLE%' and upper(pp.permit_type) like '%PLAN%' then 'COJ::PLAN_APPROVAL'
      when upper(pp.agency) = 'JEA' and upper(pp.permit_type) like '%WATER%' then 'JEA::WATER_CONSTRUCTION'
      when upper(pp.agency) = 'JEA' and upper(pp.permit_type) like '%WASTEWATER%' then 'JEA::WASTEWATER_CONSTRUCTION'
      when upper(pp.agency) = 'FDOT' then 'FDOT::ACCESS'
      when upper(pp.agency) like '%ST. JOHNS%' and upper(pp.permit_type) = 'COMM' then 'SJC::COMM'
      when upper(pp.agency) like '%ST. JOHNS%' and upper(pp.permit_type) = 'MDP' then 'SJC::MDP'
      else null
    end as mapped_code
  from public.project_permits pp
),
mapped_catalog as (
  select
    mp.project_id,
    mp.permit_identifier,
    p.id as permit_id,
    pa.id as project_agency_id
  from mapped_permits mp
  join public.agency_catalog a on a.code = split_part(mp.mapped_code, '::', 1)
  join public.permit_catalog p on p.agency_id = a.id and p.code = split_part(mp.mapped_code, '::', 2)
  left join public.project_agencies pa on pa.project_id = mp.project_id and pa.agency_id = a.id
  where mp.mapped_code is not null
)
insert into public.project_permit_selections (
  project_id,
  project_agency_id,
  permit_id,
  permit_identifier,
  status,
  is_selected
)
select
  mc.project_id,
  mc.project_agency_id,
  mc.permit_id,
  nullif(mc.permit_identifier, ''),
  'required',
  true
from mapped_catalog mc
on conflict (project_id, permit_id) do update
set
  permit_identifier = coalesce(excluded.permit_identifier, public.project_permit_selections.permit_identifier),
  is_selected = true,
  updated_at = timezone('utc', now());

insert into public.project_required_items (
  project_id,
  project_permit_selection_id,
  required_item_catalog_id,
  code,
  name,
  item_type,
  responsibility,
  is_required,
  status
)
select
  pps.project_id,
  pps.id,
  ric.id,
  ric.code,
  ric.name,
  ric.item_type,
  ric.responsibility,
  ric.default_required,
  'pending'
from public.project_permit_selections pps
join public.permit_required_item_catalog ric on ric.permit_id = pps.permit_id and ric.is_active = true
left join public.project_required_items pri
  on pri.project_permit_selection_id = pps.id
 and pri.code = ric.code
 and pri.name = ric.name
where pps.is_selected = true
  and pri.id is null;

insert into public.project_required_items (
  project_id,
  project_permit_selection_id,
  required_item_catalog_id,
  code,
  name,
  item_type,
  responsibility,
  is_required,
  status,
  source_url,
  output_file_url,
  notes
)
select
  ps.project_id,
  ps.id,
  null,
  null,
  coalesce(nullif(psub.department, ''), 'LEGACY SUBMITTAL'),
  'document',
  'provided',
  true,
  case
    when lower(coalesce(psub.status, '')) in ('completed', 'approved') then 'completed'
    when lower(coalesce(psub.status, '')) in ('in progress', 'processing') then 'in_progress'
    when lower(coalesce(psub.status, '')) in ('submitted') then 'submitted'
    else 'pending'
  end,
  psub.source_url,
  psub.pdf_url,
  psub.comment
from public.project_submittals psub
join public.project_agencies pa
  on pa.project_id = psub.project_id
join public.agency_catalog a
  on a.id = pa.agency_id
 and (
   upper(psub.agency) = upper(a.name)
   or upper(psub.agency) = upper(a.code)
 )
join public.project_permit_selections ps
  on ps.project_id = psub.project_id
 and ps.project_agency_id = pa.id
left join public.project_required_items pri
  on pri.project_permit_selection_id = ps.id
 and pri.name = coalesce(nullif(psub.department, ''), 'LEGACY SUBMITTAL')
 and coalesce(pri.source_url, '') = coalesce(psub.source_url, '')
 and coalesce(pri.output_file_url, '') = coalesce(psub.pdf_url, '')
where pri.id is null;
