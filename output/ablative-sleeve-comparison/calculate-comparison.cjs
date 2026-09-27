// Conditional cylinder bookkeeping, NOT a hotfire, pyrolysis, or char solver.
"use strict";
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const rig = require('../../assets/js/ablative-depth-surface-model.js');
const evidence = JSON.parse(fs.readFileSync(path.join(__dirname, 'inputs-and-evidence.json'), 'utf8'));
const rho = rig.constants.density;
const near = (x,y) => assert(Math.abs(x-y) < 1e-9*Math.max(1,Math.abs(y)), `${x} != ${y}`);
function annulus(outerIn, innerIn, lengthIn) {
  assert([outerIn,innerIn,lengthIn].every(x=>typeof x==='number' && Number.isFinite(x) && x>0));
  const ro=outerIn*25.4/2, ri=innerIn*25.4/2, length=lengthIn*25.4;
  assert(ro>ri && ri>0 && length>0);
  const volume=Math.PI*(ro*ro-ri*ri)*length;
  return {outer_radius_mm:ro,inner_radius_mm:ri,length_mm:length,wall_mm:ro-ri,
    volume_cm3:volume/1000,inner_area_m2:2*Math.PI*ri*length/1e6,
    conditional_initial_mass_g:rho*volume/1e6};
}
function uniformRecession(g, depth) {
  assert(Number.isFinite(depth) && depth>=0 && depth<=g.wall_mm);
  const r=g.inner_radius_mm+depth;
  const removed=Math.PI*g.length_mm*(r*r-g.inner_radius_mm**2)/1000;
  const remaining=Math.PI*g.length_mm*(g.outer_radius_mm**2-r*r)/1000;
  return {hypothetical_uniform_recession_mm:depth,remaining_wall_mm:g.outer_radius_mm-r,
    final_bore_mm:2*r,geometric_removed_volume_cm3:removed,
    geometric_remaining_volume_cm3:remaining,removed_volume_fraction:removed/g.volume_cm3,
    virgin_density_equivalent_removed_mass_g:rho*removed/1000,
    virgin_density_equivalent_remaining_mass_g:rho*remaining/1000,
    actual_char_mass_g:null,actual_remaining_mass_g:null};
}
function idealTwoLayerMass(g, recessionMM, charMM, charDensity) {
  // No defaults: absent char measurements must not quietly become invented inputs.
  assert([recessionMM,charMM,charDensity].every(x=>typeof x==='number' && Number.isFinite(x) && x>=0));
  assert(recessionMM+charMM<=g.wall_mm);
  const r=g.inner_radius_mm+recessionMM, rc=r+charMM;
  const charV=Math.PI*g.length_mm*(rc*rc-r*r)/1000;
  const virginV=Math.PI*g.length_mm*(g.outer_radius_mm**2-rc*rc)/1000;
  return {char_mass_g:charV*charDensity/1000,virgin_mass_g:virginV*rho/1000,
    remaining_mass_g:(charV*charDensity+virginV*rho)/1000};
}
function retainedCharScenario(g, recessionMM, charMM, charDensityRatio, affectedFraction) {
  // All inputs are explicit. Unknown actual sleeve char measurements stay null.
  assert([recessionMM,charMM,charDensityRatio,affectedFraction].every(x=>typeof x==='number' && Number.isFinite(x)), 'Finite explicit layer inputs required');
  assert(recessionMM>=0 && charMM>=0 && recessionMM+charMM<=g.wall_mm, 'Recession plus retained char must fit inside original wall');
  assert(charDensityRatio>=0 && charDensityRatio<=1, 'Char/virgin density ratio must be 0–1 for these scenarios');
  assert(affectedFraction>=0 && affectedFraction<=1, 'Affected fraction must be 0–1');
  const ri=g.inner_radius_mm, r=ri+recessionMM, rc=r+charMM;
  const removed=affectedFraction*Math.PI*g.length_mm*(r*r-ri*ri)/1000;
  const charVolume=affectedFraction*Math.PI*g.length_mm*(rc*rc-r*r)/1000;
  const virginVolume=g.volume_cm3-removed-charVolume;
  const charDensity=rho*charDensityRatio;
  const removedMass=rho*removed/1000, charMass=charDensity*charVolume/1000;
  const virginMass=rho*virginVolume/1000, deficit=(rho-charDensity)*charVolume/1000;
  return {
    classification:'HYPOTHETICAL_RETAINED_CHAR_VOLUME_MASS_BOOKKEEPING_NOT_MEASURED_SLEEVE_RESPONSE',
    recession_mm:recessionMM,retained_char_thickness_mm:charMM,
    char_to_virgin_density_ratio:charDensityRatio,char_density_kg_m3:charDensity,
    affected_original_bore_fraction:affectedFraction,
    affected_original_bore_area_m2:g.inner_area_m2*affectedFraction,
    local_geometric_wall_after_recession_mm:g.wall_mm-recessionMM,
    local_uncharred_wall_mm:g.wall_mm-recessionMM-charMM,
    modeled_removed_volume_cm3:removed,modeled_retained_char_volume_cm3:charVolume,
    modeled_remaining_virgin_volume_cm3:virginVolume,
    virgin_density_equivalent_removed_mass_g:removedMass,
    modeled_retained_char_mass_g:charMass,modeled_remaining_virgin_mass_g:virginMass,
    density_deficit_mass_g:deficit,modeled_remaining_mass_g:charMass+virginMass,
    modeled_net_mass_loss_g:removedMass+deficit,
    actual_char_mass_g:null,actual_remaining_mass_g:null,
    local_wall_note:affectedFraction===0 ? 'No affected region exists at f=0; local layer dimensions are inactive inputs.' : 'Local wall thicknesses apply only within the modeled affected fraction; unaffected material remains virgin.'
  };
}
const g=evidence.candidate_geometry, alt=evidence.alternate_geometry, m=evidence.confirmed_hot_brick_test;
const geometry=annulus(g.outer_diameter_in,g.inner_diameter_in,g.length_in);
const endpoints=[[-1,-1],[1,1]].map(([o,l])=>annulus(g.outer_diameter_in+o*g.outer_diameter_tolerance_in,g.inner_diameter_in,g.length_in+l*g.length_tolerance_in));
const alternative=annulus(alt.inner_diameter_in+2*alt.wall_thickness_in,alt.inner_diameter_in,alt.length_in);
const brickVolume=m.nominal_brick_dimensions_in.reduce((v,x)=>v*x,1)*16.387064;
const conditionalDensity=m.initial_mass_g/brickVolume*1000;
const measuredDepth=m.approximate_material_depth_loss_in*25.4;
const hotPoint=rig.evaluate(m.duration_s,m.graphite_reference_flux_MW_m2);
const dimpleVolume=rig.constants.shapeFactor*Math.PI*(rig.constants.diameterMM/2)**2*measuredDepth/1000;
const sample={classification:m.status,
  reported_initial_mass_g:m.initial_mass_g,reported_final_mass_g:m.final_mass_g,
  reported_net_mass_loss_g:m.initial_mass_g-m.final_mass_g,
  reported_fractional_mass_loss:(m.initial_mass_g-m.final_mass_g)/m.initial_mass_g,
  reported_measured_depth_mm:measuredDepth,depth_uncertainty_mm:m.depth_uncertainty_mm,
  depth_precision_note:'Approximately 1/8 inch; 3.175 mm is the unit conversion, not measurement precision.',
  exposure_s:m.duration_s,exposure_averaged_depth_change_mm_s:measuredDepth/m.duration_s,
  graphite_reference_flux_MW_m2:m.graphite_reference_flux_MW_m2,
  graphite_equivalent_dose_MJ_m2:m.duration_s*m.graphite_reference_flux_MW_m2,
  nominal_brick_volume_cm3:brickVolume,conditional_density_kg_m3:conditionalDensity,
  assumed_dimple_diameter_mm:rig.constants.diameterMM,assumed_dimple_shape_factor:rig.constants.shapeFactor,
  measured_depth_assumed_shape_volume_cm3:dimpleVolume,
  local_dimple_mass_equivalent_g:dimpleVolume*conditionalDensity/1000,
  net_mass_loss_to_local_dimple_equivalent_ratio:(m.initial_mass_g-m.final_mass_g)/(dimpleVolume*conditionalDensity/1000),
  comparison_note:'Whole-brick net mass change and local dimple geometric mass are different observables. Their ratio is not model error or a determination of char mass.',
  source:m.source,run_and_depth_association:'User confirmed this hot rig run and that the approximate dimple depth was measured.'};
