// Generate downloads and the non-JavaScript fallback from the production model
// and renderer. No browser, network connection, or server is used.
"use strict";
const fs = require('node:fs');
const path = require('node:path');
const { createCanvas } = require('/Users/jerichlee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const model = require('../../assets/js/ablative-depth-surface-model.js');
const view = require('../../assets/js/ablative-depth-surface.js');
const out = path.resolve(__dirname, '../../assets/builds/ablative-material-testing-fixture/analysis');
const width = 1000, height = 720;
const canvas = createCanvas(width, height);
view.render(canvas.getContext('2d'), { width, height, probe: { time: 20, flux: .2592 } });
fs.writeFileSync(path.join(out, 'scenario-depth-surface.png'), canvas.toBuffer('image/png'));
const csv = ['classification,model,time_s,graphite_reference_flux_MW_m2,reference_dose_MJ_m2,modeled_depth_mm,conditional_density_equivalent_dimple_mass_g'];
for (let i = 0; i <= 50; i++) for (let j = 0; j <= 40; j++) {
  const p = model.evaluate(i / 50 * model.constants.timeMax, j / 40 * model.constants.fluxMax);
  csv.push(['SYNTHETIC_MIXED_ANCHOR_RESPONSE_NOT_MEASURED', model.fit.id, p.time, p.flux, p.dose, p.depth, p.mass].join(','));
}
fs.writeFileSync(path.join(out, 'depth-surface-grid-NOT-MEASURED.csv'), csv.join('\n') + '\n');
const description = {
  classification: 'PARTLY_CALIBRATED_MIXED_DEPTH_ANCHORS_NOT_VALIDATED',
  equation: 'depth_mm = 3 * (graphite_reference_flux_MW_m2 / 0.2592) * (time_s / 20)^n',
  fit_performed: true,
  fit_target: 'One approximate measured hot-run dimple depth and one assumed baseline depth. Flux exponent fixed at 1 by choice; time exponent solved from the mixed-evidence anchors.',
  measured_data_fit: true,
  measured_data_fit_scope: 'One user-confirmed approximate hot-run dimple depth (about 1/8 in, shown as ≈3.2 mm). The baseline 3 mm remains assumed; no thermocouple temperatures, conductivity, or heat capacity were fitted.',
  measured_depth_anchor_count: 1,
  assumed_depth_anchor_count: 1,
  thermocouple_fit: false,
  validated: false,
  mass_interpretation: 'Geometric dimple-equivalent mass using conditional hot-brick initial density (82.8 g / nominal 2 × 3.5 × 0.5 in volume), transferred across the entire surface. The 20 mm paraboloid shape remains assumed. This is not the reported 8.9 g whole-brick net loss, retained char mass, or an independent mass prediction.',
  limitations: 'One of many possible surfaces through one approximate measured depth and one assumed depth. The conversion 1/8 in = 3.175 mm preserves unit arithmetic, not measurement precision. Equal dose need not give equal depth because of the chosen functional family, not a validated test finding. No onset, evolving thermal-history, char, erosion, or breakthrough physics. Reference flux is not measured absorbed brick flux. The plotted domain is not a validated operating range.',
  constants: model.constants, model: model.fit, anchor_points: model.points, evidence: model.evidence,
  source_inputs: 'scenario-inputs.json', source_results: 'scenario-results.json',
  grid_rows: csv.length - 1
};
fs.writeFileSync(path.join(out, 'depth-surface-scenarios.json'), JSON.stringify(description, null, 2) + '\n');
fs.copyFileSync(path.join(__dirname, 'depth-surface-README.md'), path.join(out, 'depth-surface-README.md'));
console.log(`Generated shared 3D fallback, ${csv.length - 1} synthetic grid rows, model JSON, and method notes.`);
