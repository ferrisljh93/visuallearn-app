# VisualLearn — Independent Deployment: Architecture Decision

**Date:** 24 Nov 2026 · **Decision owner:** Ferris (approval given 24 Nov 2026, ~19:35 SGT)
**Status:** SELECTED and BUILT (locally). Not yet deployed — deployment requires the owner's account steps (`DEPLOYMENT-OWNER-STEPS.md`). Spend: S$0.
**Evidence base:** `../external-mvp-research.md` — every platform claim below was verified against official vendor pricing/terms/docs pages on 24 Nov 2026 and is sourced there. Claims that could not be verified from official sources are marked UNVERIFIED and are not relied on.

---

## 1. Decision

**Selected architecture:**

| Layer | Choice | Why (one line) |
|---|---|---|
| Frontend hosting | **Cloudflare Pages (Free)** | Unlimited free static requests, 500 builds/month, Git-connected deploys, independent `*.pages.dev` URL; no commercial-use ban in the terms reviewed |
| Auth + database | **Supabase (Free)** | The only candidate with built-in individual authentication AND server-side per-user isolation (Postgres Row Level Security); 50,000 free MAU vs ~10 testers |
| Source of truth | **Owner-controlled GitHub repository** (`visuallearn-app`) | GitHub hosts the *code* (its proper role); it does not host the live site |
| Application | **Plain static HTML/CSS/vanilla JS, no build step, no framework runtime** | Maximally portable: the same files deploy unchanged to any static host; zero Muse runtime dependency |

**The deployed application contains no Muse technology of any kind.** The Muse-hosted `visuallearn-mvp` Space remains the internal evaluation environment only.

## 2. Requirement-by-requirement fit

| Owner's mandatory requirement | How the selected architecture meets it |
|---|---|
| Owner-controlled source code repository | Owner creates and owns the GitHub repo; the complete app is plain files in it |
| Complete application source code, not specifications | Full working source in `external-mvp/` (shell, views, labs, scheduler, data layer) — built and smoke-tested, not specced |
| Documented DB schema + deployment instructions | `schema.sql` (tables, indexes, RLS policies, trigger, all commented) + `README.md` deployment section + `DEPLOYMENT-OWNER-STEPS.md` |
| Secure individual authentication | Supabase Auth, email + password, per-user accounts |
| Server-side user-data isolation | PostgreSQL **Row Level Security**: every table has RLS enabled and owner-only policies (`auth.uid() = user_id`). Isolation is enforced inside the database, not in frontend code |
| Persistent learning progress | Postgres rows per user (attempts, card states, lab events, uploads, journey) — survive across devices and sessions |
| Responsive desktop + mobile | Atlas v2 shell: left rail on desktop, bottom tab bar on mobile; verified layouts in CSS |
| Independent website URL | `https://<project>.pages.dev` (custom domain is a separate, later, separately-approved purchase — not required) |
| Existing validated learning journey | Identical journey and verbatim verified content (4 topics, 6 questions, 6 flashcards, 4 labs on the corrected physics baseline) |
| No Muse runtime dependency | No Muse APIs, hosting or code in the stack |
| No credentials embedded in frontend code | See §4 — the one key present is a public client key by design; no secret exists client-side |

## 3. Comparison summary (verified facts; full sourcing in the research file)

| Criterion | Cloudflare Pages | Cloudflare Workers | Supabase | GitHub Pages |
|---|---|---|---|---|
| Free limits vs our scale (~10 testers) | Static requests free & unlimited; 500 builds/mo — ample | 100k req/day; 10 ms CPU — ample for glue | 500 MB DB, 5 GB egress, 50k MAU, 1 GB storage — ample | 1 GB site, 100 GB/mo soft — ample |
| Commercial use on free tier | No ban in §2.2.1 restrictions reviewed; **but §2.2.1(h) bars processing/collecting card data on Free properties** → future checkout must be processor-hosted | Same Cloudflare terms | No explicit free-tier ban found; Terms' "internal business purposes / Authorized Users" wording flagged for clarification **before charging** (UNVERIFIED interpretation) | **Explicitly prohibited**: "not intended for or allowed to be used … to run your online business, e-commerce site, or … commercial software as a service (SaaS)" |
| Credit card to stay on free | Terms tie card requirement to Paid Services (§4.1); explicit "no card" statement UNVERIFIED | Same | Explicit "no card" statement UNVERIFIED — owner confirms at sign-up; do not activate billing | UNVERIFIED (free plan needs no billing for public repos per availability doc) |
| Built-in individual auth | None | None | **Yes (Supabase Auth)** | None |
| Server-side per-user isolation | None of its own | None (D1 has no verified RLS equivalent; hand-rolled filtering = hand-rolled risk) | **Yes — real Postgres RLS with `auth.uid()` policies** | None |
| Inactivity behaviour | No pause rule stated | No pause rule stated | **Free projects pause after ~7 days of low DB activity**; warning email ~1 week prior; restorable for 1 year via dashboard Resume | No pause rule stated |
| Portability / lock-in | Plain static files in your Git repo — re-host anywhere | Bindings (KV/D1) are Cloudflare-specific | Real Postgres; data dump in principle + verified free self-hosting (Docker/CLI) exit; Auth/API calls would need re-implementation if leaving | Plain files — most portable host, but unusable here (commercial ban) |