const directTransfer={classification:'MEASURED_COUPON_DIMPLE_DEPTH_IMPOSED_UNIFORMLY_ON_CANDIDATE_SLEEVE_NOT_ENGINE_PREDICTION',
  note:'A local approximately 3.2 mm coupon depression is imposed on every point of the full sleeve bore, with the hot brick conditional density transferred unchanged. Neither transfer is verified.',
  ...uniformRecession(geometry,measuredDepth)};
const examples=[.2592,.5844,.8].map(q=>{
  const p=rig.evaluate(10,q);
  return {classification:'UPDATED_RIG_MODEL_COUNTERFACTUAL_NOT_ENGINE_HEAT_HISTORY',assumed_duration_s:10,
    assumed_uniform_graphite_reference_flux_MW_m2:q,local_dimple_mass_equivalent_g:p.mass,
    ...uniformRecession(geometry,p.depth)};
});
const a=evidence.material_assumptions, alpha=a.thermal_conductivity_W_m_K/(rho*a.specific_heat_J_kg_K)*1e6;
const whatIf=evidence.expanded_what_if_assumptions, referenceInputs=whatIf.reference_scenario;
function caseWithReferenceEnergy(id, group, depth, char, ratio, fraction, seconds, flux, depthBasis) {
  // evaluate is also the domain gate: never extrapolate the production rig model.
  assert(Number.isFinite(seconds) && Number.isFinite(flux));
  rig.evaluate(seconds,flux);
  return {id,group,depth_basis:depthBasis,
    assumed_duration_s:seconds,assumed_graphite_reference_flux_MW_m2:flux,
    reference_equivalent_dose_MJ_m2:seconds*flux,
    reference_original_area_energy_kJ:seconds*flux*geometry.inner_area_m2*fraction*1000,
    reference_energy_note:'Reference flux × duration × original affected bore area; not absorbed energy and not an energy balance.',
    ...retainedCharScenario(geometry,depth,char,ratio,fraction)};
}
const transferredBasis='Measured coupon dimple depth transferred uniformly to the affected sleeve region; not measured sleeve recession.';
const modeledBasis='Depth from the partly calibrated rig surface, transferred uniformly to the affected sleeve region; not an engine-response prediction.';
const charGrid=whatIf.retained_char_thickness_values_mm.flatMap(char=>whatIf.char_to_virgin_density_ratios.map(ratio=>
  caseWithReferenceEnergy(`char_${char}mm_ratio_${ratio}`,'char_density_grid',measuredDepth,char,ratio,1,m.duration_s,m.graphite_reference_flux_MW_m2,transferredBasis)));
