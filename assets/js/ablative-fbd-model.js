/* Idealized rigid-rotor drive followed by the FIRST compression of a linear
 * torsional stop. This is an educational analytical profile, not a calibrated
 * impact solver, a contact-time prediction, or an energy-dissipation model.
 *
 * Units: angles in the input are degrees; returned angles are radians, time
 * seconds, speed rad/s, force lbf, torque/energy lbf in, stress ksi. The mass
 * moment of inertia (lbm in^2) is divided by gc to obtain consistent inertia J.
 * Pull radius = 5 in is an assumed, tunable input, not a measured dimension.
 *
 * driveMode 'accelerated' (default): constant tangential cable force accelerates
 * the rotor from rest through the travel angle; at contact the cable releases.
 * driveMode 'steady': the rotor starts already moving at omega and travels at
 * constant speed. Friction is ignored, so no drive torque/pull is required;
 * the earlier spin-up is outside this profile. A zero-speed input rests in both
 * modes. Both modes retain the pre-contact phase name 'pull' for compatibility.
 * With the same contact speed and stop angle, both modes have identical stop
 * loads, stored energy, and first-compression duration. During compression:
 *   k = J omega^2 / deltaTheta^2
 *   delta(tau) = deltaTheta sin(omega tau / deltaTheta)
 *   speed(tau) = omega cos(omega tau / deltaTheta)
 * Thus kinetic energy + stored stop energy is conserved. Playback ends at the
 * first maximum compression, BEFORE rebound; 'held' is that frozen snapshot,
 * not a prediction that the rotor remains in equilibrium at the endpoint.
 * The stiffness is recomputed for each chosen speed and stop angle. This
 * retains the fixed-angle what-if law, NOT a sweep of one physical fixed
 * stiffness. Its torque-displacement curve is linear; torque-time is not.
 * No material certificate, measured compliance, or operating speed is supplied.
 *
 * Bolt stress is nominal elastic cantilever demand: 32 F L / (pi d^3).
 * Results above Sy are explicitly elastic extrapolation, not post-yield stress.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AblativeFBDModel = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const constants = Object.freeze({
    inertia: 351.352,
    gc: 386.09,
    contactRadius: 3.75,
    boltDiameter: 0.19,
    boltLength: 2.75,
    yieldStress: 57,
    J: 351.352 / 386.09
  });
  const defaults = Object.freeze({ omega: 2.1, stopAngle: 10, travelAngle: 90, pullRadius: 5, driveMode: "accelerated" });
  const derivedResults = new WeakSet();

  function finiteNumber(value, fallback, name, allowZero) {
    const number = value === undefined ? fallback : Number(value);
    if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0)) {
      throw new RangeError(name + " must be finite and " + (allowZero ? "nonnegative." : "positive."));
    }
    return number;
  }

  function normalizeParams(input) {
    const source = input || {};
    const driveMode = source.driveMode === undefined ? defaults.driveMode : source.driveMode;
    if (driveMode !== "accelerated" && driveMode !== "steady") {
      throw new RangeError("driveMode must be 'accelerated' or 'steady'.");
    }
    return Object.freeze({
      omega: finiteNumber(source.omega, defaults.omega, "omega", true),
      stopAngle: finiteNumber(source.stopAngle, defaults.stopAngle, "stopAngle", false),
      travelAngle: finiteNumber(source.travelAngle, defaults.travelAngle, "travelAngle", false),
      pullRadius: finiteNumber(source.pullRadius, defaults.pullRadius, "pullRadius", false),
      driveMode: driveMode
    });
  }

  function derive(input) {
    if (input && derivedResults.has(input)) return input;
    const params = normalizeParams(input);
    const stopAngleRadians = params.stopAngle * Math.PI / 180;
    const travelAngleRadians = params.travelAngle * Math.PI / 180;
    const energy = 0.5 * constants.J * params.omega * params.omega;
    const steady = params.driveMode === "steady";
    const angularAcceleration = steady ? 0 : params.omega * params.omega / (2 * travelAngleRadians);
    const driveTorque = constants.J * angularAcceleration;
    const pullForce = driveTorque / params.pullRadius;
    const driveTime = params.omega === 0 ? 0 : (steady ? 1 : 2) * travelAngleRadians / params.omega;
    const stopTime = params.omega === 0 ? 0 : Math.PI * stopAngleRadians / (2 * params.omega);
    const duration = driveTime + stopTime;
    const angularFrequency = params.omega / stopAngleRadians;
    const stiffness = constants.J * angularFrequency * angularFrequency;
    const stopTorquePeak = stiffness * stopAngleRadians;
    const stopForcePeak = stopTorquePeak / constants.contactRadius;
    const stressPerForce = 32 * constants.boltLength / (Math.PI * Math.pow(constants.boltDiameter, 3)) / 1000;
    const peakStress = stressPerForce * stopForcePeak;
    const aboveYield = peakStress > constants.yieldStress;
    const numbers = [stopAngleRadians, travelAngleRadians, energy, angularAcceleration, driveTorque,
      pullForce, driveTime, stopTime, duration, angularFrequency, stiffness, stopTorquePeak, stopForcePeak, peakStress];
    if (!numbers.every(Number.isFinite) || stopAngleRadians === 0 || travelAngleRadians === 0) {
      throw new RangeError("The requested angles or speed exceed the finite range of this model.");
    }
    const result = Object.freeze({
      interpretation: "Unvalidated fixed-stopping-angle what-if",
      stiffnessInterpretation: "Recomputed per selection; not calibrated fixed hardware stiffness",
      hardwareValidation: false,
      params: params,
      constants: constants,
      J: constants.J,
      stopAngleRadians: stopAngleRadians,
      travelAngleRadians: travelAngleRadians,
      angularAcceleration: angularAcceleration,
      angularFrequency: angularFrequency,
      driveTime: driveTime,
      stopTime: stopTime,
      duration: duration,
      energy: energy,
      driveTorque: driveTorque,
      pullForce: pullForce,
      stiffness: stiffness,
      stopTorquePeak: stopTorquePeak,
      stopForcePeak: stopForcePeak,
      peakStress: peakStress,
      stressPerForce: stressPerForce,
      aboveYield: aboveYield,
      stressInterpretation: aboveYield ? "Elastic extrapolation above yield" : "Nominal elastic bending demand",
      pullRadiusAssumed: true
    });
    derivedResults.add(result);
    return result;
  }

  function sample(input, timeSeconds) {
    const model = derive(input);
    const requestedTime = timeSeconds === undefined ? 0 : Number(timeSeconds);
    if (!Number.isFinite(requestedTime)) throw new RangeError("timeSeconds must be finite.");
    const t = Math.max(0, Math.min(model.duration, requestedTime));
    let phase = "rest";
    let angle = 0;
    let compression = 0;
    let speed = 0;
    let pullForce = 0;
    let stopForce = 0;
    let torque = 0;
    let acceleration = 0;
    let stopEnergy = 0;
    let kineticEnergy = 0;

    if (model.params.omega > 0 && t < model.driveTime) {
      phase = "pull";
      acceleration = model.angularAcceleration;
      const steady = model.params.driveMode === "steady";
      angle = steady ? model.params.omega * t : 0.5 * acceleration * t * t;
      speed = steady ? model.params.omega : acceleration * t;
      pullForce = model.pullForce;
      torque = model.driveTorque;
      kineticEnergy = 0.5 * model.J * speed * speed;
    } else if (model.params.omega > 0) {
      const atEnd = t >= model.duration;
      const stopPhase = Math.max(0, Math.min(Math.PI / 2, model.angularFrequency * (t - model.driveTime)));
      phase = atEnd ? "held" : "stop";
      // Set the endpoint exactly, avoiding a tiny nonzero cos(pi / 2).
      compression = atEnd ? model.stopAngleRadians : model.stopAngleRadians * Math.sin(stopPhase);
      speed = atEnd ? 0 : model.params.omega * Math.cos(stopPhase);
      angle = model.travelAngleRadians + compression;
      torque = -model.stiffness * compression;
      stopForce = -torque / constants.contactRadius;
      acceleration = torque / model.J;
      kineticEnergy = 0.5 * model.J * speed * speed;
      stopEnergy = 0.5 * model.stiffness * compression * compression;
    }

    const stress = stopForce * model.stressPerForce;
    return Object.freeze({
      phase: phase,
      t: t,
      angle: angle,
      compression: compression,
      speed: speed,
      acceleration: acceleration,
      pullForce: pullForce,
      stopForce: stopForce,
      torque: torque,
      stopTorque: Math.abs(Math.min(0, torque)),
      kineticEnergy: kineticEnergy,
      stopEnergy: stopEnergy,
      stress: stress,
      aboveYield: stress > constants.yieldStress,
      stressInterpretation: stress > constants.yieldStress ? "Elastic extrapolation above yield" : "Nominal elastic bending demand"
    });
  }

  // Invert the same monotonic pull/first-compression trajectory for direct
  // manipulation. Dragging changes the shared model time, not the applied
  // loading law; angles outside the modeled motion stop at its endpoints.
  function timeAtAngle(input, angleRadians) {
    const model = derive(input);
    const requestedAngle = Number(angleRadians);
    if (!Number.isFinite(requestedAngle)) throw new RangeError("angleRadians must be finite.");
    if (model.params.omega === 0 || requestedAngle <= 0) return 0;
    const endAngle = model.travelAngleRadians + model.stopAngleRadians;
    if (requestedAngle >= endAngle) return model.duration;
    if (requestedAngle === model.travelAngleRadians) return model.driveTime;
    if (requestedAngle < model.travelAngleRadians) {
      if (model.params.driveMode === "steady") return requestedAngle / model.params.omega;
      return Math.sqrt(2 * requestedAngle / model.angularAcceleration);
    }
    const compressionFraction = (requestedAngle - model.travelAngleRadians) / model.stopAngleRadians;
    return model.driveTime + Math.asin(Math.max(0, Math.min(1, compressionFraction))) / model.angularFrequency;
  }

  return Object.freeze({ constants: constants, defaults: defaults, normalizeParams: normalizeParams, derive: derive, sample: sample, timeAtAngle: timeAtAngle });
});
