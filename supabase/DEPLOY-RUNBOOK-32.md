# §32 restricted-mode deployment runbook (owner-session steps)

Everything in this folder is built and locally verified. Deployment is
blocked ONLY on steps that need the VisualLearn Supabase session
(dashboard login for visuallearn.sg@gmail.com — an owner-login step).
Do these in order; total ~15 minutes. S$0 throughout (all free tier).

1. **Schema**: Supabase Dashboard (project `visuallearn`) → SQL Editor
   → paste `schema-v2.sql` → Run. (Additive; safe over schema.sql.)
2. **Flags**: SQL Editor →
   `update public.app_flags set enabled = true where key in ('ingestion_enabled','tutor_enabled');`
   `insert into public.tutor_allowlist (user_id, note)
    select id, 'owner test account' from auth.users
    where email in ('visuallearn.sg@gmail.com','visuallearn.sg+testa@gmail.com','visuallearn.sg+testd@gmail.com')
    on conflict do nothing;`
   (Adjust the test-account list to the accounts actually used.)
3. **Edge Functions**: Dashboard → Edge Functions → Deploy new function
   ×3, names `ingest`, `tutor`, `delete-document`, pasting each
   `functions/<name>/index.ts`; ALSO upload `functions/_shared/pipeline.js`
   with each (the functions import it). Or via CLI:
   `supabase functions deploy ingest tutor delete-document` from
   `external-mvp/` after `supabase link --project-ref glzfhfcnrwlanyjvmrfy`.
4. **Secret**: Edge Functions → Secrets → add `GEMINI_API_KEY` = the
   existing "Designated Gemini API Key" (project VisualLearn,
   visuallearn.sg@gmail.com). SUPABASE_URL / ANON / SERVICE_ROLE are
   auto-provided to functions. The service-role key must appear ONLY
   here — never in the repo/frontend.
5. **Frontend**: push `external-mvp/` changes to GitHub
   (ferrisljh93/visuallearn-app) — Cloudflare Pages auto-deploys.
   Order matters: steps 1–4 BEFORE this push, so the Documents view
   never renders against a missing backend (it degrades to a
   restricted notice if the tables are absent, but don't rely on it).
6. **Live verification (two test accounts)**: sign in as an allowlisted
   test account → Documents → upload the 10-page synthetic corpus PDF
   (provenance: synthetic) → processing completes (ready, 10/10 pages)
   → open viewer, check coverage badges → ask the tutor a question
   whose answer is in the document → click a citation → viewer opens
   at that page → sign out, sign back in → conversation still there →
   sign in as the SECOND account → confirm it cannot see the first
   account's documents/conversations (RLS) → delete the document →
   receipt shows file + pages + chunks + conversations + messages
   removed. Record results in dashboard §32.
