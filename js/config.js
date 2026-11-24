/* VisualLearn external MVP — runtime configuration.
 *
 * Fill in these two values after creating the Supabase project (see README.md).
 * SUPABASE_ANON_KEY is Supabase's PUBLIC client ("anon" / "publishable") key.
 * It is designed to be embedded in frontend code: it grants no data access by
 * itself — every table is protected by Row Level Security policies
 * (see schema.sql), so a user can only ever read/write their own rows.
 * NEVER put the Supabase service-role key (or any secret) in this file or
 * anywhere in the frontend. The service-role key bypasses RLS entirely.
 *
 * If these are left as placeholders, the app runs in clearly-labelled LOCAL
 * PREVIEW mode (localStorage only, no real accounts) so the owner can inspect
 * the journey before deployment.
 */
window.VL_CONFIG = {
  SUPABASE_URL: "https://glzfhfcnrwlanyjvmrfy.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_bD40Pr76iSv_Oo4iMMHlcg_MUC5yl6H"
};
