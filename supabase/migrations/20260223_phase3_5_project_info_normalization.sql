begin;

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

drop trigger if exists trg_normalize_project_info_fields on public.project_info;
create trigger trg_normalize_project_info_fields
before insert or update on public.project_info
for each row
execute function public.normalize_project_info_fields();

update public.project_info
set
  project_number = nullif(upper(btrim(coalesce(project_number, ''))), ''),
  project_name = nullif(upper(btrim(coalesce(project_name, ''))), ''),
  client_name = nullif(upper(btrim(coalesce(client_name, ''))), ''),
  client_address_line_1 = nullif(upper(btrim(coalesce(client_address_line_1, ''))), ''),
  client_address_line_2 = nullif(upper(btrim(coalesce(client_address_line_2, ''))), ''),
  client_phone = case
    when regexp_replace(coalesce(client_phone, ''), '\D', '', 'g') = '' then null
    when length(regexp_replace(coalesce(client_phone, ''), '\D', '', 'g')) = 10 then
      '(' || substr(regexp_replace(coalesce(client_phone, ''), '\D', '', 'g'), 1, 3) ||
      ') ' || substr(regexp_replace(coalesce(client_phone, ''), '\D', '', 'g'), 4, 3) ||
      '-' || substr(regexp_replace(coalesce(client_phone, ''), '\D', '', 'g'), 7, 4)
    else nullif(upper(btrim(coalesce(client_phone, ''))), '')
  end,
  project_date = nullif(upper(btrim(coalesce(project_date, ''))), ''),
  availability_number = nullif(upper(btrim(coalesce(availability_number, ''))), ''),
  project_manager = nullif(upper(btrim(coalesce(project_manager, ''))), ''),
  city_county = nullif(upper(btrim(coalesce(city_county, ''))), '');

commit;
