// Reproducible, conduction-only illustration. Numerical checks do not validate
// sleeve properties, imposed boundaries, geometry transfer, or engine survival.
// Run: node output/ablative-sleeve-comparison/conduction-only.cjs
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {GEOMETRY,normalize,meshFor,createStepper,robin}=require('./thermal-case-model.cjs');
const CLASSIFICATION='CONDITIONAL_CONDUCTION_ONLY_FIXED_GEOMETRY_NOT_VALIDATED_ENGINE_TEMPERATURE';
const T0=293.15,HOT_FACE_K=3000,PULSE_S=10,END_S=10000;

function calculate(maxCellWidthM=.0001){
  const parameters=normalize({gapConductanceWm2K:Infinity,maxCellWidthM});
  const mesh=meshFor(parameters),stepper=createStepper(mesh);
  const metal=mesh.ranges.find(layer=>layer.name==='metal');
  const link=mesh.links[metal.start-1];
  let temperatures=new Float64Array(mesh.cells.length).fill(T0),time=0;
  let depositedEnergyJ=0,maxStepEnergyResidualJ=0,stepCount=0;
  let maximumSteelAfterPulseK=T0,maximumCellK=T0;
  let at10=null,at600=null,atEnd=null;
  const solidHotFace=robin(HOT_FACE_K,Infinity),insulated=robin(T0,0);
  const steelTemperatures=()=>{
    const heatRate=link.conductanceWK*(temperatures[metal.start-1]-temperatures[metal.start]);
    return {steel_inner_C:temperatures[metal.start]+heatRate*mesh.cells[metal.start].innerHalfResistanceKW-273.15,
      steel_outer_C:temperatures.at(-1)-273.15};
  };
  while(time<END_S-1e-9){
    const heating=time<PULSE_S-1e-9;
    let dt=heating?.01:time<60?.05:.5;
    dt=Math.min(dt,END_S-time);
    if(heating)dt=Math.min(dt,PULSE_S-time);
    const step=stepper.step(temperatures,dt,heating?solidHotFace:insulated,insulated);
    temperatures=step.temperaturesK;time=Math.round((time+dt)*1e8)/1e8;stepCount++;
    if(heating)depositedEnergyJ+=step.innerPowerW*dt;
    else assert.equal(step.innerPowerW,0,'No post-pulse heat flux is allowed');
    assert.equal(step.outerPowerW,0,'Outer boundary must be insulated throughout');
    maxStepEnergyResidualJ=Math.max(maxStepEnergyResidualJ,Math.abs(step.stepEnergyResidualJ));
    for(const value of temperatures){assert(Number.isFinite(value)&&value>=T0-1e-6&&value<=HOT_FACE_K+1e-6);maximumCellK=Math.max(maximumCellK,value);}
    const faces=steelTemperatures();
    if(time>=PULSE_S-1e-9){
      maximumSteelAfterPulseK=Math.max(maximumSteelAfterPulseK,faces.steel_inner_C+273.15,faces.steel_outer_C+273.15);
      for(let i=metal.start;i<temperatures.length;i++)maximumSteelAfterPulseK=Math.max(maximumSteelAfterPulseK,temperatures[i]);
    }
    if(Math.abs(time-PULSE_S)<1e-8)at10={time_s:time,...faces};
    if(Math.abs(time-600)<1e-8)at600={time_s:time,...faces};
    if(Math.abs(time-END_S)<1e-8)atEnd={time_s:time,...faces};
  }
  const equilibriumK=T0+depositedEnergyJ/mesh.totalCapacityJK;
  const finalStoredEnergyJ=temperatures.reduce((sum,value,i)=>sum+mesh.cells[i].capacityJK*(value-T0),0);
  const energyClosureJ=finalStoredEnergyJ-depositedEnergyJ;
  const maximumFinalDeviationK=Math.max(...temperatures.map(value=>Math.abs(value-equilibriumK)));
  const maximumSteelExcessK=Math.max(0,maximumSteelAfterPulseK-equilibriumK);
  assert(at10&&at600&&atEnd,'All required timestamps must be sampled');
  assert(Math.abs(energyClosureJ)/depositedEnergyJ<1e-8,'Conservative energy balance failed');
  assert(maximumFinalDeviationK<.001,'Final state has not converged sufficiently to the analytic equilibrium');
  assert(maximumSteelExcessK<1e-6,'A steel transient exceeded the equilibrium reference');
  assert(Math.abs(at10.steel_inner_C-20)<.001&&Math.abs(at10.steel_outer_C-20)<.001);
  return {parameters,mesh,depositedEnergyJ,equilibriumK,finalStoredEnergyJ,energyClosureJ,maxStepEnergyResidualJ,
    maximumFinalDeviationK,maximumSteelExcessK,maximumSteelAfterPulseK,maximumCellK,at10,at600,atEnd,stepCount};
}

