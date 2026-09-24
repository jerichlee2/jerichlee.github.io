/* Page-specific, dependency-free plots. Values match the accompanying table.
 * Sources: final report Fig. 9, Fig. 21 and Table 5; Rev B pp. 6, 8, 16.
 * Fig. 9 Y-panel calibration in the unchanged 1190 x 754 source raster:
 * x=77..1153 is 0..120 s; y=277..445 is 500..0 Hz (linear axes).
 */
(function () {
  "use strict";
  var root = document.querySelector(".spindle-project");
  if (!root) return;
  var ns = "http://www.w3.org/2000/svg";
  var models = [
    { id: "observed", name: "Unloaded band", note: "250–3000 rpm", value: 310, label: "≈310", kind: "observed" },
    { id: "baseline", name: "Baseline FEA", note: "3000 rpm", value: 307.17, label: "307.17", kind: "fea", dash: "8 4" },
    { id: "modified", name: "Modified FEA", note: "Proposed “2x” case", value: 383.27, label: "383.27", kind: "modified", dash: "3 4" },
    { id: "rayleigh", name: "Rayleigh", note: "Nonrotating", value: 336.8, label: "336.8", kind: "math", dash: "" },
    { id: "zero", name: "Rotary inertia", note: "Zero-spin baseline", value: 334.43, label: "334.43", kind: "math", dash: "2 3" },
    { id: "backward", name: "Backward whirl", note: "3000 rpm", value: 333.73, label: "333.73", kind: "math", dash: "10 3 2 3" },
    { id: "forward", name: "Forward whirl", note: "3000 rpm", value: 335.13, label: "335.13", kind: "math", dash: "5 3" }
  ];
  function node(tag, attrs, parent, text) {
    var element = document.createElementNS(ns, tag);
    Object.keys(attrs || {}).forEach(function (key) { element.setAttribute(key, attrs[key]); });
    if (text !== undefined) element.textContent = text;
    if (parent) parent.appendChild(element);
    return element;
  }
  function label(svg, x, y, text, attrs) {
    return node("text", Object.assign({ x: x, y: y }, attrs || {}), svg, text);
  }
  function makeSVG(host, width, height, title, description) {
    host.replaceChildren();
    var svg = node("svg", {
      viewBox: "0 0 " + width + " " + height,
      width: width, height: height, role: "img", class: "spindle-chart",
      "aria-labelledby": host.id + "-title " + host.id + "-description"
    }, host);
    node("title", { id: host.id + "-title" }, svg, title);
    node("desc", { id: host.id + "-description" }, svg, description);
    return svg;
  }
  function drawDots(host, detail) {
    var width = host.clientWidth;
    if (!width) return;
    var small = width < 500;
    var left = small ? 113 : 182, right = small ? 57 : 77;
    var top = 38, rowHeight = small ? 57 : 49;
    var data = detail ? models.filter(function (m) { return m.kind === "math"; }) :
      models.filter(function (m) { return m.id !== "modified"; }).concat(
        models.filter(function (m) { return m.id === "modified"; }));
    var bottom = top + data.length * rowHeight, height = bottom + 53;
    var domain = detail ? [333, 338] : [290, 400];
    var start = left + 7, end = width - right - 7;
    var x = function (v) { return start + (v - domain[0]) / (domain[1] - domain[0]) * (end - start); };
    var svg = makeSVG(host, width, height,
      detail ? "Local mathematical models: expanded frequency scale" : "Observed band and first-frequency model estimates",
      data.map(function (m) { return m.name + ", " + m.note + ": " + m.label + " Hz"; }).join(". ") +
      ". Distinct models and configurations; the observed band is approximate. Higher modes are not included." +
      (detail ? "" : " The highlighted final row is the proposed modified FEA: a 24.8% increase over baseline, not a measured post-modification result."));
    if (!detail) {
      node("rect", { x: 0.5, y: top + (data.length - 1) * rowHeight + 0.5,
        width: width - 1, height: rowHeight - 1, rx: 3,
        class: "chart-row-highlight", "data-model": "modified", "aria-hidden": "true" }, svg);
    }
    node("rect", { x: left, y: top, width: width - left - right, height: bottom - top, class: "chart-frame" }, svg);
    var ticks = detail ? (small ? [333, 335, 338] : [333, 334, 335, 336, 337, 338]) :
      (small ? [300, 350, 400] : [300, 320, 340, 360, 380, 400]);
    ticks.forEach(function (t) {
      node("line", { x1: x(t), x2: x(t), y1: top, y2: bottom, class: "chart-grid" }, svg);
      label(svg, x(t), bottom + 21, String(t), { "text-anchor": "middle" });
    });
    label(svg, 8, 22, "Test / model");
    label(svg, width - 8, 22, "Hz", { "text-anchor": "end" });
    label(svg, (left + width - right) / 2, height - 7, "Frequency (Hz)", { "text-anchor": "middle" });
    if (!detail) node("line", { x1: x(310), x2: x(310), y1: top, y2: bottom, class: "observed-reference" }, svg);
    data.forEach(function (m, i) {
      var y = top + rowHeight * (i + 0.5);
      var emphasized = !detail && m.id === "modified";
      label(svg, 8, y - 5, m.name, emphasized ? { class: "chart-highlight-label" } : {});
      label(svg, 8, y + 13, m.note, { class: "chart-note" });
      var attrs = { class: "chart-mark mark-" + m.kind, "data-model": m.id, "data-frequency": m.value };
      if (m.kind === "fea" || m.kind === "modified") {
        node("rect", Object.assign(attrs, { x: x(m.value) - 4, y: y - 4, width: 8, height: 8 }), svg);
      } else {
        node("circle", Object.assign(attrs, { cx: x(m.value), cy: y, r: 4.5 }), svg);
      }
      label(svg, width - 8, y + 4, m.label, { "text-anchor": "end", class: "chart-value" + (emphasized ? " chart-highlight-label" : "") });
    });
  }
  var overlayHost = root.querySelector("#spindle-wavelet-plot");
  var controls = root.querySelector("#spindle-wavelet-controls");
  var status = root.querySelector("#spindle-wavelet-status");
  function drawOverlay() {
    if (!overlayHost) return;
    var width = overlayHost.clientWidth;
    if (!width) return;
    var small = width < 500;
    var left = 48, right = 12, top = 28, plotHeight = small ? 224 : 270;
    var plotWidth = width - left - right, bottom = top + plotHeight, height = bottom + 62;
    var selected = Array.from(controls.querySelectorAll("input:checked")).map(function (input) {
      return models.find(function (model) { return model.id === input.value; });
    });
    var svg = makeSVG(overlayHost, width, height, "Unloaded Y-direction wavelet with model frequency references",
      "Measured raster from final report Figure 9. Linear frequency axis from 0 to 500 Hz. Twelve separate ten-second tests at 250-rpm increments from 250 to 3000 rpm, stitched in time. " +
      selected.map(function (m) { return m.name + ": constant reference at " + m.label + " Hz"; }).join(". ") +
      ". Reference lines are not predictions following the speed sweep. Modified FEA is a proposed-design comparison, not modified-spindle test data.");
    var x = function (t) { return left + plotWidth * t / 120; };
    var y = function (f) { return bottom - plotHeight * f / 500; };
    // Reframe only the Y data field. The full, unchanged raster remains linked.
    // Axes are redrawn outside this viewport; no pixel values are synthesized.
    var viewport = node("svg", { x: left, y: top, width: plotWidth, height: plotHeight,
      viewBox: "77 277 1076 168", preserveAspectRatio: "none", overflow: "hidden" }, svg);
    node("image", { href: overlayHost.dataset.source, width: 1190, height: 754 }, viewport);
    node("rect", { x: left, y: top, width: plotWidth, height: plotHeight, class: "chart-frame" }, svg);
    [0, 100, 200, 300, 400, 500].forEach(function (f) {
      node("line", { x1: left - 4, x2: left, y1: y(f), y2: y(f), class: "chart-axis" }, svg);
      label(svg, left - 8, y(f) + 4, String(f), { "text-anchor": "end" });
    });
    (small ? [0, 40, 80, 120] : [0, 20, 40, 60, 80, 100, 120]).forEach(function (t) {
      label(svg, x(t), bottom + 20, String(t), { "text-anchor": t === 0 ? "start" : t === 120 ? "end" : "middle" });
    });
    label(svg, left, 15, "Frequency (Hz)");
    label(svg, left + plotWidth / 2, height - 19, "Stitched record time (s)", { "text-anchor": "middle" });
    selected.forEach(function (m) {
      node("line", { x1: left, x2: width - right, y1: y(m.value), y2: y(m.value),
        class: "model-reference reference-" + m.kind, "stroke-dasharray": m.dash,
        "data-model": m.id, "data-frequency": m.value }, svg);
    });
  }
  var overview = root.querySelector("#spindle-frequency-overview-plot");
  var detail = root.querySelector("#spindle-frequency-detail-plot");
  function drawAll() {
    if (overview) drawDots(overview, false);
    if (detail) drawDots(detail, true);
    drawOverlay();
  }
  if (controls && overlayHost) {
    controls.hidden = false;
    status.hidden = false;
    controls.addEventListener("change", function () {
      drawOverlay();
      var selected = Array.from(controls.querySelectorAll("input:checked"));
      status.textContent = selected.length ? selected.length + " model reference lines shown." : "Measured wavelet only; no model reference lines shown.";
    });
  }
  drawAll();
  if ("ResizeObserver" in window) {
    var lastWidth = 0;
    new ResizeObserver(function () {
      var width = root.clientWidth;
      if (width !== lastWidth) { lastWidth = width; drawAll(); }
    }).observe(root);
  } else {
    window.addEventListener("resize", drawAll);
  }
})();
