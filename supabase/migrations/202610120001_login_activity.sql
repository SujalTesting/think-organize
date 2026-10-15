-- Record successful sign-ins for the authenticated user's own account.
-- City/region/country are copied from the user's profile; they are not GPS/IP-detected.
create table if not exists public.login_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  country text,
  region text,
  city text,
  time_zone text,
  locale text,
  location_source text not null default 'profile'
    check (location_source in ('profile', 'not_provided'))
);

create index if not exists login_activity_user_logged_at_idx
  on public.login_activity (user_id, logged_at desc);

alter table public.login_activity enable row level security;

drop policy if exists "Users can read their own login activity" on public.login_activity;
create policy "Users can read their own login activity"
  on public.login_activity for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own login activity" on public.login_activity;
create policy "Users can insert their own login activity"
  on public.login_activity for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

grant select, insert on public.login_activity to authenticated;

comment on table public.login_activity is
  'Successful sign-in history. Location fields come from the user profile, not precise device geolocation.';
comment on column public.login_activity.logged_at is
  'Database-generated timestamp for the login event, stored with time zone.';
comment on column public.login_activity.location_source is
  'profile means user-entered profile location; not_provided means no profile location was available.';

-- Always use a database timestamp for the audit event, not a client-supplied value.
create or replace function public.set_login_activity_logged_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.logged_at := now();
  return new;
end;
$$;

revoke all on function public.set_login_activity_logged_at() from public;

drop trigger if exists set_login_activity_logged_at on public.login_activity;
create trigger set_login_activity_logged_at
  before insert on public.login_activity
  for each row execute function public.set_login_activity_logged_at();
