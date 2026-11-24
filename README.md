# VisualLearn — External MVP (independently deployable)

A complete, self-contained implementation of the VisualLearn learning journey
that runs **entirely outside Muse**: a static web app (HTML/CSS/vanilla JS, no
build step) backed by **Supabase** (Auth + PostgreSQL with Row Level Security),
hosted on **Cloudflare Pages**. It exists so independent learners can use
VisualLearn through a normal website URL with their own accounts — no Muse
account, no Muse runtime, nothing proprietary in the deployed stack.

The Muse-hosted `visuallearn-mvp` Space remains the internal evaluation
environment. This repository is the external counterpart, built under the
owner's approval of 24 Nov 2026 at S$0 expenditure.

## What it contains

- The Atlas v2 information architecture (approved for MVP implementation):
  left rail **LEARN / STUDY / PROGRESS** on desktop, bottom tab bar on mobile.
- The full validated learning journey: sign-up/sign-in → Today → Library →
  Upload → Study Workspace (Source / Topics / Explanations) → Topic Map →
  Visual Lab → Practice → Flashcards → Weaknesses → Settings.
- The prototype's verified demo content, verbatim (`js/content.js`, generated
  from `../mvp/mvp-seed-content.json` + the authorised synthetic pumping
  document): 4 topics, 6 verified practice questions, 6 flashcards.
- The four validated Visual Labs, deterministic, no AI at runtime
  (`js/labs.js`): Affinity Laws (corrected baseline 120 L/s · 250 kPa ·
  η 75% · hydraulic 30.0 kW · shaft 40.0 kW; at 80% speed 96.0 L/s ·
  160 kPa · 15.36 kW · 20.48 kW · 48.8% ideal saving; traps 32.0 / 25.6 kW),
  Derivative & Tangent, Ohm's Law, Phase Diagram (water). Each lab has a
  prediction gate, range-rejecting inputs (never silently clamped), live
  readouts + chart, assumptions and the hand-checked reference example.
- Practice checking equivalent to the prototype's: numerical answers within
  1% (or 0.01) of the verified key; wrong answers surface the misconception
  the question was designed to catch. Attempts persist per user.
- FSRS-style flashcard scheduling (`js/fsrs.js`); state persists per user.
- Weakness analysis computed only from the signed-in user's real attempts.

## Honest limits of this build

- **Live AI processing is DISABLED.** Uploads record file name/size against
  the user's account; content is not analysed and no topics/questions are
  generated from uploads. The UI says so in place. Study content is the
  pre-verified demo set and is labelled **PRE-VERIFIED**.
- **Payments do not exist** in this build (no checkout code at all).
- Both stay off until their existing acceptance gates pass.

## Security model

- Authentication: Supabase Auth (email + password), secure individual accounts.
- Data isolation: **server-side**, via PostgreSQL Row Level Security. Every
  table in `schema.sql` has RLS enabled with owner-only policies
  (`auth.uid() = user_id`). A signed-in user can only ever read/write their
  own attempts, card states, lab events, uploads and journey progress.
- Keys: the frontend carries only Supabase's **anon/publishable key** — a
  public client key designed for exactly this use; it grants nothing beyond
  what RLS policies allow. The **service-role key is never used** anywhere in
  this repository and must never be added to frontend code.
- Practice answer keys are educational content (the verified question set),
  not credentials; checking runs client-side against them with the same
  tolerance rules as the prototype.

## Repository layout

```
index.html            app shell (Atlas v2 nav)
css/app.css           styles (responsive desktop + mobile)
js/config.js          Supabase URL + anon key (owner fills in — see below)
js/content.js         verified content (generated; do not hand-edit)
js/store.js           data layer: Supabase backend + local preview fallback
js/fsrs.js            flashcard scheduler
js/labs.js            the four Visual Labs (+ VL_LABMATH for verification)
js/app.js             router + all views
schema.sql            full database schema + RLS policies + signup trigger
.env.example          canonical env names (no real values)
DEPLOYMENT-OWNER-STEPS.md   the exact steps only the owner can do
```

