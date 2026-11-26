// VisualLearn §32 — ingest Edge Function (Deno).
// Restricted mode: real ingestion runs ONLY for tutor-allowlisted owner
// test accounts (server-enforced here, not just in the UI).
// Flow per invocation (checkpointed, resumable — close-and-resume safe):
//   download PDF from the private 'documents' bucket -> extract up to
//   BATCH_PAGES pages starting at processing_jobs.next_page -> upsert
//   doc_pages with coverage classification -> advance checkpoint.
// When all pages are extracted: build the coverage summary + disclosure,
// run chapter-aware chunking (shared pipeline), insert doc_chunks, mark
// the document ready (all pages extracted) or partial (gaps disclosed).
// The client re-invokes until status is ready/partial/failed; an
// interrupted browser loses nothing — the checkpoint is server-side.
// Quotas: page cap MAX_PAGES enforced before indexing; file-size cap is
// enforced by the bucket + documents check constraint (25 MiB).
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocumentProxy, extractText } from "https://esm.sh/unpdf@0.12.1";
import {
  classifyPage, coverageSummary, disclosureText, planChunks,
} from "../_shared/pipeline.js";

const MAX_PAGES = 500;
const BATCH_PAGES = 20;

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
    const { data: allowed } = await sb.rpc("is_tutor_allowed", { uid });
    if (!allowed) return json({ error: "restricted mode: account is not on the owner-testing allowlist" }, 403);
    const { data: flag } = await sb.from("app_flags").select("enabled")
      .eq("key", "ingestion_enabled").single();
    if (!flag?.enabled) return json({ error: "ingestion is disabled by feature flag" }, 403);

    const { document_id } = await req.json();
    const { data: doc, error: docErr } = await sb.from("documents")
      .select("*").eq("id", document_id).single();
    if (docErr || !doc) return json({ error: "document not found" }, 404);
    if (doc.user_id !== uid) return json({ error: "not your document" }, 403);

    let { data: job } = await sb.from("processing_jobs")
      .select("*").eq("document_id", document_id).maybeSingle();
    if (!job) {
      const ins = await sb.from("processing_jobs")
        .insert({ document_id, user_id: uid }).select().single();
      job = ins.data;
    }
    if (job.stage === "done") return json({ status: doc.status, stage: "done" });

    const { data: blob, error: dlErr } = await sb.storage
      .from("documents").download(doc.storage_path);
    if (dlErr || !blob) return json({ error: "stored file not accessible" }, 500);
    const buf = new Uint8Array(await blob.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    const totalPages = pdf.numPages;
    if (totalPages > MAX_PAGES) {
      await sb.from("documents").update({ status: "failed", page_count: totalPages,
        disclosure: `This document has ${totalPages} pages; the restricted-mode cap is ${MAX_PAGES}. It was not indexed.` })
        .eq("id", document_id);
      await sb.from("processing_jobs").update({ stage: "failed",
        error: "page cap exceeded" }).eq("id", job.id);
      return json({ status: "failed", reason: "page_cap", page_count: totalPages });
    }

    const from = job.next_page;
    const to = Math.min(totalPages, from + BATCH_PAGES - 1);
    const { text: pageTexts } = await extractText(pdf, { mergePages: false });
    const rows = [];
    for (let p = from; p <= to; p++) {
      const text = pageTexts[p - 1] ?? "";
      rows.push({ document_id, user_id: uid, page: p,
        classification: classifyPage(text, null), text });
    }
    const { error: upErr } = await sb.from("doc_pages")
      .upsert(rows, { onConflict: "document_id,page" });
    if (upErr) throw upErr;
    const done = to >= totalPages;
    await sb.from("processing_jobs").update({
      stage: done ? "chunk" : "extract", next_page: to + 1,
      updated_at: new Date().toISOString() }).eq("id", job.id);
    await sb.from("documents").update({ status: "processing",
      page_count: totalPages }).eq("id", document_id);
    if (!done) return json({ status: "processing", processed_to: to, page_count: totalPages });

    // Finalise: coverage + chapter-aware chunks from ALL stored pages.
    const { data: allPages } = await sb.from("doc_pages")
      .select("page,text,classification").eq("document_id", document_id)
      .order("page", { ascending: true });
    const summary = coverageSummary(allPages);
    const { chunks } = planChunks(allPages.map((p) => ({ page: p.page, text: p.text })));
    await sb.from("doc_chunks").delete().eq("document_id", document_id);
    const chunkRows = chunks.map((c) => ({
      document_id, user_id: uid, chunk_index: c.index,
      chapter_from: c.chapterFrom, chapter_to: c.chapterTo,
      pages: [...new Set(c.pages.map((s) => s.page))], text: c.text }));
    if (chunkRows.length) {
      const { error: chErr } = await sb.from("doc_chunks").insert(chunkRows);
      if (chErr) throw chErr;
    }
    const status = summary.fully_extracted ? "ready" : "partial";
    await sb.from("documents").update({ status, coverage: summary,
      disclosure: disclosureText(summary, doc.file_name) }).eq("id", document_id);
    await sb.from("processing_jobs").update({ stage: "done",
      updated_at: new Date().toISOString() }).eq("id", job.id);
    return json({ status, coverage: summary, chunks: chunkRows.length });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
