/* VisualLearn external MVP — data layer.
 *
 * Two backends behind one interface:
 *  - "supabase": real accounts (Supabase Auth) + per-user rows in Postgres,
 *    isolated by Row Level Security (schema.sql). This is the deployed mode.
 *  - "local": LOCAL PREVIEW only — no real accounts; data in localStorage so
 *    the owner can inspect the full journey before deploying. Clearly
 *    banner-labelled in the UI. Never present this mode as a live service.
 *
 * No secret keys are used client-side in either mode. The Supabase anon key
 * (config.js) is a public client key; RLS is the security boundary.
 */
(function () {
  var cfg = window.VL_CONFIG || {};
  var configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    cfg.SUPABASE_URL.indexOf("YOUR-PROJECT-REF") === -1 &&
    cfg.SUPABASE_ANON_KEY.indexOf("YOUR-") === -1 &&
    typeof window.supabase !== "undefined";

  var sb = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  var user = null;

  /* ---------------- local backend ---------------- */
  var LS_KEY = "vl_preview_v1";
  function lsLoad() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; }
  }
  function blankUser() { return { attempts: [], cardStates: {}, labEvents: [], uploads: [], journey: {} }; }
  /* load → mutate(data, userData) → save, atomically */
  function lsMutate(fn) {
    var d = lsLoad();
    d.users = d.users || {};
    var email = d.sessionEmail;
    var ud = null;
    if (email) { d.users[email] = d.users[email] || blankUser(); ud = d.users[email]; }
    fn(d, ud);
    localStorage.setItem(LS_KEY, JSON.stringify(d));
  }

  var Local = {
    mode: "local",
    signUp: function (email) {
      lsMutate(function (d) {
        d.users[email] = d.users[email] || blankUser();
        d.sessionEmail = email;
      });
      user = { email: email, id: "local-" + email };
      return Promise.resolve(user);
    },
    signIn: function (email) { return Local.signUp(email); },
    signOut: function () { lsMutate(function (d) { delete d.sessionEmail; }); user = null; return Promise.resolve(); },
    restore: function () {
      var d = lsLoad();
      if (d.sessionEmail) { user = { email: d.sessionEmail, id: "local-" + d.sessionEmail }; return Promise.resolve(user); }
      return Promise.resolve(null);
    },
    loadAll: function () {
      var out = blankUser();
      lsMutate(function (d, ud) { if (ud) out = JSON.parse(JSON.stringify(ud)); });
      return Promise.resolve(out);
    },
    addAttempt: function (a) { lsMutate(function (d, ud) { if (ud) ud.attempts.push(a); }); return Promise.resolve(); },
    saveCardState: function (id, st) { lsMutate(function (d, ud) { if (ud) ud.cardStates[id] = st; }); return Promise.resolve(); },
    addLabEvent: function (e) { lsMutate(function (d, ud) { if (ud) ud.labEvents.push(e); }); return Promise.resolve(); },
    addUpload: function (u) { lsMutate(function (d, ud) { if (ud) ud.uploads.push(u); }); return Promise.resolve(); },
    saveJourney: function (j) { lsMutate(function (d, ud) { if (ud) ud.journey = j; }); return Promise.resolve(); }
  };

  /* ---------------- supabase backend ---------------- */
  function check(r) { if (r.error) throw r.error; }
  var SB = {
    mode: "supabase",
    signUp: function (email, pw) {
      return sb.auth.signUp({ email: email, password: pw }).then(function (r) {
        if (r.error) throw r.error;
        user = r.data.user; return user;
      });
    },
    signIn: function (email, pw) {
      return sb.auth.signInWithPassword({ email: email, password: pw }).then(function (r) {
        if (r.error) throw r.error;
        user = r.data.user; return user;
      });
    },
    signOut: function () { return sb.auth.signOut().then(function () { user = null; }); },
    restore: function () {
      return sb.auth.getSession().then(function (r) {
        user = r.data.session ? r.data.session.user : null; return user;
      });
    },
    loadAll: function () {
      return Promise.all([
        sb.from("attempts").select("*").order("created_at", { ascending: true }),
        sb.from("card_states").select("*"),
        sb.from("lab_events").select("*").order("created_at", { ascending: true }),
        sb.from("uploads").select("*").order("created_at", { ascending: true }),
        sb.from("journey_progress").select("*").maybeSingle()
      ]).then(function (rs) {
        rs.forEach(check);
        var cardStates = {};
        rs[1].data.forEach(function (row) { cardStates[row.card_id] = row.state; });
        return {
          attempts: rs[0].data, cardStates: cardStates, labEvents: rs[2].data,
          uploads: rs[3].data, journey: rs[4].data ? rs[4].data.data : {}
        };
      });
    },
    addAttempt: function (a) {
      return sb.from("attempts").insert({ user_id: user.id, question_id: a.question_id, topic: a.topic, kind: a.kind, correct: a.correct, given: String(a.given), misconception_tag: a.misconception_tag || null }).then(check);
    },
    saveCardState: function (id, st) {
      return sb.from("card_states").upsert({ user_id: user.id, card_id: id, state: st, updated_at: new Date().toISOString() }).then(check);
    },
    addLabEvent: function (e) {
      return sb.from("lab_events").insert({ user_id: user.id, lab_id: e.lab_id, prediction: e.prediction, correct: e.correct }).then(check);
    },
    addUpload: function (u) {
      return sb.from("uploads").insert({ user_id: user.id, file_name: u.file_name, file_size: u.file_size, status: "stored_analysis_disabled" }).then(check);
    },
    saveJourney: function (j) {
      return sb.from("journey_progress").upsert({ user_id: user.id, data: j, updated_at: new Date().toISOString() }).then(check);
    }
  };

  var backend = sb ? SB : Local;
  window.VL_STORE = {
    mode: backend.mode,
    get user() { return user; },
    signUp: backend.signUp.bind(backend),
    signIn: backend.signIn.bind(backend),
    signOut: backend.signOut.bind(backend),
    restore: backend.restore.bind(backend),
    loadAll: backend.loadAll.bind(backend),
    addAttempt: backend.addAttempt.bind(backend),
    saveCardState: backend.saveCardState.bind(backend),
    addLabEvent: backend.addLabEvent.bind(backend),
    addUpload: backend.addUpload.bind(backend),
    saveJourney: backend.saveJourney.bind(backend)
  };
})();
