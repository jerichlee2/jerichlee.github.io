// Code-native, to-scale radial wall stack for one explicitly assumed sleeve case.
// Read the reference result rather than creating a second set of assumptions.
"use strict";
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = path.resolve(__dirname, '../../assets/builds/ablative-material-testing-fixture/analysis');
const results = JSON.parse(fs.readFileSync(path.join(directory, 'sleeve-comparison-results.json'), 'utf8'));
const r = results.expanded_what_if_scenarios?.reference;
assert(r, 'Generate the expanded reference scenario before this schematic.');
const wall = results.candidate_geometry.wall_mm;
const depth = r.recession_mm, char = r.retained_char_thickness_mm, virgin = r.local_uncharred_wall_mm;
const finitePositive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
assert([wall,depth,char,virgin].every(finitePositive));
assert(Math.abs(wall-depth-char-virgin)<1e-9, 'Layers must equal the original radial wall.');
assert.equal(r.affected_original_bore_fraction, 1, 'This figure depicts the full-bore reference case.');
assert(r.char_to_virgin_density_ratio>0 && r.char_to_virgin_density_ratio<1);
const display = value => value.toFixed(1);
const precise = value => Number(value.toFixed(3)).toString();
const W = 1100, H = 440, left = 64, right = 1036, top = 159, bottom = 257;
const scale = (right-left)/wall;
const depthEnd = left+depth*scale, charEnd = depthEnd+char*scale;
const coord = value => Number(value.toFixed(3));
const n = {depthEnd:coord(depthEnd),charEnd:coord(charEnd),
  depthWidth:coord(depth*scale),charWidth:coord(char*scale),virginWidth:coord(virgin*scale),
  depthCenter:coord((left+depthEnd)/2),charCenter:coord((depthEnd+charEnd)/2),virginCenter:coord((charEnd+right)/2)};
const densityPercent = Math.round(r.char_to_virgin_density_ratio*100);
const title = 'Illustrative wall section · not an observed sleeve cross-section';
const description = `One assumed full-bore sleeve case, drawn to scale through the radial wall. The original target wall is ${precise(wall)} millimeters. From the original bore surface toward the case, a ${precise(depth)}-millimeter recessed region transfers the coupon's approximately measured dimple depth uniformly to the sleeve. Next is ${precise(char)} millimeters of retained char chosen as an assumption, followed by ${precise(virgin)} millimeters of modeled uncharred remainder. Char density is assumed to be ${densityPercent} percent of virgin density. No actual sleeve char thickness, temperatures, or hotfire response are inferred.`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="sleeve-wall-title sleeve-wall-desc" style="max-width:100%;height:auto">
  <title id="sleeve-wall-title">${title}</title>
  <desc id="sleeve-wall-desc">${description}</desc>
  <defs>
    <pattern id="recess-hatch" width="12" height="12" patternUnits="userSpaceOnUse">
      <path d="M-3 3L3-3M0 12L12 0M9 15L15 9" fill="none" stroke="#ac432c" stroke-opacity=".16" stroke-width="1"/>
    </pattern>
    <pattern id="char-grain" width="15" height="15" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r=".85" fill="#fffdf9" fill-opacity=".17"/>
      <circle cx="11" cy="11" r=".65" fill="#fffdf9" fill-opacity=".13"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="#fffdf9"/>
  <g font-family="Georgia, 'Times New Roman', serif" fill="#38352f">
    <text x="${left}" y="40" font-size="27" font-weight="bold">${title}</text>
    <text x="${left}" y="72" font-size="19" fill="#6b655b">One selected scenario · uniform full-bore recession and retained char</text>
    <path d="M${left} 94H${right}" stroke="#d5cec2"/>
    <path d="M${left} 126H${right}M${left} 119V134M${right} 119V134" fill="none" stroke="#958b7d" stroke-width="1.3"/>
    <rect x="384" y="109" width="332" height="30" fill="#fffdf9"/>
    <text x="550" y="130" text-anchor="middle" font-size="21">Original target wall ≈${display(wall)} mm</text>

    <rect x="${left}" y="${top}" width="${n.depthWidth}" height="${bottom-top}" fill="#fbf1ec"/>
    <rect x="${left}" y="${top}" width="${n.depthWidth}" height="${bottom-top}" fill="url(#recess-hatch)"/>
    <rect x="${n.depthEnd}" y="${top}" width="${n.charWidth}" height="${bottom-top}" fill="#575047"/>
    <rect x="${n.depthEnd}" y="${top}" width="${n.charWidth}" height="${bottom-top}" fill="url(#char-grain)"/>
    <rect x="${n.charEnd}" y="${top}" width="${n.virginWidth}" height="${bottom-top}" fill="#e6dfd2"/>
    <path d="M${left} ${top}H${n.depthEnd}M${left} ${bottom}H${n.depthEnd}M${left} ${top}V${bottom}" fill="none" stroke="#ac432c" stroke-width="1.6" stroke-dasharray="6 5"/>
    <path d="M${n.depthEnd} ${top}H${right}V${bottom}H${n.depthEnd}ZM${n.charEnd} ${top}V${bottom}" fill="none" stroke="#71685b" stroke-width="1.3"/>

    <g text-anchor="middle">
      <text x="${n.depthCenter}" y="186" font-size="23">Recessed region</text>
      <text x="${n.depthCenter}" y="219" font-size="28" fill="#ac432c">≈${display(depth)} mm</text>
      <text x="${n.depthCenter}" y="244" font-size="15">TRANSFERRED COUPON DEPTH</text>
      <g fill="#fffdf9">
        <text x="${n.charCenter}" y="186" font-size="21">Retained char</text>
        <text x="${n.charCenter}" y="219" font-size="28">${display(char)} mm</text>
        <text x="${n.charCenter}" y="244" font-size="15">ASSUMED</text>
      </g>
      <text x="${n.virginCenter}" y="186" font-size="23">Uncharred remainder</text>
      <text x="${n.virginCenter}" y="219" font-size="28">≈${display(virgin)} mm</text>
      <text x="${n.virginCenter}" y="244" font-size="15">BY SUBTRACTION</text>
    </g>
    <path d="M${left} ${bottom+3}V277M${right} ${bottom+3}V277" stroke="#958b7d" stroke-width="1.2"/>
    <text x="${left}" y="299" font-size="18" fill="#6b655b">Original bore surface</text>
    <text x="${right}" y="299" text-anchor="end" font-size="18" fill="#6b655b">Case-side boundary</text>
    <path d="M${n.depthEnd} ${bottom+3}V303" stroke="#ac432c" stroke-width="1.2"/>
    <text x="${n.depthEnd}" y="324" text-anchor="middle" font-size="18" fill="#ac432c">Assumed new bore surface</text>

    <path d="M${left} 346H${right}" stroke="#d5cec2"/>
    <text x="${left}" y="377" font-size="19">The brick’s ≈${display(depth)} mm dimple was measured; transferring it to the entire sleeve is hypothetical.</text>
    <text x="${left}" y="408" font-size="19">${display(char)} mm retained char and ${densityPercent}% char/virgin density are chosen inputs—not measured sleeve properties.</text>
  </g>
</svg>\n`;
fs.writeFileSync(path.join(directory, 'sleeve-assumed-wall.svg'), svg);
console.log(`Generated sleeve-assumed-wall.svg (${W} × ${H}); layer sum ${precise(wall)} mm verified.`);
