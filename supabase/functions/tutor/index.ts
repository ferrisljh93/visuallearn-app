// VisualLearn §32 — tutor Edge Function (Deno). RESTRICTED MODE.
// Server-enforced gates, in order, before any provider call:
//   1. caller is signed in and OWNS the document (RLS + explicit check);
//   2. caller is on the tutor allowlist AND the tutor flag is enabled
//      (owner test accounts only — never general learner use);
//   3. document provenance is synthetic / public_domain / licensed —
//      'learner_private' documents are NEVER sent to the free-tier
//      provider; the function refuses before retrieval;
//   4. document is ready/partial (coverage exists; gaps are disclosed
//      to the caller in every response).
// Answering contract (mirrors the retained typed2 service's rules):
//   BM25 retrieval over the document's chapter-aware chunks ->
//   ONE structured generation request (per-component candidates with
//   proposed page+quote) -> each citation mechanically verified
//   against the cited page's extracted text -> only verified
//   components are served; unverified ones are named as unresolved.
//   The model never assigns the evidence state; the function does.
// Provider failure: bounded retries with backoff; on exhaustion the
// function returns an honest 'provider_unavailable' status and stores
// NOTHING as an answer (safe failure — the user message is kept so the
// question is not lost, and no fabricated answer is persisted).
// The build is labelled, in every response payload, as an UNQUALIFIED
// development build (Gate T paused, §31).
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BM25, verifyQuote } from "../_shared/pipeline.js";

const MODEL = "gemini-2.5-flash-lite"; // free-tier Flash-Lite only (§24 ruling)
const MAX_ATTEMPTS = 3;

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body),
    { status, headers: { "Content-Type": "application/json" } });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(prompt) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("provider not configured");
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }) });
      if (res.status === 429 || res.status === 503) {
        lastErr = new Error(`provider_${res.status}`);
        await sleep(1000 * attempt + Math.random() * 500);
        continue;
      }
      if (!res.ok) throw new Error(`provider_${res.status}`);
      const data = await res.json();
      return data.candidates[0].content.parts[0].text;
    } catch (e) { lastErr = e; await sleep(1000 * attempt); }
  }
  throw lastErr || new Error("provider_unavailable");
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
    if (!allowed) return json({ error: "restricted mode: tutor is enabled for owner test accounts only" }, 403);

    const { document_id, conversation_id, question } = await req.json();
    if (!question || typeof question !== "string" || !question.trim())
      return json({ error: "empty question" }, 400);
    const { data: doc } = await sb.from("documents").select("*")
      .eq("id", document_id).single();
    if (!doc) return json({ error: "document not found" }, 404);
    if (doc.user_id !== uid) return json({ error: "not your document" }, 403);
    if (doc.provenance === "learner_private")
      return json({ error: "refused: learner/private documents are never sent to the development AI provider in restricted mode" }, 403);
    if (!["ready", "partial"].includes(doc.status))
      return json({ error: `document is not indexed (status: ${doc.status})` }, 409);

    let convId = conversation_id;
    if (!convId) {
      const { data: conv } = await sb.from("conversations")
        .insert({ user_id: uid, document_id, title: question.slice(0, 80) })
        .select().single();
      convId = conv.id;
    }
    await sb.from("messages").insert({ conversation_id: convId,
      user_id: uid, role: "user", content: question });

    const { data: chunks } = await sb.from("doc_chunks")
      .select("chunk_index,text,pages").eq("document_id", document_id)
      .order("chunk_index", { ascending: true });
    const bm = new BM25(chunks.map((c) => c.text));
    const top = bm.rank(question, 5).map((i) => chunks[i]).filter(Boolean);
    const { data: pageRows } = await sb.from("doc_pages")
      .select("page,text").eq("document_id", document_id);
    const pageText = new Map(pageRows.map((p) => [p.page, p.text]));
    const { data: history } = await sb.from("messages")
      .select("role,content").eq("conversation_id", convId)
      .order("created_at", { ascending: false }).limit(11);
    const histText = (history || []).reverse().slice(0, -1)
      .map((m) => `${m.role}: ${m.content}`).join("\n");

    const context = top.map((c) =>
      `[chunk ${c.chunk_index}, pages ${c.pages.join(", ")}]\n${c.text}`).join("\n\n");
    const prompt =
`You are the VisualLearn development tutor. Answer ONLY from the document excerpts below. ` +
`Return JSON: {"components":[{"text":"...","page":<page number>,"quote":"<verbatim quote from that page>"}]}. ` +
`One component per distinct part of the question. If a part cannot be answered from the excerpts, omit it (the system will disclose it as unresolved). Never invent values.\n\n` +
`Conversation so far:\n${histText}\n\nDocument excerpts:\n${context}\n\nQuestion: ${question}`;

    let raw;
    try { raw = await generate(prompt); }
    catch (e) {
      return json({ status: "provider_unavailable",
        detail: "The AI provider did not complete the request after bounded retries. Your question is saved in the conversation; no answer was generated or stored.",
        conversation_id: convId, build_label: "UNQUALIFIED DEVELOPMENT BUILD" }, 200);
    }
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { components: [] }; }
    const served = [], dropped = [];
    for (const comp of parsed.components || []) {
      const ok = Number.isInteger(comp.page) &&
        verifyQuote(comp.quote, pageText.get(comp.page));
      if (ok) served.push({ text: comp.text, page: comp.page, quote: comp.quote });
      else dropped.push(comp.text || "(unverifiable component)");
    }
    let state, answer;
    if (served.length && !dropped.length) {
      state = "GROUNDED";
      answer = served.map((s) => s.text).join("\n");
    } else if (served.length) {
      state = "PARTIALLY GROUNDED";
      answer = served.map((s) => s.text).join("\n") +
        `\n\nNot answered from your document: ${dropped.join("; ")}`;
    } else {
      state = "INSUFFICIENT EVIDENCE";
      answer = "I can't find that in the extracted text of your document. " +
        (doc.coverage && !doc.coverage.fully_extracted
          ? "Note: this document has pages that could not be extracted (see its coverage note), so the answer may be on a page I cannot read."
          : "The extracted text was searched and the supporting evidence could not be verified.");
    }
    const citations = served.map((s) => ({ page: s.page, quote: s.quote }));
    await sb.from("messages").insert({ conversation_id: convId, user_id: uid,
      role: "assistant", content: answer, state, citations });
    return json({ status: "ok", conversation_id: convId, state, answer,
      citations, coverage_disclosure: doc.disclosure,
      build_label: "UNQUALIFIED DEVELOPMENT BUILD — Gate T paused (§31); owner testing only" });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
