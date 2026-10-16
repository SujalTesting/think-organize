-- Add per-user learning path selection and isolated SDET track progress.
alter table public.profiles
  add column if not exists learning_path text not null default 'genai-agentic-ai';

alter table public.profiles
  drop constraint if exists profiles_learning_path_check;

alter table public.profiles
  add constraint profiles_learning_path_check
  check (learning_path in ('genai-agentic-ai', 'sdet-ai'));

create table if not exists public.sdet_learning_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.sdet_learning_data enable row level security;

grant select, insert, update on public.sdet_learning_data to authenticated;

drop policy if exists "Users can read own SDET learning data" on public.sdet_learning_data;
create policy "Users can read own SDET learning data"
  on public.sdet_learning_data for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own SDET learning data" on public.sdet_learning_data;
create policy "Users can insert own SDET learning data"
  on public.sdet_learning_data for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own SDET learning data" on public.sdet_learning_data;
create policy "Users can update own SDET learning data"
  on public.sdet_learning_data for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
