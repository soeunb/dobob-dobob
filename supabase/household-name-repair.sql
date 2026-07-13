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

grant execute
on function public.is_household_member(uuid)
to authenticated;

create or replace function public.update_household_name(
  target_household_id uuid,
  household_name text
)
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

grant execute
on function public.update_household_name(uuid, text)
to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;

insert into public.household_members (household_id, user_id, role)
select id, created_by, 'owner'
from public.households
where created_by is not null
on conflict (household_id, user_id) do update
set role = 'owner'
where public.household_members.role <> 'owner';

revoke update on public.households from authenticated;
grant update (name) on public.households to authenticated;

drop policy if exists "members can view households"
on public.households;

create policy "members can view households"
on public.households
for select
using (public.is_household_member(id));

drop policy if exists "household owners can update household"
on public.households;

create policy "household owners can update household"
on public.households
for update
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

drop policy if exists "members can view memberships"
on public.household_members;

create policy "members can view memberships"
on public.household_members
for select
using (
  user_id = auth.uid()
  or public.is_household_member(household_id)
);

notify pgrst, 'reload schema';
