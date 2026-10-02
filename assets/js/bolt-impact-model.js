/* Educational outer-fiber bolt bending model; no DOM or animation state.
 *
 * Part 1 is the unvalidated fixed-stopping-angle estimate of NOMINAL demand:
 *   E_k = I omega^2 / (2 gc), T_peak = 2 E_k / deltaTheta,
 *   sigma_demand = 32 (T_peak / radius) length / (pi diameter^3).
 * Its triangular work diagram is torque versus angular displacement, not
 * torque versus time. Stop work may be elastic storage and/or dissipation.
 * The assumed stopping angle is not measured compliance. No operating-speed
 * recommendation follows from comparing this demand with assumed strength.
 * This is not a contact-dynamics solver or a post-yield equilibrium solution.
 *
 * Part 2 independently prescribes a triangular total strain of demand / E.
 * The resulting small-strain, uniaxial, rate-independent material-point
 * response uses perfect plasticity or illustrative linear kinematic hardening.
 * It demonstrates history, unloading, reverse yielding and hysteresis; it
 * does NOT predict bolt deflection, thermal weakening, fatigue life or damage.
 * Cycles are a playback coordinate, NOT seconds or resolved impact duration.
 *
 * Grade 2 Sy = 57 ksi follows the article's assumption, not a bolt certificate.
 * Inertia and nominal geometry are retained from the original fixture
 * calculation, without independent as-built/inertia verification. E and H are fixed
 * illustrative inputs, not a calibrated cyclic curve for the actual bolts.
 * In uniaxial stress both von Mises and Tresca give |sigma - backstress|.
 * Theory references (not material calibration data):
 * https://doc.comsol.com/6.3/doc/com.comsol.help.sme/sme_ug_theory.06.033.html
 * https://mooseframework.inl.gov/docs/site/source/materials/CombinedNonlinearHardeningPlasticity.html
 * https://doc.comsol.com/6.3/doc/com.comsol.help.fatigue/fatigue_ug_sme.4.21.html
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BoltImpactModel = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const material = Object.freeze({ Sy: 57, E: 29000, H: 290 });
  const geometry = Object.freeze({ inertia: 351.352, gc: 386.09, radius: 3.75 });
  const defaults = Object.freeze({
    omega: 2.0944,
    stopAngle: 10,
    diameter: 0.19,
    length: 2.75,
    cycles: 3,
    loading: "pulsed",
    hardening: "kinematic"
  });
  const samplesPerCycle = 240;

  function finiteNumber(value, fallback, name, minimum, inclusive) {
    const number = value === undefined ? fallback : Number(value);
    if (!Number.isFinite(number) || (inclusive ? number < minimum : number <= minimum)) {
      throw new RangeError(name + " must be finite and " + (inclusive ? "at least " : "greater than ") + minimum + ".");
    }
    return number;
  }

  function normalizeParams(input) {
    const source = input || {};
    const cycles = finiteNumber(source.cycles, defaults.cycles, "cycles", 1, true);
    if (!Number.isInteger(cycles) || cycles > 100) throw new RangeError("cycles must be an integer from 1 to 100.");
    const loading = source.loading === undefined ? defaults.loading : source.loading;
    const hardening = source.hardening === undefined ? defaults.hardening : source.hardening;
    if (loading !== "reversed" && loading !== "pulsed") throw new RangeError("loading must be reversed or pulsed.");
    if (hardening !== "kinematic" && hardening !== "perfect") throw new RangeError("hardening must be kinematic or perfect.");
    return {
      omega: finiteNumber(source.omega, defaults.omega, "omega", 0, true),
      stopAngle: finiteNumber(source.stopAngle, defaults.stopAngle, "stopAngle", 0, false),
      diameter: finiteNumber(source.diameter, defaults.diameter, "diameter", 0, false),
      length: finiteNumber(source.length, defaults.length, "length", 0, false),
      cycles: cycles,
      loading: loading,
      hardening: hardening
    };
  }

  function impactDemand(input) {
    const params = normalizeParams(input);
    const stopAngleRadians = params.stopAngle * Math.PI / 180;
    // Dividing psi by 1000 gives ksi throughout the material-point solver.
    const coefficient = 32 * geometry.inertia * params.length /
      (Math.PI * Math.pow(params.diameter, 3) * stopAngleRadians * geometry.radius * geometry.gc * 1000);
    const energy = 0.5 * geometry.inertia / geometry.gc * params.omega * params.omega;
    const stopTorquePeak = 2 * energy / stopAngleRadians;
    const forcePeak = stopTorquePeak / geometry.radius;
    const peakDemand = coefficient * params.omega * params.omega;
    const yieldOmega = Math.sqrt(material.Sy / coefficient);
    if (![coefficient, energy, stopTorquePeak, forcePeak, peakDemand, yieldOmega].every(Number.isFinite)) {
      throw new RangeError("The requested geometry or speed exceeds the finite range of this model.");
    }
    return {
      interpretation: "Unvalidated fixed-stopping-angle what-if; no operating-speed limit",
      nominalStrengthComparisonOnly: true,
      hardwareValidation: false,
      params: params,
      material: material,
      geometry: Object.freeze({
        inertia: geometry.inertia,
        gc: geometry.gc,
        radius: geometry.radius,
        diameter: params.diameter,
        length: params.length,
        stopAngle: params.stopAngle,
        stopAngleRadians: stopAngleRadians
      }),
      coefficient: coefficient,
      peakDemand: peakDemand,
      peakStrain: peakDemand / material.E,
      // Legacy API names retained for linked views: these are only algebraic
      // nominal-stress/assumed-strength intersections, never safe speed limits.
      yieldOmega: yieldOmega,
      yieldRpm: yieldOmega * 60 / (2 * Math.PI),
      energy: energy,
      stopTorquePeak: stopTorquePeak,
      forcePeak: forcePeak
    };
  }

  function createState() {
    return {
      strain: 0,
      stress: 0,
      elasticStrain: 0,
      plasticStrain: 0,
      backstress: 0,
      effectiveStress: 0,
      accumulatedPlasticStrain: 0,
      plasticIncrement: 0,
      dissipatedEnergyDensity: 0,
      plastic: false
    };
  }

  // Pure backward-Euler return step; input state is never mutated.
  // For scalar Prager hardening a = H epsilon_p:
  //   trial = E (epsilon_new - epsilon_p_old)
  //   deltaGamma = max(0, |trial-a_old|-Sy) / (E+H).
  // Lateral stresses are zero. No constrained lateral-strain assumption is
  // used, so this is the appropriate uniaxial constitutive specialization.
  function returnStep(state, totalStrain, hardening) {
    const previous = state || createState();
    const mode = hardening === undefined ? "kinematic" : hardening;
    if (mode !== "kinematic" && mode !== "perfect") throw new RangeError("Unknown hardening mode.");
    if (!Number.isFinite(totalStrain)) throw new RangeError("totalStrain must be finite.");
    const H = mode === "kinematic" ? material.H : 0;
    const trialStress = material.E * (totalStrain - previous.plasticStrain);
    const relativeTrialStress = trialStress - previous.backstress;
    const excess = Math.abs(relativeTrialStress) - material.Sy;
    const gamma = excess > material.Sy * 1e-12 ? excess / (material.E + H) : 0;
    const plasticIncrement = Math.sign(relativeTrialStress) * gamma;
    const plasticStrain = previous.plasticStrain + plasticIncrement;
    const backstress = previous.backstress + H * plasticIncrement;
    const stress = trialStress - material.E * plasticIncrement;
    const accumulatedPlasticStrain = previous.accumulatedPlasticStrain + gamma;
    return {
      strain: totalStrain,
      stress: stress,
      elasticStrain: stress / material.E,
      plasticStrain: plasticStrain,
      backstress: backstress,
      effectiveStress: stress - backstress,
      accumulatedPlasticStrain: accumulatedPlasticStrain,
      plasticIncrement: plasticIncrement,
      // Work stored in the kinematic hardening spring is excluded. This is
      // plastic dissipation density (ksi), not a fatigue damage measure.
      dissipatedEnergyDensity: material.Sy * accumulatedPlasticStrain,
      plastic: gamma > 0
    };
  }

  function yieldMetrics(principals, backstress) {
    const alpha = backstress || [0, 0, 0];
    const relative = principals.map(function (value, index) { return value - alpha[index]; });
    const a = relative[0] - relative[1];
    const b = relative[1] - relative[2];
    const c = relative[2] - relative[0];
    return {
      vonMises: Math.sqrt((a * a + b * b + c * c) / 2),
      tresca: Math.max.apply(null, relative) - Math.min.apply(null, relative)
    };
  }

  function cycleLoad(fraction, loading) {
    // Includes all turning points exactly with 240 samples per full cycle.
    if (loading === "pulsed") return fraction <= 0.5 ? 2 * fraction : 2 * (1 - fraction);
    if (fraction <= 0.25) return 4 * fraction;
    if (fraction <= 0.75) return 2 - 4 * fraction;
    return 4 * fraction - 4;
  }

  function summarizeCycle(points, first, last, cycle) {
    let minStress = Infinity, maxStress = -Infinity;
    let minStrain = Infinity, maxStrain = -Infinity;
    let minPlasticStrain = Infinity, maxPlasticStrain = -Infinity;
    let plasticSteps = 0;
    for (let index = first; index <= last; index += 1) {
      const point = points[index];
      minStress = Math.min(minStress, point.stress);
      maxStress = Math.max(maxStress, point.stress);
      minStrain = Math.min(minStrain, point.strain);
      maxStrain = Math.max(maxStrain, point.strain);
      minPlasticStrain = Math.min(minPlasticStrain, point.plasticStrain);
      maxPlasticStrain = Math.max(maxPlasticStrain, point.plasticStrain);
      if (index > first && point.plastic) plasticSteps += 1;
    }
    const accumulatedPlasticStrain = points[last].accumulatedPlasticStrain - points[first].accumulatedPlasticStrain;
    return {
      cycle: cycle,
      minStress: minStress,
      maxStress: maxStress,
      amplitude: (maxStress - minStress) / 2,
      mean: (maxStress + minStress) / 2,
      minStrain: minStrain,
      maxStrain: maxStrain,
      strainAmplitude: (maxStrain - minStrain) / 2,
      minPlasticStrain: minPlasticStrain,
      maxPlasticStrain: maxPlasticStrain,
      plasticRange: maxPlasticStrain - minPlasticStrain,
      accumulatedPlasticStrain: accumulatedPlasticStrain,
      dissipatedEnergyDensity: material.Sy * accumulatedPlasticStrain,
      residualStressAtZeroStrain: points[last].stress,
      plasticSteps: plasticSteps
    };
  }

  function simulate(input) {
    const result = impactDemand(input);
    const params = result.params;
    let state = createState();
    const points = [Object.assign({ index: 0, cycle: 0, load: 0, demand: 0 }, state)];
    const cycleStats = [];
    for (let cycle = 0; cycle < params.cycles; cycle += 1) {
      const first = points.length - 1;
      for (let step = 1; step <= samplesPerCycle; step += 1) {
        const fraction = step / samplesPerCycle;
        const load = cycleLoad(fraction, params.loading);
        state = returnStep(state, result.peakStrain * load, params.hardening);
        points.push(Object.assign({
          index: points.length,
          cycle: cycle + fraction,
          load: load,
          demand: result.peakDemand * load
        }, state));
      }
      cycleStats.push(summarizeCycle(points, first, points.length - 1, cycle + 1));
    }
    return Object.assign(result, {
      samplesPerCycle: samplesPerCycle,
      points: points,
      cycleStats: cycleStats
    });
  }

  return Object.freeze({
    defaults: defaults,
    material: material,
    geometry: geometry,
    samplesPerCycle: samplesPerCycle,
    normalizeParams: normalizeParams,
    impactDemand: impactDemand,
    createState: createState,
    returnStep: returnStep,
    yieldMetrics: yieldMetrics,
    simulate: simulate
  });
});
