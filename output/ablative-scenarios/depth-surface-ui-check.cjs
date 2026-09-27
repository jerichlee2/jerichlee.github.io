// Offline controller checks using a small DOM adapter and native Canvas.
// This is not a live-browser layout test; no browser or server is launched.
const assert = require('node:assert/strict');
const { createCanvas } = require('/Users/jerichlee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const model = require('../../assets/js/ablative-depth-surface-model.js');
const view = require('../../assets/js/ablative-depth-surface.js');
// Native pixel checks ensure the evidence distinction is rendered, not only
// exposed in metadata: hollow assumed B versus filled measured H.
const markerCanvas = createCanvas(1000, 720), markerContext = markerCanvas.getContext('2d');
const markerRender = view.render(markerContext, { width: 1000, height: 720, probe: { time: 0, flux: 0 } });
for (const point of markerRender.points) {
  const pixel = Array.from(markerContext.getImageData(Math.round(point.position.x), Math.round(point.position.y), 1, 1).data);
  assert.equal(point.measured, point.id === 'hot');
  assert.deepEqual(pixel, point.measured ? [56, 53, 47, 255] : [255, 253, 249, 255], `${point.id} marker fill matches its evidence status`);
}
assert.equal(view.colorForMass(0), 'rgb(68,1,84)');
assert.equal(view.colorForMass(2.4), 'rgb(253,231,37)');
const elements = new Map(), frames = new Map(), timers = new Map();
const intersectionObservers = [];
let sequence = 0, now = 0, failCanvas = false, resizeObserver, observedElement;
const attributesOf = text => Object.fromEntries([...text.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
const eventTarget = values => ({
  listeners: {},
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); },
  emit(type, values = {}) {
    const event = { target: this, preventDefault() { this.prevented = true; }, ...values };
    for (const callback of this.listeners[type] || []) callback(event);
    return event;
  },
  ...values
});
const motionPreference = eventTarget({ matches: false, media: '(prefers-reduced-motion: reduce)' });
const win = eventTarget({
  devicePixelRatio: 2,
  innerWidth: 1200,
  innerHeight: 800,
  requestAnimationFrame(callback) { frames.set(++sequence, callback); return sequence; },
  cancelAnimationFrame(id) { frames.delete(id); },
  setTimeout(callback) { timers.set(++sequence, callback); return sequence; },
  clearTimeout(id) { timers.delete(id); },
  matchMedia(query) { assert.equal(query, motionPreference.media); return motionPreference; },
  performance: { now: () => now },
  ResizeObserver: class { constructor(callback) { resizeObserver = callback; } observe(element) { observedElement = element; } },
  IntersectionObserver: class {
    constructor(callback) { this.callback = callback; intersectionObservers.push(this); }
    observe(element) { this.element = element; }
  }
});
const doc = eventTarget({ defaultView: win, hidden: false, visibilityState: 'visible', hasFocus: () => true, createElement: tag => new Element(tag), getElementById: id => elements.get(id) });
class Element {
  constructor(tag = 'div', attrs = {}) {
    this.tag = tag; this.attrs = attrs; this.id = attrs.id;
    this.ownerDocument = doc; this.dataset = {}; this.style = {}; this.listeners = {};
    this.children = []; this.hidden = false; this.clientWidth = 900;
    this.value = attrs.value || ''; this._textContent = ''; this.textWrites = 0; this.backingResizes = 0;
    if (this.id) elements.set(this.id, this);
    if (tag === 'canvas') this.native = createCanvas(300, 150);
  }
  get width() { return this.native?.width; }
  set width(value) { this.backingResizes++; this.native.width = value; }
  get height() { return this.native?.height; }
  set height(value) { this.backingResizes++; this.native.height = value; }
  get isConnected() { return this.attached || this.parentNode?.isConnected || false; }
  get clientWidth() { return this.isConnected ? this._clientWidth : 0; }
  set clientWidth(value) { this._clientWidth = value; }
  get textContent() { return this._textContent + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this.textWrites++; this._textContent = String(value); this.children = []; }
  getContext() { return failCanvas ? null : this.native.getContext('2d'); }
  set innerHTML(html) {
    this.children = [];
    const stack = [this], voidTags = new Set(['input', 'img', 'br', 'hr']);
    // Only the widget's static markup is parsed; this is not a general HTML engine.
    for (const match of html.matchAll(/<\/(\w+)\s*>|<(\w+)\b([^>]*)>|([^<]+)/g)) {
      if (match[1]) {
        assert.equal(stack.at(-1).tag, match[1], 'Balanced widget markup');
        const closed = stack.pop();
        if (closed.tag === 'select') closed.value = closed.querySelector('option').attrs.value;
      } else if (match[2]) {
        const child = new Element(match[2], attributesOf(match[3]));
        stack.at(-1).appendChild(child);
        if (!voidTags.has(child.tag)) stack.push(child);
      } else stack.at(-1)._textContent += match[4];
    }
    assert.equal(stack.length, 1, 'All widget elements close');
  }
  querySelector(selector) {
    const matches = element => selector.startsWith('#') ? element.id === selector.slice(1)
      : selector.startsWith('.') ? (element.attrs.class || '').split(/\s+/).includes(selector.slice(1))
      : element.tag === selector;
    for (const child of this.children) {
      if (matches(child)) return child;
      const descendant = child.querySelector(selector);
      if (descendant) return descendant;
    }
    return null;
  }
  appendChild(element) { this.children.push(element); element.parentNode = this; }
  contains(element) { return this === element || this.children.some(child => child.contains(element)); }
  setAttribute(key, value) { this.attrs[key] = value; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  getBoundingClientRect() { return { width: this.clientWidth, height: 500, left: 0, right: this.clientWidth, top: 1200, bottom: 1700 }; }
  setPointerCapture(id) { this.pointerId = id; }
  hasPointerCapture(id) { return this.pointerId === id; }
  releasePointerCapture(id) { if (this.hasPointerCapture(id)) { this.pointerId = null; this.emit('lostpointercapture', { pointerId: id }); } }
  focus() {
    if (doc.activeElement === this) return;
    if (doc.activeElement) doc.activeElement.emit('blur');
    this.emit('focus');
  }
  emit(type, values = {}) {
    if (type === 'focus') doc.activeElement = this;
    if (type === 'blur' && doc.activeElement === this) doc.activeElement = null;
    const event = { target: this, preventDefault() { this.prevented = true; }, ...values };
    for (const callback of this.listeners[type] || []) callback(event);
    return event;
  }
}
const flush = () => { for (const queue of [frames, timers]) { const jobs = [...queue.values()]; queue.clear(); jobs.forEach(job => job(now)); } };
const tick = (milliseconds = 1000 / 60) => {
  now += milliseconds;
  const jobs = [...frames.values()]; frames.clear(); jobs.forEach(job => job(now));
};
const intersect = (canvas, visible) => {
  const observer = intersectionObservers.find(observer => observer.element === canvas);
  assert(observer, 'IntersectionObserver watches the canvas');
  observer.callback([{ target: canvas, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }]);
};
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
const makeMount = () => {
  const element = new Element('div', { id: 'ablative-depth-surface' });
  element.attached = true; element.clientWidth = 1144;
  const fallback = new Element('img', { id: 'ablative-depth-surface-fallback' });
  element.appendChild(fallback); return { element, fallback };
};
const failed = makeMount(); failCanvas = true;
assert.equal(view.mount(failed.element), null);
assert.equal(failed.fallback.hidden, false, 'Unavailable Canvas preserves the static fallback');
assert.equal(failed.element.dataset.ready, undefined);
failCanvas = false;
const { element, fallback } = makeMount(), mounted = view.mount(element);
assert(mounted); assert.equal(fallback.hidden, true); assert.equal(element.dataset.ready, 'true');
assert.equal(view.mount(element), null, 'Do not duplicate controls on repeated mount');
const get = key => elements.get('depth-surface-' + key);
const input = (key, value, type = 'input') => { get(key).value = String(value); get(key).emit(type); flush(); };
const controls = get('controls'), results = get('results');
assert.equal(controls.tag, 'section', 'Settings have a semantic section');
assert.equal(controls.attrs.class, 'depth-surface-controls');
assert.equal(controls.attrs['aria-labelledby'], 'depth-surface-settings-title');
assert.equal(get('settings-title').textContent.trim(), 'Dimple settings');
assert(controls.contains(get('settings-title')), 'Settings section owns its accessible heading');
assert.equal(results.attrs.class, 'depth-surface-results');
assert.equal(controls.parentNode, results.parentNode, 'Settings rail and results are sibling columns');
assert(controls.parentNode.children.indexOf(controls) < controls.parentNode.children.indexOf(results), 'Controls come first in document order for stacked layouts');
for (const key of ['time', 'time-value', 'flux', 'flux-value', 'reset', 'autorotate']) {
  assert(controls.contains(get(key)), `${key} belongs in the settings rail`);
  assert(!results.contains(get(key)), `${key} is not duplicated in the chart results`);
}
for (const key of ['help', 'canvas', 'readout', 'depth-value', 'mass-value']) {
  assert(results.contains(get(key)), `${key} remains with the chart results`);
  assert(!controls.contains(get(key)), `${key} does not take space in the settings rail`);
}
assert(results.querySelector('.depth-surface-note'), 'Model qualification stays with the results');
assert.match(controls.querySelector('.depth-surface-settings-note').textContent, /One measured hot depth.*baseline remains assumed/);
assert.match(get('help').textContent, /Filled H: measured ≈3.2 mm.*Hollow B: assumed 3 mm/);
assert.match(get('canvas').attrs['aria-label'], /partly calibrated.*not validated/);
assert.match(results.querySelector('.depth-surface-note').textContent, /model digits do not imply measurement precision/);
assert.match(results.querySelector('.depth-surface-note').textContent, /conditional density.*82.8 g.*not the observed 8.9 g/);
assert.equal(view.getState().result.width, element.clientWidth, 'Detached first render uses the host as a fallback');
assert.equal(frames.size, 1, 'Mount queues an attached layout redraw');
assert.equal(observedElement, results, 'ResizeObserver watches the chart column, not the full-width host');
flush();
assert.equal(view.getState().result.width, results.clientWidth, 'Attached draw measures only the chart column');
assert(results.clientWidth < element.clientWidth, 'Adapter keeps the host wider than the chart to expose sizing regressions');
assert.equal(controls.querySelector('select'), null, 'The shared model has no scenario selector');
assert.equal(element.querySelector('#depth-surface-scenario'), null, 'The obsolete scenario control is absent');
assert.equal(Object.hasOwn(view.defaults, 'scenario'), false, 'Defaults do not select an alternative surface');
assert.equal(Object.hasOwn(mounted.getState(), 'scenario'), false, 'State does not select an alternative surface');
assert.equal(Object.hasOwn(view.getState().result, 'scenario'), false, 'Renderer does not select an alternative surface');
assert.equal(view.getState().result.model, model.fit.id, 'Renderer identifies the one shared model');
assert.equal(model.constants.timeMax, 20);
assert.equal(Number(get('time').attrs.max), model.constants.timeMax, 'Time slider uses the shared model domain');
assert.equal(Number(get('flux').attrs.max), model.constants.fluxMax, 'Flux slider uses the shared model domain');
for (const key of ['depth-value', 'mass-value']) {
  assert.deepEqual(get(key).attrs.for.split(/\s+/).sort(), ['depth-surface-flux', 'depth-surface-time'], `${key} references only the two model inputs`);
}
assert.equal(get('depth-value').textContent, '3.00 mm');
assert.equal(get('mass-value').textContent, '0.680 g');
assert.equal(get('canvas').width, 1800, 'High-DPI backing store');
assert.equal(get('canvas').attrs.tabindex, '0', 'Keyboard-focusable plot');

near(mounted.getState().probe.time, 20);
near(view.getState().result.probe.depth, model.evaluate(20, .2592).depth);
input('time', 10); input('flux', .5844);
assert.equal(get('depth-value').textContent, '3.18 mm');
assert.equal(get('mass-value').textContent, '0.720 g');
assert.match(get('status').textContent, /Modeled depth 3.18 millimetres/);
assert.match(get('status').textContent, /not whole-brick net mass loss/);
assert.match(get('flux').attrs['aria-valuetext'], /0.5844/);
for (const [time, flux] of [[20,.2592],[10,.5844],[0,.8],[20,0],[20,.8],[12,.32]]) {
  input('time', time); input('flux', flux);
  const expected = model.evaluate(time, flux);
  assert.equal(get('depth-value').textContent, (Math.round(expected.depth * 100) / 100).toFixed(2) + ' mm');
  assert.equal(get('mass-value').textContent, expected.mass.toFixed(3) + ' g');
  assert.equal(view.getState().result.model, model.fit.id, 'Changing a probe cannot switch the model');
}
const canvas = get('canvas');
const oldYaw = mounted.getState().yaw;
assert.equal(canvas.emit('keydown', { key: 'ArrowRight' }).prevented, true); flush();
near(mounted.getState().yaw, oldYaw + .05);
canvas.emit('keydown', { key: 'ArrowUp', shiftKey: true }); flush();
near(mounted.getState().elevation, view.defaults.elevation + .15);
const beforeDrag = mounted.getState();
const pointer = { pointerId: 4, pointerType: 'mouse', isPrimary: true, button: 0, clientX: 10, clientY: 10 };
canvas.emit('pointerdown', pointer);
canvas.emit('pointermove', { ...pointer, clientX: 50, clientY: 30 }); flush();
assert.notEqual(mounted.getState().yaw, beforeDrag.yaw);
assert.deepEqual(mounted.getState().probe, beforeDrag.probe, 'Camera movement cannot change input conditions');
canvas.emit('pointerup', pointer); assert.equal(canvas.dataset.dragging, 'false');
const afterDrag = mounted.getState();
canvas.emit('pointermove', { ...pointer, clientX: 200 }); flush();
assert.deepEqual(mounted.getState(), afterDrag, 'Released drag stays still');
get('reset').emit('click'); flush();
near(mounted.getState().yaw, view.defaults.yaw); near(mounted.getState().elevation, view.defaults.elevation);
canvas.emit('keydown', { key: 'ArrowLeft' }); flush();
canvas.emit('keydown', { key: 'Home' }); flush(); near(mounted.getState().yaw, view.defaults.yaw);
for (const width of [280, 350, 560, 900, 1400]) {
  results.clientWidth = width; element.clientWidth = width + 244;
  resizeObserver(); flush();
  assert.equal(canvas.width, width * 2, `Backing store follows the ${width}px chart column`);
  assert.equal(view.getState().result.width, width, 'Settings rail cannot enlarge the rendered chart');
  assert.equal(fallback.hidden, true);
}
element.clientWidth += 100;
resizeObserver();
assert.equal(frames.size, 0, 'An unchanged chart width does not redraw when only the host changes');
assert.equal(frames.size, 0, 'An off-screen plot has no autonomous animation loop');

const angularVelocity = 6 * Math.PI / 180;
const stepAngle = angularVelocity / 60;
const snapshotPhysics = () => ({
  model: view.getState().result.model,
  probe: mounted.getState().probe,
  depth: get('depth-value').textContent,
  mass: get('mass-value').textContent,
  time: get('time').value,
  flux: get('flux').value,
  timeDescription: get('time').attrs['aria-valuetext'],
  fluxDescription: get('flux').attrs['aria-valuetext'],
  announcement: get('status').textContent
});
const assertStopped = (controller, target, reason) => {
  assert.equal(controller.getCameraState().autoRotating, false, reason);
  assert.equal(target.dataset.autoRotating, 'false', reason + ' (DOM state)');
  const yaw = controller.getState().yaw;
  tick(60000); tick(60000);
  near(controller.getState().yaw, yaw);
  assert.equal(frames.size, 0, reason + ' (no idle animation work)');
};
const assertResumes = (controller, target, resume, reason) => {
  now += 60000;
  const yaw = controller.getState().yaw;
  resume();
  assert.equal(controller.getCameraState().autoRotating, true, reason);
  assert.equal(target.dataset.autoRotating, 'true', reason + ' (DOM state)');
  tick();
  const firstDelta = controller.getState().yaw - yaw;
  assert(firstDelta >= -1e-10 && firstDelta <= stepAngle + 1e-10, reason + ' without catching up paused time');
  const afterFirstFrame = controller.getState().yaw;
  tick();
  near(controller.getState().yaw - afterFirstFrame, stepAngle);
};

canvas.emit('blur');
assert.equal(mounted.getCameraState().autoRotationEnabled, true, 'Slow rotation defaults on');
assert.equal(get('autorotate').attrs['aria-pressed'], 'true', 'Rotation preference is exposed to assistive technology');
assertStopped(mounted, canvas, 'Rotation waits until the chart enters the viewport');
assertResumes(mounted, canvas, () => intersect(canvas, true), 'Visible chart begins rotating');
const initialAutoYaw = mounted.getState().yaw;
const initialAutoElevation = mounted.getState().elevation;
const selectedPhysics = snapshotPhysics();
const readoutWriteCounts = () => ['time-value', 'flux-value', 'depth-value', 'mass-value'].map(key => get(key).textWrites);
const beforeAutoWrites = readoutWriteCounts(), beforeAutoResizes = canvas.backingResizes;
let paintedFrames = 0, lastPaintedPoints = JSON.stringify(view.getState().result.points);
for (let i = 0; i < 12; i++) {
  tick();
  const points = JSON.stringify(view.getState().result.points);
  if (points !== lastPaintedPoints) paintedFrames++;
  lastPaintedPoints = points;
}
near(mounted.getState().yaw - initialAutoYaw, angularVelocity * .2);
assert(paintedFrames > 0 && paintedFrames <= 7, 'At 60 Hz, the 30 fps paint cap renders at most half the animation frames, plus rounding');
near(mounted.getState().elevation, initialAutoElevation);
assert.deepEqual(snapshotPhysics(), selectedPhysics, 'Auto-rotation changes only the camera, not inputs, physics, readouts, or announcements');
assert.deepEqual(readoutWriteCounts(), beforeAutoWrites, 'Camera-only animation does not rewrite unchanged readout DOM');
assert.equal(canvas.backingResizes, beforeAutoResizes, 'Camera-only animation does not reset the Canvas backing store');
assert.equal(timers.size, 0, 'Auto-rotation does not repeatedly announce unchanged results');

get('autorotate').emit('click');
assert.equal(mounted.getCameraState().autoRotationEnabled, false);
assert.equal(get('autorotate').attrs['aria-pressed'], 'false');
assert.match(get('autorotate').textContent, /resume/i);
assertStopped(mounted, canvas, 'Explicit pause persists while the plot is visible');
get('reset').emit('click'); flush();
near(mounted.getState().yaw, view.defaults.yaw);
near(mounted.getState().elevation, view.defaults.elevation);
assert.equal(mounted.getCameraState().autoRotationEnabled, false, 'Reset view preserves an explicit pause');
assertResumes(mounted, canvas, () => get('autorotate').emit('click'), 'Explicit resume restarts rotation');
assert.equal(get('autorotate').attrs['aria-pressed'], 'true');
assert.match(get('autorotate').textContent, /pause/i);

canvas.emit('pointerdown', pointer);
canvas.emit('focus');
assert.equal(mounted.getCameraState().dragging, true);
assert.equal(mounted.getCameraState().keyboardFocus, false, 'Pointer-acquired focus is not keyboard focus');
assertStopped(mounted, canvas, 'Dragging suspends auto-rotation');
const manualYaw = mounted.getState().yaw;
canvas.emit('pointermove', { ...pointer, clientX: 30, clientY: 10 }); flush();
near(mounted.getState().yaw, manualYaw + .14);
assertResumes(mounted, canvas, () => canvas.emit('pointerup', pointer), 'Pointer release resumes even while pointer-focused');
assert.equal(mounted.getCameraState().dragging, false);
for (const endEvent of ['pointercancel', 'lostpointercapture']) {
  canvas.emit('pointerdown', pointer);
  assertStopped(mounted, canvas, 'A fresh drag suspends rotation before ' + endEvent);
  assertResumes(mounted, canvas, () => canvas.emit(endEvent, pointer), endEvent + ' releases the drag and resumes rotation');
}

canvas.emit('blur'); canvas.emit('focus');
assert.equal(mounted.getCameraState().keyboardFocus, true);
assertStopped(mounted, canvas, 'Keyboard focus holds the view still');
const keyboardYaw = mounted.getState().yaw;
canvas.emit('keydown', { key: 'ArrowRight' }); flush();
near(mounted.getState().yaw, keyboardYaw + .05);
assertStopped(mounted, canvas, 'Keyboard rotation stays still after a key press');
assertResumes(mounted, canvas, () => canvas.emit('blur'), 'Leaving keyboard focus resumes rotation');

intersect(canvas, false);
assertStopped(mounted, canvas, 'Off-screen chart suspends rotation');
assertResumes(mounted, canvas, () => intersect(canvas, true), 'Returning on-screen resumes rotation');
doc.hidden = true; doc.visibilityState = 'hidden'; doc.emit('visibilitychange');
assertStopped(mounted, canvas, 'A hidden document suspends rotation');
assertResumes(mounted, canvas, () => { doc.hidden = false; doc.visibilityState = 'visible'; doc.emit('visibilitychange'); }, 'A visible document resumes rotation');
win.emit('blur');
assertStopped(mounted, canvas, 'An inactive window suspends rotation');
assertResumes(mounted, canvas, () => win.emit('focus'), 'Window focus resumes rotation');
canvas.emit('pointerdown', pointer); win.emit('blur');
assert.equal(mounted.getCameraState().dragging, false, 'Window blur clears a drag rather than leaving the plot stuck');
assertStopped(mounted, canvas, 'A drag interrupted by window blur remains paused');
assertResumes(mounted, canvas, () => win.emit('focus'), 'Focus resumes after an interrupted drag');

get('reset').emit('click');
near(mounted.getState().yaw, view.defaults.yaw);
near(mounted.getState().elevation, view.defaults.elevation);
assert.equal(mounted.getCameraState().autoRotationEnabled, true, 'Reset view preserves enabled rotation');
tick();
assert.deepEqual(snapshotPhysics(), selectedPhysics, 'Manual and automatic camera controls preserve the shared model and selected point');
intersect(canvas, false);
assertStopped(mounted, canvas, 'The first chart is idle before testing reduced motion');

motionPreference.matches = true;
const reducedMount = makeMount(), reduced = view.mount(reducedMount.element), reducedCanvas = get('canvas');
assert(reduced); flush(); intersect(reducedCanvas, true);
assert.equal(reduced.getCameraState().autoRotationEnabled, false, 'Reduced motion defaults to a static camera');
assert.equal(get('autorotate').attrs['aria-pressed'], 'false');
assertStopped(reduced, reducedCanvas, 'Reduced motion stays still even when visible');
assertResumes(reduced, reducedCanvas, () => get('autorotate').emit('click'), 'A reduced-motion user may explicitly opt into rotation');
motionPreference.matches = false; motionPreference.emit('change');
motionPreference.matches = true; motionPreference.emit('change');
assert.equal(reduced.getCameraState().autoRotationEnabled, false, 'Changing to reduced motion switches animation off immediately');
assertStopped(reduced, reducedCanvas, 'A live reduced-motion preference change pauses the camera');
assertResumes(reduced, reducedCanvas, () => { motionPreference.matches = false; motionPreference.emit('change'); }, 'Clearing reduced motion restores an opted-in camera');
get('autorotate').emit('click');
assertStopped(reduced, reducedCanvas, 'An explicit reduced-motion pause is honored');
motionPreference.matches = true; motionPreference.emit('change');
motionPreference.matches = false; motionPreference.emit('change');
assert.equal(reduced.getCameraState().autoRotationEnabled, false, 'A later preference change never overrides an explicit pause');
assertStopped(reduced, reducedCanvas, 'The explicit pause survives reduced-motion changes');

console.log('PASS: filled measured/hollow assumed marker pixels, mixed-evidence labels, conditional-density mass scale, progressive fallback, idempotent mount, semantic settings rail, attached chart sizing, one shared model through mixed anchors, two-input probe parity, accessible output, keyboard/pointer rotation, reset, five responsive sizes, 6°/s fixed-elevation auto-rotation, unchanged physics/readouts, explicit pause/resume, reduced-motion opt-in, and viewport/document/window/interaction pauses without catch-up (offline DOM adapter).');