const noChar=caseWithReferenceEnergy('explicit_no_char','no_char_example',measuredDepth,
  whatIf.no_char_example.retained_char_thickness_mm,whatIf.no_char_example.char_to_virgin_density_ratio,1,
  m.duration_s,m.graphite_reference_flux_MW_m2,transferredBasis);
const coverageCases=whatIf.affected_original_bore_fractions.map(f=>caseWithReferenceEnergy(`coverage_${f}`,'coverage',measuredDepth,
  referenceInputs.retained_char_thickness_mm,referenceInputs.char_to_virgin_density_ratio,f,
  m.duration_s,m.graphite_reference_flux_MW_m2,transferredBasis));
const timingCases=whatIf.time_examples_s.map(seconds=>{
  const q=whatIf.time_examples_graphite_reference_flux_MW_m2, depth=rig.evaluate(seconds,q).depth;
  return caseWithReferenceEnergy(`time_${seconds}s`,'timing',depth,referenceInputs.retained_char_thickness_mm,
    referenceInputs.char_to_virgin_density_ratio,referenceInputs.affected_original_bore_fraction,seconds,q,modeledBasis);
});
const fluxCases=whatIf.flux_examples_MW_m2.map(q=>{
  const seconds=whatIf.flux_examples_duration_s, depth=rig.evaluate(seconds,q).depth;
  return caseWithReferenceEnergy(`flux_${q}`,'flux',depth,referenceInputs.retained_char_thickness_mm,
    referenceInputs.char_to_virgin_density_ratio,referenceInputs.affected_original_bore_fraction,seconds,q,modeledBasis);
});
const reference=caseWithReferenceEnergy('reference','reference',measuredDepth,referenceInputs.retained_char_thickness_mm,
  referenceInputs.char_to_virgin_density_ratio,referenceInputs.affected_original_bore_fraction,
  m.duration_s,m.graphite_reference_flux_MW_m2,transferredBasis);
