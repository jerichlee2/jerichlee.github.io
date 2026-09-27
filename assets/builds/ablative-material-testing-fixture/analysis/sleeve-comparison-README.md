# From the brick test to the engine sleeve

This document covers geometry and mass bookkeeping. The separate [case-temperature study](sleeve-thermal-README.md) adds newly sourced metal dimensions and explicit thermal-boundary assumptions; it does not validate these assumed sleeve end states. [Case-source audit](sleeve-case-sources.md).

**Conditional comparison—not hotfire validation.** The higher-flux brick lost **8.9 g** (82.8 → 73.9 g, or 10.75%) during its 10-second test, and its dimple was measured at approximately **1/8 in (≈3.2 mm)**. These records belong to the brick, not the sleeve. The 3.175-mm conversion is not measurement precision. [Test record](https://docs.google.com/presentation/d/1oOHAGOG1Z7mmtfshaSWwUD1cEP_X0XBLRNJsbGGLRxo/edit#slide=id.g3e65397d0ca_0_302)

The confirmed nominal brick size, 2 × 3.5 × 0.5 in, and reported initial mass imply a **conditional density of about 1,444 kg/m³**. Individual dimensional metrology and tare remain unverified. The current shared plot uses this density and the approximately measured hot depth; its 3-mm baseline depth and linear flux dependence remain assumptions. It is not fitted to the whole-brick mass loss.

At the measured depth, a still-assumed **20-mm-diameter paraboloid** represents only **0.720 g** of virgin-density-equivalent material. That is about 12.4 times smaller than the whole-brick net loss, but this is not an error score: a local depression and total specimen loss are different quantities. The comparison cannot identify char mass or partition surface erosion, decomposition, fragments, or deposits.

## Conditional sleeve geometry

The [sizing task](https://docs.google.com/document/d/1oIKhaOOdl2J4FMQjktNuqRRpTlfGJ7aP7FaxK298SMk/edit) specifies **3.95 ± 0.05 in OD, 3 in ID, and 7.168 ± 0.05 in length**. Treating those targets as an annular cylinder gives 609.1 cm³ and a 12.065-mm wall. Neither the part revision nor these dimensions has been verified for the fired sleeve. Transferring the hot brick's conditional density gives an **879-g initial mass equivalent**, not a measured sleeve mass.

If the coupon's approximately 3.2-mm local depth were imposed uniformly around the **entire sleeve bore**, the geometry would give:

| Quantity | Hypothetical result |
| --- | ---: |
| Initial sleeve mass equivalent | 879 g |
| Removed-volume virgin-density mass equivalent | 208 g |
| Remaining-volume virgin-density mass equivalent | 671 g |
| Remaining geometric wall | 8.9 mm |

This assumes uniform full-bore recession, unchanged outer dimensions, no end loss, and identical virgin density. **It is not a prediction of the engine's 10-second response.** The remaining-volume mass is not actual remaining mass because char, density changes, cracks, fragments, and deposits are unresolved. Engine heat flux/history is unknown; the reported controller failure around 0.25 s is not the thermal-exposure duration. [Event review](https://docs.google.com/presentation/d/1oOHAGOG1Z7mmtfshaSWwUD1cEP_X0XBLRNJsbGGLRxo/edit#slide=id.h33f62dd7f2c39b51_1_45)

The post-fire review describes seam-related axial cracks, char in fractures, and exterior deposits, not a measured uniform char layer. A surviving nominal wall does not by itself establish thermal protection against crack-related gas paths. [Inspection record](https://docs.google.com/presentation/d/1oOHAGOG1Z7mmtfshaSWwUD1cEP_X0XBLRNJsbGGLRxo/edit#slide=id.h33f62dd7f2c39b51_1_80)

**Still needed:** fired-part/batch identification; measured dimensions; conditioned before/after sleeve masses; registered recession profiles; char thickness/density; and a synchronized heat-input history. Until those exist, actual sleeve and char masses and a model-error percentage remain unknown. The linked JSON preserves these as `null` and marks validation `false`.

## Expanded assumed analysis: retained char and affected area

The following are **chosen end-state scenarios**, not predictions of char formation. They keep the measured brick result as the reference while supplying the missing sleeve inputs explicitly:

- Local sleeve recession: impose the brick's approximately 3.2-mm dimple depth, or use the existing illustrative depth surface within its 0–20 s, 0–0.8 MW/m² domain.
- Retained-char thickness: select **1, 2, or 3 mm**, measured inward from the new receded surface.
- Char density: select **25%, 50%, or 75%** of the conditional original density.
- Affected fraction of the original bore area: select **25%, 50%, or 100%**. Treat that fraction as a uniformly affected axial segment or azimuthal sector; the remainder retains its initial density and geometry. Edge effects are excluded.

These char and coverage values are analyst-selected sensitivity inputs, **not measured properties, literature ranges, probability bounds, or confidence intervals**. NASA's material-response formulation distinguishes surface recession from in-depth decomposition and uses separate virgin/char properties; it does not supply the numerical assumptions used here. [NASA formulation, §§II–III](https://ntrs.nasa.gov/api/citations/20170005508/downloads/20170005508.pdf)

### A concrete reference scenario

Impose 3.175 mm recession everywhere on the bore, retain a **2-mm char layer at half the initial density**, and leave the outer dimensions unchanged:

| Quantity | Conditional result |
| --- | ---: |
| Remaining geometric wall | 8.89 mm |
| Retained-char thickness | 2.00 mm — selected input |
| Remaining uncharred thickness in the affected region | 6.89 mm |
| Original-density equivalent of removed volume | 208.1 g |
| Mass deficit assigned to the lower-density retained layer | 69.8 g |
| Total scenario mass decrease | 277.9 g |
| Retained-char mass | 69.8 g |
| Remaining uncharred mass | 531.6 g |
| Total remaining mass | 601.4 g |

The mass balance is **879.3 − 601.4 = 208.1 + 69.8 g**. The second loss term is a *retained-layer density deficit*, not a separately measured pyrolysis loss. This geometric partition does not identify which material exited as gas, eroded char, or fragments. It excludes swelling, cracks, deposits, and changing chemistry; it has no energy balance.

### Coverage changes total mass, not local depth

Keep the same local recession and assumed char state:

| Affected original bore area | Retained-char mass | Total scenario mass decrease | Remaining mass |
| --- | ---: | ---: | ---: |
| 25% | 17.5 g | 69.5 g | 809.9 g |
| 50% | 34.9 g | 139.0 g | 740.4 g |
| 100% | 69.8 g | 277.9 g | 601.4 g |

All three have **8.89 mm geometric wall and 6.89 mm uncharred wall within the affected region**. Less affected area does not make the local recess shallower. Whole-sleeve weighing therefore cannot alone establish the thinnest surviving wall.

### Selected char-state sensitivity

At full coverage and 3.175-mm recession, the cells below are **total remaining mass**, not retained-char mass:

| Assumed char thickness | 25% initial density | 50% initial density | 75% initial density |
| --- | ---: | ---: | ---: |
| 1 mm | 619.5 g | 636.7 g | 654.0 g |
| 2 mm | 566.5 g | 601.4 g | 636.3 g |
| 3 mm | 512.3 g | 565.3 g | 618.3 g |

These changes arise from the chosen state, not a fitted decomposition model. We do not infer better or worse thermal protection from remaining mass alone.

### Equations and limits

Use consistent units. With original radii `Ri`, `Ro`, length `L`, imposed recession `d`, retained-char thickness `c`, affected fraction `f`, original density `rho_v`, and selected density ratio `beta = rho_c / rho_v`:

```
V0 = pi * L * (Ro² - Ri²)
Vr = f * pi * L * ((Ri + d)² - Ri²)
Vc = f * pi * L * ((Ri + d + c)² - (Ri + d)²)
Vv = V0 - Vr - Vc
m_remaining = rho_v * Vv + beta * rho_v * Vc
m0 - m_remaining = rho_v * Vr + (1 - beta) * rho_v * Vc
local_uncharred_wall = Ro - Ri - d - c
```

Reject negative inputs, coverage/density ratios outside 0–1, or `d + c` exceeding the original wall; do not silently clamp invalid states. At zero coverage, the sleeve remains unchanged. At `c = 0` or `beta = 1`, the extra density-deficit term vanishes.

The source model also supplies selected time/flux cases. The measured hot point is the only measured depth anchor; the baseline depth and flux law remain assumptions. Keeping `c = 2 mm` and `beta = 0.5` in every time/flux row isolates a sensitivity comparison—it does **not** predict constant char thickness during a burn. No extrapolation to the engine's estimated several-MW/m² environment is made.

For context only, `q_ref * t * f * A0` is the reference-flux integral over the *original* bore area. It is 254.7 kJ in the full-coverage reference case. It is not absorbed sleeve energy, an ablation energy requirement, or a check of energy conservation.

The next measurements should target exactly these assumptions: registered profiles for local `d` and coverage, sectioned char thickness for `c`, char volume/density for `beta`, and conditioned whole-sleeve mass for the total balance. Preserve fragments and document deposits and cutting losses. Time-resolved temperature and heating data are needed to turn the endpoint scenarios into a thermal/material-response prediction.

Downloads: [scenario rows (CSV)](sleeve-scenarios.csv), [complete calculation (JSON)](sleeve-comparison-results.json).

Full-precision calculations: [sleeve-comparison-results.json](sleeve-comparison-results.json). Numerical precision preserves arithmetic, not measurement certainty.
