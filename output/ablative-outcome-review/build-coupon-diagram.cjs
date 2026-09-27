// Separate specimens, not a two-layer assembly or a new ablator solver.
// Graphite constants: campaign report, 1D model, reproduced on the project page.
// Ablator geometry/exposures: run provenance. Its properties are unknown targets,
// not the separate forward-scenario assumptions in scenario-inputs.json.
// Run: node output/ablative-outcome-review/build-coupon-diagram.cjs
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const directory = path.join(root, 'assets/builds/ablative-material-testing-fixture/analysis');
const provenance = JSON.parse(fs.readFileSync(path.join(__dirname, 'results-and-provenance.json'), 'utf8'));
const page = fs.readFileSync(path.join(root, 'builds/ablative-material-testing-fixture.html'), 'utf8');
const graphite = {thickness_mm:23.62, conductivity_W_mK:130, density_kg_m3:1850, cp_J_kgK:700, pulse_s:3};
for (const reported of ['L = 0.02362', 'k = 130', '\\rho = 1850', 'c = 700']) {
  assert(page.includes(reported), `Graphite constant matches the existing model: ${reported}`);
}
const [baseline, hot] = provenance.tests;
assert.equal(baseline.condition, 'Baseline');
assert.equal(hot.condition, 'Hot');
const nominalThickness = provenance.nominal_dimensions_mm.thickness;
assert(nominalThickness > 0);
for (const run of [baseline, hot]) {
  assert(run.exposure_s > 0 && run.graphite_net_flux_MW_m2 > 0);
}
const number = (n, digits=0) => n.toLocaleString('en-US', {minimumFractionDigits:digits, maximumFractionDigits:digits});
const sub = value => `<tspan font-size="70%" baseline-shift="sub">${value}</tspan>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="1080" viewBox="0 0 1120 1080" role="img" aria-labelledby="coupon-title coupon-desc">
  <title id="coupon-title">Graphite reference and ablative sample: heat-transfer boundaries and properties</title>
  <desc id="coupon-desc">Two separate specimens placed in the same torch position. The fitted graphite model has thickness ${number(graphite.thickness_mm,2)} mm, conductivity ${graphite.conductivity_W_mK} W per meter kelvin, density ${graphite.density_kg_m3} kg per cubic meter and specific heat ${graphite.cp_J_kgK} J per kg kelvin. It assumes a uniform starting temperature, a three-second net inward flux pulse and an adiabatic back face over the early fit window, where a thermocouple measures temperature. Fitted fluxes are ${number(baseline.graphite_net_flux_MW_m2,4)} and ${number(hot.graphite_net_flux_MW_m2,4)} MW per square meter. ChamberSafe is the material to characterize: its conductivity and specific heat are unknown outputs, with no assigned values in this diagram. Nominal original thickness is ${number(nominalThickness,1)} mm; baseline and hot exposures lasted ${baseline.exposure_s} and ${hot.exposure_s} seconds. Bulk density requires measured initial mass and volume for each specimen. Heat input, losses and sensor coupling must also be constrained; the current back-face traces alone do not uniquely identify the thermal properties. No graphite boundary condition is silently transferred to the brick.</desc>
  <defs>
    <marker id="coupon-heat-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#ac432c"/></marker>
    <marker id="coupon-axis-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#6b655b"/></marker>
    <pattern id="coupon-insulation" width="8" height="10" patternUnits="userSpaceOnUse"><path d="M-2 10L8 0M6 12L10 8" stroke="#467278" stroke-width="1.5"/></pattern>
    <pattern id="coupon-grain" width="15" height="15" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r=".8" fill="#fffdf9" opacity=".18"/></pattern>
  </defs>
  <rect width="1120" height="1080" fill="#fffdf9"/>
  <g font-family="Georgia, 'Times New Roman', serif" fill="#38352f">
    <text x="40" y="46" font-size="31" font-weight="bold">Graphite reference → ablative sample</text>
    <text x="40" y="80" font-size="21" fill="#6b655b">Separate specimens at the same torch position—not stacked layers · not to scale</text>
    <path d="M40 103H1080" stroke="#d5cec2"/>

    <text x="40" y="145" font-size="26" font-weight="bold">1. Graphite · fitted 1D model</text>
    <text x="1080" y="145" font-size="22" text-anchor="end">${graphite.pulse_s} s pulse · 0–3.5 s fit window</text>
    <text x="40" y="179" font-size="21" fill="#6b655b">Initial condition: T(x, 0) = T${sub('0')}, uniform at that run’s starting temperature.</text>

    <rect x="320" y="212" width="460" height="190" fill="#575047"/>
    <rect x="320" y="212" width="460" height="190" fill="url(#coupon-grain)"/>
    <rect x="320" y="212" width="460" height="190" fill="none" stroke="#71685b" stroke-width="1.5"/>
    <path d="M320 207V407" stroke="#ac432c" stroke-width="3"/>
    <rect x="780" y="207" width="16" height="200" fill="url(#coupon-insulation)"/>
    <path d="M780 207V407" stroke="#467278" stroke-width="3"/>
    <g text-anchor="middle" fill="#fffdf9">
      <text x="550" y="249" font-size="25" font-weight="bold">Fixed graphite model inputs</text>
      <text x="550" y="289" font-size="24">k = ${number(graphite.conductivity_W_mK)} W/(m·K)</text>
      <text x="550" y="325" font-size="24">ρ = ${number(graphite.density_kg_m3)} kg/m³</text>
      <text x="550" y="361" font-size="24">c${sub('p')} = ${number(graphite.cp_J_kgK)} J/(kg·K)</text>
    </g>
    <path d="M361 383H735" stroke="#d58e60" stroke-width="2.5" marker-end="url(#coupon-heat-arrow)"/>
    <g text-anchor="middle" fill="#ac432c">
      <text x="170" y="236" font-size="21">Hot-face flux boundary</text>
      <text x="170" y="272" font-size="25">−k ∂T/∂x = q″${sub('g')}(t)</text>
      <path d="M85 297H306" stroke="#ac432c" stroke-width="3" marker-end="url(#coupon-heat-arrow)"/>
      <text x="170" y="336" font-size="23">q″${sub('g')} = q${sub('0')} for 0 &lt; t &lt; 3 s</text>
      <text x="170" y="371" font-size="23">q″${sub('g')} = 0 for t ≥ 3 s</text>
    </g>
    <g text-anchor="middle" fill="#365e63">
      <text x="939" y="235" font-size="22">Back boundary</text>
      <text x="939" y="272" font-size="26">−k ∂T/∂x = 0</text>
      <text x="939" y="308" font-size="20">Silica-cloth sensor region</text>
      <text x="939" y="337" font-size="20">Early-window assumption</text>
    </g>
    <circle cx="780" cy="377" r="7" fill="#fffdf9" stroke="#365e63" stroke-width="2.5"/>
    <path d="M789 377H838" stroke="#365e63" stroke-width="1.5"/>
    <text x="851" y="386" font-size="22" fill="#365e63">Back-face TC · x = L${sub('g')}</text>
    <path d="M320 422V438M320 431H780M780 422V438" fill="none" stroke="#958b7d" stroke-width="1.4"/>
    <rect x="407" y="416" width="287" height="30" fill="#fffdf9"/>
    <text x="550" y="440" text-anchor="middle" font-size="22">L${sub('g')} = ${number(graphite.thickness_mm,2)} mm (0.93 in)</text>
    <text x="320" y="435" dx="-17" text-anchor="end" font-size="19" fill="#6b655b">x = 0</text>
    <path d="M795 431H843" stroke="#6b655b" marker-end="url(#coupon-axis-arrow)"/>
    <text x="854" y="438" font-size="19" fill="#6b655b">x</text>
    <rect x="40" y="461" width="1040" height="45" fill="#f3f0e9"/>
    <text x="60" y="491" font-size="23">Temperature trace → inverse fit → q${sub('0')} = ${number(baseline.graphite_net_flux_MW_m2,4)} / ${number(hot.graphite_net_flux_MW_m2,4)} MW/m² (baseline / hot)</text>
    <path d="M40 532H1080" stroke="#d5cec2"/>

    <text x="40" y="577" font-size="26" font-weight="bold">2. ChamberSafe · material characterization</text>
    <text x="1080" y="577" text-anchor="end" font-size="21">${baseline.exposure_s} s baseline / ${hot.exposure_s} s hot</text>
    <text x="40" y="611" font-size="21" fill="#6b655b">Thermal properties are characterization targets, not assigned model inputs.</text>
    <rect x="320" y="644" width="460" height="190" fill="#e6dfd2" stroke="#71685b" stroke-width="1.5"/>
    <path d="M320 639V839" stroke="#ac432c" stroke-width="3" stroke-dasharray="6 5"/>
    <path d="M780 639V839" stroke="#467278" stroke-width="3" stroke-dasharray="6 5"/>
    <g text-anchor="middle">
      <text x="550" y="680" font-size="25" font-weight="bold">Characterization targets</text>
      <text x="550" y="718" font-size="24">Conductivity k(T): unknown</text>
      <text x="550" y="755" font-size="24">Specific heat c${sub('p')}(T): unknown</text>
      <text x="550" y="792" font-size="21" fill="#6b655b">No values assigned here</text>
    </g>
    <path d="M361 815H735" stroke="#ac432c" stroke-width="2" stroke-dasharray="5 5" marker-end="url(#coupon-heat-arrow)"/>
    <g text-anchor="middle" fill="#ac432c">
      <text x="170" y="667" font-size="21">Conductive heat input</text>
      <text x="170" y="704" font-size="27">q″${sub('a')}(t) = ?</text>
      <path d="M85 729H306" stroke="#ac432c" stroke-width="3" stroke-dasharray="6 5" marker-end="url(#coupon-heat-arrow)"/>
      <text x="170" y="768" font-size="19">Surface / char energy split:</text>
      <text x="170" y="792" font-size="19">unknown. Recession history</text>
      <text x="170" y="816" font-size="19">also remains unresolved.</text>
    </g>
    <g text-anchor="middle" fill="#365e63">
      <text x="939" y="667" font-size="21">Back / fixture heat loss</text>
      <text x="939" y="704" font-size="27">q″${sub('back')}(t) = ?</text>
      <text x="939" y="740" font-size="20">Not assumed zero here</text>
    </g>
    <circle cx="780" cy="786" r="8" fill="#fffdf9" stroke="#365e63" stroke-width="2.5" stroke-dasharray="3 2"/>
    <path d="M791 786H826" stroke="#365e63" stroke-width="1.5"/>
    <text x="840" y="793" font-size="22" fill="#365e63">Reported back-face TC</text>
    <text x="810" y="824" font-size="19" fill="#6b655b">Depth / coupling uncertain</text>
    <path d="M320 854V870M320 863H780M780 854V870" fill="none" stroke="#958b7d" stroke-width="1.4"/>
    <rect x="403" y="848" width="296" height="31" fill="#fffdf9"/>
    <text x="550" y="872" text-anchor="middle" font-size="22">Nominal L${sub('a')} = ${number(nominalThickness,1)} mm</text>

    <rect x="40" y="900" width="1040" height="91" fill="#f7f5f0" stroke="#d5cec2"/>
    <text x="60" y="935" font-size="24" font-weight="bold">Bulk density: ρ = m / V</text>
    <text x="60" y="970" font-size="21">Requires measured initial mass and volume for each specimen.</text>
    <text x="40" y="1035" font-size="23" font-weight="bold">Graphite flux is a reference—not a measured heat-flux boundary for the brick.</text>
    <text x="40" y="1065" font-size="19" fill="#6b655b">Current traces alone do not uniquely identify k or c${sub('p')}: heat input, losses and sensor coupling also need constraints.</text>
  </g>
</svg>\n`;
fs.writeFileSync(path.join(directory, 'coupon-heat-transfer-boundaries.svg'), svg);
console.log('Generated coupon-heat-transfer-boundaries.svg (1120 × 1080); graphite inputs checked, ChamberSafe properties left unknown.');
