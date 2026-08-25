alter table public.meal_missions
  drop constraint if exists meal_missions_slot_check;

alter table public.meal_missions
  add constraint meal_missions_slot_check
  check (slot in ('breakfast', 'lunch', 'snack', 'dinner'));

alter table public.menu_templates
  drop constraint if exists menu_templates_slot_check;

alter table public.menu_templates
  add constraint menu_templates_slot_check
  check (slot is null or slot in ('breakfast', 'lunch', 'snack', 'dinner'));

notify pgrst, 'reload schema';
