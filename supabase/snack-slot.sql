do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.meal_missions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%slot%'
  loop
    execute format('alter table public.meal_missions drop constraint if exists %I', constraint_record.conname);
  end loop;

  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.menu_templates'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%slot%'
  loop
    execute format('alter table public.menu_templates drop constraint if exists %I', constraint_record.conname);
  end loop;
end $$;

alter table public.meal_missions
  add constraint meal_missions_slot_check
  check (slot in ('breakfast', 'snack', 'dinner'));

alter table public.menu_templates
  add constraint menu_templates_slot_check
  check (slot is null or slot in ('breakfast', 'snack', 'dinner'));

drop index if exists meal_missions_household_date_slot_key;

create unique index if not exists meal_missions_household_date_slot_unique_idx
on public.meal_missions (household_id, meal_date, slot)
where slot in ('breakfast', 'dinner');

notify pgrst, 'reload schema';
