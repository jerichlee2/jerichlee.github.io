// Offline numerical and interpretation checks. This validates implementation,
// not real-material properties, engine boundary conditions, or thermal survival.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const m=require('./thermal-case-model.cjs');
let checks=0;
function check(name,fn){fn();checks++;console.log(`PASS ${name}`);}
function near(actual,expected,tol=1e-8,message=''){assert(Number.isFinite(actual));assert(Math.abs(actual-expected)<=tol,`${message}: ${actual} versus ${expected} (tolerance ${tol})`);}
const annulus={name:'test',innerM:.04,outerM:.06,densityKgm3:1300,cpJkgK:900,kWmK:2};
const energy=(mesh,T)=>mesh.cells.reduce((sum,c,i)=>sum+c.capacityJK*T[i],0);
const adiabatic=m.robin(293.15,0);

check('selected geometry, density and units are explicit',()=>{
  const g=m.GEOMETRY,p=m.normalize(),layers=m.layersFor(p);
  near((g.caseInnerM-g.sleeveOuterM)*1000,.635,1e-11);
  near(layers[0].innerM,.041275,1e-12);near(layers[0].outerM,.043275,1e-12);
  near(layers[1].outerM-layers[1].innerM,.00689,1e-12);
  near(p.virginDensityKgm3,.0828/(2*3.5*.5*.0254**3),1e-9);
  near(g.modeledOverlapLengthM,7.168*.0254,1e-12);
  near(g.caseFullLengthM,12*.0254,1e-12);
});
check('invalid physical or numerical parameters are rejected',()=>{
  for(const p of [{virginKWmK:0},{charCpJkgK:-1},{maxCellWidthM:0},{gasTemperatureK:NaN},
    {gapConductanceWm2K:-1},{charDensityRatio:1.1},{recessionM:.011,retainedCharM:.002},
    {heatingTimeStepS:0},{minimumEndTimeS:5},{maximumEndTimeS:100}])assert.throws(()=>m.normalize(p));
  for(const h of [0,20,1000,Infinity])assert.equal(m.normalize({gapConductanceWm2K:h}).gapConductanceWm2K,h);
});
check('annular capacities exclude physical gap and unmodeled axial length',()=>{
  const p=m.normalize(),mesh=m.meshFor(p),g=m.GEOMETRY,layers=m.layersFor(p);
  const volume=layers.reduce((sum,l)=>sum+Math.PI*g.modeledOverlapLengthM*(l.outerM**2-l.innerM**2),0);
  near(mesh.totalMaterialVolumeM3,volume,1e-14);
  assert(mesh.cells.every(c=>c.outerM<=g.sleeveOuterM+1e-12||c.innerM>=g.caseInnerM-1e-12));
  const metal=mesh.cells.filter(c=>c.layer==='metal').reduce((sum,c)=>sum+c.massKg,0);
  near(metal,7900*Math.PI*g.modeledOverlapLengthM*(g.caseOuterM**2-g.caseInnerM**2),1e-11);
  assert(metal<7900*Math.PI*g.caseFullLengthM*(g.caseOuterM**2-g.caseInnerM**2));
  const link=mesh.links.find(l=>l.materialGapM>0);
  near(link.materialGapM,.000635,1e-12);
  near(link.interfaceResistanceKW,1/(100*2*Math.PI*g.modeledOverlapLengthM*g.sleeveOuterM),1e-12);
  const perfect=m.meshFor(m.normalize({gapConductanceWm2K:Infinity}));
  near(perfect.totalMaterialVolumeM3,volume,1e-14);
  assert.equal(perfect.links.find(l=>l.materialGapM>0).interfaceResistanceKW,0);
});
check('steady homogeneous cylinder matches independent logarithmic solution',()=>{
  const mesh=m.buildMesh([annulus],{lengthM:.2,maxCellWidthM:.0008});
  const Tin=500,Tout=300,R=Math.log(.06/.04)/(2*Math.PI*.2*2),Q=(Tin-Tout)/R;
  const T=Float64Array.from(mesh.cells,c=>Tin-Q*Math.log(c.centerM/.04)/(2*Math.PI*.2*2));
  const result=m.createStepper(mesh).step(T,100,m.robin(Tin,Infinity),m.robin(Tout,Infinity));
  result.temperaturesK.forEach((v,i)=>near(v,T[i],1e-9));
  near(result.innerPowerW,Q,1e-8);near(result.outerPowerW,-Q,1e-8);
  near(result.innerSurfaceK,Tin,1e-10);near(result.outerSurfaceK,Tout,1e-10);
});
check('steady multilayer gap conserves heat rate across unequal endpoint areas',()=>{
  const layers=[{...annulus,name:'a',outerM:.045,kWmK:.2},{...annulus,name:'b',innerM:.046,outerM:.055,kWmK:5}];
  const L=.17,h=75,mesh=m.buildMesh(layers,{lengthM:L,maxCellWidthM:.0005,interfaceConductances:{0:h}});
  const Ra=Math.log(.045/.04)/(2*Math.PI*L*.2),Rg=1/(h*2*Math.PI*L*.045),Rb=Math.log(.055/.046)/(2*Math.PI*L*5);
  const Q=200/(Ra+Rg+Rb),T=Float64Array.from(mesh.cells,c=>500-Q*(c.layer==='a'?Math.log(c.centerM/.04)/(2*Math.PI*L*.2):Ra+Rg+Math.log(c.centerM/.046)/(2*Math.PI*L*5)));
  const result=m.createStepper(mesh).step(T,30,m.robin(500,Infinity),m.robin(300,Infinity));
  result.temperaturesK.forEach((v,i)=>near(v,T[i],1e-9));
  near(result.innerPowerW,Q,1e-8);near(result.outerPowerW,-Q,1e-8);
  const gap=mesh.links.find(l=>l.materialGapM>0),Qgap=gap.conductanceWK*(result.temperaturesK[gap.left]-result.temperaturesK[gap.right]);
  near(Qgap,Q,1e-8);
  assert.notEqual(Q/(2*Math.PI*L*.045),Q/(2*Math.PI*L*.046),'Conserved heat rate need not imply equal flux density at different radii');
});
check('adiabatic redistribution conserves energy and passive bounds',()=>{
  const mesh=m.buildMesh([annulus],{maxCellWidthM:.0005}),stepper=m.createStepper(mesh);
  let T=Float64Array.from(mesh.cells,(_,i)=>i<mesh.cells.length/2?500:300);
  const E0=energy(mesh,T);
  for(let i=0;i<250;i++)T=stepper.step(T,.4,adiabatic,adiabatic).temperaturesK;
  near(energy(mesh,T),E0,1e-6);
  assert([...T].every(v=>v>=300-1e-8&&v<=500+1e-8));
});
check('prescribed flux accumulates correct total energy',()=>{
  const mesh=m.buildMesh([annulus],{maxCellWidthM:.0005}),stepper=m.createStepper(mesh);
  let T=new Float64Array(mesh.cells.length).fill(293.15);const E0=energy(mesh,T);
  for(let i=0;i<100;i++)T=stepper.step(T,.1,{type:'flux',fluxWm2:100},adiabatic).temperaturesK;
  near(energy(mesh,T)-E0,100*mesh.innerAreaM2*10,1e-6);
});
check('zero heating and uniform reservoirs remain isothermal',()=>{
  const s=m.simulate({gasTemperatureK:293.15,minimumEndTimeS:100,maximumEndTimeS:100});
  for(const row of s.history){near(row.case_inner_C,20,1e-7);near(row.case_outer_C,20,1e-7);near(row.hot_face_C,20,1e-7);}
  assert(s.peak_resolved_within_simulation);
});
check('zero interface conductance isolates metal',()=>{
  const s=m.simulate({gapConductanceWm2K:0,minimumEndTimeS:100,maximumEndTimeS:100});
  for(const row of s.history){near(row.case_inner_C,20,1e-7);near(row.case_outer_C,20,1e-7);}
  assert(s.maximum_cell_hotspot.temperature_C>1000);
});

