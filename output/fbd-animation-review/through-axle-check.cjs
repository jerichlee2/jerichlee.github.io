/* Independent world-space checks for the axle passing through the T-slot.
 * Uses ray/AABB intersection rather than the production silhouette formula.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const fixture = require(path.resolve(__dirname, '../../assets/js/fixture-view-geometry.js'));
const { dimensions: d, projection, rotateX, project } = fixture;
let checks = 0;
const near = (a, b, message) => {
  assert(Math.abs(a - b) < 1e-9, `${message}: ${a} != ${b}`);
  checks++;
};
const nearPoint = (a, b, message) => a.forEach((value, i) => near(value, b[i], message));
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const lerp = (a, b, fraction) => a.map((value, i) => value + fraction * (b[i] - value));
const localBounds = [[d.mountingX, d.mountingX + d.postWidth], [-d.halfDepth, d.halfDepth], [d.bottom, d.top]];

function postOccludes(point, compression) {
  const origin = rotateX(point, compression);
  const direction = rotateX(projection.towardViewer, compression);
  let enter = 0, leave = Infinity;
  for (let axis = 0; axis < 3; axis++) {
    const [min, max] = localBounds[axis];
    if (Math.abs(direction[axis]) < 1e-12) {
      if (origin[axis] < min || origin[axis] > max) return false;
      continue;
    }
    const a = (min - origin[axis]) / direction[axis];
    const b = (max - origin[axis]) / direction[axis];
    enter = Math.max(enter, Math.min(a, b));
    leave = Math.min(leave, Math.max(a, b));
    if (leave <= enter + 1e-10) return false;
  }
  return leave > enter + 1e-10;
}

const reference = fixture.axleSegments();
reference.near.forEach((point, i) => nearPoint(point, fixture.axle()[i], 'Legacy near-side stub is preserved'));
nearPoint(reference.exit, [d.mountingX + d.postWidth, 0, 0], 'Axle exits the actual opposite face');
nearPoint(reference.tip, [d.mountingX + d.postWidth + d.axleProtrusion, 0, 0], 'Tip protrudes beyond opposite face');
assert(d.axleProtrusion > 0, 'There is a positive far-side overhang');

for (let degrees = -20; degrees <= 20; degrees += .25) {
  const compression = degrees * Math.PI / 180;
  const axle = fixture.axleSegments(compression);
  nearPoint(axle.near[0], reference.near[0], 'Near endpoint stays fixed');
  nearPoint(axle.near[1], axle.hidden[0], 'Near and internal spans meet');
  nearPoint(axle.hidden[1], axle.far[0], 'Hidden and visible spans meet exactly');
  nearPoint(axle.far[1], axle.tip, 'Far span ends at the protruding tip');
  nearPoint(axle.exit, reference.exit, 'Opposite-face penetration stays on the pivot axis');
  nearPoint(axle.tip, reference.tip, 'Far endpoint stays fixed during compliance');
  assert(axle.hidden[0][0] < axle.exit[0] && axle.exit[0] < axle.hidden[1][0], 'Dashes continue through post and occluded overhang');
  assert(axle.far[0][0] < axle.far[1][0], 'Far end includes a visibly exposed solid tail');
  near(Math.abs(dot([1, 0, 0], rotateX([-1, 0, 0], -compression))), 1, 'Axle normal to mounting face');
  near(dot([1, 0, 0], rotateX([0, -1, 0], -compression)), 0, 'Axle parallel to impact/front face');
  for (const point of [...axle.near, ...axle.hidden, ...axle.far, axle.exit, axle.tip]) {
    near(point[1], 0, 'All axle pieces share Y=0');
    near(point[2], 0, 'All axle pieces share Z=0');
    nearPoint(fixture.postPoint(point, compression), point, 'Rx compliance cannot move the axle');
  }
  for (let sample = 1; sample < 20; sample++) {
    const fraction = sample / 20;
    assert(!postOccludes(lerp(...axle.near, fraction), compression), 'Near stub is exposed');
    assert(postOccludes(lerp(...axle.hidden, fraction), compression), 'Every dashed sample is inside or behind post');
    assert(!postOccludes(lerp(...axle.far, fraction), compression), 'Every solid tail sample is outside post silhouette');
    checks += 3;
  }
  assert(postOccludes([axle.far[0][0] - .001, 0, 0], compression), 'Reveal point has an occluded neighbor');
  assert(!postOccludes([axle.far[0][0] + .001, 0, 0], compression), 'Reveal point has an exposed neighbor');
  const points = [...axle.near, ...axle.hidden, ...axle.far].map(project)
    .concat(fixture.circle(6, axle.exit[0]), fixture.circle(3.5, axle.tip[0]));
  for (const [x, y] of points) {
    assert(x >= 4 && x <= 436 && y >= 4 && y <= 320, 'Axle fits upper canvas');
    const lower = [22 + .9 * x, -24 + .9 * y];
    assert(lower[0] >= 4 && lower[0] <= 436 && lower[1] >= 4 && lower[1] <= 268, 'Axle fits lower canvas');
    checks += 2;
  }
}
console.log(`PASS ${checks} through-axle checks: opposite-face penetration, fixed pivot axis, normal alignment, independent ray-box occlusion, continuous spans, and both canvas bounds.`);
