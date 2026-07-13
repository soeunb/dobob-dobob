create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  recipe_book_status text not null default 'never_enabled',
  created_at timestamptz not null default now()
);

alter table public.profiles
  drop column if exists household_id,
  add column if not exists display_name text,
  add column if not exists recipe_book_status text not null default 'never_enabled',
  add column if not exists created_at timestamptz not null default now();

alter table public.profiles
  drop constraint if exists profiles_recipe_book_status_check;

alter table public.profiles
  add constraint profiles_recipe_book_status_check
  check (recipe_book_status in ('never_enabled', 'enabled', 'disabled'));

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our home',
  invite_code text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.households
  add column if not exists name text not null default 'Our home',
  add column if not exists invite_code text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists households_invite_code_key
on public.households (invite_code);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table if not exists public.meal_missions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  meal_date date not null,
  slot text not null check (slot in ('breakfast', 'snack', 'dinner')),
  menu_name text not null,
  note text not null default '',
  is_fed boolean not null default false,
  fed_at timestamptz,
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meal_missions
  add column if not exists household_id uuid references public.households(id) on delete cascade,
  add column if not exists meal_date date,
  add column if not exists slot text,
  add column if not exists menu_name text,
  add column if not exists note text not null default '',
  add column if not exists is_fed boolean not null default false,
  add column if not exists fed_at timestamptz,
  add column if not exists author_id uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.meal_missions
  drop column if exists location,
  drop column if exists prep,
  drop column if exists amount,
  drop column if exists storage_tag,
  drop column if exists prep_tag;

alter table public.meal_missions
  drop constraint if exists meal_missions_household_id_meal_date_slot_key;

drop index if exists meal_missions_household_date_slot_key;
drop index if exists meal_missions_household_date_slot_unique_idx;

create table if not exists public.meal_mission_items (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.meal_missions(id) on delete cascade,
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

alter table public.meal_mission_items
  add column if not exists storage_tags text[] not null default '{}'::text[],
  add column if not exists prep_tags text[] not null default '{}'::text[];

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'meal_mission_items'
      and column_name = 'storage_tag'
  ) then
    execute 'update public.meal_mission_items set storage_tags = array[storage_tag] where cardinality(storage_tags) = 0 or storage_tags = array[''fridge'']::text[]';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'meal_mission_items'
      and column_name = 'prep_tag'
  ) then
    execute 'update public.meal_mission_items set prep_tags = array[prep_tag] where cardinality(prep_tags) = 0 or prep_tags = array[''microwave'']::text[]';
  end if;
end $$;

alter table public.meal_mission_items
  drop column if exists storage_tag,
  drop column if exists prep_tag;

alter table public.meal_mission_items
  alter column storage_tags set default '{}'::text[],
  alter column prep_tags set default '{}'::text[];

create index if not exists meal_mission_items_mission_id_sort_order_idx
on public.meal_mission_items (mission_id, sort_order);

create table if not exists public.fridge_memos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  text text not null check (char_length(text) <= 200),
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fridge_memos
  add column if not exists household_id uuid references public.households(id) on delete cascade,
  add column if not exists text text,
  add column if not exists author_id uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions
  add column if not exists user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  add column if not exists endpoint text,
  add column if not exists p256dh text,
  add column if not exists auth text,
  add column if not exists user_agent text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists push_subscriptions_endpoint_key
on public.push_subscriptions (endpoint);

create index if not exists push_subscriptions_user_id_idx
on public.push_subscriptions (user_id);

