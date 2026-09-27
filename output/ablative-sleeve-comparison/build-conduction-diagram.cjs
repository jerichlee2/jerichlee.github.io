// Code-native diagram of the saved conduction-only model; no new thermal inputs.
// Run: node output/ablative-sleeve-comparison/build-conduction-diagram.cjs
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = path.resolve(__dirname, '../../assets/builds/ablative-material-testing-fixture/analysis');
const model = JSON.parse(fs.readFileSync(path.join(directory, 'sleeve-conduction-only.json'), 'utf8'));
const bc = model.boundary_conditions;
const [char, virgin, steel] = model.layer_properties;
assert.deepEqual([char.name, virgin.name, steel.name], ['char', 'virgin', 'metal']);
assert.equal(bc.inner_during_pulse.type, 'prescribed_solid_temperature');
assert.equal(bc.outer_throughout.type, 'adiabatic');
assert.equal(bc.inner_after_pulse.type, 'adiabatic');
assert.equal(bc.interface.type, 'zero_thermal_resistance_no_added_capacity');
assert.equal(bc.convection, false);
assert.equal(bc.radiation, false);
assert.equal(char.outer_radius_m, virgin.inner_radius_m);
const gap = (steel.inner_radius_m - virgin.outer_radius_m) * 1000;
assert(Math.abs(gap - model.geometry.physical_radial_gap_m * 1000) < 1e-10);
const number = (n, digits = 0) => n.toLocaleString('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits});
const thickness = layer => number((layer.outer_radius_m - layer.inner_radius_m) * 1000, 2);
const pulse = number(bc.pulse_duration_s);
const hot = number(bc.inner_during_pulse.temperature_K);
const initial = number(bc.initial_temperature_K - 273.15);
const sub = text => `<tspan font-size="70%" baseline-shift="sub">${text}</tspan>`;
const properties = (layer, center, fill) => `<g fill="${fill}" text-anchor="middle" font-size="21">
      <text x="${center}" y="422">k = ${number(layer.conductivity_W_per_m_K, layer === steel ? 1 : 2)}</text>
      <text x="${center}" y="451">c${sub('p')} = ${number(layer.heat_capacity_J_per_kg_K)}</text>
      <text x="${center}" y="480">ρ ≈ ${number(layer.density_kg_per_m3)}</text>
    </g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="952" viewBox="0 0 1120 952" role="img" aria-labelledby="conduction-diagram-title conduction-diagram-desc">
  <title id="conduction-diagram-title">Conduction-only sleeve model: layers, heat flow and boundary conditions</title>
  <desc id="conduction-diagram-desc">Schematic radial wall section, not to scale. All solids initially start at ${initial} degrees Celsius. From the bore outward: ${thickness(char)} mm retained char, ${thickness(virgin)} mm virgin ablator, an idealized ${number(gap, 3)} mm gap with zero resistance and no heat capacity, and ${thickness(steel)} mm stainless steel. For the first ${pulse} seconds the solid bore surface is held at ${hot} K; the incoming flux is calculated by conduction, not prescribed. The exterior has zero heat flux throughout. After ${pulse} seconds the bore also has zero heat flux; stored heat redistributes inside the insulated system. At the gap, interface temperatures and heat rates match, not flux densities at different radii. No convection, radiation, changing layers or axial heat flow is modeled.</desc>
  <defs>
    <marker id="heat-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#ac432c"/></marker>
    <marker id="axis-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#6b655b"/></marker>
    <pattern id="char-grain" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r=".8" fill="#fffdf9" opacity=".2"/><circle cx="11" cy="11" r=".6" fill="#fffdf9" opacity=".13"/></pattern>
    <pattern id="insulation" width="8" height="10" patternUnits="userSpaceOnUse"><path d="M-2 10L8 0M6 12L10 8" stroke="#467278" stroke-width="1.5"/></pattern>
  </defs>
  <rect width="1120" height="952" fill="#fffdf9"/>
  <g font-family="Georgia, 'Times New Roman', serif" fill="#38352f">
    <text x="40" y="46" font-size="31" font-weight="bold">The heat-transfer problem</text>
    <text x="40" y="80" font-size="21" fill="#6b655b">Radial wall schematic · not to scale · assumed intact, already-recessed sleeve</text>
    <rect x="40" y="103" width="1040" height="49" fill="#f3f0e9"/>
    <text x="60" y="135" font-size="23">Initial condition: every solid starts at ${initial} °C (${number(bc.initial_temperature_K, 2)} K).</text>

    <text x="40" y="200" font-size="26" font-weight="bold">1. Heating · 0 ≤ t &lt; ${pulse} s</text>
    <text x="1080" y="200" text-anchor="end" font-size="24">q″${sub('r')}(r, t) = −k ∂T/∂r</text>
    <path d="M240 246H918" stroke="#6b655b" stroke-width="1.4" marker-end="url(#axis-arrow)"/>
    <rect x="409" y="227" width="335" height="29" fill="#fffdf9"/>
    <text x="576" y="247" text-anchor="middle" font-size="20" fill="#6b655b">Radially outward · increasing r</text>

    <rect x="220" y="270" width="180" height="230" fill="#575047"/>
    <rect x="220" y="270" width="180" height="230" fill="url(#char-grain)"/>
    <rect x="400" y="270" width="262" height="230" fill="#e6dfd2"/>
    <rect x="662" y="270" width="36" height="230" fill="#fffdf9"/>
    <rect x="698" y="270" width="242" height="230" fill="#dbe5e5"/>
    <rect x="220" y="270" width="720" height="230" fill="none" stroke="#71685b" stroke-width="1.5"/>
    <path d="M400 270V500M662 270V500M698 270V500" stroke="#71685b" stroke-width="1.5"/>
    <path d="M220 263V507" stroke="#ac432c" stroke-width="4"/>
    <rect x="940" y="264" width="16" height="242" fill="url(#insulation)"/>
    <path d="M940 264V506" stroke="#467278" stroke-width="3"/>

    <g text-anchor="middle">
      <text x="310" y="304" font-size="23" fill="#fffdf9" font-weight="bold">Retained char</text>
      <text x="310" y="341" font-size="29" fill="#fffdf9">${thickness(char)} mm</text>
      <text x="531" y="304" font-size="25" font-weight="bold">Virgin ablator</text>
      <text x="531" y="341" font-size="29">${thickness(virgin)} mm</text>
      <text x="819" y="304" font-size="25" font-weight="bold">304L steel</text>
      <text x="819" y="341" font-size="29">${thickness(steel)} mm</text>
    </g>
    <text x="680" y="393" text-anchor="middle" font-size="17" fill="#6b655b" transform="rotate(-90 680 393)">idealized gap</text>
    <path d="M250 378H367" stroke="#d58e60" stroke-width="3" marker-end="url(#heat-arrow)"/>
    <path d="M449 378H609M748 378H895" stroke="#ac432c" stroke-width="3" marker-end="url(#heat-arrow)"/>
    ${properties(char, 310, '#fffdf9')}
    ${properties(virgin, 531, '#38352f')}
    ${properties(steel, 819, '#38352f')}

    <g text-anchor="middle" fill="#ac432c">
      <text x="123" y="282" font-size="19">Solid bore surface</text>
      <text x="123" y="316" font-size="26">T${sub('s')} = ${hot} K</text>
      <text x="123" y="343" font-size="18">prescribed</text>
      <text x="123" y="378" font-size="26">q″${sub('in')}(t)</text>
      <path d="M72 400H206" stroke="#ac432c" stroke-width="3" marker-end="url(#heat-arrow)"/>
      <text x="123" y="436" font-size="19">Flux is calculated,</text>
      <text x="123" y="462" font-size="19">not held constant.</text>
    </g>
    <g text-anchor="middle" fill="#365e63">
      <text x="1025" y="303" font-size="22">Exterior</text>
      <text x="1025" y="341" font-size="26">q″${sub('out')} = 0</text>
      <text x="1025" y="413" font-size="21">Insulated</text>
      <text x="1025" y="442" font-size="19">at all times</text>
    </g>
    <text x="40" y="531" font-size="19" fill="#6b655b">Property units: k [W/(m·K)] · c${sub('p')} [J/(kg·K)] · ρ [kg/m³]. Heat-flow arrows show direction, not magnitude.</text>

    <rect x="40" y="554" width="1040" height="121" fill="#f7f5f0" stroke="#d5cec2"/>
    <text x="60" y="586" font-size="23" font-weight="bold">${number(gap, 3)} mm nominal gap → perfect thermal coupling</text>
    <text x="60" y="617" font-size="21">No resistance or heat storage. The two facing interface temperatures match.</text>
    <text x="60" y="647" font-size="20">Heat rate is conserved across the gap: A${sub('v')}q″${sub('v')} = A${sub('s')}q″${sub('s')}, with A = 2πrL. Flux density need not match.</text>

    <text x="40" y="721" font-size="26" font-weight="bold">2. Heat soak · t ≥ ${pulse} s</text>
    <rect x="258" y="748" width="90" height="66" fill="#575047"/>
    <rect x="258" y="748" width="90" height="66" fill="url(#char-grain)"/>
    <rect x="348" y="748" width="298" height="66" fill="#e6dfd2"/>
    <rect x="646" y="748" width="16" height="66" fill="#fffdf9"/>
    <rect x="662" y="748" width="228" height="66" fill="#dbe5e5"/>
    <rect x="258" y="748" width="632" height="66" fill="none" stroke="#71685b"/>
    <path d="M348 748V814M646 748V814M662 748V814" stroke="#71685b"/>
    <rect x="244" y="742" width="14" height="78" fill="url(#insulation)"/>
    <rect x="890" y="742" width="14" height="78" fill="url(#insulation)"/>
    <path d="M258 742V820M890 742V820" stroke="#467278" stroke-width="3"/>
    <text x="146" y="780" text-anchor="middle" font-size="25" fill="#365e63">q″${sub('in')} = 0</text>
    <text x="146" y="809" text-anchor="middle" font-size="20" fill="#365e63">Bore insulated</text>
    <text x="1000" y="780" text-anchor="middle" font-size="25" fill="#365e63">q″${sub('out')} = 0</text>
    <text x="1000" y="809" text-anchor="middle" font-size="20" fill="#365e63">Still insulated</text>
    <text x="497" y="777" text-anchor="middle" font-size="20">Stored heat redistributes</text>
    <path d="M408 795H588" stroke="#ac432c" stroke-width="2.5" marker-end="url(#heat-arrow)"/>
    <text x="40" y="855" font-size="22">The source is removed—not reset to room temperature. No heat can leave the modeled band.</text>
    <path d="M40 884H1080" stroke="#d5cec2"/>
    <text x="560" y="919" text-anchor="middle" font-size="21" fill="#6b655b">No convection · No radiation · Fixed material layers · One-dimensional radial conduction</text>
  </g>
</svg>\n`;
fs.writeFileSync(path.join(directory, 'sleeve-conduction-boundaries.svg'), svg);
console.log('Generated sleeve-conduction-boundaries.svg (1120 × 952) from saved conduction-only inputs.');
