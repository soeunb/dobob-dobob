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

create index if not exists memo_reminders_due_idx
on public.memo_reminders (status, remind_at);

create index if not exists memo_reminders_household_idx
on public.memo_reminders (household_id);

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

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at
before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

drop trigger if exists memo_reminders_touch_updated_at on public.memo_reminders;
create trigger memo_reminders_touch_updated_at
before update on public.memo_reminders
for each row execute function public.touch_updated_at();

alter table public.push_subscriptions enable row level security;
alter table public.memo_reminders enable row level security;

drop policy if exists "users can manage own push subscriptions" on public.push_subscriptions;
drop policy if exists "members can manage memo reminders" on public.memo_reminders;

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

do $$
begin
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