const expanded={classification:whatIf.classification,assumptions:whatIf,
  reference,retained_char_density_grid:charGrid,explicit_no_char:noChar,
  affected_fraction_cases:coverageCases,timing_cases:timingCases,flux_cases:fluxCases,
  equations:{removed_volume:'f*pi*L*((ri+d)^2-ri^2)',retained_char_volume:'f*pi*L*((ri+d+c)^2-(ri+d)^2)',
    remaining_virgin_volume:'V0 - Vremoved - Vchar; includes unaffected material',
    remaining_mass:'rho_v*Vvirgin + rho_c*Vchar',density_deficit:'(rho_v-rho_c)*Vchar',
    net_mass_loss:'rho_v*Vremoved + density_deficit',local_uncharred_wall:'original_wall - d - c'},
  conservation_note:'The density deficit is algebraic mass bookkeeping for the selected char density; it does not identify gas species, reaction enthalpy, or a physical mass-transport mechanism.',
  model_limits:'Fixed geometry; no char growth or heat balance. Assumed char and coverage are independent of modeled depth, time and reference flux. No edge interactions, cracks, end losses, deposits or swelling. These are not observed hotfire outcomes.'};
const result={classification:evidence.classification,
  measured_hot_brick:sample,
  assumptions:{transferred_density_kg_m3:rho,density_status:a.density_source,
    shared_rig_model:rig.fit,baseline_depth_measured:false,hot_depth_measured:true,
    fitted_to_whole_brick_mass_loss:false,uniform_recession_geometry_only:true,
    omitted:'End recession, chamfers, physical property evolution, pyrolysis, measured char density/thickness, swelling, cracks, fragments, deposits, and spatially or temporally varying heating. Expanded char density/thickness values are selected cases only.'},
  candidate_geometry:geometry,candidate_geometry_source:g.source,
  candidate_geometry_status:g.status,dimensional_only_endpoints:endpoints,
  alternative_geometry:alternative,alternative_geometry_status:alt.status,
  direct_measured_depth_transfer:directTransfer,
  ten_second_model_counterfactuals:examples,
  expanded_what_if_scenarios:expanded,
  conduction_scales_not_char_depth_or_safe_burn_time:{alpha_mm2_s:alpha,
    sqrt_alpha_10s_mm:Math.sqrt(alpha*10),nominal_wall_diffusion_scale_s:geometry.wall_mm**2/alpha},
  actual_sleeve_measurements:evidence.actual_sleeve_measurements,
  verified_hotfire_thermal_exposure_s:evidence.requested_event.verified_thermal_exposure_s,
  controller_failure_timestamp_is_not_thermal_duration:true,
  model_error_percent:null,validation_performed:false};

