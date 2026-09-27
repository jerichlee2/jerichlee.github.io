/* Reconstructed, playable FBDs. Every drawing reads the same analytical state.
 * The model is idealized first compression, not measured hardware dynamics.
 */
(function () {
  "use strict";
  const mount = document.getElementById("ablative-fbd-lab"), model = window.AblativeFBDModel, fixture = window.FixtureViewGeometry;
  if (!mount || !model || !fixture) return;
  const fields = [
    ["omega", "Impact speed", 0, 5, .05, "rad/s"],
    ["travelAngle", "Travel angle", 45, 120, 5, "°"],
    ["stopAngle", "Stop angle", 5, 20, .5, "°"],
    ["pullRadius", "Pull radius", 4, 6, .1, "in"]
  ];
  const picture = (id, title, w, h) => `<canvas class="fbd-visual" id="fbd-${id}" width="${w * 2}" height="${h * 2}" role="slider" tabindex="0" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-describedby="fbd-drag-help" aria-label="${title}; shared fixture rotation"></canvas>`;
  mount.innerHTML = `
    <div class="fbd-controls">
      <h3>Motion settings</h3>
      <label for="fbd-driveMode">Approach motion<select id="fbd-driveMode" aria-describedby="fbd-profile-help"><option value="accelerated" selected>Accelerate from rest</option><option value="steady">Steady speed</option></select></label>
      <p class="fbd-small fbd-profile-help" id="fbd-profile-help"></p>
      <div class="fbd-settings">${fields.map(([id, label, min, max, step, unit]) => `<label for="fbd-${id}"><span class="fbd-control-head"><span>${label}</span><output id="fbd-${id}-value" for="fbd-${id}"></output></span><input id="fbd-${id}" type="range" min="${min}" max="${max}" step="${step}" data-fbd-setting="${id}" aria-label="${label} (${unit})"></label>`).join("")}</div>
      <dl class="fbd-timing"><div><dt>To contact</dt><dd><output id="fbd-travel-time" for="fbd-driveMode fbd-omega fbd-travelAngle"></output></dd></div><div><dt>Compression</dt><dd><output id="fbd-compression-time" for="fbd-omega fbd-stopAngle"></output></dd></div></dl>
      <div class="fbd-playback">
        <button class="fbd-play" id="fbd-play" type="button" aria-pressed="false">Play</button>
        <button id="fbd-restart" type="button">Restart</button>
        <button id="fbd-reset" type="button" aria-label="Reset motion settings">Reset</button>
        <label class="fbd-speed" for="fbd-speed">Speed<select id="fbd-speed"><option value="0.1">0.1×</option><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option></select></label>
        <div class="fbd-timeline"><div class="fbd-timeline-top"><label for="fbd-time">Model time</label><output class="fbd-clock" id="fbd-clock" for="fbd-time"></output></div><input id="fbd-time" type="range" min="0" max="2" step="0.0001" value="0"></div>
      </div>
      <div class="fbd-stage-buttons" aria-label="Jump to a stage"><button type="button" id="fbd-start">Start</button><button type="button" id="fbd-contact">Contact</button><button type="button" id="fbd-peak">Peak</button></div>
      <p class="fbd-phase" id="fbd-phase"></p>
      <p class="fbd-small">One bolt takes the stop load. Dimensions and forces are schematic.</p>
    </div>
    <div class="fbd-results">
      <div class="fbd-stage">
        <figure class="fbd-overview"><h4>Free-body diagram in motion</h4><p class="fbd-drag-hint">Drag any view to rotate · all three views stay in sync.</p>${picture("overview", "Rotating disk showing the selected approach motion, bolt contact, and an opposing stop reaction", 900, 500)}<div class="fbd-readout" id="fbd-overview-readout"></div><figcaption class="fbd-legend" id="fbd-legend">Blue: cable pull · Orange: stop reaction · Red pin: loaded bolt</figcaption></figure>
        <div class="fbd-detail-grid">
          <figure class="fbd-card fbd-detail"><h4>Rotation toward the stop</h4>${picture("rotation", "Perspective view of a disk and T-slot: axle normal to the left face, with compliance tilting about that axle at the shared contact time", 440, 350)}<div class="fbd-readout" id="fbd-rotation-readout"></div></figure>
          <figure class="fbd-card fbd-detail"><h4>Stop compliance</h4>${picture("stop", "Close-up of the bolt contact and effective stop compliance during first compression", 440, 350)}<div class="fbd-readout" id="fbd-stop-readout"></div></figure>
        </div>
      </div>
    </div>
    <span id="fbd-drag-help" class="fbd-visually-hidden">Arrow keys rotate 1° (Shift: 5°); Home goes to start and End to peak. All three views stay in sync.</span>
    <p id="fbd-status" class="fbd-visually-hidden" aria-live="polite" aria-atomic="true"></p>`;

  const get = id => mount.querySelector(`#fbd-${id}`);
  const C = { blue: "#176da5", orange: "#b8520c", red: "#952a24", ink: "#38332d", gray: "#82796c", light: "#c6bfb3", paper: "#fffdf9" };
  const degrees = 180 / Math.PI, constants = model.constants;
  const fmt = (v, n = 2) => (Math.abs(v) < .5 * 10 ** -n ? 0 : v).toFixed(n);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const announce = value => { get("status").textContent = value; };
  let settings = { ...model.defaults }, run, time = 0, running = false, frameId = 0, lastFrame = null, drag = null;
  const draggableViews = ["overview", "rotation", "stop"];
  function context(id, w, h) {
    const ctx = get(id).getContext("2d");
    ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; return ctx;
  }
  function line(ctx, points, color = C.ink, width = 1.6, dash = []) {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
    points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke(); ctx.setLineDash([]);
  }
  function text(ctx, value, x, y, color = C.ink, size = 18, align = "left") {
    ctx.font = `${size}px Georgia, serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y);
  }
  function dot(ctx, p, color = C.red, size = 5) { ctx.beginPath(); ctx.arc(...p, size, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.fill(); }
  function arrow(ctx, p, q, color, width = 2.5) {
    line(ctx, [p, q], color, width); const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
    line(ctx, [[q[0] - 8 * Math.cos(a - .45), q[1] - 8 * Math.sin(a - .45)], q, [q[0] - 8 * Math.cos(a + .45), q[1] - 8 * Math.sin(a + .45)]], color, width);
  }
  function polar(cx, cy, r, a) { return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; }
  function arc(ctx, cx, cy, r, start, end, color, dashed = false) {
    if (Math.abs(end - start) < .00001) return;
    const points = [], count = 48;
    for (let i = 0; i <= count; i++) points.push(polar(cx, cy, r, start + (end - start) * i / count));
    line(ctx, points, color, dashed ? 1.3 : 2.3, dashed ? [5, 5] : []);
    if (!dashed) arrow(ctx, points[count - 2], points[count], color, 2.3);
  }
  function spring(ctx, x0, x1, y, color = C.gray) {
    const p = [[x0, y], [x0 + 5, y]], length = Math.max(0, x1 - x0 - 10);
    for (let i = 0; i < 8; i++) p.push([x0 + 5 + length * (i + .5) / 8, y + (i % 2 ? 5 : -5)]);
    p.push([x1 - 5, y], [x1, y]); line(ctx, p, color, 1.8);
  }
  function shape(ctx, points, fill, stroke = C.gray) {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.4; ctx.stroke(); }
  }
  function drawOverview(s) {
    const ctx = context("overview", 900, 500), cx = 450, cy = 270, scale = 23.5;
    const rc = constants.contactRadius * scale, rp = settings.pullRadius * scale;
    const start = Math.PI / 2 - run.travelAngleRadians, angle = start + s.angle;
    const pin = polar(cx, cy, rc, angle), pull = polar(cx, cy, rp, angle);
    const wallX = s.phase === "stop" || s.phase === "held" ? pin[0] : cx;
    text(ctx, "CCW is positive", 25, 32, C.blue, 19);
    text(ctx, "T-slot stop · effective compliance", 665, 32, C.ink, 19, "center");
    // Rotating arms and disk: schematic geometry, not a reconstructed CAD model.
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-angle);
    ctx.fillStyle = "#e9e4dc"; ctx.strokeStyle = C.gray; ctx.lineWidth = 1.5;
    [-1, 1].forEach(sign => { const x = sign === 1 ? 94 : -184; ctx.fillRect(x, -19, 90, 38); ctx.strokeRect(x, -19, 90, 38); });
    ctx.beginPath(); ctx.arc(0, 0, 94, 0, Math.PI * 2); ctx.fillStyle = "#f2eee7"; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 82, 0, Math.PI * 2); ctx.strokeStyle = C.light; ctx.stroke(); ctx.restore();
    arc(ctx, cx, cy, rp + 19, start, Math.PI / 2, C.blue, true);
    arc(ctx, cx, cy, rp + 19, start, Math.min(angle, Math.PI / 2), C.blue);
    arc(ctx, cx, cy, rc + 14, Math.PI / 2, Math.PI / 2 + run.stopAngleRadians, C.orange, true);
    if (s.compression > 0) arc(ctx, cx, cy, rc + 14, Math.PI / 2, angle, C.orange);
    line(ctx, [[cx, 52], [cx, 208]], C.light, 2, [5, 5]);
    line(ctx, [[wallX, 58], [wallX, 208]], C.gray, 7);
    line(ctx, [[cx - 75, 69], [cx - 75, 113]], C.gray, 3); spring(ctx, cx - 75, wallX - 4, 91);
    line(ctx, [[606, 49], [wallX + 8, 58]], C.gray, 1);
    line(ctx, [[cx, cy], pin], C.gray, 1.5, [4, 4]);
    text(ctx, "r꜀", (cx + pin[0]) / 2 - 21, (cy + pin[1]) / 2, C.gray, 20);
    dot(ctx, [cx, cy], C.ink, 4); dot(ctx, pin, C.red, 6); dot(ctx, pull, C.blue, 4);
    const maxForce = Math.max(run.pullForce, run.stopForcePeak, .00001);
    if (s.pullForce > 0) {
      const length = 18 + 90 * s.pullForce / maxForce;
      const q = [pull[0] - length * Math.sin(angle), pull[1] - length * Math.cos(angle)];
      arrow(ctx, pull, q, C.blue); text(ctx, `Fpull = ${fmt(s.pullForce, 2)} lbf`, clamp(q[0] + 12, 20, 710), clamp(q[1] - 12, 50, 430), C.blue, 20);
    }
    if (s.stopForce > 0) {
      const length = 18 + 90 * s.stopForce / maxForce;
      const q = [pin[0] + length * Math.sin(angle), pin[1] + length * Math.cos(angle)];
      arrow(ctx, pin, q, C.orange); text(ctx, `Fstop = ${fmt(s.stopForce, 2)} lbf`, q[0] + 12, q[1] + 5, C.orange, 20);
    }
    const nearContact = s.phase === "stop" || s.phase === "held";
    const steady = settings.driveMode === "steady";
    text(ctx, s.phase === "rest" ? "At rest · no cable load" : nearContact ? (steady ? "No drive torque" : "Cable released") : (steady ? "Steady speed · no net pull" : "Constant tangential pull"), 28, 77, nearContact || s.phase === "rest" ? C.gray : C.blue, 19);
    text(ctx, `Δθtravel = ${fmt(settings.travelAngle, 0)}°`, 28, 111, C.blue, 20);
    text(ctx, `Δθstop = ${fmt(settings.stopAngle, 1)}°`, 28, 144, C.orange, 20);
    text(ctx, steady ? "Pull radius not used" : `rp = ${fmt(settings.pullRadius, 1)} in`, 28, 177, C.gray, 18);
    if (Math.abs(s.torque) > .000001) {
      const a0 = -Math.PI / 2, a1 = a0 + (s.torque > 0 ? .58 : -.58);
      arc(ctx, cx, cy, 200, a0, a1, s.torque > 0 ? C.blue : C.orange);
    }
    text(ctx, `Net torque = ${fmt(s.torque, 2)} lbf·in`, 645, 428, C.ink, 19, "center");
    text(ctx, `ω = ${fmt(s.speed, 2)} rad/s`, 450, 493, C.ink, 21, "center");
    get("overview-readout").textContent = `θ = ${fmt(s.angle * degrees, 1)}° · Fpull = ${fmt(s.pullForce)} lbf · Fstop = ${fmt(s.stopForce)} lbf`;
  }
  function drawRotation(s) {
    const ctx = context("rotation", 440, 350), cx = 220, cy = 159;
    const { project, point } = fixture, boltLength = 42, rootRadius = 3.5;
    const axle = fixture.axle().map(project);
    const axisLength = Math.hypot(fixture.projection.right[0], fixture.projection.down[0]);
    const axis = [fixture.projection.right[0] / axisLength, fixture.projection.down[0] / axisLength];
    const highlight = p => [p[0] + 2 * axis[1], p[1] - 2 * axis[0]];
    const contactAngle = fixture.contactAngle(rootRadius);
    const start = contactAngle - run.travelAngleRadians, angle = start + s.angle;
    const pin = point(angle), pinEnd = point(angle, fixture.dimensions.orbitRadius, boltLength);
    const inContact = s.phase === "stop" || s.phase === "held";
    const compression = inContact ? s.compression : 0;
    // The post rotates rigidly about X, the same axis as the disk/axle.
    // Its left YZ face stays parallel to the disk; front X edges parallel the axle.
    shape(ctx, fixture.circle(125, -fixture.dimensions.diskThickness), "#f2eee7");
    shape(ctx, fixture.circle(), C.paper);
    for (let i = 0; i < 4; i++) line(ctx, [[cx, cy], point(angle + i * Math.PI / 2)], C.light, 1.2);
    const fills = { top: "#efebe3", bottom: "#ded8cd", front: "#f4f0e9", back: "#ede8de", left: "rgba(225, 219, 208, 0.28)", right: "#e1dbd0" };
    // The mounting face remains translucent, with technical-drawing hidden edges.
    fixture.visibleFaces(compression).forEach(face => shape(ctx, face.points.map(project), fills[face.name], null));
    const postEdges = fixture.edges(compression);
    postEdges.filter(edge => edge.dashed).forEach(edge => line(ctx, edge.points.map(project), "#aaa298", 1.15, [4, 4]));
    postEdges.filter(edge => !edge.dashed).forEach(edge => line(ctx, edge.points.map(project), C.gray, 1.4));
    const edge = fixture.contactEdge();
    if (s.compression > 0) line(ctx, edge.map(project), C.light, 1.2, [4, 4]);
    if (inContact) line(ctx, edge.map(p => project(fixture.postPoint(p, compression))), C.orange, 2.5);
    const throughAxle = fixture.axleSegments(compression), farAxle = throughAxle.far.map(project);
    line(ctx, throughAxle.hidden.map(project), C.gray, 2.2, [3, 3]);
    const cutaway = fixture.axleExitCutaway(compression), opening = cutaway.outline.map(project);
    ctx.save(); ctx.beginPath(); opening.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.clip();
    shape(ctx, opening, C.paper, null);
    cutaway.walls.forEach((wall, i) => shape(ctx, wall.map(project), i % 2 ? "#e4ded2" : "#d4cbbd", null));
    shape(ctx, cutaway.surface.map(project), "#f0ebe1", null);
    line(ctx, [axle[0], project(throughAxle.tip)], C.gray, 7);
    line(ctx, [highlight(axle[0]), highlight(project(throughAxle.tip))], C.light, 2);
    ctx.restore(); line(ctx, [...opening, opening[0]], C.gray, 1);
    line(ctx, fixture.circle(6, throughAxle.exit[0]), C.gray, 1.1, [2, 3]);
    line(ctx, farAxle, C.gray, 7); line(ctx, farAxle.map(highlight), C.light, 2);
    shape(ctx, fixture.circle(3.5, throughAxle.tip[0]), C.gray);
    line(ctx, axle, C.gray, 7); line(ctx, axle.map(highlight), C.light, 2);
    dot(ctx, [cx, cy], C.ink, 3);
    line(ctx, [pin, pinEnd], C.gray, 7);
    line(ctx, [highlight([pin[0] + axis[0], pin[1] + axis[1]]), highlight([pinEnd[0] - axis[0], pinEnd[1] - axis[1]])], C.light, 1.5);
    ctx.beginPath(); ctx.ellipse(...pinEnd, 2.5, 3.5, 0, 0, 2 * Math.PI); ctx.fillStyle = C.gray; ctx.fill();
    // Keep the contact marker visible above the shaft; the neutral tip is
    // at a different depth even when it overlaps the post in this projection.
    ctx.beginPath(); ctx.ellipse(...pin, rootRadius, 5, 0, 0, 2 * Math.PI); ctx.fillStyle = C.red; ctx.fill();
    const guide = [], active = [];
    for (let i = 0; i <= 48; i++) {
      const a = start + run.travelAngleRadians * i / 48;
      guide.push(point(a, 139));
      if (a <= angle) active.push(guide[guide.length - 1]);
    }
    line(ctx, guide, C.light, 1.5, [4, 4]); line(ctx, active, C.blue, 2.4);
    if (active.length > 2) arrow(ctx, active[active.length - 2], active[active.length - 1], C.blue, 2.4);
    if (s.compression > 0) {
      const compressionArc = [];
      for (let i = 0; i <= 24; i++) compressionArc.push(point(contactAngle + s.compression * i / 24, 139));
      line(ctx, compressionArc, C.orange, 2.4);
    }
    const phaseText = s.phase === "pull" ? (settings.driveMode === "steady" ? "Steady-speed turn" : "Cable-driven turn") : s.phase === "rest" ? "At rest" : s.phase === "held" ? "Maximum compression" : s.compression < 1e-9 ? "First contact" : "Compressing the stop";
    text(ctx, phaseText, 220, 335, inContact ? C.orange : s.phase === "pull" ? C.blue : C.gray, 17, "center");
    get("rotation-readout").textContent = `θ = ${fmt(s.angle * degrees, 1)}° · θstop = ${fmt(s.compression * degrees, 1)}° · ω = ${fmt(s.speed)} rad/s`;
  }
  function drawStop(s) {
    const ctx = context("stop", 440, 350), cx = 227, cy = 270, r = 151;
    const angle = Math.PI / 2 + s.compression, pin = polar(cx, cy, r, angle), active = s.phase === "stop" || s.phase === "held";
    const wallX = active ? pin[0] : cx;
    text(ctx, active ? "First compression" : "Waiting for contact", 220, 25, active ? C.orange : C.gray, 17, "center");
    line(ctx, [[cx, 54], [cx, 160]], C.light, 2, [4, 4]);
    shape(ctx, [[115, 60], [128, 60], [128, 128], [115, 128]], "#e1dbd0");
    spring(ctx, 128, wallX - 5, 90, active ? C.orange : C.gray);
    line(ctx, [[wallX, 55], [wallX, 161]], C.gray, 7);
    line(ctx, [[cx, cy], [cx, cy - r]], C.light, 1.4, [4, 4]);
    line(ctx, [[cx, cy], pin], active ? C.orange : C.gray, 2.3);
    arc(ctx, cx, cy, 58, Math.PI / 2, Math.PI / 2 + run.stopAngleRadians, C.orange, true);
    arc(ctx, cx, cy, 58, Math.PI / 2, angle, C.orange);
    dot(ctx, [cx, cy], C.ink, 4);
    line(ctx, [[pin[0] - 17, pin[1]], [pin[0] + 23, pin[1]]], C.gray, 8); dot(ctx, pin, active ? C.red : C.gray, 5);
    if (s.stopForce > 0) {
      const length = 20 + 67 * s.stopForce / Math.max(run.stopForcePeak, .00001);
      const end = [pin[0] + length * Math.sin(angle), pin[1] + length * Math.cos(angle)];
      arrow(ctx, pin, end, C.orange); text(ctx, "Fstop", end[0] + 9, end[1] + 4, C.orange, 17);
    }
    text(ctx, `θstop = ${fmt(s.compression * degrees, 1)}° / ${fmt(settings.stopAngle, 1)}°`, 220, 310, C.orange, 17, "center");
    text(ctx, s.phase === "held" ? "Peak reached · sequence paused" : "Dashed line: first contact", 220, 336, C.gray, 14, "center");
    get("stop-readout").textContent = `Fstop = ${fmt(s.stopForce)} lbf · ${s.aboveYield ? "Elastic extrapolation" : "Elastic bending estimate"}: ${fmt(s.stress, 1)} ksi`;
  }
  function render() {
    const s = model.sample(run, time);
    get("time").value = time; get("clock").textContent = `${fmt(time, 3)} / ${fmt(run.duration, 2)} s`;
    const names = { pull: settings.driveMode === "steady" ? "Steady rotation toward contact" : "Pulling toward contact", stop: time === run.driveTime ? "First contact" : "Compressing the stop", held: "Maximum compression", rest: "At rest · zero speed" };
    get("phase").textContent = names[s.phase]; get("phase").dataset.phase = s.phase; mount.dataset.phase = s.phase;
    drawOverview(s); drawRotation(s); drawStop(s);
    draggableViews.forEach(id => {
      const el = get(id);
      el.setAttribute("aria-valuemax", String(settings.travelAngle + settings.stopAngle));
      el.setAttribute("aria-valuenow", fmt(s.angle * degrees, 2));
      el.setAttribute("aria-valuetext", `${fmt(s.angle * degrees, 1)} degrees; ${names[s.phase]}`);
      el.setAttribute("aria-disabled", String(run.duration === 0));
    });
  }
  function pause() { running = false; lastFrame = null; cancelAnimationFrame(frameId); frameId = 0; get("play").textContent = "Play"; get("play").setAttribute("aria-pressed", "false"); }
  function rebuild(notify = true) {
    endDrag(); pause(); run = model.derive(settings); settings = { ...run.params }; time = 0;
    fields.forEach(([id, , , , , unit]) => {
      get(id).value = settings[id]; get(`${id}-value`).textContent = `${fmt(settings[id], id === "omega" ? 2 : id === "travelAngle" ? 0 : 1)} ${unit}`;
    });
    const steady = settings.driveMode === "steady";
    get("driveMode").value = settings.driveMode;
    get("profile-help").textContent = steady ? "Starts at speed; startup and friction excluded." : "Starts from rest with a constant cable pull.";
    get("pullRadius").disabled = steady;
    if (steady) get("pullRadius-value").textContent = "Not used";
    get("legend").textContent = steady ? "Blue: rotation · Orange: stop reaction · Red pin: loaded bolt" : "Blue: cable pull · Orange: stop reaction · Red pin: loaded bolt";
    get("travel-time").textContent = run.duration ? `${fmt(run.driveTime)} s` : "—";
    get("compression-time").textContent = run.duration ? `+ ${fmt(run.stopTime)} s` : "—";
    get("time").max = run.duration || 1;
    ["play", "time", "contact", "peak"].forEach(id => { get(id).disabled = run.duration === 0; });
    render(); if (notify) announce("Motion settings reset. Press Play or scrub the timeline.");
  }
  function setTime(value) { endDrag(); pause(); time = clamp(Number(value) || 0, 0, run.duration); render(); }
  function seekAngle(angle) {
    // Pointer coordinates and repeated key steps can land a few ulps away
    // from a stage boundary. Keep those visually identical positions exact.
    for (const boundary of [0, run.travelAngleRadians, run.travelAngleRadians + run.stopAngleRadians]) {
      if (Math.abs(angle - boundary) < 1e-6) { angle = boundary; break; }
    }
    time = model.timeAtAngle(run, angle);
    render();
  }
  function endDrag(notify = false) {
    if (!drag) return;
    const ended = drag; drag = null;
    delete ended.el.dataset.dragging;
    if (ended.el.hasPointerCapture(ended.pointerId)) ended.el.releasePointerCapture(ended.pointerId);
    if (notify && ended.active) announce(`Paused at ${fmt(model.sample(run, time).angle * degrees, 1)} degrees. ${get("phase").textContent}.`);
  }
  function localPointer(el, event) {
    const box = el.getBoundingClientRect();
    return [(event.clientX - box.left) * (el.width / 2) / box.width, (event.clientY - box.top) * (el.height / 2) / box.height];
  }
  function polarPointer(el, event, geometry) {
    const [x, y] = localPointer(el, event);
    if (geometry.fixture) return fixture.pointer([x, y]);
    const dx = (x - geometry.cx) / geometry.rx, dy = (geometry.cy - y) / geometry.ry;
    return { angle: Math.atan2(dy, dx), radius: Math.hypot(dx, dy) };
  }
  function activateDrag() {
    pause(); drag.active = true; drag.angle = model.sample(run, time).angle;
    drag.el.dataset.dragging = "true";
    drag.el.focus({ preventScroll: true });
    drag.el.setPointerCapture(drag.pointerId);
  }
  // Only the angle is manipulated. Its analytical inverse selects the same
  // model time used by Play and the timeline; gesture speed never drives loads.
  const dragGeometry = {
    overview: { cx: 450, cy: 270, rx: 94, ry: 94, outer: 2 },
    rotation: { fixture: true, outer: 1.2 }
  };
  draggableViews.forEach(id => {
    const el = get(id), geometry = dragGeometry[id];
    el.addEventListener("pointerdown", event => {
      if (!event.isPrimary || event.button !== 0 || run.duration === 0 || drag) return;
      const polar = geometry ? polarPointer(el, event, geometry) : null;
      const circular = event.pointerType !== "touch" && polar && polar.radius > .25 && polar.radius < geometry.outer;
      drag = { el, pointerId: event.pointerId, active: false, circular, geometry,
        lastPolar: circular ? polar.angle : null, lastX: event.clientX, startX: event.clientX, startY: event.clientY };
      if (event.pointerType !== "touch") { activateDrag(); event.preventDefault(); }
    });
    el.addEventListener("pointermove", event => {
      if (!drag || drag.el !== el || event.pointerId !== drag.pointerId) return;
      if (event.pointerType !== "touch" && event.buttons === 0) { endDrag(); return; }
      if (!drag.active) {
        const dx = Math.abs(event.clientX - drag.startX), dy = Math.abs(event.clientY - drag.startY);
        // Leave vertical gestures/pinch to the browser, without pausing Play.
        if (dy > 6 && dy >= dx) { endDrag(); return; }
        if (dx <= 6 || dx <= dy * 1.2) return;
        activateDrag();
      }
      event.preventDefault();
      let delta;
      if (drag.circular) {
        const polar = polarPointer(el, event, drag.geometry);
        if (polar.radius < .2) { drag.lastPolar = null; return; }
        delta = drag.lastPolar === null ? 0 : Math.atan2(Math.sin(polar.angle - drag.lastPolar), Math.cos(polar.angle - drag.lastPolar));
        drag.lastPolar = polar.angle;
      } else {
        delta = (event.clientX - drag.lastX) / el.getBoundingClientRect().width * (run.travelAngleRadians + run.stopAngleRadians);
        drag.lastX = event.clientX;
      }
      // Discard overshoot at either endpoint so reversing responds at once.
      drag.angle = clamp(drag.angle + delta, 0, run.travelAngleRadians + run.stopAngleRadians);
      seekAngle(drag.angle);
    });
    el.addEventListener("pointerup", event => { if (drag?.el === el && event.pointerId === drag.pointerId) endDrag(true); });
    ["pointercancel", "lostpointercapture"].forEach(type => el.addEventListener(type, event => {
      if (drag?.el === el && event.pointerId === drag.pointerId) endDrag();
    }));
    el.addEventListener("keydown", event => {
      const steps = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
      if (!(event.key in steps) && event.key !== "Home" && event.key !== "End") return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault(); if (run.duration === 0) return;
      endDrag(); pause();
      const total = run.travelAngleRadians + run.stopAngleRadians;
      const angle = event.key === "Home" ? 0 : event.key === "End" ? total : model.sample(run, time).angle + steps[event.key] * (event.shiftKey ? 5 : 1) / degrees;
      seekAngle(clamp(angle, 0, total));
    });
  });
  window.addEventListener("blur", () => endDrag());
  function frame(timestamp) {
    if (!running) return;
    if (lastFrame !== null) time = Math.min(run.duration, time + Math.min(.1, (timestamp - lastFrame) / 1000) * Number(get("speed").value));
    lastFrame = timestamp; render();
    if (time >= run.duration) { pause(); announce("Maximum compression reached. Playback ends before rebound."); }
    else frameId = requestAnimationFrame(frame);
  }
  fields.forEach(([id]) => {
    get(id).addEventListener("input", () => { settings[id] = Number(get(id).value); rebuild(false); });
    get(id).addEventListener("change", () => announce("Motion recalculated from the selected inputs."));
  });
  get("driveMode").addEventListener("change", () => {
    settings.driveMode = get("driveMode").value;
    rebuild(false);
    announce(`${settings.driveMode === "steady" ? "Steady-speed travel" : "Acceleration from rest"} selected. Motion reset.${run.duration ? ` Contact at ${fmt(run.driveTime)} seconds; compression adds ${fmt(run.stopTime)} seconds.` : " At rest with zero impact speed."}`);
  });
  get("play").addEventListener("click", () => {
    endDrag();
    if (running) { pause(); announce("Playback paused."); return; }
    if (run.duration === 0) return;
    if (time >= run.duration) time = 0;
    running = true; lastFrame = null; get("play").textContent = "Pause"; get("play").setAttribute("aria-pressed", "true");
    frameId = requestAnimationFrame(frame); announce(`Playing at ${get("speed").value} times model speed.`);
  });
  get("restart").addEventListener("click", () => { setTime(0); announce("Returned to the start of the motion."); });
  get("reset").addEventListener("click", () => { settings = { ...model.defaults }; get("speed").value = "1"; rebuild(); });
  get("speed").addEventListener("change", () => { endDrag(); lastFrame = null; });
  get("time").addEventListener("input", () => setTime(get("time").value));
  get("time").addEventListener("change", () => announce(`Paused at ${fmt(time, 3)} model seconds.`));
  get("start").addEventListener("click", () => { setTime(0); announce(settings.driveMode === "steady" ? "Start of steady-speed travel; disk already moving at the selected speed." : "Start of the cable pull."); });
  get("contact").addEventListener("click", () => { setTime(run.driveTime); announce(settings.driveMode === "steady" ? "First contact: steady-speed travel ends and stop compression begins." : "First contact: the cable releases and stop compression begins."); });
  get("peak").addEventListener("click", () => { setTime(run.duration); announce("Maximum stop compression, before rebound."); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { endDrag(); if (running) pause(); } });
  if ("IntersectionObserver" in window) new IntersectionObserver(entries => { if (!entries[0].isIntersecting) { endDrag(); if (running) { pause(); announce("Playback paused while the diagrams are off screen."); } } }).observe(mount);
  rebuild(false); mount.dataset.ready = "true";
  window.AblativeFBDLab = Object.freeze({
    setTime,
    getState: () => ({ ...model.sample(run, time), params: { ...settings }, duration: run.duration, driveTime: run.driveTime, stopTime: run.stopTime, running }),
    getModel: () => ({ ...run, params: { ...settings } })
  });
})();
