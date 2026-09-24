/* Page-specific plots; the semantic HTML table is the single data source.
 * Rev C pp. 5, 7, 10: same assumed 250 N, different model responses.
 * Metals are analytical only. This is not an experimental validation plot.
 */
(function () {
  "use strict";
  var root = document.querySelector(".pigjaw-project");
  if (!root) return;
  var table = root.querySelector("#pigjaw-displacement-table");
  var plots = root.querySelector(".comparison-plots");
  if (!table || !plots) return;
  var models = Array.from(table.querySelectorAll("tbody tr[data-model]")).map(function (row) {
    var value = row.querySelector(".motion-value").textContent.trim();
    return {
      id: row.dataset.model, name: row.dataset.chartLabel, note: row.dataset.chartNote,
      kind: row.dataset.kind, metal: row.dataset.material === "metal",
      value: Number(value), label: value
    };
  });
  var ns = "http://www.w3.org/2000/svg";
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
  function draw(host, detail) {
    if (!host || !host.clientWidth) return;
    var width = host.clientWidth;
    var small = width < 500;
    var left = small ? 112 : 183, right = small ? 58 : 77;
    var top = detail ? 38 : 58, rowHeight = small ? 62 : 55;
    var data = detail ? models.filter(function (m) { return m.metal; }) : models;
    var bottom = top + data.length * rowHeight, height = bottom + 55;
    var max = detail ? 1 : 150;
    var start = left + 7, end = width - right - 7;
    var x = function (value) { return start + value / max * (end - start); };
    host.replaceChildren();
    var svg = node("svg", {
      width: width, height: height, viewBox: "0 0 " + width + " " + height,
      class: "displacement-chart", role: "img",
      "aria-labelledby": host.id + "-title " + host.id + "-description"
    }, host);
    node("title", { id: host.id + "-title" }, svg,
      detail ? "Analytical metal bridge motion: expanded scale" : "Analytical and FE displacement predictions at 250 newtons");
    node("desc", { id: host.id + "-description" }, svg,
      data.map(function (m) { return m.name + ", " + m.note + ": " + m.label + " micrometers"; }).join(". ") +
      ". Analytical results are bridge-midspan motion, not the FE annular maximum or measured data. Metals are analytical only." +
      (detail ? " Linear axis from 0 to 1 micrometer; the chosen 50 micrometer target is outside this view." :
        " Linear axis from 0 to 150 micrometers. Dashed reference: analyst-chosen 50 micrometer maximum-annular-motion target, not a validated acceptance limit."));
    label(svg, 8, 22, "Material / model");
    label(svg, width - 8, 22, "µm", { "text-anchor": "end" });
    node("rect", { x: left, y: top, width: width - left - right, height: bottom - top, class: "chart-frame" }, svg);
    var ticks = detail ? (small ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]) :
      (small ? [0, 50, 100, 150] : [0, 25, 50, 75, 100, 125, 150]);
    ticks.forEach(function (value) {
      node("line", { x1: x(value), x2: x(value), y1: top, y2: bottom, class: "chart-grid" }, svg);
      label(svg, x(value), bottom + 21, String(value), { "text-anchor": "middle" });
    });
    if (!detail) {
      node("line", { x1: x(50), x2: x(50), y1: top - 8, y2: bottom,
        class: "target-reference", "data-target": "50" }, svg);
      label(svg, x(50) + 4, top - 16, "50 µm target", { class: "chart-note" });
    }
    label(svg, (left + width - right) / 2, height - 7, "Downward motion (µm)", { "text-anchor": "middle" });
    data.forEach(function (model, index) {
      var y = top + (index + 0.5) * rowHeight;
      label(svg, 8, y - 5, model.name);
      label(svg, 8, y + 13, model.note, { class: "chart-note" });
      var attrs = { class: "chart-mark mark-" + model.kind,
        "data-model": model.id, "data-displacement": model.value };
      if (model.kind === "fea") {
        node("rect", Object.assign(attrs, { x: x(model.value) - 4, y: y - 4, width: 8, height: 8 }), svg);
      } else {
        node("circle", Object.assign(attrs, { cx: x(model.value), cy: y, r: 4.5 }), svg);
      }
      label(svg, width - 8, y + 4, model.label, { class: "chart-value", "text-anchor": "end" });
    });
  }
  function drawAll() {
    draw(root.querySelector("#pigjaw-displacement-overview-plot"), false);
    draw(root.querySelector("#pigjaw-metal-detail-plot"), true);
  }
  plots.hidden = false;
  drawAll();
  if ("ResizeObserver" in window) {
    var lastWidth = 0;
    new ResizeObserver(function () {
      if (root.clientWidth !== lastWidth) { lastWidth = root.clientWidth; drawAll(); }
    }).observe(root);
  } else {
    window.addEventListener("resize", drawAll);
  }
})();