const central=m.simulate();
check('central phase transition, energy balance and postfire peak resolve',()=>{
  assert.equal(central.at_selected_heating_end.time_s,10);
  near(central.at_selected_heating_end.case_outer_C,20,.001);
  assert(central.local_band_case_inner_peak.time_s>10&&central.local_band_case_outer_peak.time_s>10);
  assert(central.peak_resolved_within_simulation);
  assert(central.energy_check.residual_fraction_of_absolute_boundary_energy<1e-8);
  assert(central.history.find(r=>r.time_s===10).inner_boundary_power_W>0);
  assert(central.history.find(r=>r.time_s>10).inner_boundary_power_W<0);
  assert(!central.low_temperature_metal_surrogate_extrapolated_above_100C);
  assert(central.maximum_cell_hotspot.temperature_C>1000,'Cool metal cannot validate the high-temperature ablator model');
});
const refinement={};
check('independent mesh, time and combined refinements agree on case peaks',()=>{
  const configurations={mesh:{maxCellWidthM:.0001},time:{heatingTimeStepS:.01,earlyCoolingTimeStepS:.05,lateTimeStepS:.5},combined:{maxCellWidthM:.0001,heatingTimeStepS:.01,earlyCoolingTimeStepS:.05,lateTimeStepS:.5}};
  for(const [name,p]of Object.entries(configurations)){
    const fine=m.simulate(p);refinement[name]={};
    for(const side of ['inner','outer']){
      const a=central[`local_band_case_${side}_peak`],b=fine[`local_band_case_${side}_peak`];
      const temperatureDifferenceC=Math.abs(a.temperature_C-b.temperature_C),peakTimeDifferenceS=Math.abs(a.time_s-b.time_s);
      refinement[name][side]={temperatureDifferenceC,peakTimeDifferenceS};
      assert(temperatureDifferenceC<.1);assert(peakTimeDifferenceS<=2);
    }
    assert(fine.energy_check.residual_fraction_of_absolute_boundary_energy<1e-8);
  }
});
check('truncated rising trajectory is not labeled a resolved peak',()=>{
  const s=m.simulate({minimumEndTimeS:60,maximumEndTimeS:60,extendUntilPeakResolved:false});
  assert(!s.peak_resolved_within_simulation);
  assert(s.warnings.some(w=>w.includes('Peak not resolved')));
});
check('full scenario suite preserves interpretation and separates invalid bare-wall benchmark',()=>{
  const cases=m.runSuite();assert.equal(cases.length,17);assert.equal(new Set(cases.map(c=>c.id)).size,17);
  for(const c of cases){
    assert.equal(c.actual_engine_case_temperature_C,null);assert.equal(c.actual_thermal_exposure_s,null);
    assert.equal(c.classification,m.CLASSIFICATION);assert(c.peak_resolved_within_simulation);
    assert(c.energy_check.residual_fraction_of_absolute_boundary_energy<1e-8);
    assert(c.warnings.some(w=>w.includes('not an evolving ablation')));
    assert(c.warnings.some(w=>w.includes('unmeasured')));
    assert(c.history.every(r=>Object.values(r).every(v=>typeof v!=='number'||Number.isFinite(v))));
  }
  const bare=cases.find(c=>c.id==='bare_wall_column');
  assert(bare.low_temperature_metal_surrogate_extrapolated_above_100C);
  assert(bare.metal_surrogate_reaches_ATI_melting_range);
  assert(!bare.display_in_intact_layer_comparison);
  assert(bare.warnings.some(w=>w.includes('not a physically predicted steel peak')));
  assert(cases.filter(c=>c.id!=='bare_wall_column').every(c=>c.display_in_intact_layer_comparison));
  const insulated=cases.find(c=>c.id==='insulated_bore_after_heating');
  assert(insulated.local_band_case_inner_peak.temperature_C>central.local_band_case_inner_peak.temperature_C);
});