near(geometry.wall_mm,12.065);
near(geometry.volume_cm3,Math.PI/4*(3.95**2-3**2)*7.168*16.387064);
near(rho,conditionalDensity);near(measuredDepth,3.175);near(hotPoint.depth,measuredDepth);
near(sample.reported_net_mass_loss_g,8.9);near(sample.local_dimple_mass_equivalent_g,hotPoint.mass);
assert.equal(m.depth_measured,true);assert.equal(sample.depth_uncertainty_mm,null);
for(const anchor of rig.points) near(rig.evaluate(anchor.time,anchor.flux).depth,anchor.depth);
for(const p of [...examples,directTransfer]) {
  near(p.geometric_removed_volume_cm3+p.geometric_remaining_volume_cm3,geometry.volume_cm3);
  near(p.virgin_density_equivalent_removed_mass_g+p.virgin_density_equivalent_remaining_mass_g,geometry.conditional_initial_mass_g);
  assert(p.remaining_wall_mm>0);
  near(idealTwoLayerMass(geometry,p.hypothetical_uniform_recession_mm,0,0).remaining_mass_g,p.virgin_density_equivalent_remaining_mass_g);
  near(idealTwoLayerMass(geometry,p.hypothetical_uniform_recession_mm,1,rho).remaining_mass_g,p.virgin_density_equivalent_remaining_mass_g);
  assert.equal(p.actual_char_mass_g,null);assert.equal(p.actual_remaining_mass_g,null);
}
near(uniformRecession(geometry,0).geometric_removed_volume_cm3,0);
near(uniformRecession(geometry,geometry.wall_mm).geometric_remaining_volume_cm3,0);
assert.throws(()=>idealTwoLayerMass(geometry,1,undefined,300));
assert.throws(()=>uniformRecession(geometry,13));
assert.equal(result.model_error_percent,null);assert.equal(result.actual_sleeve_measurements.initial_mass_g,null);
assert.equal(result.verified_hotfire_thermal_exposure_s,null);
const scenarioRows=[...charGrid,noChar,...coverageCases,...timingCases,...fluxCases];
assert.equal(charGrid.length,9);assert.equal(scenarioRows.length,19);
for(const p of [...scenarioRows,reference]) {
  near(p.modeled_removed_volume_cm3+p.modeled_retained_char_volume_cm3+p.modeled_remaining_virgin_volume_cm3,geometry.volume_cm3);
  near(p.modeled_remaining_mass_g+p.modeled_net_mass_loss_g,geometry.conditional_initial_mass_g);
  near(p.modeled_net_mass_loss_g,p.virgin_density_equivalent_removed_mass_g+p.density_deficit_mass_g);
  near(p.modeled_remaining_mass_g,p.modeled_retained_char_mass_g+p.modeled_remaining_virgin_mass_g);
  near(p.reference_original_area_energy_kJ,p.reference_equivalent_dose_MJ_m2*p.affected_original_bore_area_m2*1000);
  assert(p.local_uncharred_wall_mm>=0 && p.modeled_remaining_virgin_volume_cm3>=0 && p.modeled_remaining_mass_g>=0);
  assert(p.assumed_duration_s<=rig.constants.timeMax && p.assumed_graphite_reference_flux_MW_m2<=rig.constants.fluxMax);
  assert.equal(p.actual_char_mass_g,null);assert.equal(p.actual_remaining_mass_g,null);
}
near(reference.local_uncharred_wall_mm,6.89);
near(retainedCharScenario(geometry,measuredDepth,2,.5,0).modeled_remaining_mass_g,geometry.conditional_initial_mass_g);
near(retainedCharScenario(geometry,measuredDepth,2,.5,0).modeled_net_mass_loss_g,0);
near(retainedCharScenario(geometry,measuredDepth,2,1,1).density_deficit_mass_g,0);
near(retainedCharScenario(geometry,measuredDepth,2,1,1).modeled_remaining_mass_g,directTransfer.virgin_density_equivalent_remaining_mass_g);
near(noChar.modeled_retained_char_mass_g,0);near(noChar.density_deficit_mass_g,0);
near(noChar.modeled_remaining_mass_g,directTransfer.virgin_density_equivalent_remaining_mass_g);
near(retainedCharScenario(geometry,measuredDepth,0,0,1).modeled_remaining_mass_g,noChar.modeled_remaining_mass_g);
near(retainedCharScenario(geometry,measuredDepth,0,1,1).modeled_remaining_mass_g,noChar.modeled_remaining_mass_g);
for(const bad of [undefined,null,NaN,Infinity,-1]) assert.throws(()=>retainedCharScenario(geometry,measuredDepth,bad,.5,1));
assert.throws(()=>retainedCharScenario(geometry,measuredDepth,geometry.wall_mm,.5,1));
assert.throws(()=>retainedCharScenario(geometry,measuredDepth,2,1.01,1));
assert.throws(()=>retainedCharScenario(geometry,measuredDepth,2,.5,1.01));
assert.throws(()=>retainedCharScenario(geometry,measuredDepth,2,-.1,1));
assert.throws(()=>retainedCharScenario(geometry,measuredDepth,2,.5,-.1));
assert.throws(()=>caseWithReferenceEnergy('outside','test',3,2,.5,1,rig.constants.timeMax+1,.5,'invalid domain'));
assert.equal(result.actual_sleeve_measurements.char_thickness_mm,null);
assert.equal(result.actual_sleeve_measurements.char_mass_g,null);
assert.equal(evidence.material_assumptions.char_density_kg_m3,null);
assert.equal(evidence.material_assumptions.char_thickness_mm,null);
expanded.csv_row_count=scenarioRows.length;
fs.writeFileSync(path.join(__dirname,'conditional-results.json'),JSON.stringify(result,null,2)+'\n');
// Curated public artifact: only evidence needed for this comparison, no unrelated Drive data.
const publicOut=path.join(__dirname,'../../assets/builds/ablative-material-testing-fixture/analysis');
fs.writeFileSync(path.join(publicOut,'sleeve-comparison-results.json'),JSON.stringify(result,null,2)+'\n');
const csvFields=['id','group','classification','depth_basis','assumed_duration_s','assumed_graphite_reference_flux_MW_m2',
  'recession_mm','retained_char_thickness_mm','char_to_virgin_density_ratio','affected_original_bore_fraction','char_density_kg_m3',
  'affected_original_bore_area_m2','modeled_removed_volume_cm3','modeled_retained_char_volume_cm3','modeled_remaining_virgin_volume_cm3',
  'local_uncharred_wall_mm','virgin_density_equivalent_removed_mass_g','modeled_retained_char_mass_g','modeled_remaining_virgin_mass_g',
  'density_deficit_mass_g','modeled_remaining_mass_g','modeled_net_mass_loss_g','reference_equivalent_dose_MJ_m2',
  'reference_original_area_energy_kJ','reference_energy_note'];
const csvCell=v=>{const s=typeof v==='number'?v.toPrecision(10):String(v);return /[,"\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
const csv=[csvFields.join(','),...scenarioRows.map(p=>csvFields.map(k=>csvCell(p[k])).join(','))].join('\n')+'\n';
fs.writeFileSync(path.join(publicOut,'sleeve-scenarios.csv'),csv);
console.log(JSON.stringify({hot_brick:sample,sleeve:geometry,uniform_depth_transfer:directTransfer,expanded_reference:reference,
  timing_cases:timingCases,flux_cases:fluxCases,scenario_csv_rows:scenarioRows.length},null,2));
console.log('PASS: hot coupon evidence, cylinder identities, explicit char inputs, 19 cases, volume/mass conservation, zero-coverage/unit-density/no-char limits, invalid-input rejection, rig domain, and actual-sleeve null protections.');
