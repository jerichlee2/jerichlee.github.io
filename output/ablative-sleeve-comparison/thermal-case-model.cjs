// Conditional fixed-geometry radial conduction, NOT a pyrolysis/ablation,
// structural-survival, or reconstructed-hotfire solver. Run directly to export.
// Metal surrogate: ATI 302/304/304L/305 technical data sheet, physical properties:
// https://www.atimaterials.com/Products/Documents/datasheets/stainless-specialty-steel/austenitic/ati_302_304_304l_305_tds_en4_v1.pdf
// ATI lists rho=7900 kg/m3, cp=500 J/(kg K) for 0–100 C, k=16.3 W/(m K)
// at 100 C (21.4 at 500 C). We deliberately retain constant low-temperature
// properties and flag extrapolation above 100 C; this is not a strength limit.
"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rig = require('../../assets/js/ablative-depth-surface-model.js');
const CLASSIFICATION = 'CONDITIONAL_FIXED_GEOMETRY_RADIAL_CONDUCTION_NOT_VALIDATED_ENGINE_TEMPERATURE';
const GEOMETRY = Object.freeze({
  sleeveOriginalInnerM: .0381, sleeveOuterM: .050165,
  caseInnerM: .0508, caseOuterM: .05715,
  caseFullLengthM: .3048, modeledOverlapLengthM: .1820672
});
const DEFAULTS = Object.freeze({
  id: 'central', initialTemperatureK: 293.15, ambientTemperatureK: 293.15,
  gasTemperatureK: 2876, gasFilmCoefficientWm2K: 2240, selectedHeatingDurationS: 10,
  recessionM: .003175, retainedCharM: .002, charDensityRatio: .5,
  virginDensityKgm3: rig.constants.density, virginCpJkgK: 1000, virginKWmK: .16,
  charCpJkgK: 1000, charKWmK: .16,
  metalDensityKgm3: 7900, metalCpJkgK: 500, metalKWmK: 16.3,
  gapConductanceWm2K: 100, coolingBoreCoefficientWm2K: 10, outsideCoefficientWm2K: 10,
  directMetalPatch: false,
  maxCellWidthM: .0002, heatingTimeStepS: .02, earlyCoolingTimeStepS: .1, lateTimeStepS: 1,
  minimumEndTimeS: 1800, maximumEndTimeS: 7200, extendUntilPeakResolved: true
});
function positive(x, label) { assert(typeof x === 'number' && Number.isFinite(x) && x > 0, `${label} must be finite and positive`); }
function nonnegative(x, label) { assert(typeof x === 'number' && Number.isFinite(x) && x >= 0, `${label} must be finite and nonnegative`); }
function validConductance(x) { assert(x === Infinity || (typeof x === 'number' && Number.isFinite(x) && x >= 0), 'Conductance must be nonnegative or the infinite-conductance limit'); }
function normalize(input = {}) {
  const p = { ...DEFAULTS, ...input };
  for (const key of ['initialTemperatureK','ambientTemperatureK','gasTemperatureK','virginDensityKgm3','virginCpJkgK','virginKWmK','charCpJkgK','charKWmK','metalDensityKgm3','metalCpJkgK','metalKWmK','maxCellWidthM','heatingTimeStepS','earlyCoolingTimeStepS','lateTimeStepS','minimumEndTimeS','maximumEndTimeS']) positive(p[key], key);
  for (const key of ['selectedHeatingDurationS','recessionM','retainedCharM','gasFilmCoefficientWm2K','coolingBoreCoefficientWm2K','outsideCoefficientWm2K']) nonnegative(p[key], key);
  positive(p.charDensityRatio, 'charDensityRatio'); assert(p.charDensityRatio <= 1);
  assert(p.recessionM + p.retainedCharM < GEOMETRY.sleeveOuterM - GEOMETRY.sleeveOriginalInnerM, 'Selected recession and char must leave some virgin sleeve material');
  assert(p.minimumEndTimeS > p.selectedHeatingDurationS && p.maximumEndTimeS >= p.minimumEndTimeS);
  validConductance(p.gapConductanceWm2K);
  assert(typeof p.directMetalPatch === 'boolean' && typeof p.extendUntilPeakResolved === 'boolean');
  return p;
}
function layersFor(p) {
  const g = GEOMETRY, layers = [];
  if (!p.directMetalPatch) {
    const hotRadius = g.sleeveOriginalInnerM + p.recessionM;
    if (p.retainedCharM > 0) layers.push({ name:'char', innerM:hotRadius, outerM:hotRadius+p.retainedCharM,
      densityKgm3:p.virginDensityKgm3*p.charDensityRatio, cpJkgK:p.charCpJkgK, kWmK:p.charKWmK });
    layers.push({ name:'virgin', innerM:hotRadius+p.retainedCharM, outerM:g.sleeveOuterM,
      densityKgm3:p.virginDensityKgm3, cpJkgK:p.virginCpJkgK, kWmK:p.virginKWmK });
  }
  layers.push({ name:'metal', innerM:g.caseInnerM, outerM:g.caseOuterM,
    densityKgm3:p.metalDensityKgm3, cpJkgK:p.metalCpJkgK, kWmK:p.metalKWmK });
  return layers;
}

