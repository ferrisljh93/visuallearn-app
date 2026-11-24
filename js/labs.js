/* VisualLearn — the four validated Visual Labs (deterministic, no AI).
 * Each lab: prediction gate first (controls locked until a prediction is
 * committed), parameter schema with RANGE REJECTION (out-of-range input is
 * refused, never silently clamped), live readouts + chart, assumptions and
 * the hand-checked reference example from the verification records.
 */
(function () {
  /* ---------------- pure maths (also used by the verification script) ------- */
  var AFF = { flow: 120, pressure: 250, eta: 0.75, hydraulic: 30.0, shaft: 40.0 };
  function affinity(ratio) {
    return {
      flow_Ls: AFF.flow * ratio,
      pressure_kPa: AFF.pressure * ratio * ratio,
      hydraulic_kW: AFF.hydraulic * Math.pow(ratio, 3),
      shaft_kW: AFF.shaft * Math.pow(ratio, 3),
      savingPct: (1 - Math.pow(ratio, 3)) * 100
    };
  }
  var FUNCS = {
    "x2": { label: "f(x) = x²", f: function (x) { return x * x; }, df: function (x) { return 2 * x; } },
    "x3": { label: "f(x) = x³", f: function (x) { return x * x * x; }, df: function (x) { return 3 * x * x; } },
    "sin": { label: "f(x) = sin x", f: function (x) { return Math.sin(x); }, df: function (x) { return Math.cos(x); } }
  };
  function ohm(v, r) { var i = v / r; return { current_A: i, power_W: v * i }; }
  /* Water boiling point (°C) at pressure (atm): steam-table anchors, log-P interpolation. */
  var BOIL = [[0.1, 45.8], [0.25, 65.9], [0.5, 81.3], [1, 100], [2, 120.2], [3, 133.5], [5, 151.8]];
  function boilingPoint(p) {
    if (p <= BOIL[0][0]) return BOIL[0][1];
    for (var i = 1; i < BOIL.length; i++) {
      if (p <= BOIL[i][0]) {
        var p0 = BOIL[i - 1][0], t0 = BOIL[i - 1][1], p1 = BOIL[i][0], t1 = BOIL[i][1];
        var f = (Math.log(p) - Math.log(p0)) / (Math.log(p1) - Math.log(p0));
        return t0 + f * (t1 - t0);
      }
    }
    return BOIL[BOIL.length - 1][1];
  }
  function phaseAt(t, p) {
    var melt = 0; /* idealised teaching diagram: melting at 0 °C across this pressure range */
    if (t < melt) return "Solid (ice)";
    if (t >= boilingPoint(p)) return "Gas (steam)";
    return "Liquid (water)";
  }
  window.VL_LABMATH = { affinity: affinity, FUNCS: FUNCS, ohm: ohm, boilingPoint: boilingPoint, phaseAt: phaseAt, AFF: AFF };

  /* ---------------- shared helpers ---------------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(v, d) { return Number(v).toFixed(d == null ? 1 : d); }

  /* Prediction gate: renders options; on submit records event and unlocks. */
  function predictionGate(container, opts, onDone) {
    var wrap = document.createElement("div");
    wrap.className = "card prediction";
    var fs = "<fieldset><legend><strong>Predict first</strong> — the controls unlock once you commit a prediction.</legend>";
    opts.options.forEach(function (o, i) {
      fs += '<label><input type="radio" name="pred" value="' + i + '"> ' + esc(o.label) + "</label>";
    });
    fs += "</fieldset>";
    wrap.innerHTML = "<h3>" + esc(opts.question) + "</h3>" + fs +
      '<button class="btn primary" disabled>Commit prediction</button> <span class="msg"></span>';
    container.appendChild(wrap);
    var btn = wrap.querySelector("button"), msg = wrap.querySelector(".msg");
    wrap.addEventListener("change", function () { btn.disabled = !wrap.querySelector("input[name=pred]:checked"); });
    btn.addEventListener("click", function () {
      var sel = wrap.querySelector("input[name=pred]:checked");
      var idx = Number(sel.value);
      var correct = idx === opts.correctIndex;
      msg.innerHTML = correct
        ? ' <span class="ok">Correct prediction.</span> Controls unlocked — now test it.'
        : ' <span class="bad">Not quite.</span> Controls unlocked — explore and see what actually happens.';
      btn.disabled = true;
      wrap.querySelectorAll("input").forEach(function (i) { i.disabled = true; });
      if (opts.onRecord) opts.onRecord(opts.options[idx].label, correct);
      onDone();
    });
    return wrap;
  }

  /* Numeric control with range rejection: slider + typed input.
   * Typed out-of-range values are REFUSED (readouts untouched, error shown). */
  function rangedControl(label, min, max, step, value, unit, onValid) {
    var wrap = document.createElement("div");
    wrap.innerHTML = '<label>' + esc(label) + " (" + min + "–" + max + " " + esc(unit) + ")" +
      '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '">' +
      '<input type="number" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '">' +
      '</label><div class="range-err"></div>';
    var slider = wrap.querySelector('input[type=range]'), num = wrap.querySelector('input[type=number]'), err = wrap.querySelector(".range-err");
    slider.addEventListener("input", function () {
      num.value = slider.value; num.classList.remove("invalid"); err.textContent = "";
      onValid(Number(slider.value));
    });
    num.addEventListener("change", function () {
      var v = Number(num.value);
      if (isNaN(v) || v < min || v > max) {
        num.classList.add("invalid");
        err.textContent = "Rejected: " + num.value + " is outside the allowed range " + min + "–" + max + " " + unit + ". The value has NOT been changed or clamped.";
        num.value = slider.value;
        return;
      }
      num.classList.remove("invalid"); err.textContent = "";
      slider.value = v; onValid(v);
    });
    return wrap;
  }

  function svgEl(w, h, inner) {
    return '<svg class="chart" viewBox="0 0 ' + w + " " + h + '" role="img">' + inner + "</svg>";
  }

  /* ---------------- Lab 1: Affinity Laws ---------------- */
  function mountAffinity(el, ctx) {
    var L = window.VL_CONTENT.labs.affinityLaws;
    el.innerHTML = "<h3>" + esc(L.title) + "</h3>" +
      '<p class="muted">Baseline (100% speed): flow ' + AFF.flow + " L/s · pressure " + AFF.pressure + " kPa · efficiency 75% · hydraulic " + fmt(AFF.hydraulic) + " kW · shaft " + fmt(AFF.shaft) + " kW.</p>" +
      '<div class="gate"></div><div class="body locked"></div>' +
      '<div class="card"><strong>Assumptions.</strong> ' + esc(L.assumptions) + "<br><strong>Reference (hand-checked):</strong> at 80% speed → 96.0 L/s · 160.0 kPa · hydraulic 15.36 kW · shaft 20.48 kW · 48.8% ideal saving.<br><span class='muted small'>" + esc(L.citation) + "</span></div>";
    var body = el.querySelector(".body");
    body.innerHTML = '<div class="lab-controls"></div><div class="readouts"></div><div class="plot"></div>';
    var ratio = 1;
    function render() {
      var r = affinity(ratio);
      body.querySelector(".readouts").innerHTML =
        ro("Speed", fmt(ratio * 100, 0) + " %") + ro("Flow", fmt(r.flow_Ls) + " L/s") +
        ro("Pressure", fmt(r.pressure_kPa) + " kPa") + ro("Hydraulic power", fmt(r.hydraulic_kW, 2) + " kW") +
        ro("Shaft power", fmt(r.shaft_kW, 2) + " kW") + ro("Ideal saving vs 100%", fmt(r.savingPct) + " %");
      var pts = "";
      for (var s = 50; s <= 110; s += 2) { var a = affinity(s / 100); pts += (60 + (s - 50) * 5.6).toFixed(1) + "," + (190 - a.shaft_kW * 1.55).toFixed(1) + " "; }
      var cx = 60 + (ratio * 100 - 50) * 5.6, cy = 190 - affinity(ratio).shaft_kW * 1.55;
      body.querySelector(".plot").innerHTML = svgEl(420, 210,
        '<polyline fill="none" stroke="#2563eb" stroke-width="2" points="' + pts + '"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="#b91c1c"/>' +
        '<text x="60" y="205" font-size="10">speed 50%</text><text x="330" y="205" font-size="10">110%</text>' +
        '<text x="4" y="20" font-size="10">shaft kW</text>');
    }
    function ro(k, v) { return '<div class="readout"><div class="muted small">' + k + '</div><div class="v">' + v + "</div></div>"; }
    body.querySelector(".lab-controls").appendChild(
      rangedControl("Pump speed", 50, 110, 1, 100, "% of rated", function (v) { ratio = v / 100; render(); }));
    render();
    predictionGate(el.querySelector(".gate"), {
      question: "The pump slows to 80% of rated speed. What happens to shaft power (from 40.0 kW)?",
      options: [{ label: "20.48 kW" }, { label: "32.0 kW (falls in line with speed)" }, { label: "25.6 kW (falls with speed squared)" }],
      correctIndex: 0,
      onRecord: function (label, correct) { ctx.recordLab("affinity", label, correct); }
    }, function () { body.classList.remove("locked"); ctx.markJourney("lab"); });
  }

  /* ---------------- Lab 2: Derivative & Tangent ---------------- */
  function mountDerivative(el, ctx) {
    var L = window.VL_CONTENT.labs.derivativeTangent;
    el.innerHTML = "<h3>" + esc(L.title) + "</h3>" +
      '<p class="muted">' + esc(L.schema) + '.</p><div class="gate"></div><div class="body locked"></div>' +
      '<div class="card"><strong>Reference (hand-checked):</strong> ' + esc(L.reference) + "</div>";
    var body = el.querySelector(".body");
    body.innerHTML = '<div class="lab-controls"></div><div class="readouts"></div><div class="plot"></div>';
    var fnKey = "x2", x0 = 2;
    var selWrap = document.createElement("div");
    selWrap.innerHTML = '<label>Function <select><option value="x2">f(x) = x²</option><option value="x3">f(x) = x³</option><option value="sin">f(x) = sin x</option></select></label>';
    selWrap.querySelector("select").addEventListener("change", function (e) { fnKey = e.target.value; render(); });
    body.querySelector(".lab-controls").appendChild(selWrap);
    body.querySelector(".lab-controls").appendChild(
      rangedControl("Point of tangency x₀", -3, 3, 0.1, 2, "", function (v) { x0 = v; render(); }));
    function render() {
      var F = FUNCS[fnKey], y0 = F.f(x0), m = F.df(x0);
      body.querySelector(".readouts").innerHTML =
        '<div class="readout"><div class="muted small">f(x₀)</div><div class="v">' + fmt(y0, 2) + '</div></div>' +
        '<div class="readout"><div class="muted small">Gradient f′(x₀)</div><div class="v">' + fmt(m, 2) + '</div></div>' +
        '<div class="readout"><div class="muted small">Tangent line</div><div class="v">y = ' + fmt(m, 2) + "x " + (y0 - m * x0 >= 0 ? "+ " : "− ") + fmt(Math.abs(y0 - m * x0), 2) + "</div></div>";
      function X(x) { return 210 + x * 52; } function Y(y) { return 150 - y * 13; }
      var curve = "", tan = "";
      for (var x = -3.4; x <= 3.4; x += 0.1) { curve += X(x).toFixed(1) + "," + Y(Math.max(-11, Math.min(11, F.f(x)))).toFixed(1) + " "; }
      tan = X(x0 - 1.6).toFixed(1) + "," + Y(y0 + m * -1.6).toFixed(1) + " " + X(x0 + 1.6).toFixed(1) + "," + Y(y0 + m * 1.6).toFixed(1);
      body.querySelector(".plot").innerHTML = svgEl(420, 300,
        '<line x1="0" y1="150" x2="420" y2="150" stroke="#cbd5e1"/><line x1="210" y1="0" x2="210" y2="300" stroke="#cbd5e1"/>' +
        '<polyline fill="none" stroke="#2563eb" stroke-width="2" points="' + curve + '"/>' +
        '<line x1="' + tan.split(" ")[0].split(",")[0] + '" y1="' + tan.split(" ")[0].split(",")[1] + '" x2="' + tan.split(" ")[1].split(",")[0] + '" y2="' + tan.split(" ")[1].split(",")[1] + '" stroke="#b91c1c" stroke-width="2"/>' +
        '<circle cx="' + X(x0) + '" cy="' + Y(y0) + '" r="5" fill="#b91c1c"/>');
    }
    render();
    predictionGate(el.querySelector(".gate"), {
      question: "For f(x) = x² at x = 2, what is the gradient of the curve?",
      options: [{ label: "4" }, { label: "2" }, { label: "8" }],
      correctIndex: 0,
      onRecord: function (label, correct) { ctx.recordLab("derivative", label, correct); }
    }, function () { body.classList.remove("locked"); ctx.markJourney("lab"); });
  }

  /* ---------------- Lab 3: Ohm's Law ---------------- */
  function mountOhm(el, ctx) {
    var L = window.VL_CONTENT.labs.ohmsLaw;
    el.innerHTML = "<h3>" + esc(L.title) + "</h3>" +
      '<p class="muted">' + esc(L.schema) + '.</p><div class="gate"></div><div class="body locked"></div>' +
      '<div class="card"><strong>Reference (hand-checked):</strong> ' + esc(L.reference) + "</div>";
    var body = el.querySelector(".body");
    body.innerHTML = '<div class="lab-controls"></div><div class="readouts"></div><div class="plot"></div>';
    var V = 12, R = 6;
    body.querySelector(".lab-controls").appendChild(rangedControl("Voltage", 0, 24, 0.5, 12, "V", function (v) { V = v; render(); }));
    body.querySelector(".lab-controls").appendChild(rangedControl("Resistance", 1, 100, 1, 6, "Ω", function (v) { R = v; render(); }));
    function render() {
      var r = ohm(V, R);
      body.querySelector(".readouts").innerHTML =
        '<div class="readout"><div class="muted small">Current I = V/R</div><div class="v">' + fmt(r.current_A, 2) + ' A</div></div>' +
        '<div class="readout"><div class="muted small">Power P = V × I</div><div class="v">' + fmt(r.power_W, 1) + " W</div></div>";
      body.querySelector(".plot").innerHTML = svgEl(420, 210,
        '<line x1="40" y1="10" x2="' + (40 + 24 * 15) + '" y2="' + (190 - (24 / R) * 40) + '" stroke="#2563eb" stroke-width="2"/>' +
        '<circle cx="' + (40 + V * 15) + '" cy="' + (190 - r.current_A * 40) + '" r="5" fill="#b91c1c"/>' +
        '<text x="40" y="205" font-size="10">V: 0</text><text x="360" y="205" font-size="10">24 V</text><text x="4" y="20" font-size="10">I (A)</text>');
    }
    render();
    predictionGate(el.querySelector(".gate"), {
      question: "Voltage doubles while resistance stays fixed. What happens to the current?",
      options: [{ label: "It doubles" }, { label: "It stays the same" }, { label: "It halves" }],
      correctIndex: 0,
      onRecord: function (label, correct) { ctx.recordLab("ohm", label, correct); }
    }, function () { body.classList.remove("locked"); ctx.markJourney("lab"); });
  }

  /* ---------------- Lab 4: Phase Diagram ---------------- */
  function mountPhase(el, ctx) {
    var L = window.VL_CONTENT.labs.phaseDiagram;
    el.innerHTML = "<h3>" + esc(L.title) + "</h3>" +
      '<p class="muted">' + esc(L.schema) + '.</p><div class="gate"></div><div class="body locked"></div>' +
      '<div class="card"><strong>Reference:</strong> ' + esc(L.reference) + "</div>";
    var body = el.querySelector(".body");
    body.innerHTML = '<div class="lab-controls"></div><div class="readouts"></div><div class="plot"></div>';
    var T = 25, P = 1;
    body.querySelector(".lab-controls").appendChild(rangedControl("Temperature", -10, 120, 1, 25, "°C", function (v) { T = v; render(); }));
    body.querySelector(".lab-controls").appendChild(rangedControl("Pressure", 0.1, 5, 0.1, 1, "atm", function (v) { P = v; render(); }));
    function render() {
      var ph = phaseAt(T, P), bp = boilingPoint(P);
      body.querySelector(".readouts").innerHTML =
        '<div class="readout"><div class="muted small">Phase at this point</div><div class="v">' + ph + '</div></div>' +
        '<div class="readout"><div class="muted small">Boiling point at ' + fmt(P) + ' atm</div><div class="v">' + fmt(bp) + " °C</div></div>" +
        '<div class="readout"><div class="muted small">Melting point</div><div class="v">0 °C</div></div>';
      function X(t) { return 40 + (t + 10) * 2.8; }
      function Y(p) { return 190 - (Math.log10(p) - Math.log10(0.1)) / (Math.log10(5) - Math.log10(0.1)) * 170; }
      var boilPts = "";
      for (var p = 0.1; p <= 5.01; p *= 1.25) { boilPts += X(boilingPoint(p)).toFixed(1) + "," + Y(p).toFixed(1) + " "; }
      body.querySelector(".plot").innerHTML = svgEl(420, 210,
        '<line x1="' + X(0) + '" y1="10" x2="' + X(0) + '" y2="190" stroke="#2563eb" stroke-width="2"/>' +
        '<polyline fill="none" stroke="#b91c1c" stroke-width="2" points="' + boilPts + '"/>' +
        '<circle cx="' + X(T) + '" cy="' + Y(P) + '" r="5" fill="#101826"/>' +
        '<text x="' + (X(0) - 34) + '" y="30" font-size="10" fill="#2563eb">melting</text>' +
        '<text x="330" y="40" font-size="10" fill="#b91c1c">boiling</text>' +
        '<text x="50" y="205" font-size="10">−10 °C</text><text x="350" y="205" font-size="10">120 °C</text>');
    }
    render();
    predictionGate(el.querySelector(".gate"), {
      question: "At 25 °C and 1 atm, what phase is water in?",
      options: [{ label: "Liquid" }, { label: "Gas (steam)" }, { label: "Solid (ice)" }],
      correctIndex: 0,
      onRecord: function (label, correct) { ctx.recordLab("phase", label, correct); }
    }, function () { body.classList.remove("locked"); ctx.markJourney("lab"); });
  }

  window.VL_LABS = [
    { id: "affinity", mount: mountAffinity },
    { id: "derivative", mount: mountDerivative },
    { id: "ohm", mount: mountOhm },
    { id: "phase", mount: mountPhase }
  ];
})();
