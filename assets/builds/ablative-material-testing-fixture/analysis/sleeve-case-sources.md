# Overture Mk1 case: sources and limits

Reviewed September 27, 2026. These records support **conditional case-heating calculations**, not measured first-hotfire temperatures, an as-built certificate, or a safety approval. The Drive search combined folder traversal and keyword discovery; missing records may exist elsewhere.

## Documented case

The [Appendix Comps Sheet](https://docs.google.com/spreadsheets/d/1Zg9WjmT8dic_PtStrfykBivGqj8CVY54Y9kj8dExC5A/edit), housing Part #1, lists a one-foot-long, 4-inch-ID, quarter-inch-wall seamless pipe: **304L stainless steel**, McMaster **89495K95**. The connector export identifies this as CSV index 21; that index is not a verified spreadsheet row number. The sheet was last modified September 23, 2025.

The [Appendix Dims Sheet](https://docs.google.com/spreadsheets/d/1HcJMnTM0SDfNXDDfdOUr65X4GkdxouMvA-WkfBdLpM0/edit), Closure rows, independently lists **12-inch length, 4-inch ID, and 0.25-inch wall**. Thus OD is 4.5 inches. In SI units: length 304.8 mm, ID 101.6 mm, OD 114.3 mm, wall 6.35 mm. These are design dimensions, not individual-part measurements.

The [Mk1 Master Document](https://drive.google.com/file/d/1jDAsfee5J-WOtEefkqIQlGdgy0_b5N1a/view), §6.1, printed page 26, gives the same dimensions but calls the material **304 stainless steel**. Its cover says September 24, 2025; its September 2026 upload metadata does not establish a newer engineering revision. Prefer the component list's more specific 304L designation for a documented-input scenario, while retaining the discrepancy. Installed grade, heat treatment, material certificate, and measured case mass remain unknown.

## Sleeve fit and conflicting revisions

The [sizing task](https://docs.google.com/document/d/1oIKhaOOdl2J4FMQjktNuqRRpTlfGJ7aP7FaxK298SMk/edit), “Final Dimensions of Ablative Sleeve,” specifies **3.95 ± 0.05-inch OD, 3-inch ID, and 7.168 ± 0.05-inch length**. Against a nominal 4-inch-ID case, the central values imply 0.635 mm radial clearance—not a measured, uniform air gap or known thermal-contact resistance. The task's instruction to check mass is not a mass result.

The older Appendix Dims sleeve rows instead list 7.118-inch length and quarter-inch wall, implying 3.5-inch OD. Later [TRR slide 16](https://docs.google.com/presentation/d/1oOHAGOG1Z7mmtfshaSWwUD1cEP_X0XBLRNJsbGGLRxo/edit#slide=id.g3e65397d0ca_0_302) describes half-inch material as sleeve thickness. These revisions are not silently merged; no exact as-fired dimensional inspection was recovered.

## First-fire and temperature limits

The [TRR timing review](https://docs.google.com/presentation/d/1oOHAGOG1Z7mmtfshaSWwUD1cEP_X0XBLRNJsbGGLRxo/edit#slide=id.h33f62dd7f2c39b51_1_45) reports a controller failure about 0.25 seconds into the May 3, 2026 burn. The [preliminary analysis](https://docs.google.com/document/d/1FI2h3YqpO12gbUEWAxf61ywpwOMc37wW0xKYwL8t3wY/edit) describes early fuel-valve closure and interprets later combustion as oxygen-rich. Neither establishes the actual local thermal history. A steady ten-second calculation is therefore a hypothetical exposure, not a reconstruction.

The [inspection review](https://docs.google.com/presentation/d/1oOHAGOG1Z7mmtfshaSWwUD1cEP_X0XBLRNJsbGGLRxo/edit#slide=id.h33f62dd7f2c39b51_1_80) reports axial cracks and deposits outside the sleeve. These permit heating paths excluded by an intact, radial-only model.

The [safety-factor sheet](https://docs.google.com/spreadsheets/d/1ChCQonLD_LLp4Zp1h3W1QxBT0lzy-UEHTjcbH6s86so/edit) assumes a 200 K thermal load and 30 ksi allowable stress. Neither is a measured temperature nor a certified thermal limit. Likewise, the master's 70–1500 °F calculation range is not an operating rating. No measured case-temperature history was found.

## Separate engine-heating estimate

The local torch report, `ablative_test_final_report.tex`, subsection “Engine representativeness (order-of-magnitude check),” lines 368–374, separately estimates **CEA gas temperature 2,876 K** and **h ≈ 2,240 W/(m²·K)**, using `q″ ≈ h(T₀ − T_wall)` where the second temperature is the exposed wall temperature. This estimate is explicitly **not derived from the torch data** and is not a measured engine boundary condition. Gas temperature is not case temperature; film cooling, ablation, cracks, and contact conditions remain unresolved. No existing public archive of this report was located; no public download URL is asserted.

Needed records include installed-part dimensions and material identity, calibrated case temperatures with sensor locations, synchronized firing history, sleeve pre/post conditioned mass, recession/char maps, and temperature-dependent liner, char, metal, and contact properties. The model cannot supply those missing measurements.
