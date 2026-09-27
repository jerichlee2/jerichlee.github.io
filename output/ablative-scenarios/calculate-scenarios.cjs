// Reproducible forward scenarios. No parameter is fitted to the temperature traces.
// Run with Node.js. Writes only this task's generated analysis artifacts.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'assets/builds/ablative-material-testing-fixture/analysis');
fs.mkdirSync(out, { recursive: true });
const choice = (nominal, range, unit, basis, evidence_class = 'ANALYST_SELECTED_SCENARIO') => ({ nominal, range, unit, basis, evidence_class });
const reported = (nominal, unit, basis) => ({ nominal, range: [nominal, nominal], unit, basis,
  evidence_class: 'USER_REPORTED_MEASUREMENT', measurement_uncertainty: null,
  sensitivity_treatment: 'Held fixed at reported value; unknown measurement uncertainty is excluded, not zero.' });
const inputs = {
  status: 'MIXED USER-REPORTED MEASUREMENTS AND SELECTED ASSUMPTIONS — NOT MEASURED THERMAL PROPERTIES',
  purpose: 'Forward sensitivity / measurement planning; not a thermal-property fit, ablation model, or engine qualification.',
  range_interpretation: 'Selected endpoint sensitivity envelope, not a statistical confidence interval or proven physical bound. Unlisted model errors can exceed it.',
  shared: {
    width_mm: choice(50.8, [48, 54], 'mm', 'User confirmed nominal brick size 2 × 3.5 × 0.5 inches in this conversation; corroborated by December 12 design review slide 11. Ranges analyst-selected, not measured manufacturing tolerances.', 'USER_CONFIRMED_NOMINAL_GEOMETRY_WITH_SELECTED_SWEEP'),
    height_mm: choice(88.9, [85, 93], 'mm', 'Same user-confirmed nominal dimensions; no individual caliper measurements or tolerances available.', 'USER_CONFIRMED_NOMINAL_GEOMETRY_WITH_SELECTED_SWEEP'),
    thickness_mm: choice(12.7, [10, 15], 'mm', 'Same user-confirmed nominal thickness; actual local thickness variation and sensor depth are not measured.', 'USER_CONFIRMED_NOMINAL_GEOMETRY_WITH_SELECTED_SWEEP'),
    cp_J_kgK: choice(1000, [700, 1500], 'J/(kg·K)', 'Analyst-selected constant-property scenario; not a measured or literature-validated value for this batch.'),
    k_W_mK: choice(0.16, [0.08, 0.32], 'W/(m·K)', 'Nominal reused only as an assumption from semiinfiniteablative.tex lines 99–102; that earlier calculation cites no material-property measurement. Factor-two range analyst-selected.'),
    dimple_diameter_mm: choice(20, [10, 30], 'mm', 'Analyst-selected circular footprint. Not dimensioned from photos; not a measured flame footprint.'),
    heated_diameter_mm: choice(20, [10, 30], 'mm', 'Separate analyst-selected uniformly heated circular footprint. Not inferred from the dimple diameter and varied independently.'),
    depression_shape_factor: choice(0.5, [1 / 3, 1], 'dimensionless', 'V=f*projected_area*depth: paraboloid nominal; cone-to-cylinder scenario range. Not fitted to a surface scan.'),
    graphite_flux_multiplier: choice(1, [0.73, 1.33], 'dimensionless', 'Report sensitivity to ±20% graphite heat capacity; not complete flux uncertainty and not a brick absorptivity factor.')
  },
  runs: [
    { id: 'baseline_20s', label: 'Baseline · 20 s · right', graphite_flux_MW_m2: 0.2592,
      mass_g: choice(50, [30, 80], 'g', 'Analyst-selected baseline pre-test mass; no baseline mass measurement is available.'),
      duration_s: choice(20, [19, 21], 's', 'Reported nominal exposure; ±1 s is an analyst timing scenario, not measured timing error.', 'REPORT_NOMINAL_DURATION_WITH_SELECTED_SWEEP'),
      depth_mm: choice(3, [1, 5], 'mm', 'Analyst-selected baseline example, NOT an image measurement. Retained as a hypothesis, not adjusted to enforce the earlier qualitative photo ordering.') },
    { id: 'hot_10s', label: 'Hot · 10 s · left', graphite_flux_MW_m2: 0.5844,
      mass_g: reported(82.8, 'g', 'User confirmed pre-test mass for the hot 10 s / approximately 2.25× reference-flux test. Instrument uncertainty and conditioning/cleaning state were not supplied.'),
      post_test_mass_g: reported(73.9, 'g', 'User confirmed post-test mass for the same hot specimen. Instrument uncertainty and conditioning/cleaning state were not supplied.'),
      duration_s: choice(10, [9, 11], 's', 'Reported nominal exposure; ±1 s is an analyst timing scenario, not measured timing error.', 'REPORT_NOMINAL_DURATION_WITH_SELECTED_SWEEP'),
      depth_mm: reported(3.175, 'mm', 'User confirmed approximately 1/8 inch dimple depth for this hot specimen. Conversion is exactly 3.175 mm, not measurement precision. Reference-plane method and measurement uncertainty were not supplied.') }
  ],
  geometry: 'Uniform rectangular specimen; circular depression V=f*πD²d/4 with paraboloid f=1/2 nominal and cone-to-cylinder f=1/3..1 scenarios. Char-rim swelling, cracks, shedding, porosity changes and density changes are excluded.',
  thermal_model: 'Homogeneous constant-property original virgin slab, using alpha=k/(rho*cp). Diffusion length sqrt(alpha*t) is a convention, not a sharp front or ablation depth. L²/alpha is a characteristic scale, not an onset prediction.',
  sources: [
    { role: 'Design corroboration of nominal dimensions; user separately confirmed 2 × 3.5 × 0.5 inches. Not individual specimen metrology.', title: 'Ablative Testing LRI Presentation 2025-12-12, slide 11: 2 x 3.5 x 0.5 Mold', url: 'https://docs.google.com/presentation/d/18DxEOy2dH5_4A8xdhqXUpu7fwHjdE_QfHz8l_n1QdhM/edit#slide=id.g3aac5729a02_0_10' },
    { role: 'User-reported hot 10 s measurements', source: 'User confirmation in this conversation', pre_test_mass_g: 82.8, post_test_mass_g: 73.9, approximate_dimple_depth_in: 0.125, measurement_uncertainty: null },
    { role: 'Reported exposures, graphite flux and sensitivity', local_path: '/Users/jerichlee/Documents/JerichCore/30_research/lri/projects/ablative-testing/final-report/ablative_test_final_report.tex' },
    { role: 'Unvalidated prior k assumption only; its graphite thickness, heat flux and alpha are NOT reused', local_path: '/Users/jerichlee/Documents/JerichCore/30_research/lri/projects/ablative-testing/semi-infinite-model/semiinfiniteablative.tex', lines: '99–102' },
    { role: 'Property relation, not numeric brick-property source', url: 'https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication960-11.pdf', section: '6.3.1.6' },
    { role: 'Property-identification method and uncertainty', url: 'https://authors.library.caltech.edu/records/w7s9t-q5s59' },
    { role: 'Recession / inverse-heat-transfer ambiguity', url: 'https://ntrs.nasa.gov/citations/20170004352' }
  ]
};
const units = {
  volume_cm3: 'cm³', density_kg_m3: 'kg/m³', specimen_heat_capacity_J_K: 'J/K',
  diffusivity_mm2_s: 'mm²/s', through_thickness_diffusion_time_s: 's', fourier_number: 'dimensionless',
  diffusion_length_mm: 'mm', equivalent_dose_MJ_m2: 'MJ/m²', equivalent_footprint_energy_kJ: 'kJ',
  depth_mm: 'mm', depth_rate_mm_s: 'mm/s', depth_per_equivalent_dose: 'mm/(MJ/m²)',
  depression_volume_cm3: 'cm³', virgin_density_equivalent_mass_g: 'g', remaining_geometric_thickness_mm: 'mm'
};
function calculate(s, run) {
  const w = s.width_mm / 1000, h = s.height_mm / 1000, L = s.thickness_mm / 1000;
  const V = w * h * L, m = s.mass_g / 1000, rho = m / V;
  const alpha = s.k_W_mK / (rho * s.cp_J_kgK);
  const d = s.depth_mm / 1000, D = s.dimple_diameter_mm / 1000;
  const footprint = Math.PI * (s.heated_diameter_mm / 1000) ** 2 / 4;
  const vd = Math.PI * D * D / 4 * d * s.depression_shape_factor;
  const Q = run.graphite_flux_MW_m2 * s.graphite_flux_multiplier * s.duration_s;
  assert(d >= 0 && d < L && D < w && D < h, 'Valid illustrative geometry');
  return {
    volume_cm3: V * 1e6, density_kg_m3: rho, specimen_heat_capacity_J_K: m * s.cp_J_kgK,
    diffusivity_mm2_s: alpha * 1e6, through_thickness_diffusion_time_s: L * L / alpha,
    fourier_number: alpha * s.duration_s / (L * L), diffusion_length_mm: Math.sqrt(alpha * s.duration_s) * 1000,
    equivalent_dose_MJ_m2: Q, equivalent_footprint_energy_kJ: Q * footprint * 1000,
    depth_mm: s.depth_mm, depth_rate_mm_s: s.depth_mm / s.duration_s, depth_per_equivalent_dose: s.depth_mm / Q,
    depression_volume_cm3: vd * 1e6, virgin_density_equivalent_mass_g: rho * vd * 1000,
    remaining_geometric_thickness_mm: s.thickness_mm - s.depth_mm
  };
}
function endpoints(specs) {
  let values = [{}];
  for (const [key, spec] of Object.entries(specs)) values = values.flatMap(s => [...new Set(spec.range)].map(v => ({ ...s, [key]: v })));
  return values;
}
const runs = inputs.runs.map(run => {
  const specs = { ...inputs.shared, mass_g: run.mass_g, duration_s: run.duration_s, depth_mm: run.depth_mm };
  const nominalInputs = Object.fromEntries(Object.entries(specs).map(([k, v]) => [k, v.nominal]));
  const nominal = calculate(nominalInputs, run);
  const corners = endpoints(specs).map(s => calculate(s, run));
  const envelope = Object.fromEntries(Object.keys(nominal).map(k => [k, [Math.min(...corners.map(s => s[k])), Math.max(...corners.map(s => s[k]))]]));
  const fixedInputs = Object.keys(specs).filter(k => new Set(specs[k].range).size === 1);
  const result = { id: run.id, label: run.label, endpoint_cases: corners.length,
    varied_inputs: Object.keys(specs).filter(k => !fixedInputs.includes(k)), fixed_inputs: fixedInputs,
    excluded_uncertainty: fixedInputs.length ? 'Hot mass and approximate depth are fixed reported points. Their unknown measurement uncertainties are not included in these sensitivity envelopes.' : null,
    input_evidence: Object.fromEntries(Object.entries(specs).map(([k, v]) => [k, v.evidence_class])), nominal, envelope };
  if (run.post_test_mass_g) result.reported_mass_balance = {
    evidence_class: 'ARITHMETIC_FROM_USER_REPORTED_MASSES', pre_test_mass_g: run.mass_g.nominal,
    post_test_mass_g: run.post_test_mass_g.nominal, mass_difference_g: run.mass_g.nominal - run.post_test_mass_g.nominal,
    mass_difference_percent_initial: 100 * (run.mass_g.nominal - run.post_test_mass_g.nominal) / run.mass_g.nominal,
    measurement_uncertainty: null, caveat: 'Total specimen mass difference, not mass proven to have come from the dimple. Conditioning, residual char, moisture and collection/cleaning protocol are unverified.'
  };
  return result;
});
// Hand-checks, dependencies and scaling tests. Derived ranges preserve shared inputs within each case.
assert(Math.abs(runs[0].nominal.equivalent_dose_MJ_m2 - 5.184) < 1e-12);
assert(Math.abs(runs[1].nominal.equivalent_dose_MJ_m2 - 5.844) < 1e-12);
assert(Math.abs(runs[0].nominal.volume_cm3 - 57.354724) < 1e-8);
assert(Math.abs(runs[0].nominal.depression_volume_cm3 - Math.PI * 0.15) < 1e-12);
assert(Math.abs(runs[0].nominal.density_kg_m3 * runs[0].nominal.volume_cm3 / 1000 - 50) < 1e-12);
assert.equal(runs[0].nominal.specimen_heat_capacity_J_K, 50);
assert(Math.abs(runs[1].nominal.density_kg_m3 * runs[1].nominal.volume_cm3 / 1000 - 82.8) < 1e-12);
assert.equal(runs[1].nominal.specimen_heat_capacity_J_K, 82.8);
assert.equal(runs[1].nominal.depth_mm, 3.175);
assert(Math.abs(runs[1].reported_mass_balance.mass_difference_g - 8.9) < 1e-12);
assert.equal(runs[1].reported_mass_balance.measurement_uncertainty, null);
assert.deepEqual(runs.map(r => r.endpoint_cases), [4096, 1024]);
assert.deepEqual(runs[1].fixed_inputs, ['mass_g', 'depth_mm']);
for (const r of runs) for (const [k, v] of Object.entries(r.nominal)) assert(r.envelope[k][0] <= v && v <= r.envelope[k][1]);
const results = { status: inputs.status, range_interpretation: inputs.range_interpretation, fit_performed: false, units, runs };
// A descriptive comparison that actually uses the recovered figure, separately from the material assumptions.
const digitized = JSON.parse(fs.readFileSync(path.join(out, 'digitized-chambersafe-summary.json'), 'utf8'));
assert.equal(digitized.classification, 'DIGITIZED_NOT_RAW');
results.recovered_trace_comparison = {
  classification: 'DIGITIZED_PEAK_DIVIDED_BY_REFERENCE_DOSE_NOT_A_MATERIAL_PROPERTY',
  digitization_source: 'digitized-chambersafe-summary.json', source_plot_sha256: digitized.source.sha256,
  warning: 'Each peak covers its entire unequal log window, not an aligned exposure window. This ratio is not heat transfer efficiency, conductivity, heat capacity, or a material ranking. Sensor errors and heating-boundary uncertainty are not quantified.',
  runs: runs.map(r => {
    const peak = digitized.results[r.id].visible_maximum_delta_c_approx;
    const dp = digitized.graphical_uncertainty.temperature_c_approx;
    const q = r.envelope.equivalent_dose_MJ_m2;
    return { id: r.id, peak_delta_c_digitized: peak, graphical_allowance_c: dp,
      peak_per_reference_dose_K_per_MJ_m2: peak / r.nominal.equivalent_dose_MJ_m2,
      selected_graphical_and_dose_envelope: [(peak - dp) / q[1], (peak + dp) / q[0]] };
  }),
  hot_table6_alternative: { reported_peak_delta_c: 0.241, peak_per_reference_dose_K_per_MJ_m2: 0.241 / runs[1].nominal.equivalent_dose_MJ_m2, note: 'Separate report-table value, not substituted for the digitized curve peak.' }
};
fs.writeFileSync(path.join(out, 'scenario-inputs.json'), JSON.stringify(inputs, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'scenario-results.json'), JSON.stringify(results, null, 2) + '\n');
const csv = ['status,run,quantity,unit,nominal,selected_envelope_min,selected_envelope_max,envelope_notes'];
for (const r of runs) {
  for (const k of Object.keys(units)) csv.push([k === 'depth_mm' && r.id === 'hot_10s' ? 'USER_REPORTED_APPROXIMATE_DEPTH_UNCERTAINTY_UNKNOWN' : 'CONDITIONAL_FROM_MIXED_INPUTS_NOT_MEASURED_THERMAL_PROPERTY', r.id, k, units[k], r.nominal[k].toPrecision(8), ...r.envelope[k].map(x => x.toPrecision(8)), r.id === 'hot_10s' ? 'Hot mass and depth held fixed; their unknown measurement uncertainties are excluded' : 'Selected assumption sensitivities; not confidence intervals'].join(','));
  if (r.reported_mass_balance) for (const [key, unit] of Object.entries({ pre_test_mass_g: 'g', post_test_mass_g: 'g', mass_difference_g: 'g', mass_difference_percent_initial: '%' })) {
    csv.push(['USER_REPORTED_MASS_OR_DIRECT_ARITHMETIC', r.id, key, unit, r.reported_mass_balance[key].toPrecision(8), '', '', 'No interval supplied; weighing uncertainty and conditioning protocol unknown'].join(','));
  }
}
fs.writeFileSync(path.join(out, 'scenario-results.csv'), csv.join('\n') + '\n');
const recoveredCsv = ['status,run,peak_delta_c_digitized,graphical_allowance_c,peak_per_reference_dose_K_per_MJ_m2,selected_graphical_and_dose_min,selected_graphical_and_dose_max'];
for (const r of results.recovered_trace_comparison.runs) recoveredCsv.push(['DIGITIZED_NOT_RAW_NOT_MATERIAL_PROPERTY',r.id,r.peak_delta_c_digitized,r.graphical_allowance_c,r.peak_per_reference_dose_K_per_MJ_m2,...r.selected_graphical_and_dose_envelope].join(','));
fs.writeFileSync(path.join(out, 'digitized-peak-reference-dose-comparison.csv'), recoveredCsv.join('\n') + '\n');

