/* Offline regression checks for the shared fixture camera and post geometry.
 * Run with Node; no browser, network, or generated files are required.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const fixture = require(path.resolve(__dirname, '../../assets/js/fixture-view-geometry.js'));
const { dimensions: d, project, rotateX, postPoint } = fixture;
const camera = fixture.projection || fixture.camera || fixture;
const { right, down, towardViewer } = camera;
const eps = 1e-9;
let checks = 0;
const near = (a, b, message = '') => {
  assert(Math.abs(a - b) < eps, `${message}: ${a} != ${b}`);
  checks++;
};
const nearPoint = (a, b, message) => a.forEach((value, i) => near(value, b[i], message));
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const subtract = (a, b) => a.map((value, i) => value - b[i]);
const norm = a => Math.hypot(...a);
const distance = (a, b) => norm(subtract(a, b));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const key = p => p.map(value => value.toFixed(7)).join(',');
const edgeKey = points => points.map(key).sort().join('|');
const faceNormals = { left: [-1, 0, 0], right: [1, 0, 0], front: [0, -1, 0], back: [0, 1, 0], top: [0, 0, 1], bottom: [0, 0, -1] };
const transformed = (p, compression) => rotateX(p, -compression);
const normalOf = (name, compression) => transformed(faceNormals[name], compression);

assert(right && down && towardViewer, 'The geometry exports its orthonormal camera basis');
for (const v of [right, down, towardViewer]) near(norm(v), 1, 'Camera basis unit length');
near(dot(right, down), 0, 'Right/down orthogonality');
near(dot(right, towardViewer), 0, 'Right/view orthogonality');
near(dot(down, towardViewer), 0, 'Down/view orthogonality');
near(Math.abs(dot(cross(right, down), towardViewer)), 1, 'Consistent camera handedness');
for (const p of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [-13, 42, -101]]) {
  nearPoint(project(p), [d.cx + dot(right, p), d.cy + dot(down, p)], 'Projection uses one camera');
}

// The singular values of a circle's YZ-to-screen matrix are 1 and |view.X|.
// A sheared oblique sketch does not satisfy this natural orthographic ellipse.
const aa = right[1] ** 2 + right[2] ** 2;
const bb = down[1] ** 2 + down[2] ** 2;
const ab = right[1] * down[1] + right[2] * down[2];
const disc = Math.sqrt((aa - bb) ** 2 + 4 * ab ** 2);
near(Math.sqrt((aa + bb + disc) / 2), 1, 'Disk major axis is its true radius');
near(Math.sqrt((aa + bb - disc) / 2), Math.abs(towardViewer[0]), 'Disk minor axis is foreshortened, never sheared');
for (const radius of [8, d.orbitRadius, d.diskRadius, 139]) {
  const circle = fixture.circle(radius, 0);
  nearPoint(circle[0], circle.at(-1), 'Circle closes');
  for (let i = 0; i < circle.length; i++) {
    nearPoint(circle[i], fixture.point(i * 2 * Math.PI / (circle.length - 1), radius), 'Circle samples projected world circle');
  }
}

near(d.mountingX, 0, 'Disk and mounting plane are flush');
assert(d.top > 0 && d.bottom < 0, 'Axle lies inside mounting-face height');
assert(d.top < -d.bottom * .4, 'Disk center is toward the top with a modest offset');
assert(d.top >= 2 * 8, 'Mounting bearing has room below the top edge');
const topFraction = d.top / (d.top - d.bottom);
assert(topFraction > .15 && topFraction < .3, 'Axle is near top, not centered vertically or flush to the edge');
const hub = [d.mountingX, 0, 0];
const axle = fixture.axle();
nearPoint(axle[1], hub, 'Axle terminates at centered mounting bearing');
near(norm(subtract(axle[1], axle[0])), d.axleLength, 'Axle length unchanged');
nearPoint(subtract(axle[1], axle[0]), [d.axleLength, 0, 0], 'Axle is normal to the mounting face');

const referenceEdges = fixture.edges(0);
assert.equal(referenceEdges.length, 12, 'Rectangular post has exactly twelve edges');
const baselineLengths = referenceEdges.map(edge => distance(...edge.points)).sort((a, b) => a - b);
const expectedLengths = [d.postWidth, d.halfDepth * 2, d.top - d.bottom].flatMap(length => Array(4).fill(length)).sort((a, b) => a - b);
nearPoint(baselineLengths, expectedLengths, 'Post dimensions define all twelve edges');
for (let deg = -20; deg <= 20; deg += .5) {
  const compression = deg * Math.PI / 180;
  const faces = fixture.faces(compression);
  for (const name of ['left', 'front', 'top']) {
    assert.equal(faces[name].length, 4, `Compatibility face ${name}`);
    faces[name].forEach((p, i) => nearPoint(p, transformed(fixture.faces(0)[name][i], compression), 'Rigid post face rotation'));
  }
  nearPoint(postPoint(hub, compression), hub, 'Compliance rotation pivots at axle');
  const localHub = rotateX(hub, compression);
  near(localHub[0], d.mountingX, 'Hub lies in mounting face');
  near(localHub[1], 0, 'Hub remains centered across mounting face');
  near(localHub[2], 0, 'Hub retains the same offset below top through tilt');
  const visible = fixture.visibleFaces(compression);
  const expectedVisible = Object.keys(faceNormals).filter(name => dot(normalOf(name, compression), towardViewer) > eps).sort();
  assert.deepEqual(visible.map(face => face.name).sort(), expectedVisible, 'Visible faces follow rotated outward normals');
  for (const face of visible) {
    nearPoint(face.normal, normalOf(face.name, compression), 'Visible face exposes actual rotated normal');
    assert.equal(face.points.length, 4, 'Visible quad vertices');
    const geometricNormal = cross(subtract(face.points[1], face.points[0]), subtract(face.points[2], face.points[0]));
    near(Math.abs(dot(geometricNormal, face.normal)) / norm(geometricNormal), 1, 'Face normal matches geometric plane');
  }
  const edges = fixture.edges(compression);
  assert.equal(edges.length, 12);
  assert.equal(new Set(edges.map(edge => edgeKey(edge.points))).size, 12, 'No duplicated prism edges');
  nearPoint(edges.map(edge => distance(...edge.points)).sort((a, b) => a - b), baselineLengths, 'Tilt never shears or stretches prism');
  const vertices = new Map();
  for (const edge of edges) {
    assert.equal(edge.points.length, 2);
    assert.equal(edge.faces.length, 2, 'Every edge has two adjacent faces');
    assert.equal(new Set(edge.faces).size, 2, 'Adjacent face names differ');
    assert(edge.faces.every(name => Object.hasOwn(faceNormals, name)), 'All adjacent faces have known outward normals');
    assert.equal(edge.hidden, edge.faces.every(name => dot(normalOf(name, compression), towardViewer) <= eps), 'Hidden edge iff both adjacent faces turn away');
    const farInterior = edge.faces.includes('right') && edge.faces.includes('back');
    const nearInterior = edge.faces.includes('left') && edge.faces.includes('front');
    assert.equal(edge.dashed, farInterior ? false : nearInterior ? true : edge.hidden, 'Cutaway swaps only the two interior vertical edge styles');
    for (const p of edge.points) {
      vertices.set(key(p), (vertices.get(key(p)) || 0) + 1);
      const local = rotateX(p, compression);
      assert([d.mountingX, d.mountingX + d.postWidth].some(value => Math.abs(value - local[0]) < eps));
      near(Math.abs(local[1]), d.halfDepth, 'Vertex keeps post half-depth');
      assert([d.top, d.bottom].some(value => Math.abs(value - local[2]) < eps), 'Vertex keeps top/bottom location');
    }
  }
  assert.equal(vertices.size, 8, 'Post has eight corners');
  assert([...vertices.values()].every(count => count === 3), 'Three distinct edges meet at every corner');
  assert(edges.some(edge => edge.hidden), 'Occluded edges are explicitly present for dashed rendering');
  if (compression >= 0) {
    const points = edges.flatMap(edge => edge.points.map(project))
      .concat(fixture.circle(), fixture.circle(d.diskRadius, -d.diskThickness), axle.map(project));
    for (const [x, y] of points) {
      assert(x >= 2 && x <= 438 && y >= 2 && y <= 320, 'Upper geometry fits above the phase caption');
      const lower = [22 + .9 * x, -24 + .9 * y];
      assert(lower[0] >= 2 && lower[0] <= 438 && lower[1] >= 0 && lower[1] <= 268, 'Lower geometry fits above its phase caption');
    }
  }
}

for (let degrees = -720; degrees <= 720; degrees += 3) {
  const angle = degrees * Math.PI / 180;
  for (const radius of [10, 76, d.orbitRadius, d.diskRadius, 139]) {
    const mapped = fixture.pointer(fixture.point(angle, radius));
    near(Math.sin(mapped.angle - angle), 0, 'Pointer inverse preserves angle');
    near(Math.cos(mapped.angle - angle), 1, 'Pointer inverse avoids mirror/half-turn');
    near(mapped.radius, radius / d.diskRadius, 'Pointer inverse preserves physical radial distance');
  }
}
for (const diameter of [.16, .19, .25]) for (const degrees of [0, 5, 10, 20]) {
  const rootRadius = 3.5 * diameter / .19;
  const compression = degrees * Math.PI / 180;
  const root = fixture.orbit(fixture.contactAngle(rootRadius) + compression);
  const local = rotateX(root, compression);
  near(local[0], d.mountingX, 'Contact root stays in mounting plane');
  near(local[1] - d.halfDepth, rootRadius, 'Physical root clearance unchanged during compliance');
  assert(local[2] > d.bottom && local[2] < d.top, 'Contact remains on the post');
}
console.log(`PASS ${checks} numeric checks: orthonormal natural disk projection, upper-centered mounting, rigid compliance, all twelve visible/hidden edges, pointer inverse, root contact, and both canvas bounds.`);