## 4. The frontend-key requirement, stated precisely

The owner's requirement is **no credentials embedded in frontend code**. The standard Supabase pattern must be described honestly:

- The frontend carries Supabase's **anon / publishable key**. Supabase's own API-keys guide states this key is **"Safe to expose online"** and exists precisely "for anything you ship: browser, mobile app… because anyone can read it, so it only reaches what Row Level Security allows." It is a **public client identifier, not a credential**: on its own it can access nothing — with RLS enabled and no policies, the API returns no data at all (Supabase docs, RLS guide).
- The actual security boundary is **RLS in the database** (server-side), which this build implements on every table.
- The **service-role / secret key bypasses RLS entirely** and is a real credential. It appears **nowhere** in this repository, the frontend, or the build output, and must never be added. This is the requirement's substance, and it is met.
- Practice answer keys in `js/content.js` are educational content (the verified question set), not credentials; checking runs client-side with the prototype's tolerance rules, equivalent to the prototype's checking for this content set.

## 5. Why the alternatives were rejected

- **GitHub Pages as host — REJECTED (disqualified).** GitHub's official limits page explicitly prohibits using Pages "as a free web-hosting service to run your online business… or providing commercial software as a service (SaaS)", and warns against sending passwords through Pages sites. Building the commercial deployment on a host whose terms forbid the use case would be negligent. GitHub is used only as the code repository, which is unrestricted.
- **Cloudflare Workers + D1 as the backend — REJECTED.** No built-in user authentication and no RLS-equivalent isolation: every per-user filter would be hand-written application code, a materially weaker and error-prone security posture for learner data, for zero benefit at our scale. Workers remains available later as optional glue (100k free req/day) if a server-side function is ever needed (e.g. a processor-hosted checkout webhook) — it is not needed now.
- **Cloudflare Pages alone — INSUFFICIENT.** It has no database and no auth; it is a host, not a backend. Selected in its correct role.
- **Supabase alone (hosting the frontend elsewhere/nowhere) — INSUFFICIENT.** Supabase is the backend; the frontend still needs a host, and Pages is the strongest free host whose terms permit the use.

## 6. Known risks and mitigations (honest register)

| Risk | Severity for us | Mitigation |
|---|---|---|
| **Supabase free-project pausing** after ~7 days of low activity — with sporadic testers this will likely trigger at some point | Low–moderate: a paused project makes the app read-only/down until resumed; data is safe and restorable for 1 year | Owner resumes in ~2 min from the Supabase dashboard (warning email arrives ~1 week before). Any normal learner activity prevents pausing. Recorded in owner steps; if testing cadence makes this recur, it becomes evidence for a future (separately approved) paid-tier decision — not taken now |
| Cloudflare may terminate Free Services at its sole discretion (§2.6) | Low | The app is plain static files + a Postgres backend: re-hosting the frontend is a same-day file copy; no Cloudflare-specific code exists in the repo |
| Supabase Terms wording ("internal business purposes / Authorized Users") vs serving external learners | None for free testing; **must be clarified before charging money** | Payments are gated off anyway. Flagged as a pre-launch legal/terms check for the owner; this document does not conclude either way |
| "No credit card required" not stated verbatim on official pages (all vendors) | Low | Owner confirms at sign-up (owner steps say: if any screen demands payment details, stop — wrong flow). No billing activation is authorised |
| Singapore region/data residency on free tiers | UNVERIFIED in research | Owner selects Singapore region for the Supabase project at creation (option exists in the console flow per owner steps); not relied on as a compliance claim |

## 7. What this decision does NOT do

- It does not deploy anything (owner account steps pending), activate billing, buy a domain, or spend anything (S$0 maintained).
- It does not enable live AI processing or payments — both remain behind their existing acceptance gates.
- It does not amend any testing criterion: the moderated protocol and thresholds stay with Class A assisted sessions; direct learner use of this external MVP is Class B evidence under `testing-evidence-addendum-2026-11-24.md`, reported separately, never pooled.
