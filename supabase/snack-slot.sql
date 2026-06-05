alter table public.meal_missions
  drop constraint if exists meal_missions_slot_check,
  drop constraint if exists meal_missions_prep_tag_check,
  drop constraint if exists meal_missions_storage_tag_check;

alter table public.menu_templates
  drop constraint if exists menu_templates_slot_check;

alter table public.meal_missions
  drop column if exists prep_tag,
  drop column if exists storage_tag;

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