## Local preview (no accounts needed)

Open the folder with any static server, e.g.:

```bash
cd external-mvp
python3 -m http.server 8080
# visit http://localhost:8080
```

With `js/config.js` left as placeholders, the app runs in clearly-labelled
**LOCAL PREVIEW mode**: accounts are per-browser (localStorage), so the owner
can walk the whole journey before deploying. Preview mode is not a service
and must never be presented to learners as one.

## Deployment (owner performs the account steps — see DEPLOYMENT-OWNER-STEPS.md)

1. **Create the Supabase project** (free tier, no card): supabase.com →
   New project. Note the project URL and the anon/publishable key
   (Project Settings → API).
2. **Create the schema**: Supabase Dashboard → SQL Editor → paste the whole
   of `schema.sql` → Run. This creates all tables, indexes, RLS policies and
   the signup profile trigger.
3. **Configure auth**: Authentication → Providers → Email: enable. For the
   testing phase, "Confirm email" may be left ON (learners confirm via
   inbox) — decide before inviting learners and keep it consistent.
   Authentication → URL Configuration: add the deployed site URL.
4. **Fill in `js/config.js`** with the project URL + anon key. Commit.
5. **Create the GitHub repository** (owner step — see DEPLOYMENT-OWNER-STEPS)
   and push this folder as the repository root.
6. **Deploy to Cloudflare Pages** (free tier): Cloudflare Dashboard →
   Workers & Pages → Create → Pages → Connect to Git → select the repo.
   Framework preset: **None**. Build command: **none** (leave empty).
   Build output directory: **/** (root). Deploy. The site is live at
   `https://<project>.pages.dev` — an independent URL, no custom domain
   required (a domain is a later, separately-approved purchase).
7. **Verify**: open the URL, create a test account, walk the journey
   (Today → Study → Lab prediction → Practice → Flashcards), sign out,
   create a second test account and confirm it sees none of the first
   account's attempts (RLS isolation check).

Alternative hosting: the same static files also deploy unchanged to GitHub
Pages or Netlify; Supabase remains the backend. Portability is deliberate —
no Cloudflare-specific code exists in this repository.

## Verification performed on this build (24 Nov 2026)

- All JS files pass `node --check`.
- A Node harness evaluated the lab maths against the hand-checked references:
  Affinity at 80% = 96.0 L/s · 160.0 kPa · 15.36 kW · 20.48 kW · 48.8%;
  traps 32.0 / 25.6 kW; f′(2)=4 with tangent y = 4x − 4; Ohm's law
  12 V / 6 Ω = 2 A · 24 W; phase at 25 °C / 1 atm = liquid; boiling at
  1 atm = 100 °C; all six practice answers recomputed independently and
  matched; FSRS smoke tests (new+Good schedules ahead; Again = +10 min;
  stability grows on review). **All checks passed.**
- A DOM smoke test (jsdom) drove the local-preview journey end-to-end:
  sign-up → Today → Practice (correct + misconception feedback) →
  Weaknesses → Lab prediction gate lock/unlock → Flashcards grading →
  persistence of attempts/card states/lab events/journey in storage.
- **Not yet live-tested** (requires the owner's accounts): Supabase Auth
  sign-up/sign-in against a real project, RLS isolation between two real
  accounts, and the Cloudflare Pages deployment itself. These are verified
  by code and policy inspection only until the owner completes the steps in
  `DEPLOYMENT-OWNER-STEPS.md`.

## Content regeneration

`js/content.js` is generated from `../mvp/mvp-seed-content.json` and
`../eval-v3-full/payloads/pumping_synth.json`. If the verified content ever
changes, regenerate it rather than editing by hand, and re-run the numeric
verification above.
