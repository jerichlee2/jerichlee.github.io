# Conditional heat transfer from the sleeve to Overture’s steel case

September 27, 2026. **Fixed-wall conduction scenarios, not recovered hotfire temperatures, a validated ablation simulation, or approval to fire.** Numerical values in the accompanying JSON/CSV retain calculation precision, not measurement precision.

## Added conduction-only case: no convection or radiation

The page also presents a separate [conduction-only calculation](sleeve-conduction-only.json). It imposes a **3,000 K solid-surface temperature for 10 s**, starts all solids at 20 °C, assumes perfect sleeve–case thermal coupling, and keeps the exterior insulated. After the pulse the bore is insulated too, so all deposited heat stays in the assembly. It uses the same fixed, already-recessed 2 mm char + 6.89 mm virgin wall and 6.35 mm steel case, with the constant properties listed below. No new measurements or fitted properties are introduced.

The steel remains approximately **20 °C at 10 s**, reaches approximately **91 °C at 600 s**, and approaches **94 °C at insulated equilibrium**. Approximately 159 kJ is deposited into a combined heat capacity of 2.15 kJ/K, independently giving `T_equilibrium = T_initial + E_deposited / sum(m cp)`. The numerical steel history approaches that equilibrium without overshoot; there is no finite-time cooling peak in this insulated model. The calculation represents the local sleeve-overlap band, not a whole-engine temperature.

**Within these assumptions, the intact sleeve prevents melting of the modeled steel case during the selected heating event and subsequent heat soak.** This is not proof of real-engine survival, unchanged ablator geometry at 3,000 K, pressure strength, seal performance, or resistance to crack-related bypass. The thermal conclusion does not establish an allowable burn duration.

This case is distinct from the earlier ≈59 °C central result below: its imposed solid temperature, interface coupling, and post-pulse boundaries all differ. The 59 °C chart remains the earlier gas-heating/ambient-cooling comparison and must not be relabeled as conduction-only. Generator and self-checks: `output/ablative-sleeve-comparison/conduction-only.cjs`; input, result, and verification export: `sleeve-conduction-only.json`.

The [boundary-condition diagram](sleeve-conduction-boundaries.svg) is generated directly from that JSON by `output/ablative-sleeve-comparison/build-conduction-diagram.cjs`. It separates the imposed-temperature pulse from the fully insulated heat soak, labels the three solid layers and their constant properties, and shows the idealized massless, zero-resistance gap. The straightened wall is not to scale; the calculation remains radial and cylindrical. Equal heat rate, rather than equal flux density at different radii, is transferred across the gap. The diagram introduces no new thermal assumptions or numerical results.

## What is documented, and what is selected

