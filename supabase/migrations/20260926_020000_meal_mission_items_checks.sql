begin;

do $$
declare
  existing_constraints text;
begin
  select string_agg(
    format('%I: %s', constraint_row.conname, pg_get_constraintdef(constraint_row.oid)),
    E'\n' order by constraint_row.conname
  )
  into existing_constraints
  from pg_constraint as constraint_row
  where constraint_row.conrelid = 'public.meal_mission_items'::regclass
    and constraint_row.conname in (
      'meal_mission_items_storage_tags_check',
      'meal_mission_items_prep_tags_check'
    );

  if existing_constraints is not null then
    raise exception using
      errcode = '42710',
      message = 'Expected meal_mission_items CHECK constraints to be absent.',
      detail = existing_constraints,
      hint = 'Inspect the existing constraints before applying this migration; do not replace them automatically.';
  end if;
end;
$$;

alter table public.meal_mission_items
  add constraint meal_mission_items_storage_tags_check
  check (storage_tags <@ array['freezer', 'fridge', 'room']::text[])
  not valid;

alter table public.meal_mission_items
  add constraint meal_mission_items_prep_tags_check
  check (prep_tags <@ array['microwave', 'airfryer', 'serve']::text[])
  not valid;

commit;

begin;

alter table public.meal_mission_items
  validate constraint meal_mission_items_storage_tags_check;

alter table public.meal_mission_items
  validate constraint meal_mission_items_prep_tags_check;

commit;
