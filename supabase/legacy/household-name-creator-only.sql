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
    from public.households
    where id = target_household_id
      and created_by = auth.uid()
  ) then
    raise exception 'Only the household creator can update household name.';
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

revoke update on public.households from authenticated;
grant update (name) on public.households to authenticated;

drop policy if exists "household owners can update household"
on public.households;

drop policy if exists "household creators can update household"
on public.households;

create policy "household creators can update household"
on public.households
for update
to authenticated
using (households.created_by = auth.uid())
with check (households.created_by = auth.uid());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'households'
  ) then
    alter publication supabase_realtime add table public.households;
  end if;
end $$;

notify pgrst, 'reload schema';
