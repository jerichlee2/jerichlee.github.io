"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const modelPath = path.resolve(__dirname, "../../assets/js/ablative-fbd-model.js");
const model = require(modelPath);
const boltModel = require(path.resolve(__dirname, "../../assets/js/bolt-impact-model.js"));
const close = (actual, expected, label, tolerance = 1e-10) => {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    `${label}: ${actual} != ${expected}`);
};

const d = model.derive();
assert.deepEqual(d.params, { omega: 2.1, stopAngle: 10, travelAngle: 90, pullRadius: 5, driveMode: "accelerated" });
assert.equal(model.defaults.driveMode, "accelerated");
assert.deepEqual(model.derive({ driveMode: "accelerated" }).params, d.params);
assert.equal(d.pullRadiusAssumed, true);
assert.equal(model.derive(d), d);
close(d.driveTime, 2 * d.travelAngleRadians / 2.1, "drive duration");
close(d.stopTime, Math.PI * d.stopAngleRadians / 4.2, "first-compression duration");
close(d.energy, model.constants.inertia / model.constants.gc * 2.1 ** 2 / 2, "energy");
close(d.stopTorquePeak * d.stopAngleRadians / 2, d.energy, "linear stop work");
close(d.driveTorque * d.travelAngleRadians, d.energy, "constant pull work");
close(d.pullForce * d.params.pullRadius, d.driveTorque, "pull lever arm");
close(d.stopForcePeak * model.constants.contactRadius, d.stopTorquePeak, "stop lever arm");
const boltDemand = boltModel.impactDemand({ omega: d.params.omega, stopAngle: d.params.stopAngle,
  diameter: model.constants.boltDiameter, length: model.constants.boltLength });
close(d.energy, boltDemand.energy, "existing bolt model energy parity");
close(d.stopTorquePeak, boltDemand.stopTorquePeak, "existing bolt model peak torque parity");
close(d.stopForcePeak, boltDemand.forcePeak, "existing bolt model peak force parity");
close(d.peakStress, boltDemand.peakDemand, "existing bolt model peak elastic demand parity");

const start = model.sample(d, 0);
assert.equal(start.phase, "pull");
assert.equal(start.speed, 0);
assert.equal(start.angle, 0);
assert.equal(start.stopForce, 0);
const halfPull = model.sample(d, d.driveTime / 2);
close(halfPull.speed, d.params.omega / 2, "half pull speed");
close(halfPull.angle, d.travelAngleRadians / 4, "half pull angle");
const contact = model.sample(d, d.driveTime);
assert.equal(contact.phase, "stop");
assert.equal(contact.pullForce, 0);
assert.equal(contact.compression, 0);
close(contact.angle, d.travelAngleRadians, "contact angle");
close(contact.speed, d.params.omega, "contact speed");

let previousCompression = 0;
let previousSpeed = d.params.omega;
for (let step = 0; step <= 1000; step++) {
  const s = model.sample(d, d.driveTime + d.stopTime * step / 1000);
  close(s.kineticEnergy + s.stopEnergy, d.energy, `energy conservation ${step}`);
  assert.equal(s.pullForce, 0);
  assert.ok(s.compression >= previousCompression - 1e-13);
  assert.ok(s.speed <= previousSpeed + 1e-13);
  assert.ok(s.speed >= 0);
  close(s.torque, -s.stopForce * model.constants.contactRadius, "signed stop torque");
  previousCompression = s.compression;
  previousSpeed = s.speed;
}
const end = model.sample(d, d.duration);
assert.equal(end.phase, "held");
assert.equal(end.speed, 0);
close(end.compression, d.stopAngleRadians, "endpoint compression");
close(end.stress, d.peakStress, "endpoint peak stress");
close(end.stopEnergy, d.energy, "all energy stored, not dissipated");
assert.deepEqual(model.sample(d, d.duration + 100), end);
assert.deepEqual(model.sample(d, -10), start);
assert.deepEqual(model.sample(d.params, d.duration), end);

