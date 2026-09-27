// Native SVG chart of computed fixed-wall scenarios. No measured-trace claim.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const dir = path.resolve(__dirname, '../../assets/builds/ablative-material-testing-fixture/analysis');
const result = JSON.parse(fs.readFileSync(path.join(dir, 'sleeve-thermal-results.json'), 'utf8'));
const lines = fs.readFileSync(path.join(dir, 'sleeve-thermal-history.csv'), 'utf8').trim().split('\n');
const columns = lines.shift().split(',');
const rows = lines.map(line => Object.fromEntries(line.split(',').map((value, i) => [columns[i], value])));
const choices = [
  {id:'central',name:'Already-recessed wall · central',color:'#186a94',dash:''},
  {id:'original_virgin',name:'Original virgin wall',color:'#776d60',dash:'10 6'},
  {id:'insulated_bore_after_heating',name:'No bore cooling after shutdown',color:'#72752e',dash:'3 5'},
  {id:'char_k064',name:'4× assumed char conductivity',color:'#b34f2c',dash:'13 4 3 4'}
];
for (const c of choices) {
  c.result = result.cases.find(r => r.id === c.id);
  assert(c.result && c.result.peak_resolved_within_simulation);
  assert(!c.result.low_temperature_metal_surrogate_extrapolated_above_100C,
    'Do not silently plot extrapolated steel properties as within-range examples.');
  c.rows = rows.filter(r => r.scenario_id === c.id).map(r => ({t:+r.time_s,y:+r.case_inner_C}));
  assert(c.rows.length>20 && c.rows.every(p=>Number.isFinite(p.t)&&Number.isFinite(p.y)));
  assert(c.rows[0].t===0 && Math.abs(c.rows[0].y-20)<1e-8);
}
const width=1120,height=664,left=105,right=1070,top=188,bottom=498;
const ymax = Math.ceil(Math.max(...choices.map(c=>c.result.local_band_case_inner_peak.temperature_C))/10)*10;
const tmax = Math.max(...choices.map(c=>c.result.simulated_until_s));
const x=t=>left+(right-left)*t/tmax,y=v=>bottom-(bottom-top)*(v-20)/(ymax-20);
const f=v=>Number(v.toFixed(3));
const central=choices[0].result,peak=central.local_band_case_inner_peak;
const ticksY=Array.from({length:(ymax-20)/10+1},(_,i)=>20+10*i);
const ticksT=Array.from({length:7},(_,i)=>i*tmax/6);
const legend=choices.map((c,i)=>{
  const lx=i%2?603:106,ly=113+Math.floor(i/2)*32;
  return `<path d="M${lx} ${ly}h42" stroke="${c.color}" stroke-width="3" fill="none" ${c.dash?`stroke-dasharray="${c.dash}"`:''}/><text x="${lx+55}" y="${ly+7}" font-size="20">${c.name}</text>`;
}).join('\n');
const curves=choices.map(c=>`<path d="${c.rows.map((p,i)=>(i?'L':'M')+f(x(p.t))+' '+f(y(p.y))).join(' ')}" stroke="${c.color}" stroke-width="3.3" fill="none" ${c.dash?`stroke-dasharray="${c.dash}"`:''}/>`).join('\n');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="thermal-title thermal-desc">
<title id="thermal-title">Conditional steel temperature after a ten-second heating pulse</title>
<desc id="thermal-desc">Computed inner-face temperatures in the steel band alongside the sleeve, not measurements. The central fixed, already-recessed sleeve case peaks at ${peak.temperature_C.toFixed(1)} degrees Celsius, ${Math.round(peak.time_s)} seconds after heating starts. Three selected geometry, char-conductivity and cooling comparisons are shown. All use assumed material properties and an intact radial path; real cracks and ablation are not modeled.</desc>
<defs><clipPath id="thermal-clip"><rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}"/></clipPath></defs>
<rect width="${width}" height="${height}" fill="#fffdf9"/>
<g font-family="Georgia, 'Times New Roman', serif" fill="#302e29">
<text x="54" y="43" font-size="30" font-weight="bold">The steel can keep warming after the flame is off</text>
<text x="54" y="74" font-size="20" fill="#6e675d">CONDITIONAL CONDUCTION SCENARIOS · NOT MEASURED HOTFIRE TEMPERATURES</text>
${legend}
${ticksY.map(v=>`<path d="M${left} ${f(y(v))}H${right}" stroke="#dcd5c9"/><text x="${left-14}" y="${f(y(v)+7)}" font-size="20" text-anchor="end">${v}</text>`).join('\n')}
${ticksT.map(v=>`<path d="M${f(x(v))} ${top}V${bottom}" stroke="#e9e3d8"/><text x="${f(x(v))}" y="${bottom+30}" font-size="20" text-anchor="middle">${Math.round(v/60)}</text>`).join('\n')}
<g clip-path="url(#thermal-clip)">
<rect x="${left}" y="${top}" width="${f(x(10)-left)}" height="${bottom-top}" fill="#ac432c" fill-opacity=".18"/>
${curves}
<circle cx="${f(x(peak.time_s))}" cy="${f(y(peak.temperature_C))}" r="5" fill="#186a94" stroke="#fffdf9" stroke-width="2"/>
</g>
<path d="M${left} ${top}V${bottom}H${right}" fill="none" stroke="#776f62" stroke-width="1.5"/>
<path d="M${f(x(10))} ${top}V${bottom}" stroke="#ac432c" stroke-width="1.3" stroke-dasharray="4 4"/>
<text x="${left+21}" y="${top+28}" fill="#ac432c" font-size="19">Heating ends at 10 s</text>
<text x="${(left+right)/2}" y="566" text-anchor="middle" font-size="23">Time from start of heating (minutes)</text>
<text transform="translate(35 ${(top+bottom)/2}) rotate(-90)" text-anchor="middle" font-size="22">Steel inner-face temperature (°C)</text>
<path d="M54 590H1066" stroke="#d5cec2"/>
<text x="54" y="620" font-size="21">Central case: ≈${Math.round(peak.temperature_C)} °C peak at ${(peak.time_s/60).toFixed(1)} min; initial temperature 20 °C.</text>
<text x="54" y="649" font-size="18" fill="#6e675d">Fixed wall and assumed properties · no cracks, evolving ablation, or engine-safety validation</text>
</g></svg>\n`;
fs.writeFileSync(path.join(dir,'sleeve-case-temperature.svg'),svg);
console.log(`Generated ${width}×${height} SVG from ${choices.length} exported scenario histories; no extrapolated bare-wall curve shown.`);