// A mixed-evidence plot, intentionally no fitted line between the two depths.
const width = 1000, height = 630;
const p = { left: 100, right: 945, top: 144, bottom: 500 };
const x = q => p.left + (q / 10) * (p.right - p.left), y = d => p.bottom - (d / 6) * (p.bottom - p.top);
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">Mixed-evidence dimple depths versus graphite-equivalent dose</title><desc id="desc">Blue baseline assumes 3 millimeters. Orange hot is the user-reported approximate one-eighth-inch depth, converted to 3.175 millimeters and held fixed. The blue rectangle and orange horizontal line show selected input sensitivity, not confidence intervals. Hot depth measurement uncertainty is unknown and excluded. No depth versus dose law is fitted here.</desc><rect width="100%" height="100%" fill="#fffdfa"/><g font-family="Georgia,serif" fill="#28251f"><text x="50" y="42" font-size="28" font-weight="bold">One assumed depth; one user-reported depth</text><text x="50" y="76" font-size="21">Baseline: assumed 3 mm · Hot: reported ≈1/8 in (≈3.2 mm)</text><text x="50" y="109" font-size="18" fill="#686158">Selected sensitivities only; hot depth measurement uncertainty is excluded.</text>`;
for (let i = 0; i <= 10; i += 2) svg += `<path d="M${x(i)} ${p.top}V${p.bottom}" stroke="#e0dacf"/><text x="${x(i)}" y="529" font-size="18" text-anchor="middle">${i}</text>`;
for (let i = 0; i <= 6; i++) svg += `<path d="M${p.left} ${y(i)}H${p.right}" stroke="#e0dacf"/><text x="84" y="${y(i) + 6}" font-size="18" text-anchor="end">${i}</text>`;
for (let i = 0; i < runs.length; i++) {
  const r = runs[i], c = i ? '#b95a1a' : '#2074a3';
  const q = r.envelope.equivalent_dose_MJ_m2, d = r.envelope.depth_mm;
  svg += d[0] === d[1]
    ? `<path d="M${x(q[0])} ${y(d[0])}H${x(q[1])}" fill="none" stroke="${c}" stroke-dasharray="7 5" stroke-width="2"/>`
    : `<rect x="${x(q[0])}" y="${y(d[1])}" width="${x(q[1])-x(q[0])}" height="${y(d[0])-y(d[1])}" fill="${c}" fill-opacity="0.09" stroke="${c}" stroke-dasharray="7 5" stroke-width="2"/>`;
  svg += `<circle cx="${x(r.nominal.equivalent_dose_MJ_m2)}" cy="${y(r.nominal.depth_mm)}" r="7" fill="${i ? c : '#fffdfa'}" stroke="${c}" stroke-width="3"/><text x="${x(r.nominal.equivalent_dose_MJ_m2)+13}" y="${y(r.nominal.depth_mm)+(i ? -17 : 30)}" font-size="19" fill="${c}">${i ? '10 s hot · reported ≈3.2 mm' : '20 s baseline · assumed 3 mm'}</text>`;
}
svg += `<path d="M${p.left} ${p.top}V${p.bottom}H${p.right}" fill="none" stroke="#686158"/><text x="520" y="569" font-size="22" text-anchor="middle">Graphite-equivalent dose (MJ/m²) · not absorbed brick energy</text><text transform="translate(35 325) rotate(-90)" text-anchor="middle" font-size="22">Depression depth (mm)</text><text x="50" y="610" font-size="18" fill="#686158">Baseline remains assumed; this does not establish an experimental depth–dose law.</text></g></svg>`;
fs.writeFileSync(path.join(out, 'scenario-depth-dose.svg'), svg);
fs.copyFileSync(path.join(__dirname, 'README.md'), path.join(out, 'assumption-analysis-README.md'));
if (process.argv.includes('--verbose')) console.log(JSON.stringify(results, null, 2));
else console.log(JSON.stringify({ runs: runs.map(r => ({ id: r.id, endpoint_cases: r.endpoint_cases, varied_inputs: r.varied_inputs.length, fixed_inputs: r.fixed_inputs, nominal_density_kg_m3: r.nominal.density_kg_m3, nominal_diffusivity_mm2_s: r.nominal.diffusivity_mm2_s })), fit_performed: false }));
console.log('PASS: geometry, units, dose, per-run mass conservation, reported hot measurements, and mixed-input sensitivity envelopes.');