The [Mk1 component list](https://docs.google.com/spreadsheets/d/1Zg9WjmT8dic_PtStrfykBivGqj8CVY54Y9kj8dExC5A/edit), housing Part #1, lists **304L stainless steel**, McMaster 89495K95. The master report instead calls it 304 stainless. The [dimension sheet](https://docs.google.com/spreadsheets/d/1HcJMnTM0SDfNXDDfdOUr65X4GkdxouMvA-WkfBdLpM0/edit) gives case ID 4 in, wall 0.25 in, length 12 in. Thus the nominal case radii are 50.8 and 57.15 mm. These records do not establish the as-fired alloy certificate, dimensions, manufacturing condition, or pressure/temperature allowable.

The sleeve calculation retains the [separate sizing task](https://docs.google.com/document/d/1oIKhaOOdl2J4FMQjktNuqRRpTlfGJ7aP7FaxK298SMk/edit): original radii 38.1 and 50.165 mm, length 182.0672 mm. The nominal radial clearance to the case is 0.635 mm. Older sleeve documents conflict; this is a selected assembly geometry, not a reconstructed as-built fit. See [source audit](sleeve-case-sources.md).

The central thermal scenario starts with the coupon’s approximate 3.175 mm depth hypothetically removed everywhere, and a separately assumed 2 mm char layer already present. Its hot boundary is at radius 41.275 mm; the char ends at 43.275 mm; virgin material continues to 50.165 mm. **This is an already-recessed, fixed wall from time zero, not material evolution during the firing.** It cannot automatically be called conservative: heat storage, ejection, decomposition, cracking, and changing geometry are omitted.

| Input | Central choice | Evidence status |
| --- | ---: | --- |
| Virgin density | 1,443.647 kg/m³ | Hot coupon’s reported 82.8 g divided by nominal 2 × 3.5 × 0.5 in volume; transfer to sleeve unverified |
| Virgin conductivity / heat capacity | 0.16 W/(m·K) / 1,000 J/(kg·K) | Analyst assumptions, not identified by the back-face traces |
| Char conductivity / heat capacity | 0.16 W/(m·K) / 1,000 J/(kg·K) | Independent placeholders, not measured char properties |
| Char density | Half virgin density | Selected retained-char scenario |
| Case density / heat capacity / conductivity | 7,900 kg/m³ / 500 J/(kg·K) / 16.3 W/(m·K) | Typical low-temperature 304-family values, held constant |
| Initial solid / ambient temperature | 293.15 K (20 °C) | Selected |
| Effective sleeve-to-case conductance | 100 W/(m²·K) | Selected interface model, not inferred from clearance alone |
| Hot source / convection coefficient | 2,876 K / 2,240 W/(m²·K) | Separate order-of-magnitude engine estimate in the local torch report; not measured engine heating |
| Hot-source duration | 10 s | Requested hypothetical scenario; actual firing history unknown |
| After-shutdown bore / exterior convection | 10 / 10 W/(m²·K), to 20 °C | Selected cooling boundary, not measured |

The steel inputs come from [ATI’s 304-family datasheet, p. 3](https://www.atimaterials.com/Products/Documents/datasheets/stainless-specialty-steel/austenitic/ati_302_304_304l_305_tds_en4_v1.pdf#page=3). Specific heat is tabulated over 0–100 °C and conductivity at 100 °C. They are not temperature-dependent fits or final-design allowables. The solver flags metal calculations outside the cited low-temperature interval rather than implying those extrapolations are validated.

The local source of the engine boundary is `ablative_test_final_report.tex`, section “Engine representativeness (order-of-magnitude check).” No original Drive URL for that report was verified. It explicitly describes this engine estimate as separate from the torch data. The Mk1 master’s different design point gives 2,175.1 K, while 3,000 K is the user’s proposed target; neither is substituted silently for the central source.

## Equation and numerical meaning

Each material layer solves

\[
\rho c_p\frac{\partial T}{\partial t}
=\frac{1}{r}\frac{\partial}{\partial r}\left(rk\frac{\partial T}{\partial r}\right).
\]

During heating, \(q''=h_g(T_g-T_s)\). The initial cold-wall value is approximately **5.786 MW/m²**, and the flux changes as the surface temperature changes. This is not a constant-flux pulse, a measured thermal dose, or an extrapolation of the empirical rig depth surface. A finite surface-to-cell resistance is included; gas temperature is not assigned to the first solid cell.

The gap is a massless interface resistance between the actual sleeve and case radii. It does not become an invented solid layer. The solver transfers equal **power** across that interface; fluxes differ when referenced to different cylindrical areas. Perfect-interface and finite-conductance comparisons are selected sensitivities, not measured fit conditions.

After 10 s the hot source is removed. The solid’s stored heat is retained, and convection to the selected ambient replaces the gas boundary. An insulated-bore comparison removes only the bore cooling route; exterior cooling remains. It is not a universal worst-case engine bound.

Conservative radial finite volumes use exact annular heat capacities, logarithmic conduction resistances, and implicit time integration. The model represents the local case band alongside the sleeve, not the full case’s mean temperature. No axial or circumferential spreading, end hardware, nozzle, injector, or seal temperatures are solved. The calculation continues for at least 1,800 s and reports whether the metal peak was captured. Mesh/time refinement and energy-balance tests check the implementation, not the correctness of the physical assumptions.

## What the comparisons do—and do not—show

The central calculation gives approximately **20 °C at both steel faces after the 10 s pulse**, followed by **59.3 °C at the inner face at 555 s** and **59.1 °C at the outer face at 560 s**, measured from heating start. These are temperatures in the modeled sleeve-overlap band, not recovered engine measurements.

| Selected comparison | Inner-face peak (°C) | Time from heating start (s) |
| --- | ---: | ---: |
| Central, already-recessed wall | 59.3 | 555 |
| Original virgin sleeve | 57.7 | 880 |
| No bore cooling after shutdown | 74.3 | 721 |
| Char conductivity 0.08 W/(m·K) | 46.6 | 568 |
| Char conductivity 0.64 W/(m·K) | 92.4 | 544 |
| Gas-source temperature 3,000 K | 61.2 | 555 |

All 16 intact-path cases resolve their metal peaks by 1,800 s; their peak inner-face temperatures span 46.6–92.4 °C. The central hot face reaches approximately 2,527 °C, where the frozen sleeve properties/geometry are not physically validated. This contrast is essential when interpreting the much cooler steel.

The offline checks pass exact steady cylindrical solutions, no-heating/insulated limits, conservation, phase-boundary timing, peak detection, and independent spatial/temporal refinements. Halving both cell width and time steps changes the central metal peak by 0.046 °C and its time by 0.5 s; relative energy-closure residuals are below 2.2 × 10⁻¹¹ across the suite. Numerical convergence does not remove the physical-model uncertainty.

The original virgin wall, already-recessed/charred wall, alternative conductivities, gas temperatures, interface conductances, and cooling cases are one-at-a-time numerical comparisons. Their spread is **not a confidence interval or a proven physical envelope**. Unmeasured density, heat capacity, geometry, char, and heating histories could change the answer further.

The bare-wall-column case removes the insulating path entirely. It illustrates sensitivity to bypass, not the actual shape or temperature of a crack-driven hotspot. Its constant-property output outside the steel property interval is an **extrapolated numerical benchmark**, not a validated physical peak. No melting time, failure temperature, or safe burn duration is inferred from it.

More importantly, the sleeve’s assumed properties are not validated at the high modeled hot-face temperatures. Decomposition, char growth, oxidation, recession, gas transport, radiative exchange, surface chemistry, and material loss are not solved. The imposed 3.175 mm geometry is not the predicted recession under the modeled engine boundary. A small modeled steel rise therefore demonstrates what an intact low-conductivity path *could* do, not proof that the real path remained intact.

NASA’s [ablative material-response verification study](https://ntrs.nasa.gov/api/citations/20170005508/downloads/20170005508.pdf) treats surface removal and in-depth decomposition as distinct coupled processes. Our simpler conduction study deliberately does not identify those processes from one coupon depth and mass change.

## What would establish actual protection?

1. Confirm the fired sleeve revision, formulation/cure, as-built bore and wall profile, case alloy certificate, metal thickness, and actual interface/gap.
2. Recover synchronized ignition, valve, pressure, and temperature records. The [May 3 preliminary analysis](https://docs.google.com/document/d/1FI2h3YqpO12gbUEWAxf61ywpwOMc37wW0xKYwL8t3wY/edit) describes early fuel-valve closure and subsequent non-nominal burning; an intended 10 s is not its measured thermal history.
3. Measure temperature-dependent virgin and char properties independently, and calibrate the heating boundary. Retain multi-depth coupon temperatures through cooldown with documented sensor uncertainty.
4. Record case temperatures near seams, along the sleeve, and at end interfaces through the delayed peak; quantify cooling/contact conditions and sensor attachment/lag.
5. Measure registered pre/post recession, retained-char thickness/density, cracks, and conditioned whole-sleeve mass. Track deposits and fragments separately.
6. Compare measured temperatures with a validated material-response model and the pressure-boundary assembly’s approved temperature-dependent allowables. Melting is not the sole failure criterion: strength, thermal stress, seals, and local bypass matter first.

Until these checks exist, **actual engine protection remains unestablished**, even if an intact-wall scenario predicts low steel temperatures.

## Reproduction

Source: `output/ablative-sleeve-comparison/thermal-case-model.cjs`; checks: `thermal-case-check.cjs`; chart generator: `build-thermal-figure.cjs`, in the same source directory. Run the solver before the checks and figure generator. [Full input/result JSON](sleeve-thermal-results.json) and [synthetic temperature histories (CSV)](sleeve-thermal-history.csv) are computed scenarios, not test logs.