// Cells exist in material only. Geometric-mean centers make logarithmic
// center-to-face resistance exactly half a cell's cylindrical resistance.
function buildMesh(layers, options = {}) {
  const lengthM = options.lengthM ?? GEOMETRY.modeledOverlapLengthM;
  const maxCellWidthM = options.maxCellWidthM ?? DEFAULTS.maxCellWidthM;
  const interfaceConductances = options.interfaceConductances ?? {};
  positive(lengthM,'lengthM'); positive(maxCellWidthM,'maxCellWidthM');
  assert(Array.isArray(layers) && layers.length > 0);
  const cells = [], ranges = [], links = [];
  layers.forEach((layer, layerIndex) => {
    for (const key of ['innerM','outerM','densityKgm3','cpJkgK','kWmK']) positive(layer[key],key);
    assert(layer.outerM > layer.innerM);
    if (layerIndex) assert(layer.innerM >= layers[layerIndex-1].outerM - 1e-12, 'Layers must not overlap');
    const count = Math.ceil((layer.outerM-layer.innerM)/maxCellWidthM), start = cells.length;
    for (let j=0;j<count;j++) {
      const innerM = layer.innerM+(layer.outerM-layer.innerM)*j/count;
      const outerM = layer.innerM+(layer.outerM-layer.innerM)*(j+1)/count;
      const centerM = Math.sqrt(innerM*outerM);
      const volumeM3 = Math.PI*lengthM*(outerM**2-innerM**2);
      cells.push({ index:cells.length, layerIndex, layer:layer.name, innerM,outerM,centerM,volumeM3,
        massKg:layer.densityKgm3*volumeM3, capacityJK:layer.densityKgm3*layer.cpJkgK*volumeM3,
        innerHalfResistanceKW:Math.log(centerM/innerM)/(2*Math.PI*lengthM*layer.kWmK),
        outerHalfResistanceKW:Math.log(outerM/centerM)/(2*Math.PI*lengthM*layer.kWmK) });
    }
    ranges.push({ name:layer.name, layerIndex, start,end:cells.length-1,...layer });
  });
  for (let i=0;i<cells.length-1;i++) {
    const left=cells[i],right=cells[i+1],different=left.layerIndex!==right.layerIndex;
    const h=different ? (interfaceConductances[left.layerIndex] ?? Infinity) : Infinity;
    validConductance(h);
    const areaReferenceM2=2*Math.PI*lengthM*left.outerM;
    const interfaceResistanceKW=h===Infinity?0:h===0?Infinity:1/(h*areaReferenceM2);
    const resistanceKW=left.outerHalfResistanceKW+interfaceResistanceKW+right.innerHalfResistanceKW;
    links.push({ left:i,right:i+1,conductanceWK:1/resistanceKW,resistanceKW,interfaceResistanceKW,
      referenceAreaM2:areaReferenceM2, leftSurfaceM:left.outerM,rightSurfaceM:right.innerM,
      materialGapM:Math.max(0,right.innerM-left.outerM), differentLayer:different });
  }
  return { lengthM,cells,ranges,links,innerAreaM2:2*Math.PI*lengthM*cells[0].innerM,
    outerAreaM2:2*Math.PI*lengthM*cells.at(-1).outerM,
    totalMaterialVolumeM3:cells.reduce((sum,c)=>sum+c.volumeM3,0),
    totalCapacityJK:cells.reduce((sum,c)=>sum+c.capacityJK,0) };
}
function boundaryLink(mesh, side, boundary) {
  const first=side==='inner',cell=first?mesh.cells[0]:mesh.cells.at(-1);
  const areaM2=first?mesh.innerAreaM2:mesh.outerAreaM2;
  const halfResistanceKW=first?cell.innerHalfResistanceKW:cell.outerHalfResistanceKW;
  if (boundary.type==='flux') {
    assert(Number.isFinite(boundary.fluxWm2));
    return { conductanceWK:0,sourceW:boundary.fluxWm2*areaM2,halfResistanceKW,areaM2 };
  }
  assert(boundary.type==='robin'); validConductance(boundary.hWm2K); positive(boundary.temperatureK,'boundary temperature');
  const h=boundary.hWm2K;
  const resistanceKW=halfResistanceKW+(h===Infinity?0:h===0?Infinity:1/(h*areaM2));
  const conductanceWK=1/resistanceKW;
  return { conductanceWK,sourceW:conductanceWK*boundary.temperatureK,halfResistanceKW,areaM2 };
}
function createStepper(mesh) {
  const n=mesh.cells.length,cache=new Map();
  function step(temperaturesK,dt,inner,outer) {
    positive(dt,'dt'); assert(temperaturesK.length===n);
    const innerLink=boundaryLink(mesh,'inner',inner),outerLink=boundaryLink(mesh,'outer',outer);
    const key=`${dt.toPrecision(10)}:${innerLink.conductanceWK}:${outerLink.conductanceWK}`;
    let factor=cache.get(key);
    if (!factor) {
      const inv=new Float64Array(n),upper=new Float64Array(n),lower=new Float64Array(n),storage=new Float64Array(n);
      for(let i=0;i<n;i++) {
        const west=i?mesh.links[i-1].conductanceWK:innerLink.conductanceWK;
        const east=i<n-1?mesh.links[i].conductanceWK:outerLink.conductanceWK;
        storage[i]=mesh.cells[i].capacityJK/dt;
        lower[i]=i?-west:0;
        const diagonal=storage[i]+west+east;
        inv[i]=1/(diagonal-(i?lower[i]*upper[i-1]:0));
        upper[i]=i<n-1?-east*inv[i]:0;
      }
      factor={inv,upper,lower,storage}; cache.set(key,factor);
    }
    const next=new Float64Array(n);
    for(let i=0;i<n;i++) {
      const rhs=factor.storage[i]*temperaturesK[i]+(i===0?innerLink.sourceW:0)+(i===n-1?outerLink.sourceW:0);
      next[i]=(rhs-(i?factor.lower[i]*next[i-1]:0))*factor.inv[i];
    }
    for(let i=n-2;i>=0;i--) next[i]-=factor.upper[i]*next[i+1];
    const innerPowerW=innerLink.sourceW-innerLink.conductanceWK*next[0];
    const outerPowerW=outerLink.sourceW-outerLink.conductanceWK*next[n-1];
    let storedChangeJ=0;
    for(let i=0;i<n;i++) storedChangeJ+=mesh.cells[i].capacityJK*(next[i]-temperaturesK[i]);
    return { temperaturesK:next,innerPowerW,outerPowerW,storedChangeJ,
      stepEnergyResidualJ:storedChangeJ-dt*(innerPowerW+outerPowerW),
      innerSurfaceK:next[0]+innerPowerW*innerLink.halfResistanceKW,
      outerSurfaceK:next[n-1]+outerPowerW*outerLink.halfResistanceKW };
  }
  return { step, factorizationCount:()=>cache.size };
}
const robin=(temperatureK,hWm2K)=>({type:'robin',temperatureK,hWm2K});
function meshFor(p) {
  const layers=layersFor(p),interfaceConductances={};
  if (!p.directMetalPatch) interfaceConductances[layers.length-2]=p.gapConductanceWm2K;
  return buildMesh(layers,{lengthM:GEOMETRY.modeledOverlapLengthM,maxCellWidthM:p.maxCellWidthM,interfaceConductances});
}
function caseInnerSurface(mesh,T,hotSurfaceK) {
  const metal=mesh.ranges.find(layer=>layer.name==='metal');
  if (metal.start===0) return hotSurfaceK;
  const link=mesh.links[metal.start-1],power=link.conductanceWK*(T[metal.start-1]-T[metal.start]);
  return T[metal.start]+power*mesh.cells[metal.start].innerHalfResistanceKW;
}
function simulate(input={}) {
  const p=normalize(input),mesh=meshFor(p),stepper=createStepper(mesh);
  let T=new Float64Array(mesh.cells.length).fill(p.initialTemperatureK),time=0,end=p.minimumEndTimeS;
  let innerEnergyJ=0,outerEnergyJ=0,absoluteBoundaryEnergyJ=0,maxStepResidualJ=0,stepCount=0;
  const initialEnergyJ=mesh.cells.reduce((sum,c)=>sum+c.capacityJK*p.initialTemperatureK,0);
  const peaks={ caseInner:{temperatureK:p.initialTemperatureK,timeS:0},caseOuter:{temperatureK:p.initialTemperatureK,timeS:0},
    hotFace:{temperatureK:p.initialTemperatureK,timeS:0},cell:{temperatureK:p.initialTemperatureK,timeS:0,layer:mesh.cells[0].layer,radiusM:mesh.cells[0].centerM},
    metalCell:{temperatureK:p.initialTemperatureK,timeS:0} };
  const history=[{time_s:0,phase:'initial',hot_face_C:p.initialTemperatureK-273.15,case_inner_C:p.initialTemperatureK-273.15,
    case_outer_C:p.initialTemperatureK-273.15,maximum_cell_C:p.initialTemperatureK-273.15,inner_boundary_power_W:0,outer_boundary_power_W:0,stored_energy_change_J:0}];
  let nextOutput=.2,atShutdown=null,lastResult=null,priorOuterK=p.initialTemperatureK;
  const updatePeak=(peak,value,t)=>{if(value>peak.temperatureK+1e-12){peak.temperatureK=value;peak.timeS=t;}};
  const peakResolved=()=>{
    if(!lastResult)return false;
    const noRise=peaks.caseOuter.temperatureK-p.initialTemperatureK<1e-8&&peaks.caseInner.temperatureK-p.initialTemperatureK<1e-8;
    if(noRise)return true;
    const inner=caseInnerSurface(mesh,T,lastResult.innerSurfaceK),outer=lastResult.outerSurfaceK;
    return peaks.caseInner.timeS<time-30&&peaks.caseOuter.timeS<time-30&&
      inner<peaks.caseInner.temperatureK-1e-7&&outer<peaks.caseOuter.temperatureK-1e-7&&outer<=priorOuterK+1e-9;
  };
  while(true) {
    while(time<end-1e-9) {
      const heating=time<p.selectedHeatingDurationS-1e-9;
      let dt=heating?p.heatingTimeStepS:time<p.selectedHeatingDurationS+50?p.earlyCoolingTimeStepS:p.lateTimeStepS;
      dt=Math.min(dt,end-time);
      if(heating)dt=Math.min(dt,p.selectedHeatingDurationS-time);
      const inner=heating?robin(p.gasTemperatureK,p.gasFilmCoefficientWm2K):robin(p.ambientTemperatureK,p.coolingBoreCoefficientWm2K);
      const outer=robin(p.ambientTemperatureK,p.outsideCoefficientWm2K);
      priorOuterK=lastResult?.outerSurfaceK??p.initialTemperatureK;
      const result=stepper.step(T,dt,inner,outer); T=result.temperaturesK; time=Math.round((time+dt)*1e9)/1e9;
      lastResult=result; stepCount++;
      innerEnergyJ+=result.innerPowerW*dt; outerEnergyJ+=result.outerPowerW*dt;
      absoluteBoundaryEnergyJ+=(Math.abs(result.innerPowerW)+Math.abs(result.outerPowerW))*dt;
      maxStepResidualJ=Math.max(maxStepResidualJ,Math.abs(result.stepEnergyResidualJ));
      const innerCaseK=caseInnerSurface(mesh,T,result.innerSurfaceK);
      updatePeak(peaks.caseInner,innerCaseK,time);updatePeak(peaks.caseOuter,result.outerSurfaceK,time);updatePeak(peaks.hotFace,result.innerSurfaceK,time);
      let maxCell=-Infinity;
      T.forEach((value,i)=>{
        assert(Number.isFinite(value)&&value>0,'Positive finite temperatures required');maxCell=Math.max(maxCell,value);
        if(value>peaks.cell.temperatureK){peaks.cell={temperatureK:value,timeS:time,layer:mesh.cells[i].layer,radiusM:mesh.cells[i].centerM};}
        if(mesh.cells[i].layer==='metal')updatePeak(peaks.metalCell,value,time);
      });
      const atEnd=Math.abs(time-p.selectedHeatingDurationS)<1e-8;
      if(atEnd)atShutdown={time_s:time,case_inner_C:innerCaseK-273.15,case_outer_C:result.outerSurfaceK-273.15,hot_face_C:result.innerSurfaceK-273.15};
      if(time>=nextOutput-1e-8||atEnd||Math.abs(time-end)<1e-8) {
        let stored=0;T.forEach((value,i)=>{stored+=mesh.cells[i].capacityJK*(value-p.initialTemperatureK);});
        history.push({time_s:time,phase:heating?'selected_heating':'selected_cooling',hot_face_C:result.innerSurfaceK-273.15,
          case_inner_C:innerCaseK-273.15,case_outer_C:result.outerSurfaceK-273.15,maximum_cell_C:maxCell-273.15,
          inner_boundary_power_W:result.innerPowerW,outer_boundary_power_W:result.outerPowerW,stored_energy_change_J:stored});
        nextOutput=Math.round((time+(time<p.selectedHeatingDurationS-1e-8?.2:time<60?1:5))*1e9)/1e9;
      }
    }
    if(!p.extendUntilPeakResolved||peakResolved()||end>=p.maximumEndTimeS)break;
    end=Math.min(p.maximumEndTimeS,end*2);
  }
  if(!atShutdown&&p.selectedHeatingDurationS===0)atShutdown={time_s:0,case_inner_C:p.initialTemperatureK-273.15,case_outer_C:p.initialTemperatureK-273.15,hot_face_C:p.initialTemperatureK-273.15};
  let storedEnergyJ=0;T.forEach((value,i)=>{storedEnergyJ+=mesh.cells[i].capacityJK*(value-p.initialTemperatureK);});
  const energyResidualJ=storedEnergyJ-innerEnergyJ-outerEnergyJ;
  const peakAsC=peak=>({temperature_C:peak.temperatureK-273.15,time_s:peak.timeS});
  const metalMaxK=Math.max(peaks.caseInner.temperatureK,peaks.caseOuter.temperatureK,peaks.metalCell.temperatureK);
  const maximumSourceK=Math.max(p.initialTemperatureK,p.gasTemperatureK,p.ambientTemperatureK);
  assert(peaks.cell.temperatureK<=maximumSourceK+1e-5,'Passive model may not exceed the hottest imposed reservoir');
  const publicParameters={...p,gapConductanceWm2K:p.gapConductanceWm2K===Infinity?'infinite_conductance_limit':p.gapConductanceWm2K};
  return {id:p.id,classification:CLASSIFICATION,parameters:publicParameters,
    geometry:{...GEOMETRY,physicalRadialGapM:GEOMETRY.caseInnerM-GEOMETRY.sleeveOuterM,layer_boundaries:mesh.ranges.map(({name,innerM,outerM})=>({name,innerM,outerM})),
      local_band_metal_mass_kg:mesh.cells.filter(c=>c.layer==='metal').reduce((sum,c)=>sum+c.massKg,0),
      solid_volume_m3:mesh.totalMaterialVolumeM3,scope:'Local overlap band only, no axial or azimuthal spreading; not a whole-case average or verified global hotspot.'},
    at_selected_heating_end:atShutdown,
    local_band_case_inner_peak:peakAsC(peaks.caseInner),local_band_case_outer_peak:peakAsC(peaks.caseOuter),
    hot_face_peak:peakAsC(peaks.hotFace),maximum_cell_hotspot:{...peakAsC(peaks.cell),layer:peaks.cell.layer,radius_m:peaks.cell.radiusM},
    maximum_metal_cell:peakAsC(peaks.metalCell),
    peak_resolved_within_simulation:peakResolved(),simulated_until_s:time,
    low_temperature_metal_surrogate_extrapolated_above_100C:metalMaxK>373.15,
    metal_surrogate_reaches_ATI_melting_range:metalMaxK>=1399+273.15,
    display_in_intact_layer_comparison:!p.directMetalPatch&&metalMaxK<=373.15,
    warnings:[
      'Fixed preselected geometry and char exist at t=0; this is not an evolving ablation/pyrolysis calculation or a proven conservative bound.',
      'Constant virgin and char properties are unmeasured at the computed temperatures; decomposition, gas transport, surface radiation and material removal are omitted.',
      ...(metalMaxK>373.15?['Metal exceeds 100 C: constant 0–100 C cp and 100 C conductivity surrogate is extrapolated; no strength or phase-change prediction is made.']:[]),
      ...(metalMaxK>=1399+273.15?['Numerical metal temperature reaches the ATI 1399–1421 C melting range while this solver omits latent heat and phase change. This is an invalid constant-property-model output, not a physically predicted steel peak.']:[]),
      ...(p.directMetalPatch?['Bare-wall radial-column benchmark has no lateral spreading or specified patch width; it is not a measured crack width, leakage rate, whole-case temperature or failure prediction. Do not plot it as a valid intact-layer temperature.']:[]),
      ...(p.gapConductanceWm2K===Infinity?['Perfect coupling sets zero interface resistance across the retained physical gap; no fictitious solid or heat capacity is added.']:[]),
      ...(!peakResolved()?['Peak not resolved before the simulation endpoint; reported maximum is only the maximum over the computed interval.']:[])
    ],
    energy_check:{signed_inner_boundary_energy_J:innerEnergyJ,signed_outer_boundary_energy_J:outerEnergyJ,
      stored_energy_change_J:storedEnergyJ,closure_residual_J:energyResidualJ,
      residual_fraction_of_absolute_boundary_energy:Math.abs(energyResidualJ)/Math.max(1,absoluteBoundaryEnergyJ),
      maximum_step_residual_J:maxStepResidualJ,initial_absolute_energy_J:initialEnergyJ},
    numerical:{method:'Backward-Euler conservative annular finite volumes, exact annular capacities and logarithmic radial resistances',cells:mesh.cells.length,steps:stepCount,factorizations:stepper.factorizationCount()},
    actual_engine_case_temperature_C:null,actual_thermal_exposure_s:null,
    history,final_temperatures_K:Array.from(T)};
}

