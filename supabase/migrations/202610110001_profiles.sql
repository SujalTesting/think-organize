-- Communication Lab account profiles
-- Run this in Supabase SQL Editor for the communication-lab project.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text,
  date_of_birth date,
  gender text,
  country text,
  state text,
  city text,
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null and length(trim(username)) > 0;

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

grant select, insert, update on public.profiles to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (
    id, full_name, username, date_of_birth, gender, country, state, city
  )
  values (
    new.id,
    nullif(trim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), ''),
    nullif(trim(coalesce(meta ->> 'username', '')), ''),
    nullif(meta ->> 'date_of_birth', '')::date,
    nullif(trim(coalesce(meta ->> 'gender', '')), ''),
    nullif(trim(coalesce(meta ->> 'country', '')), ''),
    nullif(trim(coalesce(meta ->> 'state', '')), ''),
    nullif(trim(coalesce(meta ->> 'city', '')), '')
  )
  on conflict (id) do nothing;
  return new;
exception when invalid_text_representation then
  -- OAuth providers may not send a date of birth; the user completes it later.
  insert into public.profiles (id, full_name)
  values (new.id, nullif(trim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();
