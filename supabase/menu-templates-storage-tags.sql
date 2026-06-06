alter table public.menu_templates
  add column if not exists storage_tags text[] not null default '{}'::text[];

alter table public.menu_templates
  drop constraint if exists menu_templates_storage_tags_check;

alter table public.menu_templates
  add constraint menu_templates_storage_tags_check
  check (storage_tags <@ array['freezer', 'fridge', 'room']::text[]);

notify pgrst, 'reload schema';