const SCENARIOS=Object.freeze([
  {id:'central',label:'Selected pre-receded sleeve and retained char'},
  {id:'original_virgin',label:'Original virgin sleeve geometry',recessionM:0,retainedCharM:0},
  {id:'perfect_coupling',label:'Infinite gap-conductance limit',gapConductanceWm2K:Infinity},
  {id:'gap_h20',label:'Selected effective gap conductance 20 W/(m² K)',gapConductanceWm2K:20},
  {id:'gap_h1000',label:'Selected effective gap conductance 1000 W/(m² K)',gapConductanceWm2K:1000},
  {id:'insulated_bore_after_heating',label:'Insulated bore after source shutoff',coolingBoreCoefficientWm2K:0},
  {id:'char_k008',label:'Selected char conductivity 0.08 W/(m K)',charKWmK:.08},
  {id:'char_k064',label:'Selected char conductivity 0.64 W/(m K)',charKWmK:.64},
  {id:'char_cp500',label:'Selected char heat capacity 500 J/(kg K)',charCpJkgK:500},
  {id:'char_cp1500',label:'Selected char heat capacity 1500 J/(kg K)',charCpJkgK:1500},
  {id:'virgin_k008',label:'Selected virgin conductivity 0.08 W/(m K)',virginKWmK:.08},
  {id:'virgin_k032',label:'Selected virgin conductivity 0.32 W/(m K)',virginKWmK:.32},
  {id:'gas_2175K',label:'Different Mk1 CEA source-temperature estimate',gasTemperatureK:2175.1},
  {id:'gas_3000K',label:'Approximately 3000 K source-temperature sensitivity',gasTemperatureK:3000},
  {id:'gas_h500',label:'Selected hot-gas coefficient 500 W/(m² K)',gasFilmCoefficientWm2K:500},
  {id:'gas_h1000',label:'Selected hot-gas coefficient 1000 W/(m² K)',gasFilmCoefficientWm2K:1000},
  {id:'bare_wall_column',label:'Bare-wall radial column, no lateral spreading',directMetalPatch:true}
]);
function runSuite(numericalOverrides={}) {
  return SCENARIOS.map(({label,...parameters})=>({label,...simulate({...parameters,...numericalOverrides})}));
}
function writeOutputs(cases) {
  const output=path.resolve(__dirname,'../../assets/builds/ablative-material-testing-fixture/analysis');
  const document={classification:CLASSIFICATION,
    purpose:'Illustrative temperatures under explicitly selected heating, geometry, contact and cooling; not qualification or safe operating time.',
    documentation:'sleeve-thermal-README.md',
    source_ledger:'sleeve-case-sources.md',
    reproducibility:{solver:'output/ablative-sleeve-comparison/thermal-case-model.cjs',tests:'output/ablative-sleeve-comparison/thermal-case-check.cjs',history:'sleeve-thermal-history.csv'},
    source_notes:{
      case_family:'Mk1 report identifies 304 family; BOM identifies 304L. Candidate geometry remains unverified for the fired part.',
      case_dimensions:'Case ID 4 in, OD 4.5 in, total length 12 in; only the 7.168 in sleeve overlap band is represented.',
      steel_property_source:'https://www.atimaterials.com/Products/Documents/datasheets/stainless-specialty-steel/austenitic/ati_302_304_304l_305_tds_en4_v1.pdf',
      steel_property_status:'ATI typical 304-family rho=7900 kg/m3, cp=500 J/(kg K) for 0–100 C and k=16.3 W/(m K) at 100 C used as constant low-temperature surrogate; not certified part data or structural limits.',
      heating:'Main Tg=2876 K and h=2240 W/(m2 K) are report estimates, not measured hotfire boundaries. 2175.1 K is a different Mk1 CEA estimate; 3000 K is a separate selected sensitivity. They are not interchangeable measurements.',
      duration:'10 s is a selected scenario, not verified actual heating duration. The 0.25 s controller-failure timestamp does not establish exposure duration.',
      recession:'Approximately measured coupon depth 1/8 in is imposed uniformly on the sleeve from t=0; the rig depth-vs-flux surface is NOT extrapolated to engine heat flux.',
      density:'82.8 g divided by nominal hot-brick volume gives conditional density, transferred to candidate sleeve without as-fired density verification.',
      char_and_interface:'Char thickness/density/k/cp and gap conductance are selected inputs. Gap h is referenced to sleeve outer area; heat rate is conserved across the different radial areas.'
    },
    omissions:['moving recession','pyrolysis kinetics/energy','temperature-dependent properties','radiation','gap gas flow','crack dynamics','axial/azimuthal heat spreading','metal strength and stress','phase changes','film-cooling distribution'],
    interpretation:'These cases are not measured results, confidence intervals, established bounds or an engine-survival conclusion. Even a cool intact-path case does not rule out bypass heating.',
    actual_case_temperature_C:null,actual_heating_duration_s:null,validated:false,
    scenario_count:cases.length,cases:cases.map(({history,final_temperatures_K,...summary})=>summary)};
  fs.writeFileSync(path.join(output,'sleeve-thermal-results.json'),JSON.stringify(document,null,2)+'\n');
  const keys=['time_s','phase','hot_face_C','case_inner_C','case_outer_C','maximum_cell_C','inner_boundary_power_W','outer_boundary_power_W','stored_energy_change_J'];
  const csv=['scenario_id,classification,'+keys.join(',')];
  for(const c of cases)for(const row of c.history)csv.push([c.id,CLASSIFICATION,...keys.map(k=>typeof row[k]==='number'?row[k].toPrecision(12):row[k])].join(','));
  fs.writeFileSync(path.join(output,'sleeve-thermal-history.csv'),csv.join('\n')+'\n');
  return document;
}
if(require.main===module) {
  const cases=runSuite(),document=writeOutputs(cases);
  console.log(JSON.stringify(document.cases.map(c=>({id:c.id,end:c.at_selected_heating_end,inner_peak:c.local_band_case_inner_peak,
    outer_peak:c.local_band_case_outer_peak,resolved:c.peak_resolved_within_simulation,metal_surrogate_extrapolated:c.low_temperature_metal_surrogate_extrapolated_above_100C,
    energy_relative_residual:c.energy_check.residual_fraction_of_absolute_boundary_energy})),null,2));
  console.log(`Generated ${cases.length} conditional conduction cases and post-heating histories; not validated engine temperatures.`);
}
module.exports={CLASSIFICATION,GEOMETRY,DEFAULTS,SCENARIOS,normalize,layersFor,buildMesh,createStepper,meshFor,simulate,runSuite,writeOutputs,robin};
