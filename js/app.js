/* VisualLearn external MVP — application shell and views.
 * Atlas v2 IA (approved for MVP implementation 24 Nov 2026): left rail
 * LEARN / STUDY / PROGRESS on desktop, bottom tab bar on mobile.
 * Journey: sign-in → Today → Library/Upload → Study Workspace
 * (Source/Topics/Explanations) → Topic Map → Visual Lab → Practice →
 * Flashcards → Weaknesses → Settings. Progress persists per user via
 * js/store.js (Supabase + RLS when configured; local preview otherwise).
 * Live AI analysis is DISABLED and labelled; payments do not exist here.
 */
(function () {
  var C = window.VL_CONTENT;
  var DOC = C.document;
  var store = window.VL_STORE;
  var state = { attempts: [], cardStates: {}, labEvents: [], uploads: [], journey: {} };
  var currentLab = "affinity";
  var cardQueue = [], cardIdx = 0, cardFlipped = false;

  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(v, d) { return Number(v).toFixed(d == null ? 1 : d); }

  var ctx = {
    recordLab: function (labId, prediction, correct) {
      state.labEvents.push({ lab_id: labId, prediction: prediction, correct: correct });
      store.addLabEvent({ lab_id: labId, prediction: prediction, correct: correct }).catch(showErr);
    },
    markJourney: function (step) {
      if (!state.journey[step]) {
        state.journey[step] = new Date().toISOString();
        store.saveJourney(state.journey).catch(showErr);
      }
    }
  };
  function showErr(e) {
    var b = $("#fatalBanner");
    b.hidden = false;
    b.textContent = "Something failed to save: " + (e && e.message ? e.message : e) + " — your on-screen work is intact; check your connection and continue.";
  }

  /* ---------------- auth ---------------- */
  function showAuth() {
    $("#authView").hidden = false; $("#appShell").hidden = true;
    $("#authMsg").textContent = "";
    if (store.mode === "local") $("#previewBanner").hidden = false;
  }
  function showApp() {
    $("#authView").hidden = true; $("#appShell").hidden = false;
    $("#userEmail").textContent = store.user ? store.user.email : "";
    if (store.mode === "local") $("#previewBanner").hidden = false;
    store.loadAll().then(function (d) { state = d; route(); updateDueBadge(); }).catch(showErr);
  }
  $("#authForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("#authEmail").value.trim(), pw = $("#authPassword").value;
    $("#authMsg").textContent = "Signing in…";
    store.signIn(email, pw).then(showApp).catch(function (err) { $("#authMsg").textContent = err.message || String(err); });
  });
  $("#signUpBtn").addEventListener("click", function () {
    var email = $("#authEmail").value.trim(), pw = $("#authPassword").value;
    if (!email || !pw) { $("#authMsg").textContent = "Enter an email and a password first."; return; }
    $("#authMsg").textContent = "Creating account…";
    store.signUp(email, pw).then(function () {
      if (store.mode === "local") { showApp(); return; }
      $("#authMsg").textContent = "Account created. If email confirmation is enabled, confirm via your inbox, then sign in.";
      showApp();
    }).catch(function (err) { $("#authMsg").textContent = err.message || String(err); });
  });
  $("#signOutBtn").addEventListener("click", function () {
    store.signOut().then(function () { location.hash = "#/today"; showAuth(); });
  });

  /* ---------------- routing ---------------- */
  var TITLES = { today: "Today", library: "Library", upload: "Upload", documents: "Documents — owner testing", study: "Study Workspace", map: "Topic Map", lab: "Visual Lab", practice: "Practice", flashcards: "Flashcards", weaknesses: "Weaknesses", settings: "Settings" };
  function route() {
    var r = (location.hash || "#/today").replace("#/", "") || "today";
    if (!TITLES[r]) r = "today";
    $all(".view").forEach(function (v) { v.classList.remove("active"); });
    $("#view-" + r).classList.add("active");
    $("#viewTitle").textContent = TITLES[r];
    $all("[data-route]").forEach(function (a) { a.classList.toggle("active", a.getAttribute("data-route") === r); });
    ({ today: vToday, library: vLibrary, upload: vUpload, documents: function () { if (window.VL_DOCS) VL_DOCS.render($("#view-documents")); }, study: vStudy, map: vMap, lab: vLab, practice: vPractice, flashcards: vFlashcards, weaknesses: vWeak, settings: vSettings })[r]();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  /* ---------------- shared computations ---------------- */
  function accuracy() {
    if (!state.attempts.length) return null;
    var c = state.attempts.filter(function (a) { return a.correct; }).length;
    return Math.round(100 * c / state.attempts.length);
  }
  function dueCards(now) {
    now = now || Date.now();
    return DOC.flashcards.filter(function (card, i) {
      var st = state.cardStates["card-" + i];
      return !st || !st.due || st.due <= now;
    }).map(function (card, i) { return i; }).filter(function (i) {
      var st = state.cardStates["card-" + i];
      return !st || !st.due || st.due <= now;
    });
  }
  function updateDueBadge() {
    var n = dueCards().length, b = $("#dueBadge");
    b.hidden = n === 0; b.textContent = n;
  }
  function weakTopics() {
    var by = {};
    state.attempts.forEach(function (a) {
      by[a.topic] = by[a.topic] || { total: 0, correct: 0 };
      by[a.topic].total++; if (a.correct) by[a.topic].correct++;
    });
    return Object.keys(by).map(function (t) {
      return { topic: t, total: by[t].total, correct: by[t].correct, pct: Math.round(100 * by[t].correct / by[t].total) };
    }).sort(function (a, b) { return a.pct - b.pct; });
  }

  /* ---------------- views ---------------- */
  function vToday() {
    var el = $("#view-today");
    var acc = accuracy(), due = dueCards().length, weak = weakTopics();
    var steps = [["source", "Read the source document"], ["topics", "Review the topics & explanations"], ["lab", "Complete a Visual Lab (prediction first)"], ["practice", "Answer practice questions"], ["cards", "Review due flashcards"]];
    var done = steps.filter(function (s) { return state.journey[s[0]]; }).length;
    el.innerHTML =
      '<div class="card"><h3>Welcome back</h3><p class="muted">Your study journey on the pre-verified demo document: <strong>' + esc(DOC.title) + '</strong> (' + esc(DOC.subject) + ').</p>' +
      '<ul class="check">' + steps.map(function (s) { return '<li class="' + (state.journey[s[0]] ? "done" : "") + '">' + (state.journey[s[0]] ? "✓ " : "○ ") + esc(s[1]) + "</li>"; }).join("") + "</ul>" +
      '<p class="muted small">Journey progress: ' + done + " of " + steps.length + " steps recorded.</p></div>" +
      '<div class="grid">' +
      stat("Practice attempts", state.attempts.length) +
      stat("Practice accuracy", acc == null ? "—" : acc + "%") +
      stat("Flashcards due", due) +
      stat("Upload records (name & size only)", state.uploads.length) +
      "</div>" +
      '<p class="muted small">Upload records hold a file\'s name and size only. The file itself is not stored, not indexed and not analysed in this build — the pre-verified demo document above is the study material.</p>' +
      (weak.length ? '<div class="card"><h3>Weakest topic so far</h3><p><strong>' + esc(weak[0].topic) + '</strong> — ' + weak[0].pct + '% correct from ' + weak[0].total + ' attempts. <a href="#/weaknesses">See weaknesses</a> · <a href="#/practice">Practise</a></p></div>' : "") +
      '<div class="card"><h3>Start here</h3><p><a class="btn primary" href="#/study">Open the Study Workspace</a> <a class="btn" href="#/lab">Go to the Visual Lab</a></p></div>';
    function stat(k, v) { return '<div class="card"><div class="muted small">' + k + '</div><div class="stat">' + v + "</div></div>"; }
  }

  function vLibrary() {
    var el = $("#view-library");
    var ups = state.uploads.map(function (u) {
      return "<tr><td>" + esc(u.file_name || u.name) + '</td><td>' + esc(u.file_size != null ? Math.round(u.file_size / 1024) + " KB" : (u.size != null ? Math.round(u.size / 1024) + " KB" : "—")) + '</td><td><span class="tag tag-off">RECORD ONLY — FILE NOT STORED, NOT ANALYSED</span></td></tr>';
    }).join("");
    el.innerHTML =
      '<div class="card"><h3>' + esc(DOC.title) + '</h3><p class="muted">' + esc(DOC.subject) + ' · 4 topics · 6 practice questions · 6 flashcards · <span class="tag tag-pre">PRE-VERIFIED</span></p>' +
      '<p><a class="btn primary" href="#/study">Open Study Workspace</a> <a class="btn" href="#/map">Topic Map</a></p></div>' +
      '<div class="card"><h3>Your uploads</h3>' +
      (ups ? "<table><tr><th>File</th><th>Size</th><th>Status</th></tr>" + ups + "</table>" :
        '<p class="muted">No uploads yet. Only a record of an upload (file name and size) is kept — the file itself is not stored, indexed or analysed in this build, so no topics or questions are generated from uploads.</p>') +
      '<p class="muted small">What an upload means in this build: (1) a metadata record of the file name and size is kept against your account; (2) the file itself is <strong>not stored</strong> — its contents never leave your browser; (3) it is <strong>not indexed</strong> for search or tutoring; (4) it is <strong>not analysed</strong> — no topics, questions or flashcards are generated from it.</p>' +
      '<p><a class="btn" href="#/upload">Upload a document</a></p></div>';
  }

  function vUpload() {
    var el = $("#view-upload");
    el.innerHTML =
      '<div class="card"><h3>Upload a document</h3>' +
      '<p><span class="tag tag-off">LIVE AI ANALYSIS NOT ENABLED</span></p>' +
      '<p class="muted">In this testing build only your file\'s name and size are recorded against your account, so the upload step of the journey works end-to-end. The file itself is <strong>not</strong> uploaded or stored — its contents never leave your browser — and it is not indexed or analysed, so no topics, questions or flashcards are generated from it. The pre-verified demo document in your Library is the study material for this build.</p>' +
      '<label>Choose a file (PDF or text) <input type="file" id="upFile" accept=".pdf,.txt,.md"></label>' +
      '<button class="btn primary" id="upBtn">Record upload</button> <span class="msg" id="upMsg"></span></div>';
    $("#upBtn").addEventListener("click", function () {
      var f = $("#upFile").files[0];
      if (!f) { $("#upMsg").textContent = "Choose a file first."; return; }
      var rec = { file_name: f.name, file_size: f.size, name: f.name, size: f.size, status: "stored_analysis_disabled" };
      store.addUpload(rec).then(function () {
        state.uploads.push(rec);
        $("#upMsg").innerHTML = '<span class="ok">Recorded (name and size only).</span> The file itself was not stored, indexed or analysed — see your Library.';
        ctx.markJourney("upload");
      }).catch(showErr);
    });
  }

  function vStudy() {
    var el = $("#view-study");
    var tab = el.getAttribute("data-tab") || "source";
    var tabs = [["source", "Source"], ["topics", "Topics"], ["explain", "Explanations"]];
    var html = '<div class="card"><h3>' + esc(DOC.title) + '</h3><p class="muted">' + esc(C.sourceTitle) + ' — authorised synthetic test document, shown verbatim. All study content on this document is <span class="tag tag-pre">PRE-VERIFIED</span>.</p>' +
      '<p>' + tabs.map(function (t) { return '<button class="btn' + (tab === t[0] ? " primary" : "") + '" data-tab="' + t[0] + '">' + t[1] + "</button>"; }).join(" ") + "</p>";
    if (tab === "source") {
      html += C.sourcePages.map(function (p) { return '<h3>Page ' + p.page + '</h3><p style="white-space:pre-wrap">' + esc(p.text) + "</p>"; }).join("");
    } else if (tab === "topics") {
      html += DOC.topics.map(function (t) {
        return '<div class="card"><h3>' + esc(t.title) + '</h3><p>' + esc(t.summary) + '</p><p class="muted small">Source: page ' + t.sourcePages.join(", ") + "</p></div>";
      }).join("");
    } else {
      html += DOC.topics.map(function (t) {
        return '<div class="card"><h3>' + esc(t.title) + ' <span class="tag tag-pre">PRE-VERIFIED EXPLANATION</span></h3><p>' + esc(t.summary) + '</p><p class="muted small">Grounded in source page ' + t.sourcePages.join(", ") + ' of the document. These explanations are the prototype\'s verified set — not live AI output.</p></div>';
      }).join("");
    }
    html += "</div>";
    el.innerHTML = html;
    $all("[data-tab]", el).forEach(function (b) {
      b.addEventListener("click", function () { el.setAttribute("data-tab", b.getAttribute("data-tab")); vStudy(); });
    });
    ctx.markJourney(tab === "source" ? "source" : "topics");
  }

  function vMap() {
    var el = $("#view-map");
    var pos = [[300, 40], [110, 170], [490, 170], [300, 300]];
    var nodes = DOC.topics.map(function (t, i) {
      return '<g><rect x="' + (pos[i][0] - 95) + '" y="' + (pos[i][1] - 22) + '" width="190" height="44" rx="10" fill="#eef4ff" stroke="#2563eb"/>' +
        '<text x="' + pos[i][0] + '" y="' + (pos[i][1] + 4) + '" text-anchor="middle" font-size="11.5">' + esc(shortTitle(t.title)) + "</text></g>";
    }).join("");
    function idx(title) { return DOC.topics.findIndex(function (t) { return t.title === title; }); }
    function shortTitle(t) { return t.length > 30 ? t.slice(0, 29) + "…" : t; }
    var edges = DOC.edges.map(function (e) {
      var a = pos[idx(e.from)], b = pos[idx(e.to)];
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      return '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" stroke="#94a3b8"/>' +
        '<text x="' + mx + '" y="' + (my - 4) + '" text-anchor="middle" font-size="9.5" fill="#66707e">' + esc(e.relation) + "</text>";
    }).join("");
    el.innerHTML = '<div class="card"><h3>Topic Map — ' + esc(DOC.title) + '</h3>' +
      '<svg class="chart" viewBox="0 0 600 350" role="img">' + edges + nodes + "</svg>" +
      '<p class="muted small">Relationships are from the verified demo set. Open a topic in the <a href="#/study">Study Workspace</a>.</p></div>';
    ctx.markJourney("topics");
  }

  function vLab() {
    var el = $("#view-lab");
    el.innerHTML = '<div class="card"><p>' + window.VL_LABS.map(function (l) {
      return '<button class="btn' + (currentLab === l.id ? " primary" : "") + '" data-lab="' + l.id + '">' + esc(labName(l.id)) + "</button>";
    }).join(" ") + '</p><div id="labHost"></div></div>';
    $all("[data-lab]", el).forEach(function (b) {
      b.addEventListener("click", function () { currentLab = b.getAttribute("data-lab"); vLab(); });
    });
    var lab = window.VL_LABS.filter(function (l) { return l.id === currentLab; })[0];
    lab.mount($("#labHost"), ctx);
  }
  function labName(id) {
    return { affinity: "Affinity Laws (pumps)", derivative: "Derivative & Tangent", ohm: "Ohm's Law", phase: "Phase Diagram (water)" }[id];
  }

  /* ---------------- practice ---------------- */
  function vPractice() {
    var el = $("#view-practice");
    var done = {};
    state.attempts.forEach(function (a) { done[a.question_id] = a; });
    el.innerHTML = '<div class="card"><h3>Practice — ' + esc(DOC.title) + '</h3>' +
      '<p class="muted">The prototype\'s six verified questions, checked against the verified answer key with the same tolerance rules as the prototype (numerical: within 1% or 0.01). Wrong answers surface the misconception they were designed to catch. Attempts are saved to your account.</p></div>' +
      DOC.questions.map(function (q, i) { return questionCard(q, i, done["q-" + i]); }).join("");
    DOC.questions.forEach(function (q, i) { wireQuestion(q, i); });
  }
  function questionCard(q, i, prev) {
    var body = "";
    if (q.kind === "numerical") {
      body = '<label>Your answer (' + esc(q.unit) + ') <input type="number" step="any" id="ans-' + i + '"></label>';
    } else {
      body = q.options.map(function (o, j) {
        return '<label><input type="radio" name="mcq-' + i + '" value="' + j + '" style="width:auto"> ' + esc(o) + "</label>";
      }).join("");
    }
    return '<div class="card" id="qc-' + i + '"><h3>Q' + (i + 1) + ". " + esc(q.prompt) + '</h3>' +
      '<p class="muted small">Topic: ' + esc(q.topicTitle) + " · Source page " + q.sourcePage + "</p>" + body +
      '<button class="btn primary" id="check-' + i + '">Check answer</button> ' +
      (prev ? '<span class="muted small">Previously attempted: ' + (prev.correct ? '<span class="ok">correct</span>' : '<span class="bad">not yet</span>') + "</span>" : "") +
      '<div class="msg" id="fb-' + i + '"></div></div>';
  }
  function wireQuestion(q, i) {
    $("#check-" + i).addEventListener("click", function () {
      var given, correct;
      if (q.kind === "numerical") {
        given = Number($("#ans-" + i).value);
        if ($("#ans-" + i).value === "" || isNaN(given)) { $("#fb-" + i).textContent = "Enter a number first."; return; }
        var tol = Math.max(0.01, Math.abs(q.answer) * 0.01);
        correct = Math.abs(given - q.answer) <= tol;
      } else {
        var sel = document.querySelector('input[name="mcq-' + i + '"]:checked');
        if (!sel) { $("#fb-" + i).textContent = "Choose an option first."; return; }
        given = q.options[Number(sel.value)];
        correct = Number(sel.value) === q.correctIndex;
      }
      var fb = $("#fb-" + i);
      fb.innerHTML = correct
        ? '<p class="ok"><strong>Correct.</strong></p><p>' + esc(q.explanation) + '</p><p class="muted small">Source: page ' + q.sourcePage + ".</p>"
        : '<p class="bad"><strong>Not yet.</strong></p><p>' + esc(q.explanation) + '</p><p class="muted small">Misconception this question checks for: <strong>' + esc(q.misconceptionTag) + '</strong> · Source: page ' + q.sourcePage + ". Try again — re-attempts are recorded too.</p>";
      var rec = { question_id: "q-" + i, topic: q.topicTitle, kind: q.kind, correct: correct, given: given, misconception_tag: correct ? null : q.misconceptionTag };
      state.attempts.push(rec);
      store.addAttempt(rec).catch(showErr);
      ctx.markJourney("practice");
    });
  }

  /* ---------------- flashcards ---------------- */
  function vFlashcards() {
    var el = $("#view-flashcards");
    var due = dueCards();
    if (!due.length) {
      el.innerHTML = '<div class="card"><h3>Flashcards</h3><p class="ok">Nothing due right now.</p><p class="muted">All ' + DOC.flashcards.length + ' cards are scheduled. Due counts come from the FSRS-style scheduler state saved to your account.</p></div>';
      return;
    }
    if (cardIdx >= due.length) cardIdx = 0;
    var ci = due[cardIdx], card = DOC.flashcards[ci];
    el.innerHTML = '<div class="card"><p class="muted small">Card ' + (cardIdx + 1) + " of " + due.length + " due · Topic: " + esc(card.topicTitle) + " · Source page " + card.sourcePage + '</p>' +
      '<div class="flashcard">' + (cardFlipped ? "<div>" + esc(card.back) + "</div>" : "<div>" + esc(card.front) + "</div>") + "</div>" +
      (cardFlipped
        ? '<div class="grades">' + [1, 2, 3, 4].map(function (g) { return '<button class="btn" data-grade="' + g + '">' + ["", "Again", "Hard", "Good", "Easy"][g] + "</button>"; }).join("") + "</div>"
        : '<p style="margin-top:.8rem"><button class="btn primary" id="flipBtn">Show answer</button></p>') +
      "</div>";
    var flip = $("#flipBtn");
    if (flip) flip.addEventListener("click", function () { cardFlipped = true; vFlashcards(); });
    $all("[data-grade]", el).forEach(function (b) {
      b.addEventListener("click", function () {
        var g = Number(b.getAttribute("data-grade"));
        var prev = state.cardStates["card-" + ci] || window.VL_FSRS.initState();
        var next = window.VL_FSRS.review(prev, g, Date.now());
        state.cardStates["card-" + ci] = next;
        store.saveCardState("card-" + ci, next).catch(showErr);
        ctx.markJourney("cards");
        cardIdx++; cardFlipped = false;
        updateDueBadge();
        vFlashcards();
      });
    });
  }

  /* ---------------- weaknesses ---------------- */
  function vWeak() {
    var el = $("#view-weaknesses");
    if (!state.attempts.length) {
      el.innerHTML = '<div class="card"><h3>Weaknesses</h3><p class="muted">No practice attempts yet — this page is computed only from your real attempts. <a href="#/practice">Start practising</a>.</p></div>';
      return;
    }
    var rows = weakTopics().map(function (w) {
      return "<tr><td>" + esc(w.topic) + "</td><td>" + w.total + "</td><td>" + w.correct + "</td><td>" + w.pct + "%</td></tr>";
    }).join("");
    var misc = {};
    state.attempts.forEach(function (a) { if (!a.correct && a.misconception_tag) misc[a.misconception_tag] = (misc[a.misconception_tag] || 0) + 1; });
    var miscHtml = Object.keys(misc).length
      ? "<h3>Misconceptions caught</h3><table><tr><th>Misconception</th><th>Times</th></tr>" + Object.keys(misc).map(function (k) { return "<tr><td>" + esc(k) + "</td><td>" + misc[k] + "</td></tr>"; }).join("") + "</table>"
      : '<p class="muted">No misconceptions recorded — every wrong answer so far was outside the tagged set, or there were no wrong answers.</p>';
    el.innerHTML = '<div class="card"><h3>Accuracy by topic</h3><table><tr><th>Topic</th><th>Attempts</th><th>Correct</th><th>Accuracy</th></tr>' + rows + "</table>" + miscHtml +
      '<p><a class="btn" href="#/practice">Practise your weakest topic</a></p></div>';
  }

  /* ---------------- settings ---------------- */
  function vSettings() {
    var el = $("#view-settings");
    el.innerHTML = '<div class="card"><h3>Settings</h3>' +
      '<p>Signed in as <strong>' + esc(store.user ? store.user.email : "") + '</strong></p>' +
      '<p class="muted small">Data mode: ' + (store.mode === "supabase" ? "Supabase (your own account; rows isolated by Row Level Security)" : "LOCAL PREVIEW (localStorage in this browser only — not a real account)") + ".</p>" +
      '<p class="muted small">Live AI processing: <strong>disabled</strong>. Payments: <strong>not present</strong> in this build.</p>' +
      '<p><button class="btn" id="exportBtn">Export my progress (JSON)</button> ' +
      '<button class="btn" id="signOutBtn2">Sign out</button></p><div class="msg" id="setMsg"></div></div>';
    $("#exportBtn").addEventListener("click", function () {
      var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "visuallearn-progress.json"; a.click();
      URL.revokeObjectURL(a.href);
    });
    $("#signOutBtn2").addEventListener("click", function () { $("#signOutBtn").click(); });
  }

  /* ---------------- boot ---------------- */
  store.restore().then(function (u) { if (u) showApp(); else showAuth(); }).catch(function () { showAuth(); });
})();
