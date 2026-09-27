/* Shared schematic fixture geometry. X is the axle; Y is depth; Z is up.
 * The disk and post's LEFT face lie in YZ planes. The FRONT face is XZ.
 * Compliance is a rigid rotation about X, never a screen-space shear.
 * Schematic lengths are display units, not a reconstruction of the hardware.
 */
(function (root, factory) {
  const geometry = factory();
  if (typeof module === "object" && module.exports) module.exports = geometry;
  else root.FixtureViewGeometry = geometry;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const dimensions = Object.freeze({ cx: 220, cy: 159, diskRadius: 125, orbitRadius: 102,
    mountingX: 0, axleLength: 14, axleProtrusion: 42, postWidth: 31, halfDepth: 20, top: 38, bottom: -128, diskThickness: 13 });
  // A real orthographic camera: equal world lengths share one scale. The
  // earlier oblique shear stretched the disk instead of only foreshortening it.
  const yaw = 39 * Math.PI / 180, elevation = 12 * Math.PI / 180;
  const projection = Object.freeze({
    right: Object.freeze([Math.sin(yaw), -Math.cos(yaw), 0]),
    down: Object.freeze([-Math.sin(elevation) * Math.cos(yaw), -Math.sin(elevation) * Math.sin(yaw), -Math.cos(elevation)]),
    towardViewer: Object.freeze([-Math.cos(elevation) * Math.cos(yaw), -Math.cos(elevation) * Math.sin(yaw), Math.sin(elevation)])
  });
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  const project = p => [dimensions.cx + dot(p, projection.right), dimensions.cy + dot(p, projection.down)];
  function rotateX([x, y, z], angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return [x, c * y - s * z, s * y + c * z];
  }
  const orbit = (angle, radius = dimensions.orbitRadius, x = 0) => [x, -radius * Math.cos(angle), radius * Math.sin(angle)];
  const point = (angle, radius = dimensions.orbitRadius, x = 0) => project(orbit(angle, radius, x));
  // The disk is flush with the mounting face (X=0), centered across its width
  // but below the top by a small margin. The stop bolt
  // root meets its depth edge; contact does not depend on projected tip length.
  const contactAngle = radius => 2 * Math.PI - Math.acos(-(dimensions.halfDepth + radius) / dimensions.orbitRadius);
  const postPoint = (point, compression = 0) => rotateX(point, -compression);
  function postFaces() {
    const { mountingX: l, postWidth: w, halfDepth: d, top: t, bottom: b } = dimensions, r = l + w;
    return {
      top: [[l, -d, t], [r, -d, t], [r, d, t], [l, d, t]],
      front: [[l, -d, t], [r, -d, t], [r, -d, b], [l, -d, b]],
      left: [[l, d, t], [l, -d, t], [l, -d, b], [l, d, b]],
      right: [[r, -d, t], [r, d, t], [r, d, b], [r, -d, b]],
      back: [[r, d, t], [l, d, t], [l, d, b], [r, d, b]],
      bottom: [[l, d, b], [r, d, b], [r, -d, b], [l, -d, b]]
    };
  }
  function faces(compression = 0) {
    return Object.fromEntries(Object.entries(postFaces()).filter(([name]) => ["top", "front", "left"].includes(name)).map(([name, vertices]) =>
      [name, vertices.map(p => postPoint(p, compression))]));
  }
  const normals = { top: [0, 0, 1], bottom: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0], front: [0, -1, 0], back: [0, 1, 0] };
  function surfaces(compression) {
    return Object.entries(postFaces()).map(([name, points]) => {
      const normal = rotateX(normals[name], -compression);
      return { name, normal, points: points.map(p => postPoint(p, compression)), visible: dot(normal, projection.towardViewer) > 1e-10 };
    });
  }
  const visibleFaces = (compression = 0) => surfaces(compression).filter(face => face.visible);
  function edges(compression = 0) {
    const surfaceState = surfaces(compression), all = new Map();
    // Each physical edge is shared by two faces; both must face away for it
    // to be a hidden edge. Reclassify as the stop tilts, including its underside.
    for (const [name, points] of Object.entries(postFaces())) points.forEach((a, i) => {
      const b = points[(i + 1) % points.length], key = [a.join(","), b.join(",")].sort().join("|");
      if (!all.has(key)) all.set(key, { points: [a, b].map(p => postPoint(p, compression)), faces: [] });
      all.get(key).faces.push(name);
    });
    return [...all.values()].map(edge => {
      const hidden = edge.faces.every(name => !surfaceState.find(face => face.name === name).visible);
      // Cutaway presentation: swap the two interior vertical line styles.
      // Keep physical visibility separate so camera/occlusion math is unchanged.
      const farInterior = edge.faces.includes("right") && edge.faces.includes("back");
      const nearInterior = edge.faces.includes("left") && edge.faces.includes("front");
      return { ...edge, hidden, dashed: farInterior ? false : nearInterior ? true : hidden };
    });
  }
  function circle(radius = dimensions.diskRadius, x = 0) {
    return Array.from({ length: 97 }, (_, i) => point(i * 2 * Math.PI / 96, radius, x));
  }
  // Keep the near-side exposed stub and extend this same axis through the post.
  const axle = () => [[dimensions.mountingX - dimensions.axleLength, 0, 0], [dimensions.mountingX, 0, 0]];
  function axleSegments(compression = 0) {
    const exitX = dimensions.mountingX + dimensions.postWidth, tipX = exitX + dimensions.axleProtrusion;
    // Part of the far protrusion is still behind the post from this camera.
    // Intersect a viewer ray with the post in its unrotated local coordinates;
    // render that occluded span dashed, rather than painting it on the front.
    const view = rotateX(projection.towardViewer, compression);
    const depthTime = Math.abs(view[1]) < 1e-10 ? Infinity : dimensions.halfDepth / Math.abs(view[1]);
    const heightTime = Math.abs(view[2]) < 1e-10 ? Infinity : (view[2] > 0 ? dimensions.top : dimensions.bottom) / view[2];
    const revealX = Math.min(tipX, exitX + Math.max(0, -view[0]) * Math.min(depthTime, heightTime));
    return { near: axle(), hidden: [[dimensions.mountingX, 0, 0], [revealX, 0, 0]],
      far: [[revealX, 0, 0], [tipX, 0, 0]], exit: [exitX, 0, 0], tip: [tipX, 0, 0] };
  }
  function axleExitCutaway(compression = 0) {
    const exitX = dimensions.mountingX + dimensions.postWidth;
    const view = rotateX(projection.towardViewer, compression);
    const atExit = ([y, z]) => [exitX, y, z];
    // A small view-dependent broken-out section. Trace toward the camera to
    // put its broken rim on the actual front/left surfaces, not a floating box.
    const rim = yz => {
      const p = atExit(yz), times = [
        (dimensions.mountingX - p[0]) / view[0],
        ((view[1] < 0 ? -dimensions.halfDepth : dimensions.halfDepth) - p[1]) / view[1],
        ((view[2] < 0 ? dimensions.bottom : dimensions.top) - p[2]) / view[2]
      ].filter(t => Number.isFinite(t) && t >= 0);
      const t = Math.min(...times);
      return postPoint(p.map((n, i) => n + t * view[i]), compression);
    };
    const outside = [[-14, 17], [14, 17], [14, -17], [-14, -17]];
    const inside = [[-10, 12], [10, 12], [10, -12], [-10, -12]];
    const surface = inside.map(yz => postPoint(atExit(yz), compression));
    const corners = outside.map(rim);
    const boundary = [[-14, 17], [-4, 17], [-2, 14], [2, 17], [14, 17], [14, 5], [11, 3], [14, 0],
      [14, -17], [3, -17], [1, -14], [-2, -17], [-14, -17], [-14, -5], [-11, -3], [-14, 0]];
    return { outline: boundary.map(rim), surface,
      walls: corners.map((p, i) => [p, corners[(i + 1) % 4], surface[(i + 1) % 4], surface[i]]) };
  }
  const contactEdge = () => [[dimensions.mountingX, dimensions.halfDepth, -50], [dimensions.mountingX, dimensions.halfDepth, dimensions.bottom + 6]];
  function pointer([x, y]) {
    // Invert the camera on the disk's YZ plane, not its ellipse bounding box.
    const worldY = (x - dimensions.cx) / projection.right[1];
    const worldZ = (y - dimensions.cy - projection.down[1] * worldY) / projection.down[2];
    return { angle: Math.atan2(worldZ, -worldY), radius: Math.hypot(worldY, worldZ) / dimensions.diskRadius };
  }
  return Object.freeze({ dimensions, projection, project, rotateX, orbit, point, contactAngle, postPoint, faces, visibleFaces, edges, circle, axle, axleSegments, axleExitCutaway, contactEdge, pointer });
});
