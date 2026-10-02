/* Linked, deterministic material-point explorer. Mechanics live in
 * bolt-impact-model.js; all views sample ONE saved loading history.
 * Playback uses a cycle coordinate, never an inferred physical impact time.
 */
(function () {
  "use strict";
  const mount = document.getElementById("bolt-impact-lab");
  const model = window.BoltImpactModel, fixture = window.FixtureViewGeometry;
  if (!mount || !model || !fixture) return;
  const views = [["yield", "Yield surfaces"], ["history", "Load history"], ["cycles", "Cycles & memory"]];
  const translationScales = [1, 10, 25, 50, 100], defaultTranslationScale = 50;
  const ranges = [
    ["omega", "Impact speed", 0, 5, .05, "rad/s"],
    ["stopAngle", "Assumed stop angle", 5, 20, .5, "°"],
    ["diameter", "Bolt diameter", .16, .25, .005, "in"],
    ["length", "Bolt length", 1.5, 3, .05, "in"]
  ];
  const canvas = (id, label) => `<canvas id="bolt-${id}" class="bolt-visual" width="880" height="600" ${id === "space" ? 'role="slider" tabindex="0" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="360" aria-valuenow="34.4" aria-describedby="bolt-space-instructions bolt-space-readout"' : id === "motion" ? 'role="slider" tabindex="0" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="3" aria-valuenow="0" aria-describedby="bolt-motion-instructions"' : 'role="img"'} aria-label="${label}"></canvas>`;
  mount.innerHTML = `
    <div class="bolt-controls">
      <h3>Bolt what-if settings</h3>
      <p class="bolt-material-fixed">Assumed Grade 2 steel · fixed</p>
      <p class="bolt-material-fixed">Unvalidated fixed-angle example.</p>
      <p class="bolt-material-fixed">One-sided strain input: 0 → peak → 0.</p>
      <div class="bolt-settings">
        ${ranges.map(([key, label, min, max, step, unit]) => `<label for="bolt-${key}"><span class="bolt-control-head"><span>${label}</span><output id="bolt-${key}-value" for="bolt-${key}"></output></span><input id="bolt-${key}" type="range" min="${min}" max="${max}" step="${step}" data-parameter="${key}" aria-label="${label} (${unit})"></label>`).join("")}
        <label class="bolt-select-row" for="bolt-cycles"><span>Cycles</span><select id="bolt-cycles" data-parameter="cycles" aria-label="Number of load cycles"><option value="1">1</option><option value="3">3</option><option value="6">6</option><option value="12">12</option></select></label>
        <label class="bolt-select-row" for="bolt-criterion"><span>Criterion</span><select id="bolt-criterion" aria-label="Yield criterion"><option value="mises">von Mises</option><option value="tresca">Tresca</option></select></label>
        <label class="bolt-select-row" for="bolt-hardening"><span>Hardening</span><select id="bolt-hardening" data-parameter="hardening" aria-label="Post-yield hardening idealization"><option value="kinematic">Kinematic</option><option value="perfect">None</option></select></label>
      </div>
      <div class="bolt-playback">
        <button type="button" id="bolt-play" class="bolt-play" aria-pressed="false">Play</button>
        <button type="button" id="bolt-restart">Restart</button>
        <button type="button" id="bolt-reset" aria-label="Reset all settings">Reset</button>
        <label class="bolt-speed" for="bolt-speed">Speed<select id="bolt-speed"><option value="0.25">0.25×</option><option value="0.5" selected>0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label>
        <div class="bolt-timeline"><div class="bolt-timeline-top"><label for="bolt-progress">Cycle position</label><output id="bolt-clock" for="bolt-progress"></output></div><input id="bolt-progress" type="range" min="0" max="3" step="0.001" value="0"></div>
      </div>
      <label class="bolt-view-control" for="bolt-view"><span>Plots</span><select id="bolt-view" aria-label="Linked plot view" aria-controls="bolt-panel-yield bolt-panel-history bolt-panel-cycles">${views.map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></label>
      <div class="bolt-translation-control">
        <label class="bolt-select-row" for="bolt-translation-scale"><span>Translation</span><select id="bolt-translation-scale" aria-label="Yield-surface translation display scale">${translationScales.map(n => `<option value="${n}"${n === defaultTranslationScale ? " selected" : ""}>${n}× ${n === 1 ? "true scale" : "visual"}</option>`).join("")}</select></label>
      </div>
    </div>
    <div class="bolt-metrics">
      <div><span class="bolt-metric-label">Nominal bending demand</span><strong id="bolt-demand-value" class="bolt-metric-value"></strong></div>
      <div><span class="bolt-metric-label">Nominal demand = assumed Sᵧ · not a limit</span><strong id="bolt-limit-value" class="bolt-metric-value"></strong></div>
      <div><span class="bolt-metric-label">Illustrative material-point state</span><strong id="bolt-state" class="bolt-metric-value bolt-state" data-state="elastic">Elastic</strong></div>
    </div>
    <div class="bolt-results">
    <div class="bolt-stage">
    <div class="bolt-grid">
      <figure class="bolt-card"><h4>At the stop · angled view</h4><p class="bolt-drag-hint" id="bolt-motion-instructions">Drag disk to scrub · slider sets impact speed.<span class="bolt-visually-hidden"> Drag around the disk with a mouse, or left/right on touchscreens. Dragging pauses playback and selects the saved loading history; gesture speed does not change the model. Arrow keys scrub the cycle, Shift takes larger steps, and Home / End select the start / end.</span></p>${canvas("motion", "Angled view of a rotating disk, T-slot stop, and the modeled bolt")}</figure>
      <figure class="bolt-card"><h4>Bolt stress–strain</h4>${canvas("strain", "Axial stress versus total strain at the bolt outer surface")}<div class="bolt-readout" id="bolt-strain-readout"></div><p class="bolt-drag-hint">Negative stress after yielding comes from prescribed-strain unloading in this material-point model, not a reverse stop force.</p></figure>
    </div>
    <div class="bolt-grid" id="bolt-panel-yield" role="region" aria-label="Yield surfaces" tabindex="0">
      <figure class="bolt-card"><h4>Principal stress space</h4><div class="bolt-space-toolbar"><p class="bolt-drag-hint" id="bolt-space-instructions">Drag to rotate · σ₃ fixed.<span class="bolt-visually-hidden"> Automatic rotation pauses during dragging and resumes on release. Keyboard focus pauses rotation; arrow keys rotate and Home / End select 0° / 360°.</span></p></div>${canvas("space", "3D stress-space view angle around the fixed sigma 3 axis")}<div class="bolt-readout" id="bolt-space-readout"></div></figure>
      <figure class="bolt-card"><h4>π-plane: looking down the cylinder</h4>${canvas("pi", "Deviatoric-plane circle or hexagon with the current stress and translating center")}<div class="bolt-readout" id="bolt-pi-readout"></div></figure>
    </div>
    <div class="bolt-grid" id="bolt-panel-history" role="region" aria-label="Load history" tabindex="0" hidden>
      <figure class="bolt-card"><h4>Stress through the loading cycle</h4>${canvas("stress-history", "Elastic estimate and material response versus loading cycle")}</figure>
      <figure class="bolt-card"><h4>Recoverable and plastic strain</h4>${canvas("strain-history", "Total strain and signed plastic strain versus loading cycle")}</figure>
    </div>
    <div class="bolt-grid" id="bolt-panel-cycles" role="region" aria-label="Cycles and memory" tabindex="0" hidden>
      <figure class="bolt-card"><h4>Cycle stress ranges</h4>${canvas("cycle-ranges", "Stress amplitude and mean stress for completed cycles")}<div class="bolt-readout" id="bolt-cycle-readout"></div></figure>
      <figure class="bolt-card"><h4>Yield-surface memory</h4>${canvas("memory", "Backstress translation versus loading cycle")}<div class="bolt-readout" id="bolt-memory-readout"></div></figure>
    </div>
    </div>
    <div class="bolt-notes">
      <div class="bolt-legend"><span><i class="bolt-dot"></i>Elastic point</span><span><i class="bolt-dot bolt-plastic-dot"></i>Plastic-flow point</span><span><i class="bolt-demand"></i>Elastic estimate</span><span><i class="bolt-origin"></i>Original yield boundary</span></div>
      <p>Fixed stopping angle, not measured compliance. The strain cycle is a separate constitutive illustration; its elastic/plastic states do not predict fixture deformation, fatigue life, or a safe operating speed.</p>
    </div>
    </div>
    <p class="bolt-visually-hidden" id="bolt-announcement" aria-live="polite" aria-atomic="true"></p>`;

  const get = id => mount.querySelector(`#bolt-${id}`);
  const C = { blue: "#176da5", orange: "#b8520c", red: "#952a24", gray: "#7a746b", grid: "#e5dfd4", ink: "#36322d", paper: "#fffdf9" };
  const W = 440, H = 300, Sy = model.material.Sy, E = model.material.E;
  const fmt = (v, n = 2) => (Math.abs(v) < .5 * 10 ** -n ? 0 : v).toFixed(n);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const announce = text => { get("announcement").textContent = text; };
  let settings = { ...model.defaults, omega: 2.1, loading: "pulsed", cycles: 3 };
  let run, index = 0, coordinate = 0, running = false, raf = 0, lastFrame = null, view = "yield", rotation = .6;
  let translationScale = defaultTranslationScale, spaceExtent = 1.6, piExtent = 1.2;
  // Same projection as the earlier fixture view, fitted uniformly to 440×300.
  const motionProjection = { scale: .9, x: 22, y: -24 };
  let motionDrag = null, motionSegments = [];

  function context(id) {
    const ctx = get(id).getContext("2d");
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    return ctx;
  }
  function line(ctx, points, color = C.blue, width = 2, dash = []) {
    if (!points.length) return;
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
    points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.stroke(); ctx.setLineDash([]);
  }
  function text(ctx, value, x, y, color = C.ink, align = "left", size = 15) {
    ctx.font = `${size}px Georgia, serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y);
  }
  function dot(ctx, p, color = C.blue, hollow = false, square = false) {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.fillStyle = hollow ? C.paper : color; ctx.lineWidth = 2;
    if (square) ctx.rect(p[0] - 4, p[1] - 4, 8, 8); else ctx.arc(p[0], p[1], 4.5, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
  function axes(ctx, xDomain, yDomain, xLabel, yLabel) {
    const box = { l: 65, r: 422, t: 24, b: 246 };
    const p = (x, y) => [box.l + (x - xDomain[0]) / (xDomain[1] - xDomain[0]) * (box.r - box.l), box.b - (y - yDomain[0]) / (yDomain[1] - yDomain[0]) * (box.b - box.t)];
    for (let i = 0; i <= 4; i++) {
      const x = xDomain[0] + (xDomain[1] - xDomain[0]) * i / 4;
      const y = yDomain[0] + (yDomain[1] - yDomain[0]) * i / 4;
      line(ctx, [p(x, yDomain[0]), p(x, yDomain[1])], C.grid, 1);
      line(ctx, [p(xDomain[0], y), p(xDomain[1], y)], C.grid, 1);
      text(ctx, Number(x.toPrecision(3)).toString(), p(x, 0)[0], box.b + 20, C.gray, "center", 13);
      text(ctx, Number(y.toPrecision(3)).toString(), box.l - 8, p(0, y)[1] + 4, C.gray, "right", 13);
    }
    line(ctx, [[box.l, box.t], [box.l, box.b], [box.r, box.b]], C.gray, 1);
    if (xDomain[0] < 0 && xDomain[1] > 0) line(ctx, [p(0, yDomain[0]), p(0, yDomain[1])], "#beb6aa", 1);
    if (yDomain[0] < 0 && yDomain[1] > 0) line(ctx, [p(xDomain[0], 0), p(xDomain[1], 0)], "#beb6aa", 1);
    text(ctx, xLabel, (box.l + box.r) / 2, 289, C.ink, "center", 15);
    ctx.save(); ctx.translate(17, (box.t + box.b) / 2); ctx.rotate(-Math.PI / 2); text(ctx, yLabel, 0, 0, C.ink, "center", 15); ctx.restore();
    return p;
  }
  function path(points, mapper, end = points.length - 1) {
    const stride = Math.max(1, Math.ceil(end / 600));
    const out = [];
    for (let i = 0; i <= end; i += stride) out.push(mapper(points[i]));
    if (end % stride) out.push(mapper(points[end]));
    return out;
  }
  function trace(ctx, mapper, field, color = C.blue, end = index) {
    line(ctx, path(run.points, p => mapper(p.cycle, field(p))), "#d4dbe0", 1);
    line(ctx, path(run.points, p => mapper(p.cycle, field(p)), end), color, 2.2);
    dot(ctx, mapper(run.points[end].cycle, field(run.points[end])), color);
  }
  function stateColor(p) { return p.plastic ? C.orange : C.blue; }
  function boltFaceAppearance(p) {
    // A fixed strain reference keeps colors comparable across all settings.
    // This changes only the drawing: no yield law, load, or damage calculation.
    const referenceStrain = Sy / E;
    const elasticIntensity = clamp(Math.abs(p.elasticStrain) / referenceStrain, 0, 1);
    const plasticIntensity = clamp(p.accumulatedPlasticStrain / referenceStrain, 0, 1);
    const mix = (from, to, amount) => from.map((value, i) => Math.round(value + (to[i] - value) * amount));
    // Once plasticity has occurred, retain its tint through elastic unloading.
    // At first yield this starts continuously from the saturated elastic blue.
    const blue = mix([190, 218, 237], [23, 109, 165], plasticIntensity > 0 ? 1 : elasticIntensity);
    const rgb = mix(blue, [190, 38, 38], plasticIntensity);
    return { color: `rgb(${rgb.join(", ")})`, elasticIntensity, plasticIntensity, referenceStrain };
  }
  function drawMotion(p) {
    const ctx = context("motion"), load = run.peakDemand > 0 ? p.load : 0;
    const a = Math.abs(load), color = stateColor(p), cx = 220, cy = 159;
    const face = boltFaceAppearance(p);
    // Both fixture views share the same world axes and rigid compliance tilt.
    // Only the saved material history drives loading; drag speed never does.
    const diameterScale = settings.diameter / .19;
    const { project, point } = fixture;
    const axisLength = Math.hypot(fixture.projection.right[0], fixture.projection.down[0]);
    const axis = [fixture.projection.right[0] / axisLength, fixture.projection.down[0] / axisLength];
    const highlight = (v, offset) => [v[0] + axis[1] * offset, v[1] - axis[0] * offset];
    const axle = fixture.axle().map(project), rootRadius = 3.5 * diameterScale;
    const boltLength = 42 * settings.length / 2.75;
    const contactAngle = fixture.contactAngle(rootRadius);
    const turn = load * settings.stopAngle * Math.PI / 180;
    const angle = contactAngle + turn;
    const boltFace = point(angle), tip = point(angle, fixture.dimensions.orbitRadius, boltLength);
    // The fixture uses only nonnegative imposed strain: load, then unload.
    const compression = Math.max(0, turn);
    const supportFace = (points, fill, stroke = true) => {
      ctx.beginPath();
      points.forEach((v, i) => i ? ctx.lineTo(...v) : ctx.moveTo(...v));
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      if (stroke) { ctx.strokeStyle = C.gray; ctx.lineWidth = 1.5; ctx.stroke(); }
    };
    ctx.save(); ctx.translate(motionProjection.x, motionProjection.y); ctx.scale(motionProjection.scale, motionProjection.scale);
    supportFace(fixture.circle(125, -fixture.dimensions.diskThickness), "#f2eee7");
    supportFace(fixture.circle(), C.paper);
    for (let i = 0; i < 4; i++) line(ctx, [[cx, cy], point(angle + i * Math.PI / 2)], "#c3b9ab", 1.2);
    const fills = { top: "#efebe3", bottom: "#ded8cd", front: "#f4f0e9", back: "#ede8de", left: "rgba(225, 219, 208, 0.28)", right: "#e1dbd0" };
    fixture.visibleFaces(compression).forEach(face => supportFace(face.points.map(project), fills[face.name], false));
    const postEdges = fixture.edges(compression);
    postEdges.filter(edge => edge.dashed).forEach(edge => line(ctx, edge.points.map(project), "#aaa298", 1.15, [4, 4]));
    postEdges.filter(edge => !edge.dashed).forEach(edge => line(ctx, edge.points.map(project), C.gray, 1.5));
    if (load > 0) {
      const edge = fixture.contactEdge();
      line(ctx, edge.map(project), "#c3b9ab", 1.2, [4, 4]);
      line(ctx, edge.map(p => project(fixture.postPoint(p, compression))), C.orange, 2.5);
    }
    const throughAxle = fixture.axleSegments(compression), farAxle = throughAxle.far.map(project);
    line(ctx, throughAxle.hidden.map(project), C.gray, 2.2, [3, 3]);
    const cutaway = fixture.axleExitCutaway(compression), opening = cutaway.outline.map(project);
    ctx.save(); ctx.beginPath(); opening.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.clip();
    supportFace(opening, C.paper, false);
    cutaway.walls.forEach((wall, i) => supportFace(wall.map(project), i % 2 ? "#e4ded2" : "#d4cbbd", false));
    supportFace(cutaway.surface.map(project), "#f0ebe1", false);
    line(ctx, [axle[0], project(throughAxle.tip)], C.gray, 7);
    line(ctx, [highlight(axle[0], 2), highlight(project(throughAxle.tip), 2)], "#c3b9ab", 2);
    ctx.restore(); line(ctx, [...opening, opening[0]], C.gray, 1);
    line(ctx, fixture.circle(6, throughAxle.exit[0]), C.gray, 1.1, [2, 3]);
    line(ctx, farAxle, C.gray, 7);
    line(ctx, farAxle.map(p => highlight(p, 2)), "#c3b9ab", 2);
    supportFace(fixture.circle(3.5, throughAxle.tip[0]), C.gray);
    line(ctx, axle, C.gray, 7);
    line(ctx, axle.map(p => highlight(p, 2)), "#c3b9ab", 2);
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 2 * Math.PI); ctx.fillStyle = C.ink; ctx.fill();
    // Axle and bolt stay parallel to the projected disk normal. Tint the
    // shaft too so the same material response is legible at compact sizes.
    line(ctx, [boltFace, tip], face.color, 7 * diameterScale);
    line(ctx, [highlight([boltFace[0] + axis[0] * diameterScale, boltFace[1] + axis[1] * diameterScale], 1.5 * diameterScale), highlight([tip[0] - axis[0] * diameterScale, tip[1] - axis[1] * diameterScale], 1.5 * diameterScale)], "#d5d3cc", 1.2 * diameterScale);
    ctx.beginPath(); ctx.ellipse(...tip, 2.5 * diameterScale, 3.5 * diameterScale, 0, 0, 2 * Math.PI); ctx.fillStyle = C.gray; ctx.fill();
    ctx.beginPath(); ctx.ellipse(...boltFace, rootRadius, 5 * diameterScale, 0, 0, 2 * Math.PI); ctx.fillStyle = face.color; ctx.fill();
    const loadStep = index > 0 ? p.load - run.points[index - 1].load : 0;
    if (a > .02 && Math.abs(loadStep) > 1e-10) {
      const direction = loadStep < 0 ? -1 : 1, arcPoints = [];
      for (let i = 0; i <= 20; i++) {
        const theta = Math.PI + .15 + direction * .55 * i / 20;
        arcPoints.push(point(theta, 139));
      }
      line(ctx, arcPoints, color, 2);
      const end = arcPoints[20], previous = arcPoints[19], heading = Math.atan2(end[1] - previous[1], end[0] - previous[0]);
      line(ctx, [[end[0] - 7 * Math.cos(heading - .5), end[1] - 7 * Math.sin(heading - .5)], end, [end[0] - 7 * Math.cos(heading + .5), end[1] - 7 * Math.sin(heading + .5)]], color, 2);
    }
    ctx.restore();
    const lengthLabel = [motionProjection.x + motionProjection.scale * ((boltFace[0] + tip[0]) / 2), motionProjection.y + motionProjection.scale * ((boltFace[1] + tip[1]) / 2 + 20)];
    text(ctx, `${fmt(settings.length)} in`, ...lengthLabel, C.ink, "center", 12);
    const phase = run.peakDemand === 0 ? "No impact input" : loadStep < 0 ? "Stop unloading" : "Stop loading";
    text(ctx, `${phase} · ${fmt(100 * a, 0)}% of imposed peak`, 220, 278, color, "center", 15);
    text(ctx, `${fmt(settings.omega)} rad/s at contact · schematic angled view`, 220, 296, C.gray, "center", 13);
    const faceState = p.plastic ? "Plastic flow" : p.accumulatedPlasticStrain > 0 ? "Elastic response · plastic history retained" : "Elastic response";
    get("motion").dataset.faceColor = face.color;
    get("motion").setAttribute("aria-valuemax", settings.cycles);
    get("motion").setAttribute("aria-valuenow", p.cycle);
    get("motion").setAttribute("aria-valuetext", `Cycle ${fmt(p.cycle)} of ${settings.cycles}; disk offset ${fmt(load * settings.stopAngle, 1)} degrees; impact speed ${fmt(settings.omega)} radians per second.`);
    get("motion").setAttribute("aria-disabled", String(run.peakDemand === 0));
    get("motion").setAttribute("aria-label", `Angled view of the rotating disk, T-slot stop, and modeled bolt of length ${fmt(settings.length)} inches and diameter ${fmt(settings.diameter, 3)} inches. ${faceState}. Recoverable strain ${fmt(100 * Math.abs(p.elasticStrain), 3)} percent; accumulated plastic strain ${fmt(100 * p.accumulatedPlasticStrain, 3)} percent.`);
  }
  function drawStrain(p) {
    const ctx = context("strain"), xMax = Math.max(run.peakStrain * 100 * 1.12, Sy / E * 130);
    const yMax = Math.max(Sy * 1.25, ...run.points.map(s => Math.abs(s.stress) * 1.15));
    const xMin = -xMax * .12;
    const xy = axes(ctx, [xMin, xMax], [-yMax, yMax], "Total axial strain (%)", "Axial stress (ksi)");
    const tangent = settings.hardening === "kinematic" ? E * model.material.H / (E + model.material.H) : 0;
    const backbone = [];
    for (let i = 0; i <= 120; i++) {
      const eps = (xMin + (xMax - xMin) * i / 120) / 100;
      const s = Math.sign(eps) * (Math.abs(eps) <= Sy / E ? E * Math.abs(eps) : Sy + tangent * (Math.abs(eps) - Sy / E));
      backbone.push(xy(eps * 100, s));
    }
    line(ctx, backbone, C.gray, 1.5, [5, 4]);
    line(ctx, path(run.points, s => xy(s.strain * 100, s.stress)), "#d2dde5", 1.2);
    const stride = Math.max(1, Math.ceil(index / 600));
    for (let i = stride; i <= index; i += stride) line(ctx, [xy(run.points[i - stride].strain * 100, run.points[i - stride].stress), xy(run.points[i].strain * 100, run.points[i].stress)], stateColor(run.points[i]), 2.3);
    dot(ctx, xy(p.strain * 100, p.stress), stateColor(p));
    get("strain-readout").textContent = `σ = ${fmt(p.stress)} ksi · ε = ${fmt(100 * p.strain, 3)}% · εᵖ = ${fmt(100 * p.plasticStrain, 3)}%`;
  }
  // An orthonormal deviatoric basis, e1=(2,-1,-1)/sqrt(6), e2=(0,1,-1)/sqrt(2).
  const root6 = Math.sqrt(6), root2 = Math.sqrt(2), root3 = Math.sqrt(3), radius = Math.sqrt(2 / 3);
  function displayStress(p, demand = false) {
    // Visual-only affine shift: alpha_display=N*alpha and
    // sigma_display=sigma+(N-1)*alpha. Relative stress and hydrostatic stress
    // stay unchanged, so a yielding point remains on its displayed surface.
    const extra = (translationScale - 1) * p.backstress / Sy;
    const stress = (demand ? p.load * run.peakDemand : p.stress) / Sy;
    return [stress + 2 * extra / 3, -extra / 3, -extra / 3];
  }
  function displayPiStress(p, demand = false) {
    return radius * ((demand ? p.load * run.peakDemand : p.stress) + (translationScale - 1) * p.backstress) / Sy;
  }
  function updateDisplayBounds() {
    let maxBackstress = 0, maxComponent = 0, maxPi = 0;
    for (const p of run.points) {
      maxBackstress = Math.max(maxBackstress, Math.abs(p.backstress));
      for (const demand of [false, true]) {
        maxComponent = Math.max(maxComponent, ...displayStress(p, demand).map(Math.abs));
        maxPi = Math.max(maxPi, Math.abs(displayPiStress(p, demand)));
      }
    }
    // Fixed for the whole loading history: no zoom/pumping as the center moves.
    const centerRatio = translationScale * maxBackstress / Sy;
    spaceExtent = Math.max(1.6, 1.05 * maxComponent, 1.1 * (2 / 3) * (1 + centerRatio));
    piExtent = Math.max(1.2, 1.12 * maxPi, 1.12 * radius * (1 + centerRatio));
    get("pi").setAttribute("aria-label", `Deviatoric yield surface and stress point; translation ${translationScale} times${translationScale === 1 ? ", true scale" : ", visual exaggeration only"}`);
  }
  function translationLabel(ctx) {
    text(ctx, translationScale === 1 ? "Translation 1× · true scale" : `Translation ${translationScale}× · display only`, 220, 14, translationScale === 1 ? C.gray : C.orange, "center", 12);
  }
  function ring(backstress, hydro = 0) {
    const count = get("criterion").value === "tresca" ? 6 : 60;
    const out = [];
    for (let i = 0; i <= count; i++) {
      const t = i * 2 * Math.PI / count, x = radius * Math.cos(t) + radius * backstress / Sy, y = radius * Math.sin(t);
      out.push([2 * x / root6 + hydro / root3, -x / root6 + y / root2 + hydro / root3, -x / root6 - y / root2 + hydro / root3]);
    }
    return out;
  }
  function drawSpace(p) {
    const ctx = context("space");
    const angle = fmt(rotation * 180 / Math.PI, 1);
    get("space").setAttribute("aria-valuenow", angle);
    get("space").setAttribute("aria-valuetext", `${angle} degrees around the fixed sigma 3 axis, viewed from above`);
    const extent = spaceExtent;
    // Negative depth tilt looks down from above in this screen-y projection;
    // sigma 3 remains upright and fixed while dragging/auto-rotation change yaw.
    const scale = 96 / extent, azimuth = rotation, elev = -.42;
    const project = v => {
      const x = Math.cos(azimuth) * v[0] - Math.sin(azimuth) * v[1];
      const depth = Math.sin(azimuth) * v[0] + Math.cos(azimuth) * v[1];
      return [220 + scale * x, 151 + scale * (Math.sin(elev) * depth - Math.cos(elev) * v[2])];
    };
    const cylinder = (a, original) => {
      const h = extent * 1.05, lo = ring(a, -h), hi = ring(a, h), color = original ? "#bcb4a8" : C.red;
      if (!original) {
        for (let i = 1; i < lo.length; i++) {
          const face = [project(lo[i - 1]), project(lo[i]), project(hi[i]), project(hi[i - 1])];
          ctx.beginPath(); face.forEach((v, j) => j ? ctx.lineTo(...v) : ctx.moveTo(...v)); ctx.closePath(); ctx.fillStyle = "#952a2409"; ctx.fill();
        }
      }
      line(ctx, lo.map(project), color, original ? 1 : 1.5, original ? [4, 4] : []);
      line(ctx, hi.map(project), color, original ? 1 : 1.5, original ? [4, 4] : []);
      const step = lo.length === 7 ? 1 : 10;
      for (let i = 0; i < lo.length - 1; i += step) line(ctx, [project(lo[i]), project(hi[i])], color, original ? .7 : 1, original ? [4, 4] : []);
    };
    const haxis = extent * 1.2 / root3;
    line(ctx, [project([-haxis, -haxis, -haxis]), project([haxis, haxis, haxis])], "#8b9aa3", 1.5, [3, 4]);
    cylinder(0, true); cylinder(translationScale * p.backstress, false);
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((axis, i) => {
      const a = axis.map(x => x * extent * 1.3);
      line(ctx, [project(a.map(x => -x)), project(a)], "#81796b", 1);
      const labels = translationScale === 1 ? ["σ₁ / Sᵧ", "σ₂ / Sᵧ", "σ₃ / Sᵧ"] : ["σ̃₁ / Sᵧ", "σ̃₂ / Sᵧ", "σ̃₃ / Sᵧ"];
      const t = project(a); text(ctx, labels[i], t[0], t[1] - 9, C.ink, "center", 14);
    });
    line(ctx, path(run.points, s => project(displayStress(s)), index), C.blue, 2);
    const actual = project(displayStress(p)), elastic = project(displayStress(p, true));
    line(ctx, [actual, elastic], C.gray, 1, [3, 3]); dot(ctx, elastic, C.gray, true); dot(ctx, actual, stateColor(p));
    text(ctx, get("criterion").value === "mises" ? "von Mises · circular cylinder" : "Tresca · hexagonal prism", 220, 287, C.ink, "center", 15);
    translationLabel(ctx);
    get("space-readout").textContent = `Illustrative point stress: (${fmt(p.stress)}, 0, 0) ksi · relative yield ratio ${fmt(Math.abs(p.stress - p.backstress) / Sy, 3)}`;
  }
  function drawPi(p) {
    const ctx = context("pi"), extent = piExtent;
    const scale = 105 / extent, center = [220, 148];
    const project = (x, y) => [center[0] + x * scale, center[1] - y * scale];
    const circle = a => ring(a).map(v => project((2 * v[0] - v[1] - v[2]) / root6, (v[1] - v[2]) / root2));
    for (const value of [-extent, -extent / 2, 0, extent / 2, extent]) {
      line(ctx, [project(value, -extent), project(value, extent)], C.grid, 1);
      line(ctx, [project(-extent, value), project(extent, value)], C.grid, 1);
      text(ctx, Number(value.toPrecision(2)).toString(), project(value, 0)[0], 276, C.gray, "center", 13);
    }
    line(ctx, [project(-extent * 1.1, 0), project(extent * 1.1, 0)], C.gray, 1);
    line(ctx, [project(0, -extent * 1.1), project(0, extent * 1.1)], C.gray, 1);
    line(ctx, circle(0), C.gray, 1.5, [4, 4]);
    const shape = circle(translationScale * p.backstress); ctx.beginPath(); shape.forEach((v, i) => i ? ctx.lineTo(...v) : ctx.moveTo(...v)); ctx.fillStyle = "#952a2409"; ctx.fill();
    line(ctx, shape, C.red, 2);
    const origin = project(0, 0), shift = project(radius * translationScale * p.backstress / Sy, 0);
    line(ctx, [origin, shift], C.orange, 3); dot(ctx, shift, C.orange, false, true);
    line(ctx, path(run.points, s => project(displayPiStress(s), 0), index), C.blue, 2);
    dot(ctx, project(displayPiStress(p, true), 0), C.gray, true);
    dot(ctx, project(displayPiStress(p), 0), stateColor(p));
    text(ctx, translationScale === 1 ? "Deviatoric coordinates / Sᵧ" : "Display deviatoric coordinates / Sᵧ", 220, 295, C.ink, "center", 14);
    text(ctx, "e₂", 228, 32, C.gray, "left", 14); text(ctx, "e₁", 220 + 105 + 18, 145, C.gray, "left", 14);
    translationLabel(ctx);
    get("pi-readout").textContent = `Unscaled model center shift: ${fmt(radius * p.backstress, 3)} ksi in e₁ · no hydrostatic dependence`;
  }
  function drawHistory(p) {
    const stress = context("stress-history"), ymax = Math.max(run.peakDemand * 1.1, Sy * 1.2);
    const xy = axes(stress, [0, settings.cycles], [-ymax, ymax], "Load cycle", "Axial stress (ksi)");
    line(stress, path(run.points, s => xy(s.cycle, s.load * run.peakDemand)), C.gray, 1.5, [4, 4]);
    line(stress, path(run.points, s => xy(s.cycle, s.stress)), "#d4dbe0", 1);
    const stride = Math.max(1, Math.ceil(index / 600));
    for (let i = stride; i <= index; i += stride) line(stress, [xy(run.points[i - stride].cycle, run.points[i - stride].stress), xy(run.points[i].cycle, run.points[i].stress)], stateColor(run.points[i]), 2.2);
    dot(stress, xy(p.cycle, p.stress), stateColor(p)); dot(stress, xy(p.cycle, p.load * run.peakDemand), C.gray, true);
    const strain = context("strain-history"), emax = Math.max(run.peakStrain * 110, .25);
    const ep = axes(strain, [0, settings.cycles], [-emax, emax], "Load cycle", "Strain (%)");
    trace(strain, ep, s => s.strain * 100, C.blue); trace(strain, ep, s => s.plasticStrain * 100, C.orange);
  }
  function drawCycles(p) {
    const ctx = context("cycle-ranges"), ymax = Math.max(Sy * 1.2, ...run.cycleStats.map(s => Math.max(s.amplitude, Math.abs(s.mean)) * 1.15));
    const xy = axes(ctx, [0, settings.cycles + .5], [-ymax * .25, ymax], "Completed cycle", "Stress (ksi)");
    const completed = run.cycleStats.filter(s => s.cycle <= p.cycle + 1e-9);
    completed.forEach(s => {
      line(ctx, [xy(s.cycle, 0), xy(s.cycle, s.amplitude)], C.blue, 2);
      dot(ctx, xy(s.cycle, s.amplitude), C.blue); dot(ctx, xy(s.cycle, s.mean), C.orange, false, true);
    });
    if (!completed.length) text(ctx, "Complete a cycle to see its range", 245, 98, C.gray, "center", 14);
    const last = completed[completed.length - 1];
    get("cycle-readout").textContent = last ? `Cycle ${last.cycle}: amplitude ${fmt(last.amplitude)} ksi · mean ${fmt(last.mean)} ksi` : "No complete cycles yet.";
    const mem = context("memory"), amax = Math.max(.1, ...run.points.map(s => Math.abs(s.backstress) * 1.2));
    const ma = axes(mem, [0, settings.cycles], [-amax, amax], "Load cycle", "Axial backstress a (ksi)");
    trace(mem, ma, s => s.backstress, C.orange);
    get("memory-readout").textContent = `a = ${fmt(p.backstress, 3)} ksi · accumulated |dεᵖ| = ${fmt(p.accumulatedPlasticStrain * 100, 3)}% (not damage)`;
  }
  function render() {
    const p = run.points[index];
    get("progress").value = p.cycle;
    get("clock").textContent = `${fmt(p.cycle, 2)} / ${settings.cycles}`;
    get("state").textContent = p.plastic ? "Plastic flow" : p.accumulatedPlasticStrain > 1e-12 ? "Elastic · plastic history" : "Elastic";
    get("state").dataset.state = p.plastic ? "plastic" : "elastic";
    mount.dataset.response = p.plastic ? "plastic" : "elastic";
    drawMotion(p); drawStrain(p);
    if (view === "yield") { drawSpace(p); drawPi(p); }
    else if (view === "history") drawHistory(p);
    else drawCycles(p);
  }
  function pause() {
    running = false; cancelAnimationFrame(raf); raf = 0; lastFrame = null;
    get("play").textContent = "Play"; get("play").setAttribute("aria-pressed", "false");
  }
  function rebuild(notify = true) {
    finishMotionDrag(); pause();
    run = model.simulate(settings); settings = { ...run.params }; index = 0; coordinate = 0;
    // Invert only monotonic pieces of the existing history. Never integrate
    // pointer velocity or run a second material model while dragging.
    motionSegments = [];
    for (let i = 1; i < run.points.length; i++) {
      const direction = Math.sign(run.points[i].load - run.points[i - 1].load);
      const previous = motionSegments[motionSegments.length - 1];
      if (previous && previous.direction === direction) previous.last = i;
      else motionSegments.push({ first: i - 1, last: i, direction });
    }
    updateDisplayBounds();
    mount.querySelectorAll("[data-parameter]").forEach(el => { el.value = settings[el.dataset.parameter]; });
    ranges.forEach(([key, , , , , unit]) => { get(`${key}-value`).textContent = `${fmt(settings[key], key === "diameter" ? 3 : key === "stopAngle" ? 1 : 2)} ${unit}`; });
    get("progress").max = settings.cycles;
    get("demand-value").textContent = `${fmt(run.peakDemand, 1)} ksi · ${fmt(run.peakDemand / Sy, 2)} × Sᵧ`;
    get("limit-value").textContent = `${fmt(run.yieldOmega)} rad/s · ${fmt(run.yieldRpm, 1)} rpm`;
    render(); if (notify) announce("Loading history reset with the new settings.");
  }
  function setCycle(value) {
    finishMotionDrag(); pause(); coordinate = clamp(Number(value) || 0, 0, settings.cycles);
    index = Math.round(coordinate * run.samplesPerCycle); render();
  }
  function finishMotionDrag(notify = false) {
    const previous = motionDrag;
    motionDrag = null;
    delete get("motion").dataset.dragging;
    if (previous && get("motion").hasPointerCapture(previous.id)) get("motion").releasePointerCapture(previous.id);
    if (notify && previous?.active) announce(`Paused at cycle ${fmt(run.points[index].cycle)}. Impact speed remains ${fmt(settings.omega)} radians per second.`);
  }
  function rotateDiskBy(delta) {
    if (run.peakDemand === 0 || Math.abs(delta) < 1e-12) return;
    const sample = coordinate * run.samplesPerCycle, direction = Math.sign(delta);
    const adjacent = motionSegments.filter(segment => sample >= segment.first - 1e-7 && sample <= segment.last + 1e-7);
    // At an extremum, reversing follows the next unloading/reloading leg,
    // preserving its plastic history. Inside a leg, reversal scrubs backward.
    const segment = adjacent.find(s => Math.abs(sample - s.first) < 1e-7 && s.direction === direction) || adjacent[0];
    if (!segment) return;
    const first = run.points[segment.first], last = run.points[segment.last];
    const load = first.load + (last.load - first.load) * (sample - segment.first) / (segment.last - segment.first);
    const target = clamp(load + delta / (settings.stopAngle * Math.PI / 180), Math.min(first.load, last.load), Math.max(first.load, last.load));
    coordinate = (segment.first + (target - first.load) / (last.load - first.load) * (segment.last - segment.first)) / run.samplesPerCycle;
    index = Math.round(coordinate * run.samplesPerCycle); render();
  }
  function frame(timestamp) {
    if (!running) return;
    if (lastFrame !== null) coordinate = Math.min(settings.cycles, coordinate + Math.min(.1, (timestamp - lastFrame) / 1000) * Number(get("speed").value));
    lastFrame = timestamp; index = Math.min(run.points.length - 1, Math.round(coordinate * run.samplesPerCycle)); render();
    if (coordinate >= settings.cycles) { pause(); announce("Loading sequence complete. Play to replay, or change the settings."); }
    else raf = requestAnimationFrame(frame);
  }
  function setView(key) {
    if (!views.some(([v]) => v === key)) return;
    finishMotionDrag();
    finishSpaceDrag();
    view = key;
    get("view").value = key;
    views.forEach(([v]) => {
      get(`panel-${v}`).hidden = v !== key;
    });
    render();
    syncSpaceAutoRotation();
  }
  mount.querySelectorAll("[data-parameter]").forEach(el => el.addEventListener(el.type === "range" ? "input" : "change", () => {
    settings[el.dataset.parameter] = el.type === "range" || el.id === "bolt-cycles" ? Number(el.value) : el.value;
    rebuild(false);
  }));
  mount.querySelectorAll("input[data-parameter]").forEach(el => el.addEventListener("change", () => announce("Loading history reset with the new settings.")));
  get("criterion").addEventListener("change", () => { render(); announce("Yield surface changed. Both criteria give the same response for uniaxial bending."); });
  get("translation-scale").addEventListener("change", () => {
    const next = Number(get("translation-scale").value);
    if (!translationScales.includes(next)) return;
    finishSpaceDrag(); translationScale = next; updateDisplayBounds(); render();
    announce(`Translation display ${translationScale} times. The material calculation and playback position are unchanged.`);
  });
  const motion = get("motion");
  function diskPointer(event) {
    const box = motion.getBoundingClientRect();
    const x = ((event.clientX - box.left) * W / box.width - motionProjection.x) / motionProjection.scale;
    const y = ((event.clientY - box.top) * H / box.height - motionProjection.y) / motionProjection.scale;
    return fixture.pointer([x, y]);
  }
  function activateMotionDrag() {
    pause(); coordinate = run.points[index].cycle; motionDrag.active = true;
    motion.dataset.dragging = "true";
    motion.focus({ preventScroll: true }); motion.setPointerCapture(motionDrag.id);
  }
  motion.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0 || motionDrag || run.peakDemand === 0) return;
    const polar = diskPointer(event);
    const circular = event.pointerType !== "touch" && polar.radius > .25 && polar.radius < 1.2;
    motionDrag = { id: event.pointerId, active: false, circular, lastPolar: circular ? polar.angle : null,
      lastX: event.clientX, startX: event.clientX, startY: event.clientY };
    if (event.pointerType !== "touch") { activateMotionDrag(); event.preventDefault(); }
  });
  motion.addEventListener("pointermove", event => {
    if (!motionDrag || event.pointerId !== motionDrag.id) return;
    if (event.pointerType !== "touch" && event.buttons === 0) { finishMotionDrag(); return; }
    if (!motionDrag.active) {
      const dx = Math.abs(event.clientX - motionDrag.startX), dy = Math.abs(event.clientY - motionDrag.startY);
      // Vertical swipes and pinch zoom remain native browser gestures.
      if (dy > 6 && dy >= dx) { finishMotionDrag(); return; }
      if (dx <= 6 || dx <= dy * 1.2) return;
      activateMotionDrag();
    }
    event.preventDefault();
    let delta;
    if (motionDrag.circular) {
      const polar = diskPointer(event);
      if (polar.radius < .2) { motionDrag.lastPolar = null; return; }
      delta = motionDrag.lastPolar === null ? 0 : Math.atan2(Math.sin(polar.angle - motionDrag.lastPolar), Math.cos(polar.angle - motionDrag.lastPolar));
      motionDrag.lastPolar = polar.angle;
    } else {
      delta = (event.clientX - motionDrag.lastX) / motion.getBoundingClientRect().width * 2 * settings.stopAngle * Math.PI / 180;
      motionDrag.lastX = event.clientX;
    }
    rotateDiskBy(delta);
  });
  motion.addEventListener("pointerup", event => { if (motionDrag?.id === event.pointerId) finishMotionDrag(true); });
  ["pointercancel", "lostpointercapture"].forEach(type => motion.addEventListener(type, event => {
    if (motionDrag?.id === event.pointerId) finishMotionDrag();
  }));
  motion.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const steps = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
    if (!(event.key in steps) && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault(); if (run.peakDemand === 0) return;
    const next = event.key === "Home" ? 0 : event.key === "End" ? settings.cycles : run.points[index].cycle + steps[event.key] * (event.shiftKey ? .1 : .02);
    setCycle(next);
  });
  window.addEventListener("blur", () => finishMotionDrag());
  window.addEventListener("resize", () => finishMotionDrag());
  const space = get("space"), fullTurn = 2 * Math.PI;
  const rotationMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const autoRotationRate = 6 * Math.PI / 180; // One gentle turn per minute.
  let spaceDrag = null, spaceAutoRaf = 0, spaceAutoLast = null;
  let autoRotationEnabled = !rotationMotionPreference.matches;
  let spaceVisible = false, spaceKeyboardFocus = false, pageActive = true;
  function canAutoRotateSpace() {
    return autoRotationEnabled && spaceVisible && view === "yield" && !document.hidden && pageActive && !spaceDrag && !spaceKeyboardFocus;
  }
  function stopSpaceAutoRotation() {
    cancelAnimationFrame(spaceAutoRaf); spaceAutoRaf = 0; spaceAutoLast = null;
    space.dataset.autoRotating = "false";
  }
  function spaceAutoFrame(timestamp) {
    spaceAutoRaf = 0;
    if (!canAutoRotateSpace()) { stopSpaceAutoRotation(); return; }
    if (spaceAutoLast !== null) {
      // No catch-up jump after a suspended tab, hidden plot, or manual drag.
      const elapsed = Math.min(.1, Math.max(0, (timestamp - spaceAutoLast) / 1000));
      rotation = (rotation + elapsed * autoRotationRate) % fullTurn;
      // Camera-only redraw: never advance loading or repaint other plots.
      drawSpace(run.points[index]);
    }
    spaceAutoLast = timestamp;
    spaceAutoRaf = requestAnimationFrame(spaceAutoFrame);
  }
  function syncSpaceAutoRotation() {
    if (!canAutoRotateSpace()) { stopSpaceAutoRotation(); return; }
    space.dataset.autoRotating = "true";
    if (!spaceAutoRaf) { spaceAutoLast = null; spaceAutoRaf = requestAnimationFrame(spaceAutoFrame); }
  }
  function finishSpaceDrag() {
    const previous = spaceDrag;
    spaceDrag = null;
    delete space.dataset.dragging;
    if (previous && space.hasPointerCapture(previous.id)) space.releasePointerCapture(previous.id);
    syncSpaceAutoRotation();
  }
  space.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0 || spaceDrag) return;
    const width = space.getBoundingClientRect().width;
    if (width <= 0) return;
    spaceKeyboardFocus = false;
    spaceDrag = { id: event.pointerId, x: event.clientX, rotation, width };
    stopSpaceAutoRotation();
    space.dataset.dragging = "true";
    space.setPointerCapture(event.pointerId);
    space.focus({ preventScroll: true });
  });
  space.addEventListener("pointermove", event => {
    if (!spaceDrag || event.pointerId !== spaceDrag.id) return;
    const next = spaceDrag.rotation + (event.clientX - spaceDrag.x) / spaceDrag.width * fullTurn;
    rotation = ((next % fullTurn) + fullTurn) % fullTurn;
    // Only yaw changes. Fixed elevation keeps the sigma-3 axis upright and
    // stationary; neither the stress history nor playback is altered.
    drawSpace(run.points[index]);
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => space.addEventListener(type, event => {
    if (spaceDrag && event.pointerId === spaceDrag.id) finishSpaceDrag();
  }));
  window.addEventListener("blur", () => { pageActive = false; finishSpaceDrag(); });
  window.addEventListener("focus", () => { pageActive = true; syncSpaceAutoRotation(); });
  space.addEventListener("focus", () => {
    // Pointerdown establishes its drag before moving focus here. Tab focus
    // instead holds the view steady for keyboard and screen-reader users.
    if (!spaceDrag) { spaceKeyboardFocus = true; syncSpaceAutoRotation(); }
  });
  space.addEventListener("blur", () => { spaceKeyboardFocus = false; syncSpaceAutoRotation(); });
  space.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    let next = rotation;
    const step = (event.shiftKey ? 15 : 5) * Math.PI / 180;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next += step;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= step;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = fullTurn;
    else return;
    event.preventDefault(); spaceKeyboardFocus = true; finishSpaceDrag();
    rotation = clamp(next, 0, fullTurn); drawSpace(run.points[index]);
  });
  rotationMotionPreference.addEventListener("change", () => {
    autoRotationEnabled = !rotationMotionPreference.matches; syncSpaceAutoRotation();
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(entries => {
      spaceVisible = entries[0].isIntersecting && entries[0].intersectionRatio > .05;
      syncSpaceAutoRotation();
    }, { threshold: [0, .05] }).observe(space);
  } else {
    const updateSpaceVisibility = () => {
      const bounds = space.getBoundingClientRect();
      spaceVisible = bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < innerHeight;
      syncSpaceAutoRotation();
    };
    window.addEventListener("scroll", updateSpaceVisibility, { passive: true });
    window.addEventListener("resize", updateSpaceVisibility);
    updateSpaceVisibility();
  }
  get("progress").addEventListener("input", () => setCycle(get("progress").value));
  get("progress").addEventListener("change", () => announce(`Paused at cycle ${fmt(run.points[index].cycle)}.`));
  get("restart").addEventListener("click", () => { setCycle(0); announce("Returned to the beginning of the same loading history."); });
  get("reset").addEventListener("click", () => { finishSpaceDrag(); settings = { ...model.defaults, omega: 2.1, loading: "pulsed", cycles: 3 }; get("criterion").value = "mises"; get("speed").value = "0.5"; translationScale = defaultTranslationScale; get("translation-scale").value = String(translationScale); rotation = .6; rebuild(); });
  get("speed").addEventListener("change", () => { lastFrame = null; });
  get("play").addEventListener("click", () => {
    finishMotionDrag();
    if (running) { pause(); announce("Playback paused."); return; }
    if (coordinate >= settings.cycles) { coordinate = 0; index = 0; }
    running = true; lastFrame = null; get("play").textContent = "Pause"; get("play").setAttribute("aria-pressed", "true");
    raf = requestAnimationFrame(frame); announce(`Playing at ${get("speed").value} cycles per second.`);
  });
  get("view").addEventListener("change", () => setView(get("view").value));
  document.addEventListener("visibilitychange", () => { if (document.hidden) { finishMotionDrag(); if (running) pause(); } syncSpaceAutoRotation(); });
  if ("IntersectionObserver" in window) new IntersectionObserver(entries => { if (!entries[0].isIntersecting && running) { pause(); announce("Playback paused while the explorer is off screen."); } }).observe(mount);
  rebuild(false);
  syncSpaceAutoRotation();
  window.BoltImpactLab = Object.freeze({
    setCycle, setView,
    getCameraState: () => ({ rotationDegrees: rotation * 180 / Math.PI, autoRotationEnabled, autoRotating: !!spaceAutoRaf, dragging: !!spaceDrag }),
    getFaceAppearance: () => ({ ...boltFaceAppearance(run.points[index]) }),
    getState: () => ({ ...run.points[index], params: { ...settings }, criterion: get("criterion").value, view, running, peakDemand: run.peakDemand, yieldOmega: run.yieldOmega }),
    getPresentationState: () => {
      const p = run.points[index], a = translationScale * p.backstress / Sy;
      return { translationScale, centerNormalized: [2 * a / 3, -a / 3, -a / 3], stressNormalized: displayStress(p), estimateNormalized: displayStress(p, true), spaceExtent, piExtent };
    },
    getHistory: () => run.points.map(p => ({ ...p }))
  });
})();
