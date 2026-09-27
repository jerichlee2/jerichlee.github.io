/* Mixed-evidence explorer, partly calibrated but not validated. The pure
 * renderer also makes the no-JavaScript image from the same shared model. */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./ablative-depth-surface-model.js"));
  } else {
    root.AblativeDepthSurfaceView = factory(root.AblativeDepthSurfaceModel);
    if (root.document) {
      const start = function () { root.AblativeDepthSurfaceView.mount(root.document.getElementById("ablative-depth-surface")); };
      if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start, { once: true });
      else start();
    }
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function (model) {
  "use strict";
  const defaults = Object.freeze({ yaw: -.80, elevation: .55, time: 20, flux: .2592 });
  const ink = "#38352f", muted = "#756f64", paper = "#fffdf9", probeColor = "#ac432c";
  const viridis = [[68, 1, 84], [72, 36, 117], [65, 68, 135], [53, 95, 141], [42, 120, 142], [33, 145, 140], [34, 168, 132], [68, 191, 112], [122, 209, 81], [189, 223, 38], [253, 231, 37]];
  const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
  const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
  const depthReadout = value => (Math.round(value * 100) / 100).toFixed(2);
  let current = null;

  function colorForMass(mass) {
    const p = clamp(mass / (model ? model.constants.massMax : 2.4), 0, 1) * (viridis.length - 1);
    const i = Math.min(viridis.length - 2, Math.floor(p)), fraction = p - i;
    return "rgb(" + viridis[i].map((v, j) => Math.round(v + (viridis[i + 1][j] - v) * fraction)).join(",") + ")";
  }
  function line(ctx, points, color, width, dash) {
    if (points.length < 2) return;
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.strokeStyle = color || ink; ctx.lineWidth = width || 1;
    ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
  }
  function polygon(ctx, points, fill, stroke) {
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function text(ctx, value, x, y, options) {
    const o = options || {};
    ctx.font = (o.bold ? "600 " : "") + (o.size || 12) + "px Georgia, 'Times New Roman', serif";
    ctx.textAlign = o.align || "left"; ctx.textBaseline = "middle";
    if (o.halo) { ctx.strokeStyle = paper; ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.strokeText(value, x, y); }
    ctx.fillStyle = o.color || ink; ctx.fillText(value, x, y);
  }
  function dot(ctx, point, label, isProbe, radius, measured) {
    const r = radius || 6;
    ctx.beginPath();
    if (isProbe) { ctx.moveTo(point.x, point.y - r); ctx.lineTo(point.x + r, point.y); ctx.lineTo(point.x, point.y + r); ctx.lineTo(point.x - r, point.y); ctx.closePath(); }
    else ctx.arc(point.x, point.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = isProbe ? probeColor : measured ? ink : paper; ctx.fill();
    ctx.strokeStyle = isProbe || measured ? paper : ink; ctx.lineWidth = isProbe ? 1.8 : 2; ctx.stroke();
    if (label) text(ctx, label, point.x + 11, point.y - 9, { size: 11, bold: true, halo: true });
  }

  /** Draw in logical CSS pixels. Caller owns device-pixel-ratio transforms. */
  function render(ctx, options) {
    if (!model || !ctx) return null;
    const o = options || {}, c = model.constants;
    const width = Math.max(280, finite(o.width, 900)), height = Math.max(420, finite(o.height, 620));
    const mobile = width < 560;
    const yaw = finite(o.yaw, defaults.yaw), elevation = clamp(finite(o.elevation, defaults.elevation), .20, 1.25);
    const probe = model.evaluate(clamp(finite(o.probe && o.probe.time, defaults.time), 0, c.timeMax), clamp(finite(o.probe && o.probe.flux, defaults.flux), 0, c.fluxMax));
    const cy = Math.cos(yaw), sy = Math.sin(yaw), ce = Math.cos(elevation), se = Math.sin(elevation);
    const raw = function (time, flux, depth) {
      const x = time / c.timeMax - .5, y = flux / c.fluxMax - .5, z = depth / c.depthMax - .5;
      const back = sy * x + cy * y;
      return { x: cy * x - sy * y, y: -(se * back + ce * z), distance: ce * back - se * z };
    };
    const corners = [];
    [0, c.timeMax].forEach(t => [0, c.fluxMax].forEach(q => [0, c.depthMax].forEach(d => corners.push(raw(t, q, d)))));
    const bounds = { left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)), top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y)) };
    const plot = { left: mobile ? 52 : 72, right: width - (mobile ? 28 : 54), top: width < 350 ? 64 : 54, bottom: height - (mobile ? 175 : 155) };
    const scale = Math.min((plot.right - plot.left) / (bounds.right - bounds.left), (plot.bottom - plot.top) / (bounds.bottom - bounds.top));
    const ox = (plot.left + plot.right) / 2 - (bounds.left + bounds.right) / 2 * scale;
    const oy = (plot.top + plot.bottom) / 2 - (bounds.top + bounds.bottom) / 2 * scale;
    const project = function (t, q, d) { const p = raw(t, q, d); return { x: ox + p.x * scale, y: oy + p.y * scale, distance: p.distance }; };
    const from = p => project(p.time, p.flux, p.depth);
    ctx.save(); ctx.clearRect(0, 0, width, height); ctx.fillStyle = paper; ctx.fillRect(0, 0, width, height); ctx.lineJoin = "round"; ctx.lineCap = "round";
    text(ctx, "PARTLY CALIBRATED · NOT VALIDATED", 18, 19, { size: mobile ? 10 : 12, color: muted });
    text(ctx, "Measured hot · assumed baseline", width < 560 ? 18 : width - 18, width < 560 ? 36 : 19, { align: width < 560 ? "left" : "right", size: mobile ? 11 : 14 });
    const floor = [project(0, 0, 0), project(c.timeMax, 0, 0), project(c.timeMax, c.fluxMax, 0), project(0, c.fluxMax, 0)];
    polygon(ctx, floor, "#f4f1e9", "#c9c3b8");
    for (let t = 0; t <= c.timeMax; t += 5) line(ctx, [project(t, 0, 0), project(t, c.fluxMax, 0)], "#dcd7cd", .7);
    for (let q = 0; q <= c.fluxMax + 1e-9; q += .2) line(ctx, [project(0, q, 0), project(c.timeMax, q, 0)], "#dcd7cd", .7);
    // Subtle depth reference edges, behind the response surface.
    [[0, 0], [c.timeMax, 0], [0, c.fluxMax], [c.timeMax, c.fluxMax]].forEach(([t, q]) => line(ctx, [project(t, q, 0), project(t, q, c.depthMax)], "#e1dcd3", .7, [2, 4]));
    for (let d = 3; d <= c.depthMax; d += 3) {
      line(ctx, [project(0, c.fluxMax, d), project(c.timeMax, c.fluxMax, d), project(c.timeMax, 0, d)], "#e8e2d9", .6);
    }
    // Painter's algorithm: far facets first; mass, not depth, sets the color.
    const facets = [], columns = 34, rows = 28;
    for (let i = 0; i < columns; i++) for (let j = 0; j < rows; j++) {
      const coords = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => model.evaluate(a / columns * c.timeMax, b / rows * c.fluxMax));
      const vertices = coords.map(from);
      facets.push({ vertices: vertices, distance: vertices.reduce((sum, p) => sum + p.distance, 0) / 4, mass: coords.reduce((sum, p) => sum + p.mass, 0) / 4 });
    }
    facets.sort((a, b) => b.distance - a.distance);
    facets.forEach(f => polygon(ctx, f.vertices, colorForMass(f.mass), colorForMass(f.mass)));
    // Sparse mesh is separate from the mass contour curves.
    for (let i = 0; i <= 10; i++) {
      const alongTime = [], alongFlux = [];
      for (let j = 0; j <= 60; j++) {
        alongTime.push(from(model.evaluate(j / 60 * c.timeMax, i / 10 * c.fluxMax)));
        alongFlux.push(from(model.evaluate(i / 10 * c.timeMax, j / 60 * c.fluxMax)));
      }
      line(ctx, alongTime, "rgba(255,255,255,.22)", .65);
      line(ctx, alongFlux, "rgba(255,255,255,.22)", .65);
    }
    const contourLevels = [];
    for (let mass = .2; mass < c.massMax + .001; mass += .2) {
      const level = Number(mass.toFixed(1)), curve = model.contour(level, 100);
      if (curve.length < 2) continue;
      contourLevels.push(level);
      line(ctx, curve.map(from), "rgba(25,36,32,.62)", 1.1);
    }
    // The three labeled axes always lie on the visible, outward cube edges.
    const zCorner = [[0, 0], [c.timeMax, 0], [0, c.fluxMax], [c.timeMax, c.fluxMax]].sort((a, b) => project(a[0], a[1], 0).x - project(b[0], b[1], 0).x)[0];
    const tEdgeQ = project(c.timeMax / 2, 0, 0).y > project(c.timeMax / 2, c.fluxMax, 0).y ? 0 : c.fluxMax;
    const qEdgeT = project(0, c.fluxMax / 2, 0).y > project(c.timeMax, c.fluxMax / 2, 0).y ? 0 : c.timeMax;
    const floorCenter = project(c.timeMax / 2, c.fluxMax / 2, 0);
    function axis(start, end, ticks, locate, label, vertical) {
      line(ctx, [start, end], "#7d7568", 1.25);
      const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      let nx, ny;
      if (vertical) { nx = -1; ny = 0; }
      else {
        nx = -(end.y - start.y); ny = end.x - start.x;
        const length = Math.hypot(nx, ny) || 1; nx /= length; ny /= length;
        if (nx * (midpoint.x - floorCenter.x) + ny * (midpoint.y - floorCenter.y) < 0) { nx *= -1; ny *= -1; }
      }
      ticks.forEach(tick => {
        const p = locate(tick.value);
        line(ctx, [p, { x: p.x + nx * 4, y: p.y + ny * 4 }], "#7d7568", 1);
        text(ctx, tick.label, p.x + nx * 13, p.y + ny * 13, { size: mobile ? 10 : 12, align: vertical ? "right" : "center", halo: true });
      });
      if (vertical) {
        ctx.save(); ctx.translate(start.x - 38, midpoint.y); ctx.rotate(-Math.PI / 2);
        text(ctx, label, 0, 0, { size: mobile ? 11 : 14, align: "center", halo: true }); ctx.restore();
      } else {
        let angle = Math.atan2(end.y - start.y, end.x - start.x);
        if (angle > Math.PI / 2) angle -= Math.PI;
        if (angle < -Math.PI / 2) angle += Math.PI;
        ctx.save(); ctx.translate(midpoint.x + nx * 35, midpoint.y + ny * 35); ctx.rotate(angle);
        const size = mobile ? 10 : 14;
        if (mobile && label.indexOf("Graphite") === 0) {
          text(ctx, "Graphite-reference flux", 0, -3, { size: size, align: "center", halo: true });
          text(ctx, "(MW/m²)", 0, 10, { size: size, align: "center", halo: true });
        } else text(ctx, label, 0, 0, { size: size, align: "center", halo: true });
        ctx.restore();
      }
    }
    axis(project(0, tEdgeQ, 0), project(c.timeMax, tEdgeQ, 0), [0, 5, 10, 15, 20].map(v => ({ value: v, label: String(v) })), v => project(v, tEdgeQ, 0), "Exposure time (s)");
    axis(project(qEdgeT, 0, 0), project(qEdgeT, c.fluxMax, 0), [.2, .4, .6, .8].map(v => ({ value: v, label: v.toFixed(1) })), v => project(qEdgeT, v, 0), "Graphite-reference flux (MW/m²)");
    axis(project(zCorner[0], zCorner[1], 0), project(zCorner[0], zCorner[1], c.depthMax), [0, 3, 6, 9, 12].map(v => ({ value: v, label: String(v) })), v => project(zCorner[0], zCorner[1], v), "Dimple depth (mm)", true);
    // Only the hot depth is measured; the baseline remains an assumption.
    const projectedPoints = model.points.map(p => ({ id: p.id, measured: p.measured, position: from(p) }));
    const probePosition = from(probe);
    line(ctx, [project(probe.time, probe.flux, 0), probePosition], "rgba(172,67,44,.8)", 1.2, [3, 4]);
    projectedPoints.forEach(p => dot(ctx, p.position, p.id === "baseline" ? "B" : "H", false, 6, p.measured));
    const overlapsAnchor = projectedPoints.some(p => Math.hypot(p.position.x - probePosition.x, p.position.y - probePosition.y) < 12);
    dot(ctx, probePosition, "", true, overlapsAnchor ? 3 : 5);
    // Keep a fixed mass scale while the selected point and camera change.
    const barWidth = Math.min(width - 76, 350), barLeft = (width - barWidth) / 2;
    const barY = height - (mobile ? 88 : 78), barHeight = 11;
    text(ctx, "Dimple-equivalent mass (g)", width / 2, barY - 17, { size: mobile ? 12 : 14, align: "center" });
    for (let i = 0; i < barWidth; i++) { ctx.fillStyle = colorForMass(i / (barWidth - 1) * c.massMax); ctx.fillRect(barLeft + i, barY, 1.1, barHeight); }
    ctx.strokeStyle = "#787267"; ctx.lineWidth = .5; ctx.strokeRect(barLeft, barY, barWidth, barHeight);
    [0, .6, 1.2, 1.8, 2.4].forEach(mass => {
      const x = barLeft + mass / c.massMax * barWidth;
      line(ctx, [{ x: x, y: barY + barHeight }, { x: x, y: barY + barHeight + 3 }], muted, .7);
      text(ctx, mass.toFixed(1), x, barY + 23, { align: "center", size: mobile ? 10 : 11, color: muted });
    });
    function legend(items, y) {
      const size = mobile ? 10 : 12;
      ctx.font = size + "px Georgia, 'Times New Roman', serif";
      const lengths = items.map(item => ctx.measureText(item.label).width + 16);
      let x = (width - lengths.reduce((sum, n) => sum + n, 0) - (items.length - 1) * 14) / 2;
      items.forEach((item, i) => {
        dot(ctx, { x: x + 3, y: y }, "", item.probe, 3, item.measured);
        text(ctx, item.label, x + 12, y, { size: size, color: muted });
        x += lengths[i] + 14;
      });
    }
    const legendY = height - (mobile ? 35 : 27);
    const legendItems = [{ label: "B: assumed 3 mm" }, { label: "H: measured ≈3.2 mm", measured: true }];
    if (!mobile) legendItems.push({ label: "Probe", probe: true });
    legend(legendItems, legendY);
    if (mobile) legend([{ label: "Probe  ·  Iso-mass curves every 0.2 g", probe: true }], legendY + 17);
    else text(ctx, "20 mm paraboloid · conditional hot-brick density · not the 8.9 g net loss", width / 2, height - 9, { size: 10, align: "center", color: muted });
    ctx.restore();
    return { width: width, height: height, model: model.fit.id, probe: probe, contourLevels: contourLevels, points: projectedPoints, probePosition: probePosition };
  }

  function mount(element) {
    if (!element || !model || element.dataset.ready === "true") return null;
    const doc = element.ownerDocument, win = doc.defaultView;
    const interfaceNode = doc.createElement("div");
    interfaceNode.className = "depth-surface-interface";
    interfaceNode.innerHTML = `
      <section class="depth-surface-controls" id="depth-surface-controls" aria-labelledby="depth-surface-settings-title">
        <h3 id="depth-surface-settings-title">Dimple settings</h3>
        <p class="depth-surface-settings-note">One measured hot depth · baseline remains assumed</p>
        <div class="depth-surface-inputs">
          <label for="depth-surface-time"><span>Exposure time <output id="depth-surface-time-value" for="depth-surface-time">20.0 s</output></span><input id="depth-surface-time" type="range" min="0" max="${model.constants.timeMax}" step="0.1" value="20"></label>
          <label for="depth-surface-flux"><span>Reference flux <output id="depth-surface-flux-value" for="depth-surface-flux">0.2592 MW/m²</output></span><input id="depth-surface-flux" type="range" min="0" max="0.8" step="0.0001" value="0.2592"></label>
        </div>
        <button type="button" id="depth-surface-autorotate" aria-label="Automatic plot rotation" aria-pressed="true">Pause rotation</button>
        <button type="button" id="depth-surface-reset">Reset view</button>
      </section>
      <div class="depth-surface-results" id="depth-surface-results">
      <p class="depth-surface-help" id="depth-surface-help">Slow auto-rotation · drag to take over. Keyboard focus pauses rotation; arrow keys rotate, Home resets. Filled H: measured ≈3.2 mm. Hollow B: assumed 3 mm.</p>
      <canvas id="depth-surface-canvas" class="depth-surface-canvas" tabindex="0" role="img" aria-label="Rotatable three-dimensional partly calibrated depth surface, not validated. One approximate measured hot depth and one assumed baseline constrain the surface; color shows conditional-density-equivalent dimple mass, not whole-brick net loss." aria-describedby="depth-surface-help depth-surface-readout"></canvas>
      <div class="depth-surface-probe">
        <div class="depth-surface-probe-heading"><h3>Selected point</h3><span>◆ Probe</span></div>
        <dl class="depth-surface-readout" id="depth-surface-readout">
          <div><dt>Modeled depth</dt><dd><output id="depth-surface-depth-value" for="depth-surface-time depth-surface-flux"></output></dd></div>
          <div><dt>Dimple-equivalent mass</dt><dd><output id="depth-surface-mass-value" for="depth-surface-time depth-surface-flux"></output></dd></div>
        </dl>
        <p class="depth-surface-note">Partly calibrated, not validated. Hot depth was measured approximately; model digits do not imply measurement precision. Mass assumes a 20 mm paraboloid and transfers the hot brick’s conditional density (82.8 g / nominal volume) across this surface—not the observed 8.9 g whole-brick net loss. Curves mark equal mass every 0.2 g; the color scale stays fixed.</p>
      </div>
      </div>
      <p class="depth-surface-sr-only" id="depth-surface-status" aria-live="polite" aria-atomic="true"></p>`;
    const get = suffix => interfaceNode.querySelector("#depth-surface-" + suffix);
    const results = get("results"), canvas = get("canvas"), ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const state = { yaw: defaults.yaw, elevation: defaults.elevation, probe: { time: defaults.time, flux: defaults.flux } };
    let frame = 0, drag = null, announceTimer = 0, lastWidth = 0;
    const motionPreference = win.matchMedia ? win.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const rotationRate = 6 * Math.PI / 180, fullTurn = 2 * Math.PI;
    let autoEnabled = !motionPreference?.matches, userRotationChoice = null;
    let autoFrame = 0, autoLast = null, autoPaint = null;
    let inView = false, pageActive = true, keyboardFocus = false;
    function draw(updateReadouts = true) {
      // Measure the plot column, not the interface including its settings rail.
      // Before attachment, the existing article width sizes the fallback draw.
      const width = Math.max(280, results.clientWidth || results.getBoundingClientRect().width || element.clientWidth || element.getBoundingClientRect().width || 800);
      const height = width < 560 ? 500 : Math.min(660, Math.max(560, width * .72));
      const ratio = Math.min(win.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(width * ratio), pixelHeight = Math.round(height * ratio);
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      canvas.style.height = height + "px"; ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const result = render(ctx, { width: width, height: height, yaw: state.yaw, elevation: state.elevation, probe: state.probe });
      if (!result) return false;
      lastWidth = width;
      if (updateReadouts) {
        get("time-value").textContent = state.probe.time.toFixed(1) + " s";
        get("flux-value").textContent = state.probe.flux.toFixed(4) + " MW/m²";
        get("depth-value").textContent = depthReadout(result.probe.depth) + " mm";
        get("mass-value").textContent = result.probe.mass.toFixed(3) + " g";
        get("time").setAttribute("aria-valuetext", state.probe.time.toFixed(1) + " seconds");
        get("flux").setAttribute("aria-valuetext", state.probe.flux.toFixed(4) + " megawatts per square metre");
      }
      current = { state: state, result: result };
      return true;
    }
    function queueDraw() { if (!frame) frame = win.requestAnimationFrame(function () { frame = 0; draw(); }); }
    function canAutoRotate() { return autoEnabled && inView && !doc.hidden && pageActive && !drag && !keyboardFocus; }
    function stopAutoRotation() {
      win.cancelAnimationFrame(autoFrame); autoFrame = 0; autoLast = null; autoPaint = null;
      canvas.dataset.autoRotating = "false";
    }
    function rotateFrame(timestamp) {
      autoFrame = 0;
      if (!canAutoRotate()) { stopAutoRotation(); return; }
      if (autoLast !== null) {
        // Camera only: never change time, flux, or inferred mass.
        // No catch-up jump after suspension, tab changes, or manual rotation.
        const elapsed = Math.min(.1, Math.max(0, (timestamp - autoLast) / 1000));
        state.yaw = (state.yaw + elapsed * rotationRate) % fullTurn;
        // A 30 fps paint cap is ample for one gentle turn per minute.
        if (autoPaint === null || timestamp - autoPaint >= 1000 / 30) {
          draw(false); autoPaint = timestamp;
        }
      }
      autoLast = timestamp;
      autoFrame = win.requestAnimationFrame(rotateFrame);
    }
    function syncAutoRotation() {
      get("autorotate").textContent = autoEnabled ? "Pause rotation" : "Resume rotation";
      get("autorotate").setAttribute("aria-pressed", String(autoEnabled));
      if (!canAutoRotate()) { stopAutoRotation(); return; }
      canvas.dataset.autoRotating = "true";
      if (!autoFrame) autoFrame = win.requestAnimationFrame(rotateFrame);
    }
    function announce() {
      win.clearTimeout(announceTimer);
      announceTimer = win.setTimeout(function () {
        const p = model.evaluate(state.probe.time, state.probe.flux);
        get("status").textContent = "Modeled depth " + depthReadout(p.depth) + " millimetres; dimple-equivalent mass " + p.mass.toFixed(3) + " grams, not whole-brick net mass loss.";
      }, 180);
    }
    // Build and successfully render off-DOM before hiding the static fallback.
    try { if (!draw()) return null; } catch (error) { return null; }
    element.appendChild(interfaceNode);
    const fallback = doc.getElementById("ablative-depth-surface-fallback");
    if (fallback && element.contains(fallback)) fallback.hidden = true;
    element.dataset.ready = "true";
    queueDraw(); // Re-measure the attached chart after the responsive rail lays out.
    ["time", "flux"].forEach(key => get(key).addEventListener("input", function (event) { state.probe[key] = Number(event.target.value); queueDraw(); announce(); }));
    function reset() { state.yaw = defaults.yaw; state.elevation = defaults.elevation; autoLast = null; autoPaint = null; queueDraw(); }
    get("reset").addEventListener("click", reset);
    get("autorotate").addEventListener("click", function () {
      autoEnabled = !autoEnabled; userRotationChoice = autoEnabled; syncAutoRotation();
    });
    canvas.addEventListener("focus", function () { if (!drag) { keyboardFocus = true; syncAutoRotation(); } });
    canvas.addEventListener("blur", function () { keyboardFocus = false; syncAutoRotation(); });
    canvas.addEventListener("keydown", function (event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(event.key)) return;
      keyboardFocus = true; syncAutoRotation();
      const step = event.shiftKey ? .15 : .05;
      if (event.key === "ArrowLeft") state.yaw -= step;
      else if (event.key === "ArrowRight") state.yaw += step;
      else if (event.key === "ArrowUp") state.elevation = clamp(state.elevation + step, .20, 1.25);
      else if (event.key === "ArrowDown") state.elevation = clamp(state.elevation - step, .20, 1.25);
      else if (event.key === "Home") { reset(); event.preventDefault(); return; }
      else return;
      event.preventDefault(); queueDraw();
    });
    canvas.addEventListener("pointerdown", function (event) {
      if (!event.isPrimary || drag || (event.pointerType === "mouse" && event.button !== 0)) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      keyboardFocus = false; syncAutoRotation();
      canvas.setPointerCapture(event.pointerId); canvas.dataset.dragging = "true";
      canvas.focus({ preventScroll: true });
    });
    canvas.addEventListener("pointermove", function (event) {
      if (!drag || event.pointerId !== drag.id) return;
      state.yaw += (event.clientX - drag.x) * .007;
      state.elevation = clamp(state.elevation + (event.clientY - drag.y) * .006, .20, 1.25);
      drag.x = event.clientX; drag.y = event.clientY; queueDraw();
    });
    function endDrag(event) {
      if (!drag || drag.id !== event.pointerId) return;
      const pointerId = drag.id;
      drag = null; canvas.dataset.dragging = "false";
      if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
      syncAutoRotation();
    }
    canvas.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag); canvas.addEventListener("lostpointercapture", endDrag);
    win.addEventListener("blur", function () { pageActive = false; if (drag) endDrag({ pointerId: drag.id }); syncAutoRotation(); });
    win.addEventListener("focus", function () { pageActive = true; syncAutoRotation(); });
    doc.addEventListener("visibilitychange", function () { if (doc.hidden && drag) endDrag({ pointerId: drag.id }); syncAutoRotation(); });
    if (motionPreference) motionPreference.addEventListener("change", function () {
      if (motionPreference.matches) autoEnabled = false;
      else if (userRotationChoice !== false) autoEnabled = true;
      syncAutoRotation();
    });
    if (win.IntersectionObserver) {
      new win.IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting && entries[0].intersectionRatio > .05;
        syncAutoRotation();
      }, { threshold: [0, .05] }).observe(canvas);
    } else {
      const checkVisibility = function () {
        const bounds = canvas.getBoundingClientRect();
        inView = bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < win.innerHeight;
        syncAutoRotation();
      };
      win.addEventListener("scroll", checkVisibility, { passive: true });
      win.addEventListener("resize", checkVisibility);
      checkVisibility();
    }
    if (win.ResizeObserver) new win.ResizeObserver(function () { if (Math.abs(results.clientWidth - lastWidth) > 1) queueDraw(); }).observe(results);
    else win.addEventListener("resize", queueDraw);
    syncAutoRotation();
    return {
      render: draw,
      getState: function () { return JSON.parse(JSON.stringify(state)); },
      getCameraState: function () { return { autoRotationEnabled: autoEnabled, autoRotating: !!autoFrame, dragging: !!drag, keyboardFocus: keyboardFocus }; }
    };
  }
  return { render: render, mount: mount, colorForMass: colorForMass, defaults: defaults, getState: function () { return current ? JSON.parse(JSON.stringify(current)) : null; } };
}));
