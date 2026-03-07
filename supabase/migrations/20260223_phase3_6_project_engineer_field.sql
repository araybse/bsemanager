begin;

alter table public.project_info
  add column if not exists project_engineer text null;

create or replace function public.normalize_project_info_fields()
returns trigger
language plpgsql
as $$
declare
  phone_digits text;
begin
  new.project_number := nullif(upper(btrim(coalesce(new.project_number, ''))), '');
  new.project_name := nullif(upper(btrim(coalesce(new.project_name, ''))), '');
  new.client_name := nullif(upper(btrim(coalesce(new.client_name, ''))), '');
  new.client_address_line_1 := nullif(upper(btrim(coalesce(new.client_address_line_1, ''))), '');
  new.client_address_line_2 := nullif(upper(btrim(coalesce(new.client_address_line_2, ''))), '');
  new.project_date := nullif(upper(btrim(coalesce(new.project_date, ''))), '');
  new.availability_number := nullif(upper(btrim(coalesce(new.availability_number, ''))), '');
  new.project_manager := nullif(upper(btrim(coalesce(new.project_manager, ''))), '');
  new.project_engineer := nullif(upper(btrim(coalesce(new.project_engineer, ''))), '');
  new.city_county := nullif(upper(btrim(coalesce(new.city_county, ''))), '');

  phone_digits := regexp_replace(coalesce(new.client_phone, ''), '\D', '', 'g');
  if phone_digits = '' then
    new.client_phone := null;
  elsif length(phone_digits) = 10 then
    new.client_phone := '(' || substr(phone_digits, 1, 3) || ') ' || substr(phone_digits, 4, 3) || '-' || substr(phone_digits, 7, 4);
  else
    new.client_phone := nullif(upper(btrim(coalesce(new.client_phone, ''))), '');
  end if;

  return new;
end;
$$;

update public.project_info
set
  project_engineer = nullif(upper(btrim(coalesce(project_engineer, ''))), '');

commit;
