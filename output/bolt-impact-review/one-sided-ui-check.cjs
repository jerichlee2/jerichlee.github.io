// Offline regression: execute the production bolt controller/renderers with
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
    this.value = attributes.value || ''; this.textContent = ''; this.type = attributes.type;
    this.hidden = false; this.captured = new Set(); this.renderCount = 0;
    for (const [key, value] of Object.entries(attributes)) if (key.startsWith('data-')) {
      this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    }
    if (tag === 'canvas') {
      this.width = Number(attributes.width); this.height = Number(attributes.height);
      this.canvas = createCanvas(this.width, this.height);
      this.getContext = () => { this.renderCount++; return this.canvas.getContext('2d'); };
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
  querySelector(selector) { return elements.get(selector.slice(1)) || null; }
  querySelectorAll(selector) {
    if (selector === '[data-parameter]') return this.children.filter(element => 'parameter' in element.dataset);
    if (selector === 'input[data-parameter]') return this.children.filter(element => element.tag === 'input' && 'parameter' in element.dataset);
    throw new Error(`Unsupported adapter selector: ${selector}`);
  }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key]; }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  emit(name, properties = {}) {
    const event = { target: this, currentTarget: this, preventDefault() {}, ...properties };
    for (const callback of this.listeners[name] || []) callback(event);
  }
  getBoundingClientRect() { return { left: 0, top: 0, bottom: this.height / 2 || 300, width: this.width / 2 || 440, height: this.height / 2 || 300 }; }
  focus() { this.focused = true; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
}

