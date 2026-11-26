/* VisualLearn §32 — Documents (RESTRICTED owner-testing mode).
 *
 * Real PDF ingestion for allowlisted owner test accounts ONLY. The
 * server enforces this (Edge Functions check the allowlist + flags);
 * this module additionally hides the workflow when the account is not
 * allowlisted, and labels the tutor honestly as an UNQUALIFIED
 * DEVELOPMENT BUILD. For everyone else, Upload remains the
 * metadata-only flow in app.js — nothing here changes that.
 *
 * Flow: pick PDF -> documents row -> upload to private Storage bucket
 * (<uid>/<doc>.pdf) -> invoke `ingest` until terminal (checkpointed
 * server-side; closing the tab loses nothing) -> coverage + disclosure
 * shown -> PDF viewer (pdf.js) with per-page coverage badges ->
 * tutor panel (conversations persist in the DB; citations are buttons
 * that open the viewer at the cited page) -> delete via
 * `delete-document` (storage object + all derived rows).
 */
(function () {
  var cfg = window.VL_CONFIG || {};
  var sb = null;
  try { sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY); } catch (e) { /* local preview */ }
  var MAX_SIZE = 26214400; // 25 MiB — mirrors bucket + DB constraint
  var state = { allowed: false, ingestionOn: false, docs: [], activeDoc: null, convs: [], activeConv: null, messages: [] };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function user() { return window.VL_STORE && window.VL_STORE.user; }

  function gate() {
    var u = user();
    if (!sb || !u) return Promise.resolve(false);
    return Promise.all([
      sb.from("app_flags").select("key,enabled"),
      sb.from("tutor_allowlist").select("user_id").eq("user_id", u.id)
    ]).then(function (rs) {
      var flags = {};
      (rs[0].data || []).forEach(function (f) { flags[f.key] = f.enabled; });
      state.ingestionOn = !!flags.ingestion_enabled;
      state.tutorOn = !!flags.tutor_enabled;
      state.allowed = (rs[1].data || []).length > 0;
      return state.allowed && state.ingestionOn;
    }).catch(function () { return false; });
  }

  function loadDocs() {
    return sb.from("documents").select("*").order("created_at", { ascending: false })
      .then(function (r) { state.docs = r.data || []; });
  }

  function coverageBadge(d) {
    if (!d.coverage) return '<span class="tag">NO COVERAGE RECORD</span>';
    var c = d.coverage;
    if (c.fully_extracted) return '<span class="tag tag-pre">ALL ' + c.total + ' PAGES EXTRACTED</span>';
    return '<span class="tag">PARTIAL: ' + c.extracted.length + '/' + c.total + ' PAGES EXTRACTED</span>';
  }

  function render(el) {
    el.innerHTML = '<div class="card"><h3>Documents — owner testing</h3><p class="muted">Checking access…</p></div>';
    gate().then(function (ok) {
      if (!ok) {
        el.innerHTML = '<div class="card"><h3>Documents — owner testing</h3>' +
          '<p class="muted">Real PDF ingestion is enabled only for owner test accounts in restricted mode. ' +
          'For this account, uploads remain <strong>records of file name and size only</strong> — see Upload.</p></div>';
        return;
      }
      loadDocs().then(function () { paint(el); });
    });
  }

  function paint(el) {
    var rows = state.docs.map(function (d) {
      return '<div class="doc-row"><div><strong>' + esc(d.file_name) + '</strong> ' + coverageBadge(d) +
        ' <span class="tag">' + esc(d.status.toUpperCase()) + '</span> <span class="tag">' + esc(d.provenance) + '</span></div>' +
        (d.disclosure ? '<p class="muted small">' + esc(d.disclosure) + '</p>' : '') +
        '<p>' +
        (d.status === "ready" || d.status === "partial" ? '<button class="btn small" data-view="' + d.id + '">Open viewer</button> ' : '') +
        (d.status === "uploaded" || d.status === "processing" ? '<button class="btn small" data-resume="' + d.id + '">Resume processing</button> ' : '') +
        '<button class="btn small" data-ask="' + d.id + '">Ask the tutor</button> ' +
        '<button class="btn small" data-del="' + d.id + '">Delete</button></p></div>';
    }).join("");
    el.innerHTML =
      '<div class="card"><h3>Documents — owner testing (restricted)</h3>' +
      '<p class="muted">Real ingestion is ON for this account. Development testing uses synthetic, public-domain or licensed documents only — ' +
      'the tutor refuses private documents in this mode. PDF, max 25 MB, max 500 pages, max 10 documents.</p>' +
      '<label>Provenance <select id="docProv"><option value="synthetic">Synthetic (in-house test document)</option>' +
      '<option value="public_domain">Public domain</option><option value="licensed">Licensed for testing</option>' +
      '<option value="learner_private">Private (ingestion only — tutor will refuse)</option></select></label> ' +
      '<input type="file" id="docFile" accept="application/pdf"> ' +
      '<button class="btn primary" id="docUploadBtn">Upload &amp; process</button> ' +
      '<span class="msg" id="docMsg"></span>' +
      '<div id="docList">' + (rows || '<p class="muted">No documents yet.</p>') + '</div></div>' +
      '<div class="card" id="viewerCard" hidden><h3>Viewer</h3><p class="muted small" id="viewerMeta"></p><div id="viewerPages"></div></div>' +
      '<div class="card" id="tutorCard" hidden><h3>Tutor — UNQUALIFIED DEVELOPMENT BUILD</h3>' +
      '<p class="muted small">Gate T qualification is paused. Answers are assembled only from mechanically verified citations; treat output as a development artefact, not a qualified tutor.</p>' +
      '<div id="tutorLog"></div>' +
      '<p><input type="text" id="tutorQ" placeholder="Ask about this document…" style="width:70%"> ' +
      '<button class="btn primary" id="tutorSend">Ask</button> <span class="msg" id="tutorMsg"></span></p></div>';

    el.querySelector("#docUploadBtn").addEventListener("click", function () { upload(el); });
    el.querySelectorAll("[data-resume]").forEach(function (b) { b.addEventListener("click", function () { runIngest(el, b.getAttribute("data-resume")); }); });
    el.querySelectorAll("[data-view]").forEach(function (b) { b.addEventListener("click", function () { openViewer(el, b.getAttribute("data-view"), 1); }); });
    el.querySelectorAll("[data-ask]").forEach(function (b) { b.addEventListener("click", function () { openTutor(el, b.getAttribute("data-ask")); }); });
    el.querySelectorAll("[data-del]").forEach(function (b) { b.addEventListener("click", function () { del(el, b.getAttribute("data-del")); }); });
  }

  function upload(el) {
    var f = el.querySelector("#docFile").files[0];
    var msg = el.querySelector("#docMsg");
    if (!f) { msg.textContent = "Choose a PDF first."; return; }
    if (f.type !== "application/pdf") { msg.textContent = "PDF only in this mode."; return; }
    if (f.size > MAX_SIZE) { msg.textContent = "File exceeds the 25 MB restricted-mode cap."; return; }
    var prov = el.querySelector("#docProv").value;
    var u = user();
    msg.textContent = "Uploading…";
    sb.from("documents").insert({ user_id: u.id, file_name: f.name, file_size: f.size,
      storage_path: "pending", provenance: prov }).select().single()
      .then(function (r) {
        if (r.error) throw r.error;
        var doc = r.data;
        var path = u.id + "/" + doc.id + ".pdf";
        return sb.from("documents").update({ storage_path: path }).eq("id", doc.id)
          .then(function () { return sb.storage.from("documents").upload(path, f, { contentType: "application/pdf" }); })
          .then(function (up) { if (up.error) throw up.error; return doc.id; });
      })
      .then(function (docId) { msg.textContent = "Stored. Processing…"; return runIngest(el, docId); })
      .catch(function (e) { msg.textContent = "Upload failed: " + (e.message || e); });
  }

  function runIngest(el, docId) {
    var msg = el.querySelector("#docMsg");
    function step() {
      return sb.functions.invoke("ingest", { body: { document_id: docId } }).then(function (r) {
        if (r.error) throw r.error;
        var d = r.data;
        if (d.status === "processing") {
          if (msg) msg.textContent = "Processing… pages up to " + d.processed_to + " of " + d.page_count + " (checkpoint saved — safe to close this tab).";
          return step();
        }
        if (msg) msg.textContent = d.status === "failed" ? "Processing failed: " + (d.reason || "see document note") : "Done: " + d.status + " (" + (d.chunks || 0) + " chunks).";
        return loadDocs().then(function () { paint(el); });
      });
    }
    return step().catch(function (e) { if (msg) msg.textContent = "Processing error: " + (e.message || e) + " — use Resume processing to continue from the checkpoint."; });
  }

  function openViewer(el, docId, page) {
    var d = state.docs.filter(function (x) { return x.id === docId; })[0];
    if (!d) return;
    var card = el.querySelector("#viewerCard");
    card.hidden = false;
    el.querySelector("#viewerMeta").textContent = d.file_name + " — " + (d.disclosure || "");
    sb.storage.from("documents").createSignedUrl(d.storage_path, 600).then(function (r) {
      if (r.error) throw r.error;
      return window.pdfjsLib.getDocument(r.data.signedUrl).promise;
    }).then(function (pdf) {
      var host = el.querySelector("#viewerPages");
      host.innerHTML = "";
      var pages = [];
      for (var i = 1; i <= pdf.numPages; i++) pages.push(i);
      return pages.reduce(function (chain, pno) {
        return chain.then(function () {
          return pdf.getPage(pno).then(function (page) {
            var div = document.createElement("div");
            div.id = "viewer-page-" + pno;
            var badge = document.createElement("p");
            badge.className = "muted small";
            var cls = d.coverage && d.coverage.extracted.indexOf(pno) !== -1 ? "extracted" :
              (d.coverage && d.coverage.unsupported.indexOf(pno) !== -1 ? "UNSUPPORTED — no readable text" : "not extracted");
            badge.textContent = "Page " + pno + " — " + cls;
            var canvas = document.createElement("canvas");
            var vp = page.getViewport({ scale: 1.2 });
            canvas.width = vp.width; canvas.height = vp.height;
            div.appendChild(badge); div.appendChild(canvas);
            host.appendChild(div);
            return page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
          });
        });
      }, Promise.resolve()).then(function () {
        var target = document.getElementById("viewer-page-" + page);
        if (target) target.scrollIntoView();
      });
    }).catch(function (e) { el.querySelector("#viewerMeta").textContent = "Viewer failed: " + (e.message || e); });
  }

  function openTutor(el, docId) {
    state.activeDoc = docId; state.activeConv = null; state.messages = [];
    var card = el.querySelector("#tutorCard");
    card.hidden = false;
    paintTutor(el);
    sb.from("conversations").select("*").eq("document_id", docId).order("created_at", { ascending: false })
      .then(function (r) {
        state.convs = r.data || [];
        if (state.convs.length) {
          state.activeConv = state.convs[0].id;
          return sb.from("messages").select("*").eq("conversation_id", state.activeConv)
            .order("created_at", { ascending: true }).then(function (m) {
              state.messages = m.data || []; paintTutor(el);
            });
        }
      });
    el.querySelector("#tutorSend").onclick = function () {
      var q = el.querySelector("#tutorQ").value.trim();
      if (!q) return;
      var msg = el.querySelector("#tutorMsg");
      msg.textContent = "Asking…";
      sb.functions.invoke("tutor", { body: { document_id: state.activeDoc, conversation_id: state.activeConv, question: q } })
        .then(function (r) {
          if (r.error) throw r.error;
          var d = r.data;
          if (d.status === "provider_unavailable") { msg.textContent = d.detail; return; }
          state.activeConv = d.conversation_id;
          msg.textContent = "";
          return sb.from("messages").select("*").eq("conversation_id", state.activeConv)
            .order("created_at", { ascending: true }).then(function (m) {
              state.messages = m.data || []; paintTutor(el);
            });
        }).catch(function (e) { msg.textContent = "Tutor error: " + (e.message || e); });
    };
  }

  function paintTutor(el) {
    var log = el.querySelector("#tutorLog");
    if (!log) return;
    log.innerHTML = state.messages.map(function (m) {
      if (m.role === "user") return '<p><strong>You:</strong> ' + esc(m.content) + "</p>";
      var cites = (m.citations || []).map(function (c, i) {
        return '<button class="btn small" data-cite="' + c.page + '">p.' + c.page + '</button>';
      }).join(" ");
      return '<div class="card"><p><strong>Tutor</strong> <span class="tag">' + esc(m.state || "") + '</span></p><p>' +
        esc(m.content).replace(/\n/g, "<br>") + "</p>" + (cites ? "<p>Sources: " + cites + "</p>" : "") + "</div>";
    }).join("");
    log.querySelectorAll("[data-cite]").forEach(function (b) {
      b.addEventListener("click", function () { openViewer(el, state.activeDoc, parseInt(b.getAttribute("data-cite"), 10)); });
    });
  }

  function del(el, docId) {
    if (!window.confirm("Delete this document, its extracted text, index, conversations and the stored file? This cannot be undone.")) return;
    sb.functions.invoke("delete-document", { body: { document_id: docId } }).then(function (r) {
      if (r.error) throw r.error;
      var rm = r.data.removed || {};
      window.alert("Deleted. Removed: file (" + rm.storage_object + "), pages " + rm.doc_pages + ", chunks " + rm.doc_chunks + ", conversations " + rm.conversations + ", messages " + rm.messages + ".");
      return loadDocs().then(function () { paint(el); });
    }).catch(function (e) { window.alert("Delete failed: " + (e.message || e)); });
  }

  window.VL_DOCS = { render: render };
})();
