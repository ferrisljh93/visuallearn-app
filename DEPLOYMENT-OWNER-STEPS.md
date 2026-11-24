# Deployment — Owner Steps (only Ferris can do these)

Everything in this repository is built and verified locally. What remains are
account-creation and console steps that only the owner can perform (they need
your identity, your email and your credentials). **Total estimated owner
time: ~35–50 minutes.** Everything is on free tiers; **no card is required
and no billing is to be activated at any step.** If any screen asks for
payment details, stop — that is the wrong flow.

Work through in order. Steps 1–3 are independent of 4–5 and can be done on
different days.

---

## Step 1 — Create the GitHub repository (~5 min)

The Muse GitHub connector cannot create repositories, so this is yours.

1. Go to https://github.com/new (signed in as ferrisljh93).
2. Repository name: `visuallearn-app` (suggested). Visibility: **Private**
   is fine — Cloudflare Pages can deploy from private repos you authorise.
   Do NOT tick "Add a README" (this repo already has one).
3. Create repository. Leave it empty — Muse will push, or you can upload
   the `external-mvp` folder contents via "uploading an existing file".

## Step 2 — Create the Supabase project (~10 min, plus ~2 min provisioning)

1. Go to https://supabase.com → Sign in (use the **VisualLearn business
   Google account**, visuallearn.sg@gmail.com — keep venture accounts off
   your personal and work identities).
2. New project → name `visuallearn`, choose a strong database password and
   **store it in your password manager** (you will rarely need it; Muse
   never needs it). Region: **Southeast Asia (Singapore)**.
3. Wait for provisioning. Do NOT enable any paid add-ons.
4. Project Settings → API: copy the **Project URL** and the **anon /
   publishable** key. (The `service_role` key stays in that screen — never
   copy it into code, chat or this repo.)

## Step 3 — Create the database schema (~5 min)

1. Supabase Dashboard → SQL Editor → New query.
2. Paste the **entire** contents of `schema.sql` from this repo → Run.
3. Confirm success (no errors). This creates all tables with Row Level
   Security enabled and the signup trigger.

## Step 4 — Configure authentication (~5 min)

1. Authentication → Providers → Email: ensure **enabled**.
2. Decide email confirmation for the testing phase (recommendation: leave
   **Confirm email ON** — learners verify via their inbox; it also stops
   typo'd sign-ups). Keep whichever you choose consistent for all testers.
3. Authentication → URL Configuration → Site URL: set to the Cloudflare
   Pages URL from Step 6 (come back to this after Step 6 if needed).

## Step 5 — Put the keys into the code (~3 min)

1. Open `js/config.js` and replace the two placeholders with the Project URL
   and anon key from Step 2.4. (These are public client values by design —
   safe in the repo. The service-role key is the only secret, and it is
   never used.)
2. Tell Muse "config done" — Muse will re-verify the app against your
   live project (sign-up, sign-in, RLS isolation between two test accounts)
   before any learner is invited.

## Step 6 — Deploy to Cloudflare Pages (~10 min)

1. Go to https://dash.cloudflare.com → Sign up / Sign in (again, use the
   VisualLearn business identity). Free plan; no card.
2. Workers & Pages → Create → Pages → Connect to Git → authorise GitHub →
   select the `visuallearn-app` repository.
3. Framework preset: **None**. Build command: **leave empty**.
   Build output directory: **/** (root).
4. Save and Deploy. Your independent URL is
   `https://visuallearn-app.pages.dev` (or the project name you chose).
5. Add that URL to Supabase Authentication → URL Configuration (Step 4.3).

## Step 7 — Owner acceptance check (~5 min)

1. Open the pages.dev URL on your phone and on desktop.
2. Create a test account, walk the journey: Today → Study Workspace →
   Visual Lab (prediction gate) → Practice → Flashcards.
3. Sign out; create a second test account; confirm it starts empty
   (this is the RLS isolation check).
4. Report any issue to Muse with the screen and step — fixes are code
   changes in this repo, redeployed by pushing to GitHub (Cloudflare
   rebuilds automatically).

---

## What NOT to do

- Do not activate billing, add a card, or buy a custom domain — a domain is
  a separate owner decision with separate approval.
- Do not paste the Supabase `service_role` key anywhere outside the Supabase
  dashboard.
- Do not invite learners until Muse's live verification (Step 5.2) passes
  and the Class B testing arrangements in
  `../external-mvp/testing-evidence-addendum-2026-11-24.md` are in place.

## Estimated timeline context

Repository build: complete (24 Nov 2026). Owner steps above: ~35–50 min,
schedulable any time. Live verification by Muse: same day the config is
provided. Direct (Class B) learner testing can begin only after live
verification passes AND recruitment produces screened learners — recruitment
remains the binding constraint, not the deployment.
