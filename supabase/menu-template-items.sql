create table if not exists public.menu_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.menu_templates(id) on delete cascade,
  name text not null default '',
  location text not null default '',
  storage_tags text[] not null default '{}'::text[],
  prep text not null default '',
  prep_tags text[] not null default '{}'::text[],
  amount text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (storage_tags <@ array['freezer', 'fridge', 'room']::text[]),
  check (prep_tags <@ array['microwave', 'airfryer', 'serve']::text[])
);

create index if not exists menu_template_items_template_id_sort_order_idx
on public.menu_template_items (template_id, sort_order);

alter table public.menu_template_items enable row level security;

drop policy if exists "members can manage template items" on public.menu_template_items;

create policy "members can manage template items"
on public.menu_template_items for all
using (
  exists (
    select 1
    from public.menu_templates mt
    join public.household_members hm
      on hm.household_id = mt.household_id
    where mt.id = menu_template_items.template_id
      and hm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.menu_templates mt
    join public.household_members hm
      on hm.household_id = mt.household_id
    where mt.id = menu_template_items.template_id
      and hm.user_id = auth.uid()
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'menu_template_items'
  ) then
    alter publication supabase_realtime add table public.menu_template_items;
  end if;
end $$;

notify pgrst, 'reload schema';