const steady = model.derive({ driveMode: "steady" });
assert.equal(steady.params.driveMode, "steady");
assert.equal(model.derive(steady), steady);
close(steady.driveTime, steady.travelAngleRadians / steady.params.omega, "steady travel duration");
close(steady.driveTime, d.driveTime / 2, "steady travel takes half the from-rest time");
for (const name of ["angularAcceleration", "driveTorque", "pullForce"]) assert.equal(steady[name], 0);
for (const name of ["stopTime", "angularFrequency", "stiffness", "energy", "stopTorquePeak", "stopForcePeak", "peakStress", "aboveYield"]) {
  assert.equal(steady[name], d[name], `${name} must not depend on drive mode`);
}
for (let step = 0; step < 1000; step++) {
  const time = steady.driveTime * step / 1000;
  const state = model.sample(steady, time);
  assert.equal(state.phase, "pull");
  assert.equal(state.speed, steady.params.omega);
  close(state.angle, steady.params.omega * time, "steady angle is linear in time");
  close(state.kineticEnergy, steady.energy, "steady pre-contact kinetic energy");
  for (const name of ["acceleration", "pullForce", "torque", "stopForce", "stopEnergy", "compression"]) assert.equal(state[name], 0);
}
assert.deepEqual(model.sample(steady, -10), model.sample(steady, 0));
assert.equal(model.sample(steady, steady.driveTime).phase, "stop");
assert.equal(model.sample(steady, steady.duration).phase, "held");
assert.deepEqual(model.sample(steady, steady.duration + 100), model.sample(steady, steady.duration));
assert.deepEqual(model.sample(steady.params, steady.duration), model.sample(steady, steady.duration));
for (let step = 0; step <= 1000; step++) {
  const acceleratedState = model.sample(d, d.driveTime + d.stopTime * step / 1000);
  const steadyState = model.sample(steady, steady.driveTime + steady.stopTime * step / 1000);
  assert.equal(steadyState.phase, acceleratedState.phase);
  for (const name of ["angle", "compression", "speed", "acceleration", "pullForce", "stopForce", "torque", "stress", "kineticEnergy", "stopEnergy"]) {
    close(steadyState[name], acceleratedState[name], `${name} matches for the same stop progression`);
  }
  close(steadyState.kineticEnergy + steadyState.stopEnergy, steady.energy, "steady stop energy conservation");
}
for (const run of [d, steady]) {
  const epsilon = run.stopTime * 1e-8;
  const beforeContact = model.sample(run, run.driveTime - epsilon);
  const atContact = model.sample(run, run.driveTime);
  const afterContact = model.sample(run, run.driveTime + epsilon);
  for (const name of ["angle", "speed", "kineticEnergy"]) {
    close(beforeContact[name], atContact[name], `${run.params.driveMode} ${name} continuous into contact`, 1e-7);
    close(afterContact[name], atContact[name], `${run.params.driveMode} ${name} continuous after contact`, 1e-7);
  }
}
// The slider's preserved 2.1 rad/s default is approximately 20 rpm. Exact
// 20 rpm gives a 0.75 s steady quarter-turn (1.5 s when accelerated from rest).
const twentyRpm = 20 * 2 * Math.PI / 60;
close(model.derive({ driveMode: "steady", omega: twentyRpm }).driveTime, 0.75, "exact 20 rpm steady quarter-turn");
close(model.derive({ driveMode: "accelerated", omega: twentyRpm }).driveTime, 1.5, "exact 20 rpm accelerated quarter-turn");
for (const driveMode of ["accelerated", "steady"]) {
  const rest = model.derive({ omega: 0, driveMode });
  for (const name of ["duration", "driveTime", "stopTime", "angularAcceleration", "driveTorque", "pullForce", "energy", "stiffness", "stopForcePeak", "peakStress"]) assert.equal(rest[name], 0);
  for (const t of [-1, 0, 1, 100]) {
    const s = model.sample(rest, t);
    assert.equal(s.phase, "rest");
    for (const name of ["t", "angle", "compression", "speed", "acceleration", "pullForce", "stopForce", "torque", "kineticEnergy", "stopEnergy"]) assert.equal(s[name], 0);
  }
}
const fast = model.derive({ omega: 8 });
assert.ok(fast.aboveYield);
assert.match(fast.stressInterpretation, /Elastic extrapolation above yield/);
assert.match(model.sample(fast, fast.duration).stressInterpretation, /Elastic extrapolation above yield/);
for (const driveMode of ["accelerated", "steady"]) {
  for (const omega of [0.01, 0.5, 2.1, 4, 8]) {
    for (const stopAngle of [0.5, 10, 25, 90]) {
      const variant = model.derive({ omega, stopAngle, driveMode });
      for (let step = 0; step <= 100; step++) {
        const state = model.sample(variant, variant.driveTime + variant.stopTime * step / 100);
        close(state.kineticEnergy + state.stopEnergy, variant.energy, "parameter sweep energy conservation");
      }
    }
  }
}
const twiceRadius = model.derive({ pullRadius: 10 });
close(twiceRadius.pullForce, d.pullForce / 2, "pull radius sensitivity");
close(twiceRadius.stopForcePeak, d.stopForcePeak, "pull radius leaves stopping force unchanged");
const twiceTravel = model.derive({ travelAngle: 180 });
close(twiceTravel.driveTime, 2 * d.driveTime, "travel time sensitivity");
close(twiceTravel.pullForce, d.pullForce / 2, "travel force sensitivity");
const twiceStop = model.derive({ stopAngle: 20 });
close(twiceStop.stopTime, 2 * d.stopTime, "stop time sensitivity");
close(twiceStop.peakStress, d.peakStress / 2, "stop stress sensitivity");
for (const input of [{ omega: -1 }, { omega: Infinity }, { stopAngle: 0 }, { travelAngle: 0 }, { pullRadius: 0 }, { omega: 1e300 }]) assert.throws(() => model.derive(input), RangeError);
for (const driveMode of ["", "invalid", "STEADY", null, false, 0, {}, []]) {
  assert.throws(() => model.normalizeParams({ driveMode }), RangeError);
  assert.throws(() => model.derive({ driveMode }), RangeError);
}
assert.throws(() => model.sample(d, NaN), RangeError);

const browser = { window: {} };
vm.runInNewContext(fs.readFileSync(modelPath, "utf8"), browser);
assert.equal(typeof browser.window.AblativeFBDModel.derive, "function");
close(browser.window.AblativeFBDModel.derive().peakStress, d.peakStress, "browser export parity");
close(browser.window.AblativeFBDModel.derive({ driveMode: "steady" }).driveTime, steady.driveTime, "steady browser export parity");
console.log("PASS: accelerated and steady FBD profiles, conservation, identical stop loads, contact continuity, exact 20 rpm timing, phases, endpoints, rest, inputs, scaling, shared bolt-model parity, and browser export.");
console.log(JSON.stringify({ driveTime: d.driveTime, stopTime: d.stopTime, energy: d.energy, pullForce: d.pullForce, stopForcePeak: d.stopForcePeak, peakStress: d.peakStress, aboveYield: d.aboveYield }, null, 2));
