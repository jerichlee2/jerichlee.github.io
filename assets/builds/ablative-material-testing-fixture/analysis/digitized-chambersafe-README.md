# ChamberSafe figure digitization — NOT RAW DATA

These files numerically recover visible colored strokes from `../chambersafe-back-face-reported.png` (1920 × 1440 pixels). They are not thermocouple sample exports. The original image is unchanged.

## Files

- `digitized-chambersafe-baseline_20s-columns-NOT-RAW.csv` and `digitized-chambersafe-hot_10s-columns-NOT-RAW.csv`: one row per raster column inside each visible trace window. A row is a pixel observation, not a measurement sample.
- `digitized-chambersafe-baseline_20s-segments-NOT-RAW.csv` and `digitized-chambersafe-hot_10s-segments-NOT-RAW.csv`: only contiguous, narrow horizontal-stroke runs long enough to resolve. Segment endpoints are visible-stroke endpoints, not original sample times.
- `digitized-chambersafe-summary.json`: calibration, source SHA-256, uncertainty interpretation, results, discrepancy and limitations.
- `digitized-chambersafe-reconstruction.svg`: independent-axis reconstruction showing visible envelopes and accepted horizontal centers. No values are interpolated across gaps.
- `digitized-chambersafe-source-overlay.svg`: original PNG embedded unchanged with colored centerline overlays and tick-calibration crosshairs for inspection.

## Reproducible method

Source: `output/ablative-digitization/digitize_chambersafe.py` in the repository. Dependencies: Python 3, NumPy and Pillow. From the repository root:

```sh
python3 output/ablative-digitization/digitize_chambersafe.py
python3 output/ablative-digitization/test_digitize_chambersafe.py
```

Seven x-axis ticks (0–60 s) and five y-axis ticks (−0.4–0.4 °C) calibrate pixels to the figure's axes. Pixels are selected by proximity to source blue `(31, 119, 180)` or orange `(255, 127, 14)`. The legend and non-plot regions are excluded. Each column retains its visible min/max temperature envelope. Only columns with a narrow 4–8-pixel colored band receive a center. Vertical connectors or dense merged strokes receive no center; absent colors remain missing. Stable runs require at least four contiguous narrow columns. CSV decimal places support reproducibility and do not represent sensor precision.

Graphical uncertainty is approximately ±0.18 s and ±0.004 °C, based on a four-pixel stroke/cap allowance plus tick-fit residual. This is not measurement uncertainty or a statistical confidence interval. The color threshold, minimum run width and conservative missing-data policy are explicit in the script.

## Recoverable observations

- Visible baseline maximum: about 0.317 °C; visible window about 0–53.0 s from log start.
- Visible hot maximum: about 0.214 °C; visible window about 0–66.6 s from log start.
- Table 6 reports a hot maximum of 0.241 °C, about 0.027 °C above the visible figure. This discrepancy is unresolved; neither value is silently replaced.
- The baseline first visibly leaves its near-zero plateau around 42 s from log start (conservative graphical bracket about 41.75–42.38 s). This is not a flame-to-back-face lag: flame-on timestamps are unavailable.
- The hot trace has early chatter and offset, so no unique thermal onset is assigned. Short early maximum-height spikes are represented by envelopes; the first accepted horizontal segment at that height appears later. Neither is an original sample time.
- The source is already baseline-subtracted and corrected. The reported 1.0129 gain is not reapplied. The visible ≈0.0633 °C increment is consistent with a raw 0.0625 °C increment multiplied by that gain.

## Limits on interpretation

The 20 s and 10 s labels are nominal exposure durations, not the log windows. These logs are not synchronized to each other or to flame ignition. Counts of columns or horizontal segments do not recover sample count or sampling cadence. Blue pixels hidden beneath orange are not filled in. No smoothing, model fit, conductivity, diffusivity, incident flux or absorbed-energy estimate is made. No curve integral is reported because the unresolved transitions, occlusion and unequal unsynchronized windows require assumptions not supplied by the figure.