create table if not exists public.memo_reminders (
  id uuid primary key default gen_random_uuid(),
  memo_id uuid not null references public.fridge_memos(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  target_user_ids uuid[],
  remind_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled', 'skipped', 'failed')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.memo_reminders
  add column if not exists memo_id uuid references public.fridge_memos(id) on delete cascade,
  add column if not exists household_id uuid references public.households(id) on delete cascade,
  add column if not exists sender_id uuid references public.profiles(id) on delete cascade,
  add column if not exists target_user_ids uuid[],
  add column if not exists remind_at timestamptz,
  add column if not exists status text not null default 'pending',
  add column if not exists sent_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists memo_reminders_due_idx
on public.memo_reminders (status, remind_at);

create index if not exists memo_reminders_household_idx
on public.memo_reminders (household_id);

create table if not exists public.menu_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  menu_name text not null,
  slot text check (slot in ('breakfast', 'snack', 'dinner')),
  note text not null default '',
  storage_tags text[] not null default '{}'::text[],
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.menu_templates
  add column if not exists household_id uuid references public.households(id) on delete cascade,
  add column if not exists menu_name text,
  add column if not exists slot text check (slot in ('breakfast', 'snack', 'dinner')),
  add column if not exists note text not null default '',
  add column if not exists storage_tags text[] not null default '{}'::text[],
  add column if not exists author_id uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.menu_templates
  drop column if exists meal_date,
  drop column if exists location,
  drop column if exists prep,
  drop column if exists amount,
  drop column if exists storage_tag,
  drop column if exists prep_tag;

alter table public.menu_templates
  drop constraint if exists menu_templates_storage_tags_check;

alter table public.menu_templates
  add constraint menu_templates_storage_tags_check
  check (storage_tags <@ array['freezer', 'fridge', 'room']::text[]);

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

alter table public.menu_template_items
  add column if not exists storage_tags text[] not null default '{}'::text[],
  add column if not exists prep_tags text[] not null default '{}'::text[];

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'menu_template_items'
      and column_name = 'storage_tag'
  ) then
    execute 'update public.menu_template_items set storage_tags = array[storage_tag] where cardinality(storage_tags) = 0 or storage_tags = array[''fridge'']::text[]';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'menu_template_items'
      and column_name = 'prep_tag'
  ) then
    execute 'update public.menu_template_items set prep_tags = array[prep_tag] where cardinality(prep_tags) = 0 or prep_tags = array[''microwave'']::text[]';
  end if;
end $$;

alter table public.menu_template_items
  drop column if exists storage_tag,
  drop column if exists prep_tag;

alter table public.menu_template_items
  alter column storage_tags set default '{}'::text[],
  alter column prep_tags set default '{}'::text[];

create index if not exists menu_template_items_template_id_sort_order_idx
on public.menu_template_items (template_id, sort_order);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recipes
  add column if not exists household_id uuid references public.households(id) on delete cascade,
  add column if not exists author_id uuid references public.profiles(id) on delete set null,
  add column if not exists title text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists recipes_household_created_at_idx
on public.recipes (household_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Dobob user'
    )
  )
  on conflict (id) do update
  set display_name = excluded.display_name;

  return new;
end;
$$;

create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (
      select 1 from public.households where invite_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

update public.households
set invite_code = public.generate_invite_code()
where invite_code is null or invite_code = '';

alter table public.households
  alter column invite_code set not null,
  alter column name drop default;

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  )
$$;

