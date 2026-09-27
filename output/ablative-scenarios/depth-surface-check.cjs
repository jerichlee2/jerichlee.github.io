"use strict";
const assert = require('node:assert/strict');
const model = require('../../assets/js/ablative-depth-surface-model.js');
const close = (a, b) => assert(Math.abs(a - b) <= 1e-10 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
// Independent unit arithmetic, not parity against concurrently generated run
// tables: the surface deliberately uses hot-brick density at every point.
const nominalVolumeCm3 = 2 * 3.5 * .5 * 16.387064;
const densityGcm3 = 82.8 / nominalVolumeCm3;
const massPerMM = densityGcm3 * .5 * Math.PI * (2 / 2) ** 2 * .1;
const measuredHotDepth = .125 * 25.4;
const expectedExponent = Math.log((measuredHotDepth / 3) / (.5844 / .2592)) / Math.log(10 / 20);
close(model.constants.density, densityGcm3 * 1000);
close(model.constants.massPerMM, massPerMM);
close(model.constants.massPerMM * 3, .6803028248830075);
close(model.constants.massPerMM * measuredHotDepth, .7199871563345164);
assert.equal(model.constants.massMax, 2.4);
assert.equal(model.fit.classification, 'partly-calibrated-not-validated');
assert.equal(model.fit.measuredDepthAnchorCount, 1);
assert.equal(model.fit.assumedDepthAnchorCount, 1);
assert.equal(model.fit.thermocoupleFit, false);
assert.equal(model.fit.validated, false);
assert.equal(model.points.filter(point => point.measured).length, 1);
assert.equal(model.points[0].measured, false);
assert.equal(model.points[0].depth, 3);
assert.equal(model.points[1].measured, true);
assert.equal(model.points[1].approximate, true);
assert.match(model.points[1].label, /measured ≈3.2 mm/);
close(model.points[1].depth, measuredHotDepth);
close(model.evidence.hotInitialMassG - model.evidence.hotFinalMassG, model.evidence.hotNetMassLossG);
assert.notEqual(model.points[1].mass, model.evidence.hotNetMassLossG, 'Geometric mass is not whole-brick net loss');
assert.match(model.evidence.densityStatus, /transfer.*assumed/);
assert.equal(model.scenarios, undefined, 'No alternative calibration modes remain');
assert.equal(model.fit.fluxExponent, 1, 'Linear flux response is the explicit extra assumption');
close(model.fit.timeExponent, expectedExponent);
close(model.fit.timeExponent, 1.0910963687552264);
for (const anchor of model.points) {
  const anchored = model.evaluate(anchor.time, anchor.flux);
  close(anchored.depth, anchor.depth); close(anchored.mass, anchor.mass);
}
close(model.evaluate(10, .4).dose, model.evaluate(20, .2).dose);
assert(model.evaluate(20, .2).depth > model.evaluate(10, .4).depth,
  'Equal-dose depths differ by this assumed power law, not by evidence from the tests');
close(model.evaluate(10, .4).depth, 2 * model.evaluate(10, .2).depth);
let cases = 0;
for (let i = 0; i <= 50; i++) for (let j = 0; j <= 40; j++) {
  const time = i / 50 * model.constants.timeMax, flux = j / 40 * model.constants.fluxMax;
  const point = model.evaluate(time, flux);
  close(point.dose, point.time * point.flux);
  close(point.depth, 3 * (flux / .2592) * (time / 20) ** expectedExponent);
  close(point.mass, point.depth * massPerMM);
  assert(point.depth >= 0 && point.depth < model.constants.thicknessMM);
  assert(point.depth <= model.constants.depthMax && point.mass <= model.constants.massMax);
  if (!i || !j) { assert.equal(point.depth, 0); assert.equal(point.mass, 0); }
  if (i && j) {
    assert(point.depth > model.evaluate((i - 1) / 50 * model.constants.timeMax, flux).depth);
    assert(point.depth > model.evaluate(time, (j - 1) / 40 * model.constants.fluxMax).depth);
  }
  cases++;
}
const maximum = model.evaluate(model.constants.timeMax, model.constants.fluxMax);
close(maximum.depth, 9.25925925925926);
close(maximum.mass, 2.099700076799406);
for (let i = 0; i <= 12; i++) {
  const mass = Number((i * .2).toFixed(1)), contour = model.contour(mass);
  if (mass > maximum.mass) assert.equal(contour.length, 0, 'Unattainable contours are omitted');
  else assert(contour.length >= 3);
  for (const point of contour) {
    close(point.mass, mass);
    assert(point.time >= 0 && point.time <= model.constants.timeMax);
    assert(point.flux >= 0 && point.flux <= model.constants.fluxMax);
  }
}
for (const args of [[-1,.2], [1,-.2], [20.01,.2], [1,.81], [NaN,.2], [1,Infinity], ['1',.2]]) assert.throws(() => model.evaluate(...args), RangeError);
for (const mass of [-1, 2.41, NaN, Infinity, '.5']) assert.throws(() => model.contour(mass), RangeError);
for (const steps of [1, 1001, 2.5, NaN]) assert.throws(() => model.contour(.5, steps), RangeError);
console.log(`PASS: ${cases} shared-surface samples, independent conditional-density/depth arithmetic, one measured plus one assumed anchor, monotonic response, exact mass contours, chosen unequal-dose response, domain and input checks.`);
