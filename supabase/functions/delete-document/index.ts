// VisualLearn §32 — delete-document Edge Function (Deno).
// Deletion completeness: removes the stored PDF object AND the
// documents row; every derived artefact (doc_pages, doc_chunks,
// processing_jobs, conversations, messages) is removed by the
// ON DELETE CASCADE foreign keys in schema-v2.sql. Returns a receipt
// with the counts removed so the caller can verify nothing derived
// survives. Owner-only: a user can delete only their own documents.
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body),
    { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  try {
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "not signed in" }, 401);
    const uid = userData.user.id;
    const sb = admin();
    const { document_id } = await req.json();
    const { data: doc } = await sb.from("documents").select("*")
      .eq("id", document_id).single();
    if (!doc) return json({ error: "document not found" }, 404);
    if (doc.user_id !== uid) return json({ error: "not your document" }, 403);

    const counts = {};
    for (const t of ["doc_pages", "doc_chunks", "processing_jobs", "conversations"]) {
      const { count } = await sb.from(t).select("*",
        { count: "exact", head: true }).eq("document_id", document_id);
      counts[t] = count || 0;
    }
    const { count: msgCount } = await sb.from("messages").select("*",
      { count: "exact", head: true }).eq("user_id", uid)
      .in("conversation_id",
        (await sb.from("conversations").select("id")
          .eq("document_id", document_id)).data.map((c) => c.id));
    counts.messages = msgCount || 0;

    const { error: storageErr } = await sb.storage
      .from("documents").remove([doc.storage_path]);
    if (storageErr) return json({ error: "storage removal failed; nothing deleted" }, 500);
    const { error: delErr } = await sb.from("documents")
      .delete().eq("id", document_id);
    if (delErr) throw delErr;
    return json({ deleted: true, document_id,
      removed: { storage_object: doc.storage_path, ...counts },
      note: "Derived rows were removed by ON DELETE CASCADE; verify with a select on each table (expected 0)." });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
