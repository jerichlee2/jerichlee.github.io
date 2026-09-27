"use strict";
const assert = require("node:assert/strict");
const model = require("../../assets/js/ablative-fbd-model.js");
let checks = 0;

function near(actual, expected, scale = 1, message = "") {
  assert.ok(Number.isFinite(actual), message + " must be finite");
  assert.ok(Math.abs(actual - expected) <= 2e-9 * Math.max(1, scale),
    `${message}: ${actual} != ${expected}`);
  checks += 1;
}

for (const driveMode of ["accelerated", "steady"]) {
  for (const omega of [0.05, 2.1, 5]) {
    for (const travelAngle of [45, 90, 120]) {
      for (const stopAngle of [5, 10, 20]) {
        const params = { omega, travelAngle, stopAngle, pullRadius: 5, driveMode };
        const run = model.derive(params);
        const totalAngle = run.travelAngleRadians + run.stopAngleRadians;
        assert.equal(model.timeAtAngle(run, 0), 0);
        assert.equal(model.timeAtAngle(run, -1), 0);
        assert.equal(model.timeAtAngle(run, run.travelAngleRadians), run.driveTime);
        assert.equal(model.timeAtAngle(run, totalAngle), run.duration);
        assert.equal(model.timeAtAngle(run, totalAngle + 10), run.duration);
        checks += 5;
        if (driveMode === "steady") {
          near(model.timeAtAngle(run, run.travelAngleRadians / 2), run.driveTime / 2,
            run.duration, "steady inverse is linear");
        }

        // Both directions are checked, including dense sampling of the much
        // shorter compression interval where angular speed approaches zero.
        for (const [start, length] of [[0, run.driveTime], [run.driveTime, run.stopTime]]) {
          for (let i = 0; i <= 1000; i += 1) {
            const time = i === 1000 ? start + length : start + length * i / 1000;
            const state = model.sample(run, time);
            const inverted = model.timeAtAngle(run, state.angle);
            near(inverted, time, run.duration, "time roundtrip");
            near(model.sample(run, inverted).angle, state.angle, totalAngle, "angle from time roundtrip");
          }
        }
        let previousTime = -1;
        for (let i = 0; i <= 1000; i += 1) {
          const angle = totalAngle * i / 1000;
          const time = model.timeAtAngle(run, angle);
          assert.ok(time >= previousTime, "inverse must be monotonic");
          near(model.sample(run, time).angle, angle, totalAngle, "angle roundtrip");
          near(model.timeAtAngle(params, angle), time, run.duration, "raw input parity");
          previousTime = time;
        }

        assert.equal(model.sample(run, model.timeAtAngle(run, run.travelAngleRadians)).phase, "stop");
        assert.equal(model.sample(run, model.timeAtAngle(run, totalAngle)).phase, "held");
        for (const offset of [-1e-8, 1e-8]) {
          const angle = run.travelAngleRadians + offset;
          const state = model.sample(run, model.timeAtAngle(run, angle));
          near(state.angle, angle, totalAngle, "contact boundary");
          assert.equal(state.phase, offset < 0 ? "pull" : "stop");
        }
      }
    }
  }
}

for (const driveMode of ["accelerated", "steady"]) {
  const rest = model.derive({ omega: 0, driveMode });
  for (const angle of [-100, 0, 0.5, Math.PI, 1e8]) {
    assert.equal(model.timeAtAngle(rest, angle), 0);
    assert.equal(model.sample(rest, model.timeAtAngle(rest, angle)).phase, "rest");
    checks += 2;
  }
  for (const input of [undefined, NaN, Infinity, -Infinity, "not an angle", {}]) {
    assert.throws(() => model.timeAtAngle({ driveMode }, input), RangeError);
    assert.throws(() => model.timeAtAngle(rest, input), RangeError);
    checks += 2;
  }
}
assert.throws(() => model.timeAtAngle({ omega: -1 }, 0), RangeError);
assert.throws(() => model.timeAtAngle({ travelAngle: 0 }, 0), RangeError);
assert.throws(() => model.timeAtAngle({ stopAngle: NaN }, 0), RangeError);
assert.throws(() => model.timeAtAngle({ driveMode: "invalid" }, 0), RangeError);
assert.equal(model.timeAtAngle({}, "0"), 0);
assert.equal(model.timeAtAngle({}, -Number.MAX_VALUE), 0);
assert.equal(model.timeAtAngle({}, Number.MAX_VALUE), model.derive({}).duration);
console.log(`FBD angle inverse: ${checks} checks passed across 54 nonzero-speed configurations in both drive modes.`);
