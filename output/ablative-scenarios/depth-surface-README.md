# Shared 3D dimple-depth surface

**Partly calibrated from one approximate measured depth and one assumed depth; not a validated ablation law.** The user confirmed that the higher-flux, 10-second brick run had a measured dimple depth of approximately 1/8 inch and reported masses of 82.8 g initially and 73.9 g finally. The baseline depth remains assumed. No thermocouple or thermal-property fit was performed.

## Mixed-evidence anchors

| Reference point | Time (s) | Graphite-reference flux (MW/m²) | Dimple depth | Evidence and marker |
| --- | ---: | ---: | --- | --- |
| Baseline | 20 | 0.2592 | 3 mm | Still assumed; hollow B |
| Hot | 10 | 0.5844 | Approximately 1/8 in, shown as ≈3.2 mm | User-confirmed measurement; filled H |

The unit conversion `0.125 × 25.4 = 3.175 mm` is retained internally. It does not imply a ±0.001 mm measurement or establish an uncertainty interval. Probe values are rounded numerical model outputs, not measurements at arbitrary conditions. Baseline and hot identify anchors of one surface, not selectable models.

We retain the chosen linear-flux, power-in-time family:

`depth_mm = 3 × (q_ref / 0.2592) × (t / 20)^n`

Here flux is in MW/m², time in seconds, and both ratios are dimensionless. Solving through the mixed-evidence anchors gives:

`n = ln[(3.175 / 3) / (0.5844 / 0.2592)] / ln(10 / 20) = 1.0910963687552264`

The full-precision exponent preserves arithmetic, not experimental precision. Both markers lie on this surface. Modeled depth is zero at zero time or flux and increases with either positive input.

**The flux exponent of 1 is chosen, not established by the tests.** A different flux exponent would produce a different time exponent and a different surface through the same anchors. There is only one measured depth anchor; the baseline normalization is still an assumption. The JSON therefore reports `fit_performed: true` and `measured_data_fit: true` with an explicit one-depth scope, `measured_depth_anchor_count: 1`, `assumed_depth_anchor_count: 1`, `thermocouple_fit: false`, and `validated: false`. This is not a fit to the 8.9 g net mass loss or the digitized back-face temperature curves.

At equal reference dose, this family gives depth proportional to `t^(n−1)`, so allocating the dose over more time gives slightly greater modeled depth. That behavior follows from the chosen equation; it is not a validated intensity-versus-duration finding. No onset threshold, changing torch flux, thermal history, decomposition energy, char growth, erosion, or breakthrough mechanism is modeled. Graphite-reference net inward flux is not measured absorbed brick flux.

## Mass colors and contours

The 20 mm circular diameter and paraboloid shape factor 1/2 remain assumptions. Density is conditional on the weighed hot brick having the nominal 50.8 × 88.9 × 12.7 mm dimensions:

`rho_hot_conditional = 0.0828 / (0.0508 × 0.0889 × 0.0127) = 1443.6474317 kg/m³`

This density is transferred across the **entire surface**, including the assumed baseline, for one consistent color scale. It does not establish the baseline brick's or engine sleeve's density. The independent run table may retain a different explicitly assumed baseline density; its mass entry is not the same calculation as the surface's fixed-density color conversion.

`mass_equiv_g = 1000 × rho × (1/2) × (π D_m² / 4) × (depth_mm / 1000)`

`mass_equiv_g = 0.2267676083 × depth_mm`

The baseline/hot anchor equivalents are approximately **0.680/0.720 g**. These are the masses of virgin-density volumes with the idealized dimple geometry—not retained char mass, net whole-specimen mass loss, or separate mass predictions. The hot brick's reported **8.9 g net loss** is a different observable; it is about 12.4 times the hot dimple equivalent, not a valid model-error ratio. Pyrolysis-related density loss, geometry outside the assumed dimple, fragments, deposits, and conditioning/handling remain unresolved.

The color scale is fixed at **0–2.4 g**, with iso-mass curves every 0.2 g. For a positive mass, set `depth = mass / 0.2267676083`; the contour satisfies `q_ref = 0.2592 × (depth / 3) × (20 / t)^n`. Only portions inside the displayed domain are drawn. Zero mass follows zero-time and zero-flux edges; unattainable levels have no contour.

## Display range and uncertainty

The domain remains time 0–20 s, reference flux 0–0.8 MW/m², and depth axis 0–12 mm. Its largest modeled depth is 9.259 mm and largest equivalent mass is approximately **2.100 g**, below the nominal 12.7 mm thickness. No hidden thickness cap or breakthrough model is applied. This is a geometric display domain, not a validated operating range or safety limit.

Uncertainties include the approximate measured depth and missing measurement method/error bounds, the assumed baseline depth, diameter and shape, nominal-volume density, density transfer, graphite-to-brick flux transfer, and chosen functional family. No confidence interval is inferred. Repeated depth profiles at multiple durations and fixed fluxes, multiple fluxes at fixed duration, and independently constrained timing/heating are needed to test the joint response. As-built volume, density, mass-change, and char characterization would test the mass interpretation.

## Reproduction

- Model: `assets/js/ablative-depth-surface-model.js`
- Shared browser/native-canvas renderer: `assets/js/ablative-depth-surface.js`
- Numerical checks: `node output/ablative-scenarios/depth-surface-check.cjs`
- Offline controller/rendering checks: `node output/ablative-scenarios/depth-surface-ui-check.cjs`
- Generate fallback and exports: `node output/ablative-scenarios/build-depth-surface.cjs`

The retained filename `depth-surface-grid-NOT-MEASURED.csv` contains **2,091 synthetic evaluations**, not measured data. It uses `modeled_depth_mm` and `conditional_density_equivalent_dimple_mass_g` columns. Exact internal anchor coordinates and their separate provenance appear in `anchor_points` in `depth-surface-scenarios.json`; the approximate physical measurement is not promoted to a high-precision observation. Existing asset filenames stay stable. The fallback image comes from the same production renderer as the interactive graphic.
