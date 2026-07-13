alter table public.profiles
  add column if not exists recipe_book_status text not null default 'never_enabled';

alter table public.profiles
  drop constraint if exists profiles_recipe_book_status_check;

alter table public.profiles
  add constraint profiles_recipe_book_status_check
  check (recipe_book_status in ('never_enabled', 'enabled', 'disabled'));

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
  )
  and not exists (
    select 1
    from public.households
    where id = target_household_id
      and created_by = auth.uid()
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

revoke update on public.households from authenticated;
grant update (name) on public.households to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recipes_touch_updated_at on public.recipes;
create trigger recipes_touch_updated_at
before update on public.recipes
for each row execute function public.touch_updated_at();

alter table public.recipes enable row level security;

insert into public.household_members (household_id, user_id, role)
select id, created_by, 'owner'
from public.households
where created_by is not null
on conflict (household_id, user_id) do update
set role = 'owner'
where public.household_members.role <> 'owner';

drop policy if exists "household owners can update household" on public.households;
drop policy if exists "members can view recipes" on public.recipes;

create policy "household owners can update household"
on public.households for update
to authenticated
using (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = households.id
      and hm.user_id = auth.uid()
      and hm.role = 'owner'
  )
  or households.created_by = auth.uid()
)
with check (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = households.id
      and hm.user_id = auth.uid()
      and hm.role = 'owner'
  )
  or households.created_by = auth.uid()
);

create policy "members can view recipes"
on public.recipes for select
using (public.is_household_member(household_id));

notify pgrst, 'reload schema';
