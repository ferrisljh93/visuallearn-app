-- ============================================================================
-- VisualLearn §32 — real document ingestion (RESTRICTED owner-testing mode)
-- Additive to schema.sql. Run AFTER schema.sql in the Supabase SQL Editor.
--
-- Security model additions:
--   * Feature flag: public.app_flags(key, enabled). The tutor + ingestion
--     pipeline are gated SERVER-SIDE by public.tutor_allowlist (user ids /
--     emails). RLS alone cannot express "owner test accounts only" for
--     Edge Function provider calls, so the functions check the allowlist
--     with the caller's JWT before doing any work.
--   * Every new table has RLS ENABLED with owner-only policies
--     (auth.uid() = user_id), exactly like schema.sql.
--   * Storage: private bucket 'documents'; objects live under
--     <auth.uid()>/<document_id>.pdf; storage policies restrict each user
--     to their own folder. No public access, ever.
--   * Provenance: documents.provenance records where the file came from.
--     The tutor function REFUSES to send 'learner_private' documents to
--     the AI provider (development testing: synthetic / public-domain /
--     licensed only).
--   * Quotas (free-stack enforceable): file size cap enforced by the
--     bucket's file_size_limit AND a documents check constraint; page cap
--     enforced by the ingest function before indexing; per-user document
--     count cap enforced by trigger below.
--   * Deletion: documents -> pages/chunks/conversations/messages/jobs all
--     ON DELETE CASCADE; the storage object is removed by the
--     delete-document Edge Function before the row delete.
-- ============================================================================

-- ---------- feature flags + tutor allowlist ----------
create table if not exists public.app_flags (
  key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.app_flags (key, enabled) values
  ('ingestion_enabled', false),
  ('tutor_enabled', false)
on conflict (key) do nothing;
alter table public.app_flags enable row level security;
-- flags are readable by signed-in users (the UI must know what to show);
-- writable by NOBODY through the API (dashboard/service-role only).
drop policy if exists "flags_select_authenticated" on public.app_flags;
create policy "flags_select_authenticated" on public.app_flags
  for select using (auth.role() = 'authenticated');

create table if not exists public.tutor_allowlist (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
alter table public.tutor_allowlist enable row level security;
-- a user may check ONLY their own allowlist membership.
drop policy if exists "allowlist_select_own" on public.tutor_allowlist;
create policy "allowlist_select_own" on public.tutor_allowlist
  for select using (auth.uid() = user_id);

create or replace function public.is_tutor_allowed(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tutor_allowlist where user_id = uid)
     and exists (select 1 from public.app_flags where key = 'tutor_enabled' and enabled)
$$;

-- ---------- documents ----------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 26214400), -- 25 MiB cap
  storage_path text not null,
  provenance text not null default 'learner_private'
    check (provenance in ('synthetic','public_domain','licensed','learner_private')),
  status text not null default 'uploaded'
    check (status in ('uploaded','processing','ready','partial','failed')),
  page_count int,
  coverage jsonb,            -- {extracted:[...], unsupported:[...], failed:[...], unprocessed:[...], fully_extracted:bool}
  disclosure text,           -- learner-facing coverage note (never silent about gaps)
  created_at timestamptz not null default now()
);
create index if not exists documents_user_idx on public.documents (user_id, created_at);

-- per-user document-count cap (free-stack quota): max 10 live documents.
create or replace function public.enforce_doc_quota()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.documents where user_id = new.user_id) >= 10 then
    raise exception 'document quota exceeded (max 10 per user in restricted mode)';
  end if;
  return new;
end $$;
drop trigger if exists documents_quota on public.documents;
create trigger documents_quota before insert on public.documents
  for each row execute function public.enforce_doc_quota();

-- ---------- extracted pages (the coverage record, one row per page) ----------
create table if not exists public.doc_pages (
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  page int not null,
  classification text not null check (classification in ('extracted','unsupported','failed','unprocessed')),
  text text not null default '',
  primary key (document_id, page)
);

-- ---------- chapter-aware chunks (shared foundation output) ----------
create table if not exists public.doc_chunks (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  chunk_index int not null,
  chapter_from int not null,
  chapter_to int not null,
  pages int[] not null,
  text text not null,
  unique (document_id, chunk_index)
);
create index if not exists doc_chunks_doc_idx on public.doc_chunks (document_id, chunk_index);

-- ---------- processing jobs (checkpointed; close-and-resume safe) ----------
create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  stage text not null default 'extract' check (stage in ('extract','classify','chunk','done','failed')),
  next_page int not null default 1,     -- checkpoint: first page not yet processed
  error text,
  updated_at timestamptz not null default now()
);

-- ---------- conversations + messages (persistent tutor history) ----------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  state text,                -- GROUNDED / PARTIALLY GROUNDED / INSUFFICIENT EVIDENCE / CONFIRMED ABSENCE (assistant rows)
  citations jsonb not null default '[]'::jsonb,  -- [{page, quote}] — mechanically verified before insert
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages (conversation_id, created_at);

-- ---------- RLS: owner-only on every new user-data table ----------
do $$
declare t text;
begin
  foreach t in array array['documents','doc_pages','doc_chunks','processing_jobs','conversations','messages']
  loop
    execute format('alter table public.%I enable row level security', t);
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

-- ---------- storage: private 'documents' bucket, per-user folders ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 26214400)
on conflict (id) do nothing;

drop policy if exists "documents_storage_select_own" on storage.objects;
create policy "documents_storage_select_own" on storage.objects
  for select using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "documents_storage_insert_own" on storage.objects;
create policy "documents_storage_insert_own" on storage.objects
  for insert with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "documents_storage_delete_own" on storage.objects;
create policy "documents_storage_delete_own" on storage.objects
  for delete using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