const exportPath=path.resolve(__dirname,'../../assets/builds/ablative-material-testing-fixture/analysis/sleeve-thermal-results.json');
if(fs.existsSync(exportPath))check('public export has documented units, scenario provenance and finite values',()=>{
  const d=JSON.parse(fs.readFileSync(exportPath,'utf8'));
  assert.equal(d.scenario_count,17);assert.equal(d.validated,false);assert.equal(d.actual_case_temperature_C,null);
  assert.equal(d.documentation,'sleeve-thermal-README.md');assert.equal(d.source_ledger,'sleeve-case-sources.md');
  assert(d.source_notes.heating.includes('not measured'));
  assert(d.source_notes.recession.includes('NOT extrapolated'));
  const c=d.cases.find(c=>c.id==='central');near(c.local_band_case_inner_peak.temperature_C,central.local_band_case_inner_peak.temperature_C,1e-10);
  assert(d.cases.find(c=>c.id==='bare_wall_column').display_in_intact_layer_comparison===false);
  const csv=fs.readFileSync(path.join(path.dirname(exportPath),'sleeve-thermal-history.csv'),'utf8').trim().split('\n');
  assert(csv[0].includes('case_inner_C,case_outer_C'));
  const ids=new Set(csv.slice(1).map(r=>r.split(',')[0]));assert.equal(ids.size,17);
  assert(!csv.some(r=>/NaN|undefined|Infinity/.test(r)));
});
console.log(JSON.stringify({checks,central_inner_peak:central.local_band_case_inner_peak,central_outer_peak:central.local_band_case_outer_peak,refinement},null,2));
console.log(`PASS ${checks} offline thermal implementation checks (not physical validation).`);
