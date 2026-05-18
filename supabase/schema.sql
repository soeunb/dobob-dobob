create extension if not exists "pgcrypto";

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default '우리집',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  household_id uuid not null references public.households(id) on delete cascade,
  created_at timestamptz not null default now()
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
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, meal_date, slot)
);

create table public.fridge_memos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  text text not null check (char_length(text) <= 200),
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create or replace function public.limit_household_to_two_profiles()
returns trigger as $$
begin
  if (
    select count(*)
    from public.profiles
    where profiles.household_id = new.household_id
    and profiles.id <> new.id
  ) >= 2 then
    raise exception 'A household can have at most two profiles';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.current_household_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select household_id
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create trigger meal_missions_touch_updated_at
before update on public.meal_missions
for each row execute function public.touch_updated_at();

create trigger fridge_memos_touch_updated_at
before update on public.fridge_memos
for each row execute function public.touch_updated_at();

create trigger profiles_limit_two_per_household
before insert or update of household_id on public.profiles
for each row execute function public.limit_household_to_two_profiles();

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.meal_missions enable row level security;
alter table public.fridge_memos enable row level security;
alter table public.menu_templates enable row level security;

create policy "members can view household"
on public.households for select
using (id = public.current_household_id());

create policy "users can create own profile"
on public.profiles for insert
with check (id = auth.uid());

create policy "members can view profiles in household"
on public.profiles for select
using (household_id = public.current_household_id());

create policy "users can update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "members can manage meals"
on public.meal_missions for all
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy "members can manage fridge memos"
on public.fridge_memos for all
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy "members can manage templates"
on public.menu_templates for all
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

-- Example seed after creating two Supabase Auth users:
-- insert into public.households (id, name)
-- values ('00000000-0000-0000-0000-000000000001', '도밥이네');
--
-- insert into public.profiles (id, display_name, household_id)
-- values
--   ('사용자-1-auth-user-id', '소은', '00000000-0000-0000-0000-000000000001'),
--   ('사용자-2-auth-user-id', '남편이름', '00000000-0000-0000-0000-000000000001');