create or replace function public.shares_household_with(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_user_id = auth.uid()
    or exists (
      select 1
      from public.household_members mine
      join public.household_members theirs
        on theirs.household_id = mine.household_id
      where mine.user_id = auth.uid()
        and theirs.user_id = target_user_id
    )
$$;

create or replace function public.can_access_mission(target_mission_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.meal_missions
    where id = target_mission_id
      and public.is_household_member(household_id)
  )
$$;

create or replace function public.can_access_template(target_template_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.menu_templates
    where id = target_template_id
      and public.is_household_member(household_id)
  )
$$;

create or replace function public.can_access_memo(target_memo_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.fridge_memos
    where id = target_memo_id
      and public.is_household_member(household_id)
  )
$$;

create or replace function public.create_household_with_owner(household_name text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  created_household public.households;
begin
  if auth.uid() is null then
    raise exception 'Login is required.';
  end if;

  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Profile is required.';
  end if;

  insert into public.households (name, invite_code, created_by)
  values (
    coalesce(nullif(trim(household_name), ''), 'Our home'),
    public.generate_invite_code(),
    auth.uid()
  )
  returning * into created_household;

  insert into public.household_members (household_id, user_id, role)
  values (created_household.id, auth.uid(), 'owner')
  on conflict (household_id, user_id) do nothing;

  return created_household;
end;
$$;

create or replace function public.join_household_by_code(code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  found_household public.households;
begin
  if auth.uid() is null then
    raise exception 'Login is required.';
  end if;

  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Profile is required.';
  end if;

  select *
  into found_household
  from public.households
  where invite_code = upper(trim(code))
  limit 1;

  if found_household.id is null then
    raise exception 'Invite code was not found.';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (found_household.id, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;

  return found_household;
end;
$$;

create or replace function public.update_household_name(target_household_id uuid, household_name text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_household public.households;
  trimmed_name text;
begin
  if auth.uid() is null then
    raise exception 'Login is required.';
  end if;

  trimmed_name := nullif(trim(household_name), '');
  if trimmed_name is null then
    raise exception 'Household name is required.';
  end if;

  if not exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role = 'owner'
  ) then
    raise exception 'Only household owner can update household name.';
  end if;

  update public.households
  set name = trimmed_name
  where id = target_household_id
  returning * into updated_household;

  if updated_household.id is null then
    raise exception 'Household was not found.';
  end if;

  return updated_household;
end;
$$;

grant execute on function public.update_household_name(uuid, text) to authenticated;

drop trigger if exists meal_missions_touch_updated_at on public.meal_missions;
create trigger meal_missions_touch_updated_at
before update on public.meal_missions
for each row execute function public.touch_updated_at();

drop trigger if exists fridge_memos_touch_updated_at on public.fridge_memos;
create trigger fridge_memos_touch_updated_at
before update on public.fridge_memos
for each row execute function public.touch_updated_at();

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at
before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

drop trigger if exists memo_reminders_touch_updated_at on public.memo_reminders;
create trigger memo_reminders_touch_updated_at
before update on public.memo_reminders
for each row execute function public.touch_updated_at();

drop trigger if exists menu_templates_touch_updated_at on public.menu_templates;
create trigger menu_templates_touch_updated_at
before update on public.menu_templates
for each row execute function public.touch_updated_at();

drop trigger if exists recipes_touch_updated_at on public.recipes;
create trigger recipes_touch_updated_at
before update on public.recipes
for each row execute function public.touch_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.meal_missions enable row level security;
alter table public.meal_mission_items enable row level security;
alter table public.fridge_memos enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.memo_reminders enable row level security;
alter table public.menu_templates enable row level security;
alter table public.menu_template_items enable row level security;
alter table public.recipes enable row level security;

drop policy if exists "users can create own profile" on public.profiles;
drop policy if exists "members can view profiles in household" on public.profiles;
drop policy if exists "users can view shared profiles" on public.profiles;
drop policy if exists "users can update own profile" on public.profiles;
drop policy if exists "members can view household" on public.households;
drop policy if exists "members can view households" on public.households;
drop policy if exists "members can view memberships" on public.household_members;
drop policy if exists "members can manage meals" on public.meal_missions;
drop policy if exists "members can manage meal items" on public.meal_mission_items;
drop policy if exists "members can manage fridge memos" on public.fridge_memos;
drop policy if exists "users can manage own push subscriptions" on public.push_subscriptions;
drop policy if exists "members can manage memo reminders" on public.memo_reminders;
drop policy if exists "members can manage templates" on public.menu_templates;
drop policy if exists "members can manage template items" on public.menu_template_items;
drop policy if exists "members can view recipes" on public.recipes;

create policy "users can create own profile"
on public.profiles for insert
with check (id = auth.uid());

create policy "users can view shared profiles"
on public.profiles for select
using (public.shares_household_with(id));

create policy "users can update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "members can view households"
on public.households for select
using (public.is_household_member(id));

create policy "members can view memberships"
on public.household_members for select
using (
  user_id = auth.uid()
  or public.is_household_member(household_id)
);

create policy "members can manage meals"
on public.meal_missions for all
using (public.is_household_member(household_id))
with check (
  public.is_household_member(household_id)
  and (author_id is null or public.shares_household_with(author_id))
);

create policy "members can manage meal items"
on public.meal_mission_items for all
using (public.can_access_mission(mission_id))
with check (public.can_access_mission(mission_id));

create policy "members can manage fridge memos"
on public.fridge_memos for all
using (public.is_household_member(household_id))
with check (
  public.is_household_member(household_id)
  and (author_id is null or public.shares_household_with(author_id))
);

create policy "users can manage own push subscriptions"
on public.push_subscriptions for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "members can manage memo reminders"
on public.memo_reminders for all
using (
  public.is_household_member(household_id)
  and public.can_access_memo(memo_id)
)
with check (
  public.is_household_member(household_id)
  and public.can_access_memo(memo_id)
  and sender_id = auth.uid()
);

create policy "members can manage templates"
on public.menu_templates for all
using (public.is_household_member(household_id))
with check (
  public.is_household_member(household_id)
  and (author_id is null or public.shares_household_with(author_id))
);

create policy "members can manage template items"
on public.menu_template_items for all
using (public.can_access_template(template_id))
with check (public.can_access_template(template_id));

create policy "members can view recipes"
on public.recipes for select
using (public.is_household_member(household_id));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fridge_memos'
  ) then
    alter publication supabase_realtime add table public.fridge_memos;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'meal_missions'
  ) then
    alter publication supabase_realtime add table public.meal_missions;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'meal_mission_items'
  ) then
    alter publication supabase_realtime add table public.meal_mission_items;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'memo_reminders'
  ) then
    alter publication supabase_realtime add table public.memo_reminders;
  end if;
end $$;

notify pgrst, 'reload schema';
