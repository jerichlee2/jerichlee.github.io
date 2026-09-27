// Offline UI regression: execute the production FBD controller/renderers with
// a small DOM adapter and native Canvas. No browser, server, or network access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createCanvas } = require('/Users/jerichlee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');

const root = path.resolve(__dirname, '../..');
const elements = new Map();
const attributesOf = source => Object.fromEntries([...source.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
class Element {
  constructor(id, tag = 'div', attributes = {}) {
    this.id = id; this.tag = tag; this.attributes = attributes;
    this.dataset = {}; this.listeners = {}; this.children = [];
    this.value = attributes.value || ''; this.textContent = ''; this.disabled = false;
    this.type = attributes.type; this.hidden = false; this.captured = new Set();
    for (const [key, value] of Object.entries(attributes)) if (key.startsWith('data-')) {
      this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    }
    if (tag === 'canvas') {
      this.width = Number(attributes.width); this.height = Number(attributes.height);
      this.canvas = createCanvas(this.width, this.height);
      this.getContext = () => this.canvas.getContext('2d');
    }
    elements.set(id, this);
  }
  set innerHTML(html) {
    this.html = html; this.children = [];
    for (const match of html.matchAll(/<(\w+)\b([^>]*\bid="[^"]+"[^>]*)>/g)) {
      const attributes = attributesOf(match[2]);
      const element = new Element(attributes.id, match[1], attributes);
      const body = html.slice(match.index + match[0].length).split(`</${match[1]}>`)[0];
      element.textContent = body.replace(/<[^>]*>/g, '');
      if (match[1] === 'select') {
        const options = [...body.matchAll(/<option\b([^>]*)>/g)];
        element.options = options.map(option => attributesOf(option[1]).value);
        element.value = attributesOf((options.find(option => /\bselected\b/.test(option[1])) || options[0])[1]).value;
      }
      this.children.push(element);
    }
  }
  querySelector(selector) { return elements.get(selector.slice(1)); }
  querySelectorAll() { return this.children; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key]; }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  emit(name, properties = {}) {
    const event = { target: this, currentTarget: this, preventDefault() {}, ...properties };
    for (const callback of this.listeners[name] || []) callback(event);
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width / 2 || 440, height: this.height / 2 || 350 }; }
  focus() { this.focused = true; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
}

const mount = new Element('ablative-fbd-lab');
const model = require(path.join(root, 'assets/js/ablative-fbd-model.js'));
const window = {
  AblativeFBDModel: model,
  FixtureViewGeometry: require(path.join(root, 'assets/js/fixture-view-geometry.js')),
  addEventListener() {}, matchMedia: () => ({ matches: true, addEventListener() {} })
};
const pendingFrames = new Map();
let frameId = 0;
const context = vm.createContext({
  window,
  document: { getElementById: id => elements.get(id), addEventListener() {}, hidden: false },
  requestAnimationFrame(callback) { pendingFrames.set(++frameId, callback); return frameId; },
  cancelAnimationFrame(id) { pendingFrames.delete(id); },
  innerHeight: 800
});
const source = fs.readFileSync(path.join(root, 'assets/js/ablative-fbd-lab.js'), 'utf8');
vm.runInContext(source, context, { filename: 'ablative-fbd-lab.js' });
const lab = window.AblativeFBDLab;
const get = id => {
  const element = elements.get(`fbd-${id}`);
  assert(element, `Missing #fbd-${id}; run this test after the motion-profile UI is implemented.`);
  return element;
};
const click = id => get(id).emit('click');
const input = (id, value) => { get(id).value = String(value); get(id).emit('input'); };
const select = (id, value) => { get(id).value = String(value); get(id).emit('change'); };
const near = (actual, expected, label, tolerance = 1e-9) => assert(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
const tick = timestamp => {
  const callbacks = [...pendingFrames.values()]; pendingFrames.clear();
  for (const callback of callbacks) callback(timestamp);
};
const isPaused = () => {
  assert.equal(lab.getState().running, false);
  assert.equal(get('play').getAttribute('aria-pressed'), 'false');
  assert.equal(pendingFrames.size, 0);
};
const readoutsMatch = run => {
  if (run.duration === 0) {
    assert.equal(get('travel-time').textContent, '—', 'No contact event at zero speed');
    assert.equal(get('compression-time').textContent, '—', 'No compression event at zero speed');
  } else {
    assert(get('travel-time').textContent.includes(run.driveTime.toFixed(2)), 'Travel-time readout matches the selected profile');
    assert(get('compression-time').textContent.includes(run.stopTime.toFixed(2)), 'Compression-time readout matches the model');
  }
  assert(get('clock').textContent.includes(`/ ${run.duration.toFixed(2)} s`), 'Existing total-time readout remains visible');
  near(Number(get('time').max), run.duration || 1, 'Timeline maximum');
};
let checks = 0;
const test = (name, callback) => {
  try { callback(); checks++; }
  catch (error) { error.message = `${name}: ${error.message}`; throw error; }
};

test('Default selector and accelerated timing', () => {
  assert.equal(mount.dataset.ready, 'true');
  assert.deepEqual(get('driveMode').options, ['accelerated', 'steady']);
  assert.equal(get('driveMode').value, 'accelerated');
  assert.equal(lab.getModel().params.driveMode, 'accelerated');
  assert.equal(get('pullRadius').disabled, false);
  const run = lab.getModel();
  near(run.driveTime, Math.PI / 2.1, 'Accelerated travel time');
  near(run.stopTime, Math.PI * (10 * Math.PI / 180) / (2 * 2.1), 'Compression time');
  assert.equal(run.driveTime.toFixed(2), '1.50');
  assert.equal(run.stopTime.toFixed(2), '0.13');
  assert.equal(run.duration.toFixed(2), '1.63');
  readoutsMatch(run);
});

let acceleratedPeak;
test('Accelerated start, contact, and peak remain available', () => {
  const run = lab.getModel();
  click('start'); near(lab.getState().t, 0, 'Start time'); near(lab.getState().speed, 0, 'Starts from rest');
  click('contact');
  const contact = lab.getState();
  near(contact.t, run.driveTime, 'Contact time'); near(contact.angle, Math.PI / 2, 'Contact angle');
  near(contact.speed, 2.1, 'Impact speed'); near(contact.stopForce, 0, 'No instantaneous contact force');
  assert.equal(contact.phase, 'stop');
  click('peak'); acceleratedPeak = lab.getState();
  near(acceleratedPeak.t, run.duration, 'Peak time'); near(acceleratedPeak.speed, 0, 'Peak speed');
  assert.equal(acceleratedPeak.phase, 'held'); assert(acceleratedPeak.stopForce > 0);
  isPaused();
});

test('Steady selection resets and separates travel/compression time', () => {
  select('driveMode', 'steady');
  assert.equal(lab.getModel().params.driveMode, 'steady');
  near(lab.getState().t, 0, 'Selection returns to start'); isPaused();
  assert.equal(get('pullRadius').disabled, true);
  assert.match(get('pullRadius-value').textContent, /not used/i);
  assert(get('profile-help').textContent.length > 30, 'Profile has an explanatory note');
  const run = lab.getModel();
  near(run.driveTime, (Math.PI / 2) / 2.1, 'Steady travel time');
  assert.equal(run.driveTime.toFixed(2), '0.75');
  assert.equal(run.stopTime.toFixed(2), '0.13');
  assert.equal(run.duration.toFixed(2), '0.88');
  readoutsMatch(run);
});

test('Steady precontact motion has constant speed and zero drive/stop loads', () => {
  const run = lab.getModel();
  for (const fraction of [0, 0.01, 0.25, 0.5, 0.999]) {
    lab.setTime(run.driveTime * fraction);
    const state = lab.getState();
    assert.equal(state.phase, 'pull');
    near(state.angle, state.t * 2.1, 'Uniform angle progression');
    near(state.speed, 2.1, 'Constant precontact speed');
    for (const key of ['pullForce', 'stopForce', 'torque', 'acceleration', 'stress', 'compression']) near(state[key], 0, key);
    assert.match(get('overview-readout').textContent, /Fpull = 0\.00 lbf/);
    assert.match(get('overview-readout').textContent, /Fstop = 0\.00 lbf/);
  }
});

test('Steady stage buttons preserve contact state and identical peak loads', () => {
  const run = lab.getModel();
  click('start'); near(lab.getState().speed, 2.1, 'Already moving at start');
  click('contact');
  const contact = lab.getState();
  near(contact.t, run.driveTime, 'Steady contact time'); near(contact.angle, Math.PI / 2, 'Steady contact angle');
  near(contact.speed, 2.1, 'Contact speed'); near(contact.compression, 0, 'First contact compression');
  assert.equal(contact.phase, 'stop');
  click('peak'); const peak = lab.getState();
  assert.equal(peak.phase, 'held'); near(peak.t, run.duration, 'Steady peak time');
  for (const key of ['angle', 'compression', 'speed', 'stopForce', 'torque', 'stress', 'stopEnergy', 'kineticEnergy']) {
    near(peak[key], acceleratedPeak[key], `Same peak ${key}`);
  }
  isPaused();
});

test('Numeric changes retain selected profile and update durations', () => {
  for (const [id, value] of [['omega', 3.25], ['travelAngle', 120], ['stopAngle', 20]]) {
    input(id, value);
    const run = lab.getModel();
    assert.equal(run.params.driveMode, 'steady'); assert.equal(get('driveMode').value, 'steady');
    assert.equal(run.params[id], value); assert.equal(get('pullRadius').disabled, true);
    near(run.driveTime, run.params.travelAngle * Math.PI / 180 / run.params.omega, 'Updated steady travel duration');
    readoutsMatch(run); near(lab.getState().t, 0, 'Numeric input resets time');
  }
  select('driveMode', 'accelerated');
  assert.equal(get('pullRadius').disabled, false); input('pullRadius', 5.8);
  select('driveMode', 'steady'); assert.equal(lab.getModel().params.pullRadius, 5.8);
  select('driveMode', 'accelerated'); assert.equal(Number(get('pullRadius').value), 5.8);
});

test('Mode changes stop active playback and cancel its pending frame', () => {
  click('reset'); click('play'); tick(1000); tick(1100);
  assert.equal(lab.getState().running, true); assert(lab.getState().t > 0);
  select('driveMode', 'steady'); isPaused(); near(lab.getState().t, 0, 'Mode switch resets running timeline');
  tick(1200); near(lab.getState().t, 0, 'Canceled frames cannot advance time');
  click('play'); tick(1300); tick(1400); assert(lab.getState().t > 0);
  select('driveMode', 'accelerated'); isPaused(); near(lab.getState().t, 0, 'Reverse mode switch resets time');
});

test('Playback speed scales time in both profiles without changing physics', () => {
  for (const mode of ['accelerated', 'steady']) {
    select('driveMode', mode); select('speed', '0.5'); click('play');
    tick(2000); tick(2100); near(lab.getState().t, 0.05, '0.5x playback');
    const before = lab.getState().t;
    select('speed', '0.25'); tick(2200); near(lab.getState().t, before, 'Speed-change frame baseline');
    tick(2300); near(lab.getState().t, before + 0.025, '0.25x playback');
    assert.equal(lab.getModel().params.driveMode, mode);
    assert.equal(lab.getModel().params.omega, 2.1);
    click('play'); isPaused();
  }
});

test('Keyboard and pointer scrubbing remain synchronized in every view/profile', () => {
  for (const mode of ['accelerated', 'steady']) {
    select('driveMode', mode);
    for (const id of ['overview', 'rotation', 'stop']) {
      const element = get(id), run = lab.getModel(), totalDegrees = run.params.travelAngle + run.params.stopAngle;
      element.emit('keydown', { key: 'Home' });
      element.emit('keydown', { key: 'ArrowRight' }); near(lab.getState().angle, Math.PI / 180, `${id} arrow key`);
      element.emit('keydown', { key: 'ArrowUp', shiftKey: true }); near(lab.getState().angle, 6 * Math.PI / 180, `${id} shifted key`);
      element.emit('keydown', { key: 'End' }); near(lab.getState().t, run.duration, `${id} peak key`);
      element.emit('keydown', { key: 'Home' });
      const pointer = { pointerId: 7, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1, clientX: 5, clientY: 5 };
      element.emit('pointerdown', pointer);
      element.emit('pointermove', { ...pointer, clientX: 5 + element.getBoundingClientRect().width / 4 });
      element.emit('pointerup', pointer);
      near(lab.getState().angle, totalDegrees * Math.PI / 180 / 4, `${id} horizontal drag`);
      for (const view of ['overview', 'rotation', 'stop']) near(Number(get(view).getAttribute('aria-valuenow')), totalDegrees / 4, `${view} synchronized angle`);
      assert.equal(element.hasPointerCapture(7), false); isPaused();
    }
  }
});

test('Zero-speed handling remains finite, paused, and noninteractive in both modes', () => {
  for (const mode of ['accelerated', 'steady']) {
    select('driveMode', mode); input('omega', 0);
    const run = lab.getModel(), state = lab.getState();
    assert.equal(state.phase, 'rest'); assert.equal(state.params.driveMode, mode);
    for (const key of ['t', 'angle', 'speed', 'pullForce', 'stopForce', 'torque', 'stress', 'duration']) near(state[key], 0, `Zero-speed ${key}`);
    for (const id of ['play', 'time', 'contact', 'peak']) assert.equal(get(id).disabled, true, `${id} disabled`);
    for (const id of ['overview', 'rotation', 'stop']) assert.equal(get(id).getAttribute('aria-disabled'), 'true');
    readoutsMatch(run); click('play'); get('rotation').emit('keydown', { key: 'End' });
    near(lab.getState().t, 0, 'Zero-speed controls do not advance'); isPaused();
    assert(!/NaN|Infinity/.test([get('clock').textContent, get('overview-readout').textContent, get('rotation-readout').textContent, get('stop-readout').textContent].join(' ')));
  }
});

test('Reset restores accelerated defaults and normal control availability', () => {
  select('speed', '0.1'); click('reset');
  for (const [key, value] of Object.entries(model.defaults)) assert.equal(lab.getModel().params[key], value, `Reset ${key}`);
  assert.equal(get('driveMode').value, 'accelerated'); assert.equal(get('speed').value, '1');
  assert.equal(get('pullRadius').disabled, false);
  for (const id of ['play', 'time', 'contact', 'peak']) assert.equal(get(id).disabled, false);
  near(lab.getState().t, 0, 'Reset timeline'); readoutsMatch(lab.getModel()); isPaused();
});

console.log(`PASS ${checks} offline motion-profile UI regressions: selection, independent timing, stages, equal peak loads, zero speed, reset, playback, keyboard, and drag; all three native-canvas renderers executed.`);
