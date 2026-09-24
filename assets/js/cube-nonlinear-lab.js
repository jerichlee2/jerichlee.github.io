/* Source-faithful exploration of the supplied nonlinear release samples.
 * No force-law approximation or new numerical dynamics is introduced here.
 * Geometry and every plot read the same [time, theta, omega] trajectory.
 */
(function () {
  "use strict";
  const mount = document.getElementById("cube-nonlinear-lab");
  const data = window.CUBE_NONLINEAR_DATA;
  const potentialData = window.CUBE_POTENTIAL_DATA;
  if (!mount || !data) return;
  const ns = "http://www.w3.org/2000/svg";
  const degrees = 180 / Math.PI;
  const plotViews = [["phase", "Phase space"], ["potential", "Potential wells"], ["angle", "Angle"], ["speed", "Speed"], ["return", "Return map"]];
  const layouts = [
    { key: "root", label: "Root-mounted", color: "#176da5", dash: "" },
    { key: "side", label: "Side-mounted", color: "#b8520c", dash: "7 4" }
  ];
  const labels = {
    offset_release: "10° release from rest",
    post_turn_ringdown: "0° release at 5 rad/s",
    approaching_alignment: "Approach from −10° at +5 rad/s",
    equal_angular_impulse: "Same push: 50 μN·m·s angular impulse",
    capture_15deg: "15° release: different destinations",
    large_offset_30deg: "30° release: both approach 45°"
  };
  const explanations = {
    offset_release: "Both start 10° from alignment and return toward 0°, following different paths.",
    post_turn_ringdown: "Both start aligned at 5 rad/s; the side-mounted layer has the smaller first overshoot.",
    approaching_alignment: "Both start at −10° and move toward alignment at +5 rad/s.",
    equal_angular_impulse: "The same angular impulse gives different starting speeds because the layouts have different inertias.",
    capture_15deg: "The root-mounted model returns to 0°; the side-mounted model settles near an unwanted 45° position.",
    large_offset_30deg: "Both models settle near the unwanted 45° position instead of returning to 0°."
  };
  mount.innerHTML = `
    <div class="cube-lab-controls">
      <h3 id="cube-lab-title" tabindex="-1">Follow a turn</h3>
      <div class="cube-setup">
        <label class="cube-case" for="cube-case">Starting condition<select id="cube-case" aria-describedby="cube-initial cube-case-description"></select></label>
        <label class="cube-speed" for="cube-speed">Speed<select id="cube-speed" aria-label="Playback speed"><option value="0.05">0.05×</option><option value="0.1" selected>0.1×</option><option value="0.25">0.25×</option><option value="1">1×</option></select></label>
      </div>
      <div class="cube-playback">
        <button type="button" class="cube-play" id="cube-play" aria-pressed="false">Play</button>
        <button type="button" id="cube-restart">Restart</button>
        <div class="cube-timeline">
          <div class="cube-timeline-top"><label for="cube-time">Time</label><output id="cube-clock" class="cube-clock" for="cube-time"></output></div>
          <input id="cube-time" type="range" min="0" max="1.5" step="0.0005" value="0" aria-label="Physical time" aria-describedby="cube-playback-note">
        </div>
      </div>
      <div class="cube-plot-tabs" role="tablist" aria-label="Linked plot view">
        ${plotViews.map(([key, label]) => `<button type="button" id="cube-tab-${key}" role="tab" aria-controls="cube-panel-${key}" aria-selected="${key === "potential"}" tabindex="${key === "potential" ? 0 : -1}" data-cube-view="${key}">${label}</button>`).join("")}
      </div>
    </div>
    <div class="cube-geometry-grid">
      ${layouts.map(layout => `<section class="cube-geometry" aria-labelledby="cube-${layout.key}-title"><h4 id="cube-${layout.key}-title" class="cube-${layout.key}-text">${layout.label}</h4><canvas id="cube-${layout.key}-canvas" width="650" height="460" role="img" aria-label="${layout.label} magnet arrangement at the selected physical time"></canvas><div class="cube-readout" id="cube-${layout.key}-readout"></div></section>`).join("")}
    </div>
    <div class="cube-plot-grid">
      <figure class="cube-chart cube-chart-wide" id="cube-panel-potential" role="tabpanel" aria-labelledby="cube-tab-potential" tabindex="0">
        <div class="cube-well-grid">
          ${layouts.map(layout => `<section class="cube-well" aria-labelledby="cube-well-${layout.key}-title"><h4 id="cube-well-${layout.key}-title" class="cube-${layout.key}-text">${layout.key === "root" ? "Root: wider, gentler bowl" : "Side: narrower, firmer bowl"}</h4><div id="cube-well-${layout.key}-chart" class="cube-chart-host"></div><p class="cube-well-readout" id="cube-well-${layout.key}-readout"></p></section>`).join("")}
        </div>
        <figcaption>Alignment is the bottom of each bowl at 0°; 45° is an unwanted resting place. Ridges: root ±${data.models.root.summary.barrier_angle_deg.toFixed(2)}°, side ±${data.models.side.summary.barrier_angle_deg.toFixed(2)}°. Enough starting speed can carry a layer over a ridge.</figcaption>
      </figure>
      <figure class="cube-chart cube-chart-wide" id="cube-panel-angle" role="tabpanel" aria-labelledby="cube-tab-angle" tabindex="0" hidden><h4>Layer angle</h4><div id="cube-angle-chart" class="cube-chart-host"></div><figcaption>Angle from the intended 0° alignment.</figcaption></figure>
      <figure class="cube-chart cube-chart-wide" id="cube-panel-speed" role="tabpanel" aria-labelledby="cube-tab-speed" tabindex="0" hidden><h4>Turning speed</h4><div id="cube-speed-chart" class="cube-chart-host"></div><figcaption>Positive and negative values show opposite turning directions.</figcaption></figure>
      <figure class="cube-chart cube-chart-wide" id="cube-panel-phase" role="tabpanel" aria-labelledby="cube-tab-phase" tabindex="0" hidden><h4>Phase space: the path of the turn</h4><div id="cube-phase-chart" class="cube-chart-host"></div><figcaption>Read angle across and speed up the page; spirals shrink toward rest, while settling near (45°, 0) means the layer missed the intended alignment.</figcaption></figure>
      <figure class="cube-chart cube-chart-wide" id="cube-panel-return" role="tabpanel" aria-labelledby="cube-tab-return" tabindex="0" hidden><h4>Speed from one crossing to the next</h4><div id="cube-return-chart" class="cube-chart-host"></div><figcaption id="cube-return-caption"></figcaption></figure>
    </div>
    <div class="cube-lab-notes">
      <div class="cube-legend" aria-label="Plot legend"><span><i class="cube-swatch" aria-hidden="true"></i>Root: solid line, circle</span><span><i class="cube-swatch cube-swatch-side" aria-hidden="true"></i>Side: dashed line, square</span></div>
      <p id="cube-initial" class="cube-small cube-initial"></p>
      <p id="cube-case-description" class="cube-small"></p>
      <p id="cube-playback-note" class="cube-small">Playback is slowed to reveal the motion; angles are not exaggerated. These six releases replay computed samples, not measured hardware or a new browser simulation.</p>
      <p class="cube-small">Filled dots move with the layer; open dots stay fixed, and arrows show magnet axes. Both views use the same scale inside a 56 mm reference box, not collision-checked housing.</p>
      <p class="cube-small" id="cube-plot-explanation">The bowls use curves recovered from the report figure; moving markers follow the saved layer motion on the same scale, not a new ball-on-track simulation.</p>
    </div>
    <p class="cube-visually-hidden" id="cube-status" aria-live="polite" aria-atomic="true"></p>`;

  const query = id => document.getElementById(id);
  const controls = { select: query("cube-case"), time: query("cube-time"), play: query("cube-play"), speed: query("cube-speed") };
  Object.keys(data.cases).forEach(key => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = labels[key] || data.cases[key].label;
    controls.select.append(option);
  });

  let current = "capture_15deg", time = 0, running = false, frameId = 0, lastFrame = null;
  let plots = [], wellPlots = [], returnPlot = null, returnEvents = {}, visible = true, selectedView = "potential";
  const announce = message => { query("cube-status").textContent = message; };
  const fixed = (value, digits = 2) => (Math.abs(value) < 0.5 * Math.pow(10, -digits) ? 0 : value).toFixed(digits);

  function sample(trace, t) {
    if (t <= trace[0][0]) return trace[0];
    if (t >= trace[trace.length - 1][0]) return trace[trace.length - 1];
    let lo = 0, hi = trace.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (trace[mid][0] <= t) lo = mid; else hi = mid; }
    const u = (t - trace[lo][0]) / (trace[hi][0] - trace[lo][0]);
    return [t, trace[lo][1] * (1 - u) + trace[hi][1] * u, trace[lo][2] * (1 - u) + trace[hi][2] * u];
  }

  function rotate(p, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]];
  }
  function project(p) {
    const a = .72, b = .51, x = Math.cos(a) * p[0] - Math.sin(a) * p[1], y = Math.sin(a) * p[0] + Math.cos(a) * p[1];
    return [325 + 5 * x, 230 + 5 * (Math.sin(b) * y - Math.cos(b) * p[2]), Math.cos(b) * y + Math.sin(b) * p[2]];
  }
  function drawGeometry(layout, state) {
    const canvas = query(`cube-${layout.key}-canvas`), ctx = canvas.getContext("2d"), geometry = data.models[layout.key];
    ctx.clearRect(0, 0, 650, 460);
    ctx.strokeStyle = layout.color; ctx.fillStyle = layout.color; ctx.lineWidth = 1.4;
    const line = (p, q) => { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); };
    const vertices = [];
    for (const x of [-28, 28]) for (const y of [-28, 28]) for (const z of [-28, 28]) vertices.push([x, y, z]);
    ctx.globalAlpha = .22;
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if (vertices[i].filter((v, k) => v !== vertices[j][k]).length === 1) line(project(vertices[i]), project(vertices[j]));
    ctx.globalAlpha = 1;
    const items = geometry.position_mm.map((p, i) => {
      const moving = geometry.moving[i], position = moving ? rotate(p, state[1]) : p;
      return { moving, position, axis: moving ? rotate(geometry.axis[i], state[1]) : geometry.axis[i], screen: project(position) };
    }).sort((a, b) => a.screen[2] - b.screen[2]);
    items.forEach(item => {
      const p = item.screen, end = project(item.position.map((v, k) => v + 2.8 * item.axis[k]));
      ctx.lineWidth = item.moving ? 2 : 1.3; ctx.globalAlpha = item.moving ? 1 : .5;
      ctx.beginPath(); ctx.arc(p[0], p[1], item.moving ? 4.6 : 3.7, 0, Math.PI * 2);
      if (item.moving) ctx.fill(); else ctx.stroke();
      line(p, end);
      const a = Math.atan2(end[1] - p[1], end[0] - p[0]);
      [-1, 1].forEach(sign => line(end, [end[0] - 4 * Math.cos(a + sign * .45), end[1] - 4 * Math.sin(a + sign * .45)]));
    });
    ctx.globalAlpha = 1;
    query(`cube-${layout.key}-readout`).textContent = `Angle ${fixed(state[1] * degrees)}° · Speed ${fixed(state[2])} rad/s`;
    canvas.dataset.angle = state[1];
    canvas.dataset.speed = state[2];
  }

  function svgNode(tag, attributes, parent, text) {
    const node = document.createElementNS(ns, tag);
    Object.entries(attributes || {}).forEach(([key, value]) => node.setAttribute(key, value));
    if (text !== undefined) node.textContent = text;
    if (parent) parent.append(node);
    return node;
  }
  function range(values, includeZero = true) {
    let low = Math.min(...values), high = Math.max(...values);
    if (includeZero) { low = Math.min(0, low); high = Math.max(0, high); }
    const span = high - low || 1, pad = span * .08;
    return [low - pad, high + pad];
  }
  function tickLabel(value) {
    const rounded = Math.abs(value) < 0.000001 ? 0 : value;
    return Number(rounded.toPrecision(3)).toString();
  }
  function chart(hostId, title, xDomain, yDomain, xLabel, yLabel, height = 270, tickValues = {}) {
    const host = query(hostId), width = Math.max(210, host.clientWidth), left = 47, right = 15, top = 29, bottom = height - 45;
    host.replaceChildren();
    const svg = svgNode("svg", { viewBox: `0 0 ${width} ${height}`, width, height, role: "img", "aria-labelledby": `${hostId}-title ${hostId}-desc` }, host);
    svgNode("title", { id: `${hostId}-title` }, svg, title);
    svgNode("desc", { id: `${hostId}-desc` }, svg, `${data.cases[current].label}. ${xLabel} horizontally; ${yLabel} vertically. Root is a solid blue line with circle markers; side is a dashed orange line with square markers. Current values appear above.`);
    const x = v => left + (v - xDomain[0]) / (xDomain[1] - xDomain[0]) * (width - right - left);
    const y = v => bottom - (v - yDomain[0]) / (yDomain[1] - yDomain[0]) * (bottom - top);
    const ticks = width < 360 ? 3 : 4;
    const xTicks = tickValues.x || Array.from({ length: ticks + 1 }, (_, i) => xDomain[0] + i / ticks * (xDomain[1] - xDomain[0]));
    xTicks.forEach((v, i) => {
      svgNode("line", { x1: x(v), x2: x(v), y1: top, y2: bottom, class: "cube-grid-line" }, svg);
      svgNode("text", { x: x(v), y: bottom + 19, "text-anchor": i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle" }, svg, tickLabel(v));
    });
    const yTicks = tickValues.y || Array.from({ length: 5 }, (_, i) => yDomain[0] + i / 4 * (yDomain[1] - yDomain[0]));
    yTicks.forEach(v => {
      svgNode("line", { x1: left, x2: width - right, y1: y(v), y2: y(v), class: "cube-grid-line" }, svg);
      svgNode("text", { x: left - 7, y: y(v) + 4, "text-anchor": "end" }, svg, tickLabel(v));
    });
    svgNode("rect", { x: left, y: top, width: width - right - left, height: bottom - top, fill: "none", class: "cube-axis-line" }, svg);
    svgNode("text", { x: left, y: 15 }, svg, yLabel);
    svgNode("text", { x: (left + width - right) / 2, y: height - 5, "text-anchor": "middle" }, svg, xLabel);
    if (xDomain[0] < 0 && xDomain[1] > 0) svgNode("line", { x1: x(0), x2: x(0), y1: top, y2: bottom, class: "cube-axis-line" }, svg);
    if (yDomain[0] < 0 && yDomain[1] > 0) svgNode("line", { x1: left, x2: width - right, y1: y(0), y2: y(0), class: "cube-axis-line" }, svg);
    return { svg, x, y, top, bottom };
  }
  function pathData(points, plot, coordinate) {
    return points.map((state, i) => {
      const p = coordinate(state);
      return `${i ? "L" : "M"}${plot.x(p[0]).toFixed(2)},${plot.y(p[1]).toFixed(2)}`;
    }).join(" ");
  }
  function marker(plot, layout, opacity = 1, size = 4.5) {
    return svgNode(layout.key === "root" ? "circle" : "rect", {
      fill: layout.color, stroke: "#fffdf9", "stroke-width": 1.5, opacity,
      ...(layout.key === "root" ? { r: size } : { width: size * 2, height: size * 2 })
    }, plot.svg);
  }
  function placeMarker(node, layout, x, y, size = 4.5) {
    if (layout.key === "root") { node.setAttribute("cx", x); node.setAttribute("cy", y); }
    else { node.setAttribute("x", x - size); node.setAttribute("y", y - size); }
  }
  function makeTracePlot(hostId, title, xDomain, yDomain, xLabel, yLabel, coordinate, height) {
    const plot = chart(hostId, title, xDomain, yDomain, xLabel, yLabel, height);
    plot.coordinate = coordinate;
    plot.series = layouts.map(layout => {
      const trace = data.cases[current].trace[layout.key], attributes = { fill: "none", stroke: layout.color, "stroke-width": 1.6, "stroke-dasharray": layout.dash, "stroke-linejoin": "round" };
      svgNode("path", { ...attributes, opacity: .2, d: pathData(trace, plot, coordinate) }, plot.svg);
      const active = svgNode("path", { ...attributes, "stroke-width": 2.2 }, plot.svg);
      const start = coordinate(trace[0]), startMark = marker(plot, layout, .65, 3);
      placeMarker(startMark, layout, plot.x(start[0]), plot.y(start[1]), 3);
      return { layout, trace, active, dot: marker(plot, layout) };
    });
    if (hostId !== "cube-phase-chart") plot.cursor = svgNode("line", { y1: plot.top, y2: plot.bottom, class: "cube-cursor" }, plot.svg);
    return plot;
  }
  function positiveCrossings(trace) {
    const result = [];
    if (trace[0][1] === 0 && trace[0][2] > 0) result.push({ t: 0, speed: trace[0][2] });
    for (let i = 1; i < trace.length; i++) {
      const a = trace[i - 1], b = trace[i];
      if (a[1] < 0 && b[1] >= 0) {
        const u = -a[1] / (b[1] - a[1]);
        result.push({ t: a[0] + u * (b[0] - a[0]), speed: a[2] + u * (b[2] - a[2]) });
      }
    }
    return result.slice(1).map((event, i) => ({ time: event.t, x: result[i].speed, y: event.speed }));
  }
  function buildReturnPlot() {
    layouts.forEach(layout => { returnEvents[layout.key] = positiveCrossings(data.cases[current].trace[layout.key]); });
    const values = layouts.flatMap(layout => returnEvents[layout.key].flatMap(event => [event.x, event.y]));
    const max = values.length ? Math.max(...values) * 1.08 : 1;
    returnPlot = chart("cube-return-chart", "Successive positive crossings of zero alignment", [0, max], [0, max], "Speed at crossing n (rad/s)", "Speed at next crossing (rad/s)", 280);
    svgNode("line", { x1: returnPlot.x(0), x2: returnPlot.x(max), y1: returnPlot.y(0), y2: returnPlot.y(max), stroke: "#82786a", "stroke-dasharray": "3 4" }, returnPlot.svg);
    returnPlot.dots = [];
    layouts.forEach(layout => {
      returnEvents[layout.key].forEach(event => {
        const dot = marker(returnPlot, layout, .16, 3.5);
        placeMarker(dot, layout, returnPlot.x(event.x), returnPlot.y(event.y), 3.5);
        svgNode("title", {}, dot, `${layout.label}: ${fixed(event.x)} to ${fixed(event.y)} rad/s at ${fixed(event.time, 3)} s`);
        returnPlot.dots.push({ dot, event, layout });
      });
    });
    const absent = layouts.filter(layout => !returnEvents[layout.key].length).map(layout => layout.label.toLowerCase());
    if (!values.length) {
      svgNode("text", { x: returnPlot.x(max / 2), y: 117, "text-anchor": "middle" }, returnPlot.svg, "No positive crossings of 0°");
      svgNode("text", { x: returnPlot.x(max / 2), y: 137, "text-anchor": "middle" }, returnPlot.svg, "in this release.");
    }
    query("cube-return-caption").textContent = "Each point pairs two successive crossings of 0° in the positive direction; below the diagonal means slower on the next pass. Points are estimated by interpolation, not new simulation results." + (absent.length ? ` No crossing pairs occur for ${absent.join(" or ")} in this release.` : "");
  }
  // Read display polylines extracted from Figure 3, not a substitute force law.
  // The independent saved theta(t) remains the sole driver of the moving marker.
  function potentialAt(layout, angle) {
    const points = potentialData[layout];
    if (angle <= points[0][0]) return points[0][1];
    if (angle >= points[points.length - 1][0]) return points[points.length - 1][1];
    let lo = 0, hi = points.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (points[mid][0] <= angle) lo = mid; else hi = mid; }
    const fraction = (angle - points[lo][0]) / (points[hi][0] - points[lo][0]);
    return points[lo][1] + fraction * (points[hi][1] - points[lo][1]);
  }
  function buildWellPlots() {
    wellPlots = [];
    if (!potentialData) {
      layouts.forEach(layout => { query(`cube-well-${layout.key}-chart`).textContent = "The potential curve could not be loaded."; });
      return;
    }
    wellPlots = layouts.map(layout => {
      const plot = chart(`cube-well-${layout.key}-chart`, `${layout.label} magnetic potential well`, [-30, 60], [-.25, 5.15], "Layer angle (°)", "Magnetic potential (mJ)", 205, { x: [-30, 0, 30, 60], y: [0, 1, 2, 3, 4, 5] });
      plot.svg.querySelector("desc").textContent = `${layout.label} potential energy versus layer angle, on the same scale as the other layout. The moving marker follows the selected release. Alignment is at 0 degrees; a shallow extra resting place is at 45 degrees. Current angle and direction appear below.`;
      const guide = svgNode("g", {}, plot.svg);
      const sourcePoints = [[-30, potentialAt(layout.key, -30)], ...potentialData[layout.key].filter(p => p[0] > -30 && p[0] < 60), [60, potentialAt(layout.key, 60)]];
      const d = pathData(sourcePoints, plot, p => p);
      svgNode("path", { d: `${d} L${plot.x(60)},${plot.y(0)} L${plot.x(-30)},${plot.y(0)} Z`, fill: layout.color, opacity: .07 }, guide);
      svgNode("path", { d, fill: "none", stroke: layout.color, "stroke-width": 2.4, "stroke-dasharray": layout.dash, "stroke-linejoin": "round" }, plot.svg);
      for (const angle of [0, 45]) {
        svgNode("line", { x1: plot.x(angle), x2: plot.x(angle), y1: plot.top, y2: plot.bottom, stroke: "#9a9184", "stroke-dasharray": "2 4", opacity: .55 }, plot.svg);
        svgNode("circle", { cx: plot.x(angle), cy: plot.y(potentialAt(layout.key, angle)), r: 3, fill: "#fffdf9", stroke: layout.color, "stroke-width": 1.5 }, plot.svg);
      }
      const guideText = svgNode("text", { x: plot.x(0), y: plot.y(1.05), "text-anchor": "middle" }, plot.svg, "0° alignment");
      guideText.setAttribute("class", "cube-well-label");
      const halfway = svgNode("text", { x: plot.x(45), y: plot.y(3.55), "text-anchor": "end" }, plot.svg, "45° extra rest");
      halfway.setAttribute("class", "cube-well-label");
      const startAngle = data.cases[current].trace[layout.key][0][1] * degrees;
      const start = marker(plot, layout, .35, 4);
      placeMarker(start, layout, plot.x(startAngle), plot.y(potentialAt(layout.key, startAngle)), 4);
      const dot = marker(plot, layout, 1, 7);
      dot.setAttribute("class", "cube-well-marker");
      return { ...plot, layout, dot };
    });
  }
  function buildPlots() {
    if (!mount.isConnected) return;
    const traces = layouts.flatMap(layout => data.cases[current].trace[layout.key]);
    const angles = range(traces.map(p => p[1] * degrees)), speeds = range(traces.map(p => p[2]));
    const duration = data.cases[current].duration;
    plots = [
      makeTracePlot("cube-angle-chart", "Layer angle over time", [0, duration], angles, "Physical time (s)", "Layer angle (°)", p => [p[0], p[1] * degrees], 260),
      makeTracePlot("cube-speed-chart", "Angular speed over time", [0, duration], speeds, "Physical time (s)", "Angular speed (rad/s)", p => [p[0], p[2]], 260),
      makeTracePlot("cube-phase-chart", "Layer angle and angular speed phase space", angles, speeds, "Layer angle (°)", "Angular speed (rad/s)", p => [p[1] * degrees, p[2]], 310)
    ];
    buildReturnPlot();
    buildWellPlots();
    render();
  }
  function render() {
    mount.dataset.case = current; mount.dataset.time = time.toFixed(6); mount.dataset.running = String(running); mount.dataset.view = selectedView;
    controls.time.value = time;
    controls.time.setAttribute("aria-valuetext", `${time.toFixed(3)} of ${data.cases[current].duration.toFixed(1)} seconds`);
    query("cube-clock").textContent = `${time.toFixed(3)} / ${data.cases[current].duration.toFixed(1)} s`;
    layouts.forEach(layout => drawGeometry(layout, sample(data.cases[current].trace[layout.key], time)));
    plots.forEach(plot => {
      plot.series.forEach(series => {
        const state = sample(series.trace, time), elapsed = series.trace.filter(p => p[0] < time);
        elapsed.push(state);
        series.active.setAttribute("d", pathData(elapsed, plot, plot.coordinate));
        const point = plot.coordinate(state);
        placeMarker(series.dot, series.layout, plot.x(point[0]), plot.y(point[1]));
        series.dot.dataset.time = time.toFixed(6);
        series.dot.dataset.angle = state[1]; series.dot.dataset.speed = state[2];
      });
      if (plot.cursor) { plot.cursor.setAttribute("x1", plot.x(time)); plot.cursor.setAttribute("x2", plot.x(time)); }
    });
    if (returnPlot) returnPlot.dots.forEach(({ dot, event }) => dot.setAttribute("opacity", event.time <= time ? 1 : .16));
    wellPlots.forEach(plot => {
      const state = sample(data.cases[current].trace[plot.layout.key], time), angle = state[1] * degrees;
      const potential = potentialAt(plot.layout.key, angle);
      placeMarker(plot.dot, plot.layout, plot.x(angle), plot.y(potential), 7);
      plot.dot.dataset.time = time.toFixed(6);
      plot.dot.dataset.angle = state[1]; plot.dot.dataset.speed = state[2]; plot.dot.dataset.potentialMj = potential;
      const direction = Math.abs(state[2]) < .01 ? "Nearly at rest" : state[2] > 0 ? "Moving right →" : "← Moving left";
      query(`cube-well-${plot.layout.key}-readout`).textContent = `${fixed(angle)}° · ${direction}`;
    });
  }
  function pause() {
    running = false; lastFrame = null;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    controls.play.textContent = "Play"; controls.play.setAttribute("aria-pressed", "false");
    mount.dataset.running = "false";
  }
  function setTime(value, speak = false) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return false;
    pause(); time = Math.max(0, Math.min(data.cases[current].duration, numeric)); render();
    if (speak) announce(`Paused at ${time.toFixed(3)} seconds.`);
    return true;
  }
  function setCase(key, speak = true) {
    if (!Object.prototype.hasOwnProperty.call(data.cases, key)) return false;
    pause(); current = key; time = 0; controls.select.value = key;
    controls.time.max = data.cases[current].duration;
    const initial = layouts.map(layout => {
      const state = data.cases[current].trace[layout.key][0];
      return `${layout.label}: ${fixed(state[1] * degrees, 0)}°, ${fixed(state[2])} rad/s`;
    }).join(". ");
    query("cube-initial").textContent = initial + ".";
    query("cube-case-description").textContent = explanations[key];
    buildPlots();
    if (speak) announce(`${labels[key]}. ${initial}. Playback paused at the start.`);
    return true;
  }
  function frame(timestamp) {
    frameId = 0;
    if (!running) return;
    if (lastFrame !== null) time = Math.min(data.cases[current].duration, time + Math.min((timestamp - lastFrame) / 1000, .08) * Number(controls.speed.value));
    lastFrame = timestamp;
    render();
    if (time >= data.cases[current].duration) { pause(); announce("Release complete. Play to watch again, or choose another starting condition."); }
    else frameId = requestAnimationFrame(frame);
  }
  controls.select.addEventListener("change", () => setCase(controls.select.value));
  controls.time.addEventListener("input", () => setTime(controls.time.value));
  controls.time.addEventListener("change", () => announce(`Paused at ${time.toFixed(3)} seconds.`));
  function togglePlayback() {
    if (running) { pause(); announce("Playback paused."); return; }
    if (time >= data.cases[current].duration) time = 0;
    running = true; lastFrame = null;
    controls.play.textContent = "Pause"; controls.play.setAttribute("aria-pressed", "true");
    mount.dataset.running = "true";
    announce(`Playing at ${controls.speed.value} times real speed.`);
    frameId = requestAnimationFrame(frame);
  }
  controls.play.addEventListener("click", togglePlayback);
  function setView(view) {
    if (!plotViews.some(([key]) => key === view)) return;
    selectedView = view;
    mount.querySelectorAll("[data-cube-view]").forEach(tab => {
      const selected = tab.dataset.cubeView === view;
      tab.setAttribute("aria-selected", String(selected)); tab.tabIndex = selected ? 0 : -1;
      query(`cube-panel-${tab.dataset.cubeView}`).hidden = !selected;
    });
    mount.dataset.view = view;
    query("cube-plot-explanation").textContent = view === "potential" ? "The bowls are display curves recovered from the report figure, with interpolated heights; the markers follow the saved layer motion, not a new ball-on-track simulation." : "Faint paths show the full release; stronger paths and moving markers follow the selected time, using interpolation between the supplied samples.";
    buildPlots();
  }
  mount.querySelectorAll("[data-cube-view]").forEach(tab => {
    tab.addEventListener("click", () => setView(tab.dataset.cubeView));
    tab.addEventListener("keydown", event => {
      const order = plotViews.map(([key]) => key);
      let next = order.indexOf(tab.dataset.cubeView);
      if (event.key === "ArrowRight") next = (next + 1) % order.length;
      else if (event.key === "ArrowLeft") next = (next + order.length - 1) % order.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = order.length - 1;
      else return;
      event.preventDefault(); setView(order[next]); query(`cube-tab-${order[next]}`).focus();
    });
  });
  controls.speed.addEventListener("change", () => { lastFrame = null; announce(`Playback speed ${controls.speed.value} times real speed.`); });
  query("cube-restart").addEventListener("click", () => setTime(0, true));
  document.addEventListener("visibilitychange", () => { if (document.hidden && running) { pause(); announce("Playback paused while the page is hidden."); } });
  if ("IntersectionObserver" in window) new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible && running) { pause(); announce("Playback paused while the explorer is off screen."); }
  }, { threshold: 0 }).observe(mount);
  window.addEventListener("cube:select-case", event => { if (event.detail) setCase(event.detail.key); });
  let lastWidth = 0;
  if ("ResizeObserver" in window) new ResizeObserver(entries => {
    const width = entries[0].contentRect.width;
    if (Math.abs(width - lastWidth) > 1) { lastWidth = width; buildPlots(); }
  }).observe(mount);
  else window.addEventListener("resize", buildPlots);
  setCase(current, false);
  window.CubeNonlinearLab = Object.freeze({
    setCase, setTime,
    getState: () => ({ case: current, time, running, duration: data.cases[current].duration, visible, view: selectedView,
      root: [...sample(data.cases[current].trace.root, time)], side: [...sample(data.cases[current].trace.side, time)],
      returnPairs: { root: returnEvents.root.length, side: returnEvents.side.length } })
  });
})();
