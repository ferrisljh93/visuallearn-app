-- ============================================================================
-- VisualLearn external MVP — database schema (Supabase / PostgreSQL)
-- Run this once in the Supabase SQL Editor after creating the project
-- (see README.md). Safe to re-run: uses IF NOT EXISTS / OR REPLACE where
-- practical; policy creation is guarded by DROP POLICY IF EXISTS.
--
-- Security model:
--   * Authentication is Supabase Auth (email + password). auth.users holds
--     credentials; this schema never touches passwords.
--   * EVERY application table has Row Level Security ENABLED, with policies
--     that restrict each row to its owner: auth.uid() = user_id.
--   * The frontend uses only the public anon/publishable key. That key can
--     do nothing except what these policies allow a signed-in user to do
--     with their OWN rows. The service-role key (which bypasses RLS) must
--     NEVER appear in frontend code or in this repository.
-- ============================================================================

-- ---------- profiles (one row per auth user) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

-- ---------- practice attempts ----------
create table if not exists public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null,            -- e.g. 'q-0' .. 'q-5' (verified set)
  topic text not null,
  kind text not null check (kind in ('numerical', 'mcq')),
  correct boolean not null,
  given text,                           -- the learner's submitted answer
  misconception_tag text,               -- set only on incorrect attempts
  created_at timestamptz not null default now()
);
create index if not exists attempts_user_idx on public.attempts (user_id, created_at);

-- ---------- flashcard scheduling state (FSRS-style) ----------
create table if not exists public.card_states (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,                -- e.g. 'card-0' .. 'card-5'
  state jsonb not null,                 -- {stability, difficulty, reps, lapses, state, due, lastReview, lastGrade}
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

-- ---------- visual lab prediction events ----------
create table if not exists public.lab_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  lab_id text not null check (lab_id in ('affinity', 'derivative', 'ohm', 'phase')),
  prediction text not null,             -- the option label the learner committed
  correct boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists lab_events_user_idx on public.lab_events (user_id, created_at);

-- ---------- uploads (records only; analysis is NOT ENABLED) ----------
create table if not exists public.uploads (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  file_size bigint,
  status text not null default 'stored_analysis_disabled'
    check (status in ('stored_analysis_disabled')),
  created_at timestamptz not null default now()
);
create index if not exists uploads_user_idx on public.uploads (user_id, created_at);

-- ---------- journey progress (checklist state, one row per user) ----------
create table if not exists public.journey_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,  -- {source: iso, topics: iso, lab: iso, practice: iso, cards: iso, upload: iso}
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security — enable on every table, owner-only policies.
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.attempts enable row level security;
alter table public.card_states enable row level security;
alter table public.lab_events enable row level security;
alter table public.uploads enable row level security;
alter table public.journey_progress enable row level security;

-- profiles: a user can read/update only their own profile row
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- generic owner-only CRUD for the five user-data tables
do $$
declare t text;
begin
  foreach t in array array['attempts','card_states','lab_events','uploads','journey_progress']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('create policy %I on public.%I for select using (auth.uid() = user_id)', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id)', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for delete using (auth.uid() = user_id)', t || '_delete_own', t);
  end loop;
end $$;

-- ============================================================================
-- Auto-create a profile row when a user signs up.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
