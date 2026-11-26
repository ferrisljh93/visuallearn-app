// VisualLearn §32 — shared ingestion pipeline (plain ESM JS).
// A faithful port of the Python shared foundation's deterministic core
// (async-worker/coverage.py, chapter_chunks.py, retrieval-benchmark BM25):
//   * per-page coverage classification (extracted / unsupported / failed /
//     unprocessed) — every page accounted, never silently skipped;
//   * chapter detection (heading lines near the top of a page);
//   * chapter-aware chunking (9,000-char budget; a chunk NEVER spans a
//     chapter boundary);
//   * BM25 ranking over chunks (tutor retrieval baseline, §27 ruling).
// No provider calls happen here: ingestion is local and S$0.
// Imported by the Deno Edge Functions AND by the Node parity tests
// (integration-32/), so the deployed logic is the tested logic.

export const MIN_EXTRACTED_CHARS = 40; // mirrors coverage.py
export const CHAR_BUDGET = 9000;       // mirrors chapter_chunks.py

export function classifyPage(text, extractionError) {
  if (extractionError) return "failed";
  if (text == null) return "unprocessed";
  const nonWs = (text.match(/\S/g) || []).length;
  return nonWs >= MIN_EXTRACTED_CHARS ? "extracted" : "unsupported";
}

export function coverageSummary(pages) {
  // pages: [{page, text, classification}]
  const by = { extracted: [], unsupported: [], failed: [], unprocessed: [] };
  for (const p of pages) by[p.classification].push(p.page);
  const total = pages.length;
  const accounted = by.extracted.length + by.unsupported.length +
    by.failed.length + by.unprocessed.length;
  return {
    total, accounted,
    extracted: by.extracted, unsupported: by.unsupported,
    failed: by.failed, unprocessed: by.unprocessed,
    fully_extracted: total > 0 && by.extracted.length === total,
    complete: accounted === total &&
      by.unprocessed.length === 0 && by.failed.length === 0,
  };
}

export function disclosureText(summary, fileName) {
  const parts = [];
  if (summary.unsupported.length)
    parts.push(`pages ${summary.unsupported.join(", ")} have no readable text layer (scanned/image-only) and are NOT included in search or tutoring`);
  if (summary.failed.length)
    parts.push(`pages ${summary.failed.join(", ")} could not be extracted and are NOT included`);
  if (summary.unprocessed.length)
    parts.push(`pages ${summary.unprocessed.join(", ")} have not been processed yet`);
  if (!parts.length) return `${fileName}: all ${summary.total} pages extracted and indexed.`;
  return `${fileName}: ${summary.extracted.length} of ${summary.total} pages extracted and indexed; ` +
    parts.join("; ") + ". Answers can only come from the extracted pages.";
}

const CHAPTER_RE = /^\s*chapter\s+(\d+)\s*[-—–:.]?\s*(.*)$/i;

export function detectChapters(pages) {
  const starts = [];
  for (const p of pages) {
    const lines = (p.text || "").split("\n").slice(0, 6);
    for (const line of lines) {
      const m = CHAPTER_RE.exec(line);
      if (m) { starts.push({ chapter: parseInt(m[1], 10), start_page: p.page }); break; }
    }
  }
  starts.sort((a, b) => a.start_page - b.start_page);
  return starts;
}

export function chapterOfPage(pageNo, starts) {
  let cid = 0;
  for (const s of starts) {
    if (s.start_page <= pageNo) cid = s.chapter; else break;
  }
  return cid;
}

export function planChunks(pages, charBudget = CHAR_BUDGET) {
  const starts = detectChapters(pages);
  const boundaryPages = new Set(starts.map((s) => s.start_page));
  const segments = [];
  for (const p of pages) {
    const text = p.text || "";
    if (text.length <= charBudget) segments.push({ page: p.page, text });
    else for (let i = 0; i < text.length; i += charBudget)
      segments.push({ page: p.page, text: text.slice(i, i + charBudget) });
  }
  const chunks = [];
  let current = [], currentChars = 0;
  const flush = () => {
    if (!current.length) return;
    const chapters = current.map((s) => chapterOfPage(s.page, starts));
    chunks.push({
      index: chunks.length,
      pages: current,
      pageFrom: current[0].page, pageTo: current[current.length - 1].page,
      chapterFrom: chapters[0], chapterTo: chapters[chapters.length - 1],
      text: current.map((s) => s.text).join("\n"),
    });
    current = []; currentChars = 0;
  };
  for (const seg of segments) {
    const atBoundary = boundaryPages.has(seg.page) && current.length > 0;
    if (current.length && (currentChars + seg.text.length > charBudget || atBoundary)) flush();
    current.push(seg); currentChars += seg.text.length;
  }
  flush();
  return { chunks, chapterStarts: starts };
}

export function spanningChunks(chunks, chapterStarts) {
  const starts = chapterStarts.map((s) => s.start_page).sort((a, b) => a - b);
  let bad = 0;
  for (const c of chunks)
    if (starts.some((sp) => c.pageFrom < sp && sp <= c.pageTo)) bad++;
  return bad;
}

// ---- BM25 (same defaults as retrieval-benchmark/run_benchmark.py) ----
const TOKEN_RE = /[a-z0-9]+/g;
export function tokenize(s) { return (s || "").toLowerCase().match(TOKEN_RE) || []; }

export class BM25 {
  constructor(texts, k1 = 1.5, b = 0.75) {
    this.k1 = k1; this.b = b;
    this.docs = texts.map(tokenize);
    this.N = this.docs.length;
    this.avgdl = this.N ? this.docs.reduce((a, d) => a + d.length, 0) / this.N : 0;
    this.df = new Map();
    for (const d of this.docs) for (const t of new Set(d)) this.df.set(t, (this.df.get(t) || 0) + 1);
    this.tf = this.docs.map((d) => {
      const m = new Map();
      for (const t of d) m.set(t, (m.get(t) || 0) + 1);
      return m;
    });
  }
  idf(t) {
    const df = this.df.get(t) || 0;
    return Math.log(1 + (this.N - df + 0.5) / (df + 0.5));
  }
  rank(query, topK = 5) {
    const q = [...new Set(tokenize(query))];
    const scored = [];
    for (let i = 0; i < this.N; i++) {
      let score = 0;
      const dl = this.docs[i].length;
      for (const t of q) {
        const f = this.tf[i].get(t) || 0;
        if (!f) continue;
        score += this.idf(t) * (f * (this.k1 + 1)) /
          (f + this.k1 * (1 - this.b + this.b * (this.avgdl ? dl / this.avgdl : 1)));
      }
      if (score > 0) scored.push([score, i]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    return scored.slice(0, topK).map(([, i]) => i);
  }
}

// Mechanical citation check (product wiring): a citation may be shown
// only if its quote appears verbatim (whitespace-normalised) in the
// cited page's extracted text. Unverifiable => dropped, never shown.
export function verifyQuote(quote, pageText) {
  if (!quote || quote.trim().length < 10 || !pageText) return false;
  const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();
  return norm(pageText).includes(norm(quote));
}
