# Ablative rig → first-hotfire sleeve comparison

Updated September 27, 2026. **Conditional geometry, transferred-depth, and explicitly assumed retained-char calculations; not hotfire validation or a safe-burn-time prediction.** The current rig surface uses the approximately measured hot depth and conditional density below. Superseded 1.5-mm/50-g calculations have been removed from this comparison, not relabeled as current evidence. The expanded char calculations below are selected scenarios, not newly recovered measurements.

The added [steel-case conduction study](../../assets/builds/ablative-material-testing-fixture/analysis/sleeve-thermal-README.md) is a separate fixed-geometry calculation using newly sourced case dimensions and additional thermal/boundary assumptions. Its synthetic temperatures do not turn the geometry-only quantities here into measured sleeve performance. See also [case-source audit](../../assets/builds/ablative-material-testing-fixture/analysis/sleeve-case-sources.md).

## Evidence and identification

- [Sleeve-sizing task](https://docs.google.com/document/d/1oIKhaOOdl2J4FMQjktNuqRRpTlfGJ7aP7FaxK298SMk/edit): target OD **3.95 ± 0.05 in**, ID **3 in**, length **7.168 ± 0.05 in**. These are documented finished-size targets, not verified as-fired dimensions. ID tolerance is not given.
- [Earlier overview](https://docs.google.com/presentation/d/1NgaWUD77CgsMSfevq_a_1D9JKBlgk3bXCKqUYKJTw6o/edit): **3-in ID, 7-in length, 0.25-in wall**. This conflicting design is retained as a separate alternative, not averaged into the main calculation.
- [TRR, slide 16](https://docs.google.com/presentation/d/1oOHAGOG1Z7mmtfshaSWwUD1cEP_X0XBLRNJsbGGLRxo/edit#slide=id.g3e65397d0ca_0_302): **82.8 → 73.9 g**, **10 s**, approximately **1/8-in depth**. The user confirmed that this is the higher-flux rig brick and that the dimple depth was measured. It is **not sleeve mass data**. Instrument, depth datum, uncertainty, tare, conditioning, and loose-fragment handling remain undocumented.
- [TRR timing review](https://docs.google.com/presentation/d/1oOHAGOG1Z7mmtfshaSWwUD1cEP_X0XBLRNJsbGGLRxo/edit#slide=id.h33f62dd7f2c39b51_1_45): reviews May 3, 2026 and reports a controller failure about **0.25 s** into the burn. The user's early-May recollection is consistent with that event, but neither this timestamp nor an intended 10-second burn supplies the actual thermal-exposure history.
- [TRR post-fire inspection](https://docs.google.com/presentation/d/1oOHAGOG1Z7mmtfshaSWwUD1cEP_X0XBLRNJsbGGLRxo/edit#slide=id.h33f62dd7f2c39b51_1_80): axial cracks near cast seams, char inside fractures, and deposits outside. These are qualitative observations; the team's inference of pre-existing cracks is not pre-fire crack metrology.

No actual sleeve pre/post masses, recession profile, char thickness/density, or measured heat-input history has been found. The original question of adequate engine thermal protection therefore remains open. An intact annular-wall model cannot account for crack-related hot-gas paths just by tracking average wall thickness.

## What the hot brick establishes

| Quantity | Result | Status |
| --- | ---: | --- |
| Initial → final mass | 82.8 → 73.9 g | Reported in slide; user confirms run |
| Net whole-brick mass loss | 8.9 g; 10.75% | Not isolated char mass or sleeve mass loss |
| Dimple depth | ≈3.2 mm | Approximate measured 1/8 in; exact conversion 3.175 mm is not measurement precision |
| Depth / exposure time | ≈0.32 mm/s | Exposure average, not a verified constant recession rate |
| Graphite-reference flux | 0.5844 MW/m² | Report-derived reference severity, not measured absorbed brick flux |
| Graphite-equivalent dose | 5.844 MJ/m² | Reference flux × 10 s |
| Nominal original volume | 57.355 cm³ | Previously confirmed 2 × 3.5 × 0.5 in nominal dimensions |
| Initial bulk density | ≈1,444 kg/m³ | Conditional on bare-brick initial mass and nominal volume |
| Local dimple mass equivalent | ≈0.720 g | Measured depth, but **assumed 20-mm diameter and paraboloid shape** |

The assumed dimple volume is **0.499 cm³**. Its virgin-density mass equivalent is about **12.4 times smaller** than the whole-brick net loss. This ratio is not model error: a local depression and total mass loss are different observables, and the calculation does not separate pyrolysis, surface erosion, fragments, swelling, or deposits. It does not determine char mass.

## Updated shared rig model

The current surface is

\[
d=3\ \mathrm{mm}\left(\frac{q_{\mathrm{ref}}}{0.2592\ \mathrm{MW/m^2}}\right)\left(\frac{t}{20\ \mathrm{s}}\right)^{1.0910963688}.
\]

It is constrained to the **assumed 3-mm baseline depth** and **approximately measured 3.175-mm hot depth**, with linear flux dependence imposed. The exponent is an algebraic interpolation parameter, not a measured material property. There is one measured depth anchor, not two independent depth measurements, and the 8.9-g whole-brick loss has not been used as a dimple-mass fit. Conductivity, heat capacity, heating transfer to the engine, and char response have not been identified by this surface.

## Candidate sleeve: geometry first

The sizing-task target, approximated as a plain annular cylinder without chamfers, gives

\[
R_i=38.100\ \mathrm{mm},\ R_o=50.165\ \mathrm{mm},\ L=182.0672\ \mathrm{mm},
\quad V_0=\pi L(R_o^2-R_i^2)=609.112\ \mathrm{cm^3}.
\]

Its radial wall is **12.065 mm**, and its inside cylindrical area is **0.043585 m²**. **If** the hot brick's conditional density applies unchanged to this sleeve, the initial mass equivalent is **879.3 g**. This is not a recovered sleeve weighing. It requires matching formulation, cure, porosity, and part revision; the source documents disagree about some ingredient/fraction conventions, so that transfer is unverified.

Keeping ID and density exact, the stated OD/length endpoint combinations give **821.3–938.8 g**. This is a dimensional-only envelope, not a confidence interval. It excludes density uncertainty and missing ID tolerance. The conflicting earlier thin-wall design would instead give **422.7 g** under the same density transfer.

## What if the measured dimple depth occurred everywhere on the bore?

This intentionally strong hypothetical replaces a local coupon depression with uniform recession around the entire sleeve circumference and length. It does **not** follow from the coupon test and does not reconstruct the engine exposure. For unchanged outer radius and no end recession,

\[
\Delta V=\pi L[(R_i+d)^2-R_i^2],\qquad m_{\mathrm{removed,eq}}=\rho_v\Delta V.
\]

| Geometric quantity | Conditional result at d = 3.175 mm |
| --- | ---: |
| Initial sleeve mass equivalent | 879.3 g |
| Removed annular volume | 144.15 cm³; 23.67% of original volume |
| Removed-volume virgin-density mass equivalent | 208.1 g |
| Remaining-volume virgin-density mass equivalent | 671.2 g |
| Remaining geometric wall | 8.89 mm |
| Final bore diameter | 82.55 mm |

**208.1 g is not predicted or measured engine mass loss; 671.2 g is not actual remaining sleeve mass.** Both apply virgin density to hypothetical geometry. The difference from the local brick's 0.720-g dimple equivalent reflects the much larger affected area and cylindrical geometry. Neither number can be compared directly to the brick's measured 8.9-g whole-specimen loss as a validation metric.

For transparency, the code also evaluates three counterfactual uniform transfers at 10 s within the plot's flux range:

| Assumed graphite-reference flux (MW/m²) | Shared-model depth (mm) | Removed equivalent mass (g) | Remaining equivalent mass (g) | Remaining wall (mm) |
| ---: | ---: | ---: | ---: | ---: |
| 0.2592 | 1.408 | 90.2 | 789.1 | 10.657 |
| 0.5844 | 3.175 | 208.1 | 671.2 | 8.890 |
| 0.8000 | 4.346 | 289.1 | 590.3 | 7.719 |

No row is an engine prediction. Actual engine local flux is unknown; no extrapolation to several-MW/m² engine estimates was made. A gas-temperature estimate does not determine the material's absorbed heat flux.

## Char and remaining mass remain unresolved

Surface recession, subsurface decomposition, and retained char are different quantities. For a simplified intact two-layer sleeve, if retained char thickness \(c\) and density \(\rho_c\) were independently supplied, let \(R=R_i+d\):

\[
V_c=\pi L[(R+c)^2-R^2],\quad V_v=\pi L[R_o^2-(R+c)^2],\quad
m_{\rm remaining}=\rho_c V_c+\rho_v V_v.
\]

Neither char input is available. Cracks, deposits, swelling, and shedding also invalidate a simple uniform two-layer interpretation. The saved actual sleeve/char measurements and model error therefore remain `null`; validation is `false`.

With the still-assumed \(k=0.16\) W/(m·K), \(c_p=1000\) J/(kg·K), and revised conditional density, the original homogeneous-material scales are \(\alpha=0.11083\) mm²/s, \(\sqrt{\alpha\,10\mathrm{s}}=1.053\) mm, and \(w^2/\alpha=1313\) s. These are not char depth, a back-face temperature prediction, or allowable burn duration.

## Expanded assumed sleeve end states

At the user's request, the calculation now separately evaluates hypothetical retained char and incomplete coverage. The selected char thicknesses **1, 2, and 3 mm**, density ratios **0.25, 0.50, and 0.75**, and original bore-area fractions **0.25, 0.50, and 1.00** are deliberately explicit analyst choices. They are not material measurements, literature property ranges, uncertainty bounds, or a probability distribution. Actual sleeve/char measurements remain `null`.

For a uniformly affected segment or sector occupying fraction \(f\) of the original bore area:

\[
V_r=f\pi L[(R_i+d)^2-R_i^2],\quad
V_c=f\pi L[(R_i+d+c)^2-(R_i+d)^2],\quad
V_v=V_0-V_r-V_c.
\]

Here \(V_v\) includes the unchanged material outside the affected region. With \(\beta=\rho_c/\rho_v\),

\[
m_{\rm remaining}=\rho_vV_v+\beta\rho_vV_c,\qquad
\Delta m=\rho_vV_r+(1-\beta)\rho_vV_c.
\]

The second term is a **retained-layer density deficit**, not an independently identified pyrolysis loss. NASA distinguishes surface removal, in-depth decomposition, and separate virgin/char properties; our endpoint bookkeeping does not solve their coupled thermal/chemical evolution. The NASA source does not establish our chosen numerical char inputs. [NASA, §§II–III](https://ntrs.nasa.gov/api/citations/20170005508/downloads/20170005508.pdf)

### Reference assumed state

At \(d=3.175\) mm, \(c=2\) mm, \(\beta=0.5\), and \(f=1\), the remaining geometric wall is **8.89 mm**: **2 mm of selected retained char plus 6.89 mm of uncharred material**. Mass bookkeeping gives **69.8 g retained char**, **531.6 g uncharred material**, and **601.4 g total remaining mass**. The scenario mass decrease is **277.9 g = 208.1 g removed-volume equivalent + 69.8 g retained-layer density deficit**. These are not measured sleeve values or a prediction of a 10-second engine burn.

At 25%, 50%, and 100% affected area with the same local state, remaining masses are **809.9, 740.4, and 601.4 g**. Local residual wall thickness is identical in these cases; coverage scales volume and mass, not local recession. The model ignores edge heat transfer and abrupt-step mechanics.

The code also exports the 3 × 3 char-thickness/density grid, a zero-retained-char comparison, and time/flux cases restricted to the current rig domain. In the latter rows, retained char is held at the chosen 2-mm/half-density state; it is not a predicted time history. Inputs violating \(d+c\leq R_o-R_i\) are rejected rather than clipped.

The reference-flux integral over the original bore area is \(E_{\rm ref}=q_{\rm ref}tfA_0\), **254.7 kJ** in the reference case. This is not absorbed energy or an energy-balance closure. No safe burn duration, back-face temperature, or engine heat-transfer coefficient is inferred.

The public [expanded method notes](../../assets/builds/ablative-material-testing-fixture/analysis/sleeve-comparison-README.md) contain the tables and explanations. [Scenario CSV](../../assets/builds/ablative-material-testing-fixture/analysis/sleeve-scenarios.csv) and the JSON preserve full-precision arithmetic and explicit status labels. Property uncertainty, depth/mass measurement uncertainty, material transfer, cracks, swelling, deposits, and engine heating remain outside these selected end states.

## Measurements that complete the comparison

1. Identify the fired sleeve's drawing/revision, batch, formulation, cure, dimensions, and run/photo association.
2. Recover conditioned pre/post whole-sleeve mass with tare, deposits, recovered fragments, and any cutting/char removal documented.
3. Measure registered before/after bore profiles and separate char-thickness sections near and away from seams/cracks.
4. Reconstruct actual heating duration/history from synchronized pressure, ignition/video, valve state, and temperature data; independently constrain heat flux.
5. Compare like-for-like local recession, char thickness, conditioned total mass change, and thermal response, using repeated measured coupon tests rather than an assumed baseline anchor.

## Reproducibility

- `inputs-and-evidence.json`: source-linked inputs, user confirmations, and missing measurements.
- `calculate-comparison.cjs`: imports the current rig model and checks its updated depth/density before generating results.
- `conditional-results.json`: full-precision arithmetic; digits do not imply corresponding evidence precision.
- Public files: `assets/builds/ablative-material-testing-fixture/analysis/sleeve-comparison-results.json` and `sleeve-comparison-README.md`.

Run `node output/ablative-sleeve-comparison/calculate-comparison.cjs`. Assertions cover updated hot depth/density, both rig anchors, independent-unit geometry, volume/mass bookkeeping, zero/full recession, and missing char/engine thermal-history protection. They validate arithmetic, not physical performance.
