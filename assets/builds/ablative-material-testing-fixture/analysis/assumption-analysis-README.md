# Mixed-evidence ablative screening analysis

Prepared at the experimenter's request and updated with their confirmed hot-test measurements. This is a **forward sensitivity exercise using user-reported measurements and explicit assumptions**, not an inverse fit or new thermal-material characterization. The webpage presents it in Outcome after the digitized back-face-temperature figure; the original figure is retained as a source asset.

The displayed 3D depth/time/reference-flux graphic adds a separately documented shared relationship constrained to one baseline depth assumption and one user-reported approximate hot depth. Linear flux dependence is chosen, not inferred from data; two points do not determine a unique surface. Its mass colors are geometric dimple-equivalent mass, not measured mass loss. See `depth-surface-README.md`; this construction does not replace the mixed-evidence inputs or independent sensitivity calculations below.

## Evidence classes

1. **Report-derived:** nominal 20/10 s exposures, graphite-reference flux 0.2592/0.5844 MW/m², and its −27/+33% sensitivity to a ±20% graphite heat-capacity perturbation. The latter is not full uncertainty in heating of a brick.
2. **Digitized:** visible corrected back-face rises, time from start of each log, transition envelopes, and unresolved regions from original Figure 8. PNG SHA-256: `13aa0c43de0a275f371c320ba22770f5d53d0bf004ec3b12c8a8de488b09f92b`. Digitization is not recovered raw logging; sensor accuracy is not the same as graphical reading uncertainty.
3. **User-confirmed nominal dimensions:** the user confirmed 2 × 3.5 × 0.5 inches in this conversation, or 50.8 × 88.9 × 12.7 mm. The December 12 design presentation, slide 11, also says “2 x 3.5 x 0.5 Mold.” Individual cast specimen caliper measurements and tolerances remain unavailable; the dimensional sweep is an analyst-selected sensitivity range, not a manufacturing tolerance. [Source slide](https://docs.google.com/presentation/d/18DxEOy2dH5_4A8xdhqXUpu7fwHjdE_QfHz8l_n1QdhM/edit#slide=id.g3aac5729a02_0_10).
4. **User-reported hot measurements:** the user confirmed that the hot 10 s / approximately 2.25× reference-flux specimen weighed 82.8 g before and 73.9 g after testing, with an approximate 1/8-inch dimple depth. The exact unit conversion is 3.175 mm, not a claim of four-digit measurement precision; page text rounds this to approximately 3.2 mm. Measurement uncertainties, reference-plane method and conditioning/cleaning protocol have not been supplied. Pre-test mass and depth are held fixed in the scenario sweep; the omitted measurement uncertainty is unknown, not zero.
5. **Selected assumptions:** baseline pre-test mass 50 g and baseline depth 3 mm; specific heat 1,000 J/(kg·K); conductivity 0.16 W/(m·K); separate 20 mm heating and depression diameters. Baseline depth is not inferred from shadows or apparent rim heights, and is not adjusted to force the earlier qualitative photo ordering. The prior project `semiinfiniteablative.tex` uses k = 0.16 without a supporting material citation, so it remains a prior assumption, not a literature property. Its other inputs are not reused.

All inputs, evidence classes and selected endpoint ranges are recorded in `assets/builds/ablative-material-testing-fixture/analysis/scenario-inputs.json`. The report-summary manifest retains `recession_mm: null` for the baseline specimen; for the hot specimen it records 3.175 mm as a user-reported approximate dimple depth, with uncertainty and reference-plane method unknown. This report of depth is not a verified spatial recession profile.

## Calculation

- Volume: `V = W H L`; bulk density: `rho = m/V`.
- Whole-specimen heat capacity: `C = m cp` (J/K), distinct from the assumed specific heat (J/kg/K).
- Diffusivity: `alpha = k/(rho cp)`; scale time `tc = L²/alpha`; Fourier number `Fo = alpha t/L²`.
- Diffusion length convention: `ell = sqrt(alpha t)`. This is not a sharp front, a temperature-onset prediction, or char/ablation depth. These are original-thickness virgin-slab scales, not a moving-boundary prediction.
- Reference-equivalent dose: `Qeq = q_graphite * multiplier * duration`. Reference-equivalent spot energy: `Qeq * pi * D_heat²/4`. Neither is a direct brick-absorbed-energy measurement.
- Idealized depression volume: `Vd = f * pi * D_dimple² * d/4`, with `f=1/2` nominal (paraboloid); selected cone-to-cylinder range `1/3..1`.
- Virgin-density-equivalent geometric mass: `rho Vd`, not actual measured mass loss. Neither char density nor swelling is inferred. Density now uses each run's own pre-test mass: assumed 50 g baseline, reported 82.8 g hot, divided by nominal volume.
- The hot specimen's reported total mass difference is separately calculated as `82.8 - 73.9 = 8.9 g`, or approximately 10.75% of its initial mass. This is not mass proven to come from the dimple, and its measurement uncertainty is unavailable.
- `d/t` and `d/Qeq` are conditional ratios. Baseline nominal rate remains an assumption-based 0.15 mm/s; the hot ratio is approximately 0.318 mm/s from reported approximate depth and nominal duration. Neither determines the time-resolved ablation rate.
- The digitized peak divided by reference-equivalent dose gives a **descriptive rear-response ratio**, not conductivity, specific heat, efficiency, or a material ranking. Unequal log windows and unknown exposure alignment remain. The hot table's 0.241 °C value is kept as a separate alternative to the visible curve's approximately 0.214 °C.

For the baseline run, all 4,096 endpoint combinations of twelve varied inputs are evaluated. For the hot run, 1,024 combinations of ten varied inputs are evaluated, holding reported pre-test mass and approximate depth fixed. Density is recomputed in each combination rather than independently combining derived extremes. These intervals carry no probabilities and are not confidence intervals, nor are they guaranteed to include reality. They exclude the unknown hot mass/depth measurement uncertainties and omit unknown sensor bias/coupling, heating transfer from graphite to brick, temperature dependence, anisotropy, reaction enthalpy, char/gas transport, lateral spreading, and many geometric errors. A shared graphite uncertainty should not be interpreted as independent evidence that one run has greater absorbed energy.

No fitted k or cp is reported. A good fit to selected assumptions would not resolve the missing boundary conditions. In particular, do not use `m cp deltaT_back` as stored heat for a nonuniformly heated specimen, and do not treat a temperature integral in K·s as energy in J/m².

## Reproduce and verify

From the repository root, with numpy/Pillow available for Python and ordinary Node.js:

```sh
python3 output/ablative-digitization/digitize_chambersafe.py
python3 -m unittest discover -s output/ablative-digitization -p 'test_*.py'
node output/ablative-scenarios/calculate-scenarios.cjs
node output/ablative-outcome-review/verify-outcome.cjs
```

The scenario generator reads the digitization summary and emits classified inputs, results JSON/CSV, the peak/reference-dose comparison CSV, and a mixed-evidence depth–dose SVG. It does not change the raw report image or the observed-data manifest. A zero-width hot depth envelope in the data/SVG means its unknown measurement uncertainty was excluded, not that the measurement is exact. Extra digits in machine-readable files document arithmetic, not experimental accuracy. Page tables round these outputs.

## Explicit next-test requirements

- Same-batch IDs, recipe, cure, moisture conditioning, orientation; dimensions at multiple locations and dry pre/post mass. Proposed readout resolution ≤0.1 mm and ≤0.01 g; verify actual uncertainty rather than equating resolution with accuracy.
- Calibrated pre/post surface profiles referenced to intact material, depth target uncertainty ≤0.1 mm for mm-scale dimples; depression area/volume, char thickness, and as-tested versus cleaned states recorded separately.
- Raw timestamped temperature channels, units, probe/channel IDs, calibration, measured depths and attachment details; synchronized flame-on/off; full heating/cooling traces. Distinguish true TC update rate from duplicate logger records. For controlled non-ablating property experiments, target signal ≥10× the verified differential-temperature uncertainty.
- Characterize the heat-flux distribution and footprint at the specimen plane before/after each series. Record geometry/alignment and reference conditions; account for fixture heat sinks and exposed-surface losses. A reference flux is not automatically the conducted heat input to the brick.
- Independent density and cp(T) for unburned same-batch coupons, then suitable diffusivity or conductivity measurement. DSC is for a thermally stable range; decomposition screening and separate char characterization are needed for ablating-temperature models. A lab must assess method suitability for this porous composite.
- As a pilot, at least three independent samples per condition, multiple durations at fixed flux, matched-equivalent-dose pairs at different fluxes, randomized order, and reference checks. Revisit statistical sample size and uncertainty targets after the pilot. This is not a guarantee that three samples establishes performance.

## Primary methodological sources

- [NIST data evaluation guide, §6.3.1.6](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication960-11.pdf): relation `k = rho cp alpha`.
- [ASTM E1269-24](https://store.astm.org/e1269-24.html): DSC specific heat, thermally stable range.
- [ASTM E1461](https://store.astm.org/standards/e1461): flash diffusivity, with specimen-suitability restrictions.
- [Mahzari et al.](https://authors.library.caltech.edu/records/w7s9t-q5s59): in-depth temperature information and boundary conditions for inverse estimation.
- [NASA Pizzo/Glass](https://ntrs.nasa.gov/citations/20170001312): sensor-location and measurement-error sensitivity.
- [NASA Oliver](https://ntrs.nasa.gov/citations/20170004352): recession uncertainty in inverse heating reconstruction.

These sources support relations and measurement approaches, **not** the selected numerical properties of these particular bricks. This analysis is not a safety factor, flight-material certification, or engine qualification.
