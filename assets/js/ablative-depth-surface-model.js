/* Partly calibrated shared depth surface, NOT a validated ablation law.
 * Linear flux dependence is chosen; the time exponent passes through one
 * approximate measured hot-run depth and one still-assumed baseline depth.
 * No thermocouple temperatures, conductivity, or heat capacity are fitted.
 * Color converts depth using assumed diameter/shape and conditional bulk
 * density from the hot brick, transferred across the surface. It is not the
 * reported whole-brick net mass loss or an independent mass prediction.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AblativeDepthSurfaceModel = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const density = 0.0828 / (0.0508 * 0.0889 * 0.0127);
  const diameterMM = 20, shapeFactor = 0.5;
  // kg/m³ × projected area in m² × depth in mm gives mass in grams.
  const massPerMM = density * shapeFactor * Math.PI * (diameterMM / 1000) ** 2 / 4;
  const constants = Object.freeze({ timeMax: 20, fluxMax: 0.8, depthMax: 12,
    massMax: 2.4, density, diameterMM, shapeFactor, thicknessMM: 12.7, massPerMM });
  const evidence = Object.freeze({
    hotInitialMassG: 82.8, hotFinalMassG: 73.9, hotNetMassLossG: 8.9,
    densityStatus: "Conditional on the weighed hot brick having nominal 2 × 3.5 × 0.5 in dimensions; transfer across the surface is assumed.",
    dimpleGeometryStatus: "20 mm diameter and paraboloid shape remain assumptions.",
    hotDepthSource: "User-confirmed measured dimple depth, reported approximately as 1/8 in; conversion digits are not measurement precision."
  });
  const points = Object.freeze([
    Object.freeze({ id: "baseline", time: 20, flux: 0.2592, depth: 3, mass: 3 * massPerMM, measured: false, approximate: false, depthSource: "assumed", label: "Baseline · assumed 3 mm" }),
    Object.freeze({ id: "hot", time: 10, flux: 0.5844, depth: 0.125 * 25.4, mass: 0.125 * 25.4 * massPerMM, measured: true, approximate: true, depthSource: "user-confirmed measurement, approximately 1/8 in", label: "Hot · measured ≈3.2 mm" })
  ]);
  const [baseline, hot] = points;
  // Two anchors do not identify a general two-input response. Fixing the flux
  // exponent at 1 is an extra assumption, not a result of either torch test.
  const fit = Object.freeze({ id: "shared-power-law", fluxExponent: 1,
    referenceTime: baseline.time, referenceFlux: baseline.flux, referenceDepth: baseline.depth,
    timeExponent: Math.log((hot.depth / baseline.depth) / (hot.flux / baseline.flux)) / Math.log(hot.time / baseline.time),
    classification: "partly-calibrated-not-validated", measuredDepthAnchorCount: 1, assumedDepthAnchorCount: 1,
    thermocoupleFit: false, validated: false });
  function coordinate(value, max, label) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) {
      throw new RangeError(`${label} must be finite and within 0–${max}.`);
    }
    return value;
  }
  function evaluate(time, flux) {
    coordinate(time, constants.timeMax, "Time (s)");
    coordinate(flux, constants.fluxMax, "Reference flux (MW/m²)");
    const dose = time * flux; // MW/m² × s = MJ/m².
    const depth = fit.referenceDepth * (flux / fit.referenceFlux) * (time / fit.referenceTime) ** fit.timeExponent;
    return Object.freeze({ time, flux, dose, depth, mass: depth * massPerMM });
  }
  function contour(mass, steps = 100) {
    coordinate(mass, constants.massMax, "Equivalent mass (g)");
    if (!Number.isInteger(steps) || steps < 2 || steps > 1000) throw new RangeError("Contour steps must be an integer from 2 to 1000.");
    if (mass === 0) return [evaluate(0, constants.fluxMax), evaluate(0, 0), evaluate(constants.timeMax, 0)];
    const depth = mass / massPerMM;
    const minTime = fit.referenceTime * (fit.referenceFlux * depth / (fit.referenceDepth * constants.fluxMax)) ** (1 / fit.timeExponent);
    if (minTime > constants.timeMax) return [];
    return Array.from({ length: steps + 1 }, (_, i) => {
      const time = minTime + (constants.timeMax - minTime) * i / steps;
      return evaluate(time, Math.min(constants.fluxMax, fit.referenceFlux * (depth / fit.referenceDepth) * (fit.referenceTime / time) ** fit.timeExponent));
    });
  }
  return Object.freeze({ constants, evidence, fit, points, evaluate, contour });
});