function buildDocument(){
  const fine=calculate(.0001),coarse=calculate(.0002);
  const meshDelta=Math.abs(fine.equilibriumK-coarse.equilibriumK);
  assert(meshDelta<.1,'Coarse-versus-fine equilibrium difference exceeds 0.1 C');
  const p=fine.parameters;
  return {
    classification:CLASSIFICATION,validated:false,
    purpose:'Conduction-only illustration of bulk steel heating behind an intact, fixed sleeve. Not an engine-survival or structural certificate.',
    reproducibility:{generator:'output/ablative-sleeve-comparison/conduction-only.cjs',shared_solver:'output/ablative-sleeve-comparison/thermal-case-model.cjs',self_checks:'Run the generator; assertions check energy, timestamps, passive bounds, equilibrium convergence, steel overshoot and mesh refinement.'},
    documentation:'sleeve-thermal-README.md',source_ledger:'sleeve-case-sources.md',
    assumptions:{
      hot_boundary:'A solid hot-face temperature of 3000 K is imposed for 10 s. This is a selected Dirichlet boundary, not measured gas temperature or heat flux; the source supplies whatever heat conduction demands.',
      initial_state:'Every represented solid starts at 293.15 K (20 C).',
      fixed_geometry:'The selected 3.175 mm uniform recession and 2 mm retained char layer already exist at time zero and do not evolve.',
      interface:'Perfect thermal coupling across the actual 0.635 mm sleeve/case radial gap: zero interface resistance, no invented solid or heat capacity in the gap.',
      cooling:'No convection or radiation. The steel exterior is insulated throughout; the bore is also insulated after 10 s, so all deposited energy remains in the modeled solids.',
      dimensionality:'One-dimensional radial heat conduction in the sleeve-overlap band; no axial or azimuthal spreading, end heating, cracks or gas bypass.',
      properties:'All k, density and heat capacity values are held constant. The virgin/char high-temperature properties are unvalidated; pyrolysis, recession, chemistry and phase-change energy are omitted.'
    },
    evidence_status:{
      recession:'Approximately measured 1/8-inch hot-brick dimple depth is converted to 3.175 mm and hypothetically transferred uniformly to this sleeve. It is not measured sleeve recession.',
      virgin_density:'82.8 g initial brick mass divided by nominal 2 x 3.5 x 0.5 inch volume gives conditional density; transfer to the sleeve is assumed.',
      retained_char:'2 mm retained char, density ratio 0.5 and char k/cp are analyst-selected, not measured layer properties.',
      case:'Documented candidate case dimensions and 304L BOM designation; constant ATI 304-family thermal properties are a low-temperature surrogate, not certified fired-part data.',
      pulse:'3000 K solid boundary and 10 s duration are selected assumptions, not a reconstruction of the actual exposure. The reported 0.25 s controller event does not establish thermal duration.'
    },
    measured_sleeve_data:{case_temperature_C:null,solid_hot_face_temperature_K:null,heat_flux_W_per_m2:null,
      heating_duration_s:null,recession_mm:null,retained_char_thickness_mm:null,as_fired_density_kg_per_m3:null},
    geometry:{...GEOMETRY,physical_radial_gap_m:GEOMETRY.caseInnerM-GEOMETRY.sleeveOuterM,
      imposed_uniform_recession_m:p.recessionM,selected_retained_char_m:p.retainedCharM,
      scope:'Local sleeve-overlap band, not full-case average or verified global hotspot.'},
    layer_properties:fine.mesh.ranges.map(layer=>({name:layer.name,inner_radius_m:layer.innerM,outer_radius_m:layer.outerM,
      density_kg_per_m3:layer.densityKgm3,heat_capacity_J_per_kg_K:layer.cpJkgK,conductivity_W_per_m_K:layer.kWmK,
      property_status:layer.name==='metal'?'Constant low-temperature ATI family surrogate':'Selected constant properties; not high-temperature validated'})),
    boundary_conditions:{initial_temperature_K:T0,pulse_duration_s:PULSE_S,
      inner_during_pulse:{type:'prescribed_solid_temperature',temperature_K:HOT_FACE_K},
      outer_throughout:{type:'adiabatic',heat_flux_W_per_m2:0},inner_after_pulse:{type:'adiabatic',heat_flux_W_per_m2:0},
      interface:{type:'zero_thermal_resistance_no_added_capacity'},convection:false,radiation:false},
    results:{deposited_energy_J:fine.depositedEnergyJ,total_heat_capacity_J_per_K:fine.mesh.totalCapacityJK,
      asymptotic_equilibrium_C:fine.equilibriumK-273.15,
      equilibrium_formula:'T_infinity = T_initial + deposited_energy / sum(m_i * cp_i)',
      equilibrium_time_s:null,equilibrium_time_status:'Asymptotic equilibrium, not a peak at a claimed finite time.',
      at_10_s:fine.at10,at_600_s:fine.at600,final_computed_state:fine.atEnd,
      maximum_computed_material_cell_C:fine.maximumCellK-273.15,
      maximum_computed_steel_C:fine.maximumSteelAfterPulseK-273.15,
      conclusion:'Within these intact-sleeve assumptions, the model keeps bulk case temperature far below melting during the 10 s pulse and subsequent retained-energy soak. It does not establish actual-engine safety or structural survival.'},
    numerical_checks:{
      method:'Conservative backward-Euler annular finite volumes with logarithmic radial resistance and exact annular heat capacity.',
      max_cell_width_m:.0001,heating_time_step_s:.01,early_cooling_time_step_s:.05,late_time_step_s:.5,
      fine_cells:fine.mesh.cells.length,steps:fine.stepCount,integrated_until_s:END_S,
      final_stored_energy_change_J:fine.finalStoredEnergyJ,energy_closure_residual_J:fine.energyClosureJ,
      energy_closure_relative_error:Math.abs(fine.energyClosureJ)/fine.depositedEnergyJ,
      maximum_step_energy_residual_J:fine.maxStepEnergyResidualJ,
      maximum_final_cell_deviation_from_equilibrium_C:fine.maximumFinalDeviationK,
      post_pulse_no_steel_overshoot:true,maximum_steel_excess_above_equilibrium_C:fine.maximumSteelExcessK,
      overshoot_check_tolerance_C:1e-6,coarse_cell_width_m:.0002,
      coarse_equilibrium_C:coarse.equilibriumK-273.15,coarse_vs_fine_equilibrium_delta_C:meshDelta,
      numerical_verification_is_physical_validation:false
    },
    limitations:[
      'Fixed high-temperature virgin/char properties do not model real decomposition or thermal protection performance.',
      'No bypass heat path, cracked sleeve, end exposure or loss of material/contact is represented.',
      'No pressure load, steel strength reduction, stress or structural safety factor is calculated.',
      'Perfect coupling and retained energy are selected sensitivities, not proof of an overall conservative bound.',
      'Results do not reuse the separate 59 C scenario, which included convective cooling.',
      'Approximately 94 C is an idealized model equilibrium, not a measured engine-case temperature or qualified operating limit.'
    ]
  };
}
if(require.main===module){
  const document=buildDocument();
  const target=path.resolve(__dirname,'../../assets/builds/ablative-material-testing-fixture/analysis/sleeve-conduction-only.json');
  fs.writeFileSync(target,JSON.stringify(document,null,2)+'\n');
  console.log(JSON.stringify({results:document.results,numerical_checks:document.numerical_checks},null,2));
  console.log('PASS conduction-only energy, equilibrium, no-overshoot, boundary, timestamp and mesh checks; not physical validation.');
}
module.exports={CLASSIFICATION,calculate,buildDocument};
