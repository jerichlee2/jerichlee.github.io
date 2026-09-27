"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const fixture = require("../../assets/js/fixture-view-geometry.js");
const { dimensions: d } = fixture;
const EPS = 1e-8;
let checks = 0;
const check = (condition, message) => { checks++; assert.ok(condition, message); };
const close = (a, b) => Math.abs(a - b) < EPS;
const local = (point, compression) => fixture.rotateX(point, compression);

function contains(polygon, [x, y]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const exitX = d.mountingX + d.postWidth;
for (let degrees = 0; degrees <= 20; degrees += .25) {
  const compression = degrees * Math.PI / 180;
  const cutaway = fixture.axleExitCutaway(compression);
  const opening = cutaway.outline.map(fixture.project);
  const surface = cutaway.surface.map(fixture.project);
  const exit = fixture.axleSegments(compression).exit;
  check(close(exit[0], exitX) && close(exit[1], 0) && close(exit[2], 0), `exit remains on axle at ${degrees}°`);
  check(cutaway.outline.length === 16 && cutaway.surface.length === 4 && cutaway.walls.length === 4,
    `complete broken-out section at ${degrees}°`);

  for (const point of cutaway.outline) {
    const [x, y, z] = local(point, compression);
    check(x >= d.mountingX - EPS && x <= exitX + EPS && Math.abs(y) <= d.halfDepth + EPS &&
      z >= d.bottom - EPS && z <= d.top + EPS, `rim stays within the post at ${degrees}°`);
    check(close(x, d.mountingX) || close(y, -d.halfDepth), `rim lies on actual front/left surface at ${degrees}°`);
  }
  for (const point of cutaway.surface) {
    const [x, y, z] = local(point, compression);
    check(close(x, exitX) && close(Math.abs(y), 10) && close(Math.abs(z), 12),
      `exposed patch follows the opposite X face at ${degrees}°`);
  }
  for (const point of [...cutaway.outline, ...cutaway.surface, ...cutaway.walls.flat()]) {
    check(point.every(Number.isFinite), `finite cutaway coordinates at ${degrees}°`);
    const [x, y] = fixture.project(point);
    check(x > 0 && x < 440 && y > 0 && y < 350, `cutaway fits upper canvas at ${degrees}°`);
    check(22 + .9 * x > 0 && 22 + .9 * x < 440 && -24 + .9 * y > 0 && -24 + .9 * y < 300,
      `cutaway fits lower canvas at ${degrees}°`);
  }
  const ring = fixture.circle(6, exitX);
  ring.forEach((point, i) => {
    const world = fixture.orbit(i * Math.PI * 2 / 96, 6, exitX);
    const [x, y, z] = local(world, compression);
    check(close(x, exitX) && close(Math.hypot(y, z), 6), `exit ring lies in face plane, normal to axle at ${degrees}°`);
    check(fixture.project(world).every((value, axis) => close(value, point[axis])), `ring projection matches its world plane at ${degrees}°`);
    check(contains(opening, point), `whole dotted ring fits the broken opening at ${degrees}°`);
    check(contains(surface, point), `whole dotted ring sits on exposed opposite-face patch at ${degrees}°`);
  });
}

for (const filename of ["ablative-fbd-lab.js", "bolt-impact-lab.js"]) {
  const source = fs.readFileSync(path.join(__dirname, "../../assets/js", filename), "utf8");
  check(!/fixture\.circle\(\s*8\s*,\s*fixture\.dimensions\.mountingX\s*\)/.test(source),
    `${filename}: white near-hub bearing ring removed`);
  check(source.includes("fixture.axleExitCutaway(compression)"), `${filename}: shared cutaway used`);
  check(/fixture\.circle\(\s*6\s*,\s*throughAxle\.exit\[0\]\s*\)/.test(source),
    `${filename}: dotted ring located on actual axle exit face`);
}
console.log(`Exit cutaway: ${checks} checks passed across 81 compliance angles (0–20°).`);
