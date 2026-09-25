begin;

create or replace function public.enforce_author_id_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'Authentication is required to create authored content.'
        using errcode = '42501';
    end if;

    new.author_id := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.author_id := old.author_id;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_author_id_integrity() from public;
revoke all on function public.enforce_author_id_integrity() from anon;
revoke all on function public.enforce_author_id_integrity() from authenticated;

drop trigger if exists meal_missions_enforce_author_id
on public.meal_missions;

create trigger meal_missions_enforce_author_id
before insert or update on public.meal_missions
for each row execute function public.enforce_author_id_integrity();

drop trigger if exists fridge_memos_enforce_author_id
on public.fridge_memos;

create trigger fridge_memos_enforce_author_id
before insert or update on public.fridge_memos
for each row execute function public.enforce_author_id_integrity();

drop trigger if exists menu_templates_enforce_author_id
on public.menu_templates;

create trigger menu_templates_enforce_author_id
before insert or update on public.menu_templates
for each row execute function public.enforce_author_id_integrity();

drop policy if exists "members can manage meals"
on public.meal_missions;
drop policy if exists "members can view meals"
on public.meal_missions;
drop policy if exists "members can create meals"
on public.meal_missions;
drop policy if exists "members can update meals"
on public.meal_missions;
drop policy if exists "members can delete meals"
on public.meal_missions;

create policy "members can view meals"
on public.meal_missions
for select
to authenticated
using (public.is_household_member(household_id));

create policy "members can create meals"
on public.meal_missions
for insert
to authenticated
with check (
  public.is_household_member(household_id)
  and author_id = auth.uid()
);

create policy "members can update meals"
on public.meal_missions
for update
to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "members can delete meals"
on public.meal_missions
for delete
to authenticated
using (public.is_household_member(household_id));

drop policy if exists "members can manage fridge memos"
on public.fridge_memos;
drop policy if exists "members can view fridge memos"
on public.fridge_memos;
drop policy if exists "members can create fridge memos"
on public.fridge_memos;
drop policy if exists "members can update fridge memos"
on public.fridge_memos;
drop policy if exists "members can delete fridge memos"
on public.fridge_memos;

create policy "members can view fridge memos"
on public.fridge_memos
for select
to authenticated
using (public.is_household_member(household_id));

create policy "members can create fridge memos"
on public.fridge_memos
for insert
to authenticated
with check (
  public.is_household_member(household_id)
  and author_id = auth.uid()
);

create policy "members can update fridge memos"
on public.fridge_memos
for update
to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "members can delete fridge memos"
on public.fridge_memos
for delete
to authenticated
using (public.is_household_member(household_id));

drop policy if exists "members can manage templates"
on public.menu_templates;
drop policy if exists "members can view templates"
on public.menu_templates;
drop policy if exists "members can create templates"
on public.menu_templates;
drop policy if exists "members can update templates"
on public.menu_templates;
drop policy if exists "members can delete templates"
on public.menu_templates;

create policy "members can view templates"
on public.menu_templates
for select
to authenticated
using (public.is_household_member(household_id));

create policy "members can create templates"
on public.menu_templates
for insert
to authenticated
with check (
  public.is_household_member(household_id)
  and author_id = auth.uid()
);

create policy "members can update templates"
on public.menu_templates
for update
to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "members can delete templates"
on public.menu_templates
for delete
to authenticated
using (public.is_household_member(household_id));

commit;
