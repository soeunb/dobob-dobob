create extension if not exists "pgcrypto";

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default '우리집',
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('mom', 'dad', 'guardian')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.meal_missions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  meal_date date not null,
  slot text not null check (slot in ('breakfast', 'dinner')),
  menu_name text not null,
  location text not null default '',
  prep text not null default '',
  amount text not null default '',
  note text not null default '',
  storage_tag text not null default 'fridge' check (storage_tag in ('freezer', 'fridge', 'room')),
  prep_tag text not null default 'microwave' check (prep_tag in ('microwave', 'airfryer', 'serve')),
  is_fed boolean not null default false,
  fed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, meal_date, slot)
);

create table public.menu_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  menu_name text not null,
  location text not null default '',
  prep text not null default '',
  amount text not null default '',
  note text not null default '',
  storage_tag text not null default 'fridge' check (storage_tag in ('freezer', 'fridge', 'room')),
  prep_tag text not null default 'microwave' check (prep_tag in ('microwave', 'airfryer', 'serve')),
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger meal_missions_touch_updated_at
before update on public.meal_missions
for each row execute function public.touch_updated_at();

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.meal_missions enable row level security;
alter table public.menu_templates enable row level security;

create policy "members can view household"
on public.households for select
using (
  exists (
    select 1 from public.household_members
    where household_members.household_id = households.id
    and household_members.user_id = auth.uid()
  )
);

create policy "members can view members"
on public.household_members for select
using (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = household_members.household_id
    and hm.user_id = auth.uid()
  )
);

create policy "members can manage meals"
on public.meal_missions for all
using (
  exists (
    select 1 from public.household_members
    where household_members.household_id = meal_missions.household_id
    and household_members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.household_members
    where household_members.household_id = meal_missions.household_id
    and household_members.user_id = auth.uid()
  )
);

create policy "members can manage templates"
on public.menu_templates for all
using (
  exists (
    select 1 from public.household_members
    where household_members.household_id = menu_templates.household_id
    and household_members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.household_members
    where household_members.household_id = menu_templates.household_id
    and household_members.user_id = auth.uid()
  )
);
