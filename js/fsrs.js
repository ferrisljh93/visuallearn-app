/* FSRS-style spaced-repetition scheduler (simplified FSRS-4.5 formulation).
 * Deterministic, no AI. Grades: 1=Again, 2=Hard, 3=Good, 4=Easy.
 * State per card: stability (days), difficulty (1..10), reps, lapses,
 * state ("new" | "learning" | "review"), due (epoch ms).
 */
(function () {
  var W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031,
           1.6474, 0.1367, 1.0461, 2.1072, 0.0797, 0.3249, 1.587, 0.2272, 2.8755];
  var DECAY = -0.5, FACTOR = 19 / 81;
  var DAY = 86400000;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function initState() {
    return { stability: 0, difficulty: 0, reps: 0, lapses: 0, state: "new", due: Date.now() };
  }

  function initDifficulty(g) { return clamp(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10); }
  function initStability(g) { return Math.max(W[g - 1], 0.1); }

  function meanReversion(d, g) {
    var anchor = initDifficulty(3); // Easy? no — anchor to grade-3 init per FSRS
    return clamp(W[7] * anchor + (1 - W[7]) * d, 1, 10);
  }
  function nextDifficulty(d, g) {
    var delta = -W[6] * (g - 3);
    return meanReversion(clamp(d + delta, 1, 10), g);
  }
  function retrievability(elapsedDays, stability) {
    if (!stability) return 0;
    return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY);
  }
  function nextStability(d, s, r, g) {
    if (g === 1) { // post-lapse
      return Math.max(0.1, Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r))));
    }
    var hardPenalty = g === 2 ? W[15] : 1;
    var easyBonus = g === 4 ? W[16] : 1;
    var grow = Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hardPenalty * easyBonus;
    return s * (1 + Math.max(grow, 0));
  }
  function intervalDays(s, requestRetention) {
    var rr = requestRetention || 0.9;
    var ivl = (s / FACTOR) * (Math.pow(rr, 1 / DECAY) - 1);
    return Math.max(1, Math.round(ivl));
  }

  /* grade: 1..4. Returns a NEW state object. */
  function review(state, grade, now) {
    now = now || Date.now();
    var s = Object.assign({}, state);
    if (s.state === "new" || !s.stability) {
      s.difficulty = initDifficulty(grade);
      s.stability = initStability(grade);
      s.state = grade === 1 ? "learning" : "review";
      s.due = grade === 1 ? now + 10 * 60000 : now + intervalDays(s.stability) * DAY;
    } else {
      var elapsed = Math.max(0, (now - (s.lastReview || now)) / DAY);
      var r = retrievability(elapsed, s.stability);
      s.difficulty = nextDifficulty(s.difficulty, grade);
      s.stability = nextStability(s.difficulty, s.stability, r, grade);
      s.state = grade === 1 ? "learning" : "review";
      s.due = grade === 1 ? now + 10 * 60000 : now + intervalDays(s.stability) * DAY;
    }
    s.reps = (s.reps || 0) + 1;
    if (grade === 1) s.lapses = (s.lapses || 0) + 1;
    s.lastReview = now;
    s.lastGrade = grade;
    return s;
  }

  window.VL_FSRS = { initState: initState, review: review, intervalDays: intervalDays, retrievability: retrievability };
})();