const mount = new Element('bolt-impact-lab');
const model = require(path.join(root, 'assets/js/bolt-impact-model.js'));
const window = {
  BoltImpactModel: model,
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
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/bolt-impact-lab.js'), 'utf8'), context, { filename: 'bolt-impact-lab.js' });
const lab = window.BoltImpactLab;
assert(lab, 'Production bolt UI initializes successfully');
// Preserve signed zero while bringing VM-created objects into the host realm.
const plain = value => structuredClone(value);
const get = id => {
  const element = elements.get(`bolt-${id}`);
  assert(element, `Missing #bolt-${id}`);
  return element;
};
const click = id => get(id).emit('click');
const input = (id, value) => { get(id).value = String(value); get(id).emit('input'); };
const select = (id, value) => { get(id).value = String(value); get(id).emit('change'); };
const near = (actual, expected, label) => assert(Math.abs(actual - expected) < 1e-10, `${label}: ${actual} != ${expected}`);
const tick = timestamp => {
  const callbacks = [...pendingFrames.values()]; pendingFrames.clear();
  for (const callback of callbacks) callback(timestamp);
};
const checkHistory = () => {
  const state = lab.getState(), history = plain(lab.getHistory());
  assert.equal(state.params.loading, 'pulsed', 'Fixture always uses one-sided input');
  assert.equal(history.length, state.params.cycles * model.samplesPerCycle + 1);
  for (const point of history) {
    assert(point.load >= 0 && point.load <= 1, `Nonnegative imposed input at ${point.cycle}`);
    assert(point.demand >= 0, `Nonnegative elastic demand at ${point.cycle}`);
    assert(point.strain >= 0, `Nonnegative total strain at ${point.cycle}`);
    for (const value of Object.values(point)) if (typeof value === 'number') assert(Number.isFinite(value));
  }
  assert.deepEqual(history, model.simulate(state.params).points, 'Every saved field matches the pure model');
  for (let cycle = 0; cycle < state.params.cycles; cycle++) {
    assert.equal(history[cycle * model.samplesPerCycle].load, 0, 'Cycle starts at zero input');
    assert.equal(history[(cycle + 0.5) * model.samplesPerCycle].load, 1, 'Peak input at half cycle');
    assert.equal(history[(cycle + 1) * model.samplesPerCycle].load, 0, 'Cycle ends at zero input');
  }
  return history;
};
let checks = 0;
const test = (name, callback) => {
  try { callback(); checks++; }
  catch (error) { error.message = `${name}: ${error.message}`; throw error; }
};

test('One-sided initialization has no loading selector', () => {
  assert.equal(model.defaults.loading, 'pulsed');
  assert.equal(model.normalizeParams().loading, 'pulsed');
  assert.equal(elements.has('bolt-loading'), false);
  assert.equal(mount.querySelectorAll('[data-parameter]').some(element => element.dataset.parameter === 'loading'), false);
  assert.match(mount.html, /one-sided/i, 'Fixed loading explanation is visible');
  near(lab.getState().cycle, 0, 'Initial cycle');
  checkHistory();
});

test('Every physical slider preserves one-sided input and resets the cycle', () => {
  for (const [id, value] of [['omega', 3.4], ['stopAngle', 5], ['diameter', 0.16], ['length', 3]]) {
    lab.setCycle(0.75); input(id, value);
    assert.equal(lab.getState().params[id], value);
    near(lab.getState().cycle, 0, 'Input resets cycle');
    checkHistory();
  }
});

test('Both hardening modes and every cycle option preserve complete deterministic histories', () => {
  click('reset'); input('omega', 5);
  for (const hardening of ['kinematic', 'perfect']) for (const cycles of get('cycles').options.map(Number)) {
    select('hardening', hardening); select('cycles', cycles);
    assert.equal(lab.getState().params.hardening, hardening);
    assert.equal(lab.getState().params.cycles, cycles);
    const saved = checkHistory();
    for (const position of [0, 0.25, 0.5, 0.75, 1, cycles]) {
      lab.setCycle(position);
      const state = lab.getState(), expected = saved[state.index];
      for (const key of Object.keys(expected)) assert.equal(state[key], expected[key], `Scrubbed ${key}`);
    }
    assert.deepEqual(plain(lab.getHistory()), saved, 'Scrubbing never rewrites material history');
    // This is total-strain control, not reverse external-force control.
    assert(saved.some(point => point.stress < 0), 'Plastic unloading may produce negative local stress');
  }
});

test('All plot views and presentation controls retain the saved one-sided history', () => {
  const saved = checkHistory();
  lab.setCycle(0.75);
  for (const view of ['yield', 'history', 'cycles']) {
    select('view', view);
    assert.equal(lab.getState().view, view);
    near(lab.getState().cycle, 0.75, 'View preserves cycle');
  }
  for (const criterion of ['mises', 'tresca']) select('criterion', criterion);
  for (const scale of get('translation-scale').options) select('translation-scale', scale);
  for (const speed of get('speed').options) select('speed', speed);
  assert.deepEqual(plain(lab.getHistory()), saved, 'Presentation changes do not alter loading');
  for (const id of ['motion', 'strain', 'space', 'pi', 'stress-history', 'strain-history', 'cycle-ranges', 'memory']) {
    assert(get(id).renderCount > 0, `${id} native-canvas renderer executed`);
  }
});

test('Restart, active-playback reset, and defaults remain one-sided', () => {
  click('restart'); near(lab.getState().cycle, 0, 'Restart cycle'); checkHistory();
  click('play'); tick(1000); tick(1100);
  assert.equal(lab.getState().running, true); assert(lab.getState().cycle > 0);
  click('reset');
  assert.equal(lab.getState().running, false);
  assert.equal(pendingFrames.size, 0);
  assert.deepEqual(plain(lab.getState().params), { ...model.defaults, omega: 2.1, loading: 'pulsed', cycles: 3 });
  near(lab.getState().cycle, 0, 'Reset cycle');
  assert.equal(get('criterion').value, 'mises'); assert.equal(get('speed').value, '0.5');
  checkHistory();
});

test('Zero-speed input remains finite and one-sided', () => {
  input('omega', 0);
  const history = checkHistory();
  for (const point of history) for (const key of ['demand', 'strain', 'stress', 'plasticStrain']) near(point[key], 0, `Zero-speed ${key}`);
  for (const view of ['yield', 'history', 'cycles']) { lab.setView(view); lab.setCycle(1); }
  click('reset'); checkHistory();
});

test('Explicit reversed constitutive API remains available outside the fixture UI', () => {
  const reversed = model.simulate({ loading: 'reversed', omega: 5 });
  assert.equal(reversed.params.loading, 'reversed');
  assert(reversed.points.some(point => point.load < 0));
  assert(reversed.points.some(point => point.load > 0));
  assert.equal(lab.getState().params.loading, 'pulsed');
});

console.log(`PASS ${checks} offline one-sided bolt UI regressions: selector removal, defaults, reset, every control, all cycle options, both hardening modes, complete model parity, zero speed, and all eight native-canvas renderers.`);
