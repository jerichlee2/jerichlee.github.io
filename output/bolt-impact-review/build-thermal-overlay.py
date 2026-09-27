"""Build a shared-axis comparison without inventing raw measurement samples.

The source figures contain dense scatter markers on quantized temperature
plateaus. Extract those visible horizontal bands, NOT individual sample times.
Reconstruct the model using the report's CN method and rounded fitted fluxes.
All source images remain untouched. Dependencies: numpy, Pillow.
"""
from pathlib import Path
import csv
import hashlib
import json
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets/builds/ablative-material-testing-fixture"
OUT = Path(__file__).resolve().parent
COLORS = {"baseline": "#176da5", "hot": "#b8520c"}
FLUX = {"baseline": .2592, "hot": .5844}


def groups(values):
    return [g for g in np.split(values, np.flatnonzero(np.diff(values) > 1) + 1) if len(g)]


def measured_bands(kind):
    source = ASSETS / f"graphite-inverse-fit-{kind}.png"
    a = np.array(Image.open(source).convert("RGB"))
    assert a.shape == (1440, 1920, 3), "Recalibrate if source dimensions change"
    black = a.max(axis=2) < 70
    # Axis ticks, detected independently in each source rather than sharing
    # pixel Y coordinates: the original charts have DIFFERENT vertical scales.
    xs = [float(g.mean()) for g in groups(np.flatnonzero(black[1266:1283].sum(0)[230:1820] > 10) + 230)]
    ys = [float(g.mean()) for g in groups(np.flatnonzero(black[:, 178:195].sum(1)[115:1240] > 10) + 115)]
    assert len(xs) == 8 and len(ys) == (5 if kind == "baseline" else 6)
    x_coeff = np.polyfit(xs, np.arange(0, 4, .5), 1)
    y_ticks = np.array([20, 15, 10, 5, 0] if kind == "baseline" else [50, 40, 30, 20, 10, 0])
    y_coeff = np.polyfit(ys, y_ticks, 1)
    mask = (a[:, :, 0] < 70) & (a[:, :, 1] > 85) & (a[:, :, 1] < 155) & (a[:, :, 2] > 155) & (a[:, :, 2] < 210)
    # Plot bounds and opaque source legend. No plotted measured bands are
    # hidden by this legend region in these two figures.
    mask[:110] = False
    mask[1260:] = False
    mask[:, :263] = False
    mask[:, 1810:] = False
    mask[:410, :1260] = False
    # The model is a thin line; measured dot clusters are >=11px thick.
    thick = mask.copy()
    for offset in range(-5, 6):
        thick &= np.roll(mask, offset, axis=0)
    rows = []
    for y in range(110, 1260):
        spans = [g for g in groups(np.flatnonzero(thick[y])) if len(g) >= 8]
        if spans:
            rows.append((y, max(spans, key=len)))
    row_lookup = dict(rows)
    bands = []
    wide = groups(np.array([row for row, span in rows if len(span) > 35]))
    candidates = list(wide)
    # A final isolated marker in the hot trace has no long plateau. Keep it
    # without merging the two closely spaced low-temperature baseline bands.
    for band in groups(np.array([row for row, span in rows])):
        if all(abs(float(band.mean()) - float(w.mean())) > 18 for w in wide):
            candidates.append(band)
    for band in candidates:
        y = int(round(float(band.mean())))
        span = row_lookup[y]
        # Eroded marker caps extend about6px past their sample centers.
        x0, x1 = float(span[0] + 6), float(span[-1] - 6)
        if x1 < x0:
            x0 = x1 = float((span[0] + span[-1]) / 2)
        bands.append({"t_start": float(np.clip(np.polyval(x_coeff, x0), 0, 3.5)),
                      "t_end": float(np.clip(np.polyval(x_coeff, x1), 0, 3.5)),
                      "temperature": float(np.polyval(y_coeff, y)),
                      "source_y": y})
    bands.sort(key=lambda b: b["t_start"])
    assert len(bands) == (17 if kind == "baseline" else 16), (kind, bands)
    assert all(a["temperature"] < b["temperature"] for a, b in zip(bands, bands[1:]))
    return bands, {"source": source.name, "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                   "x_ticks_px": xs, "y_ticks_px": ys, "y_ticks_celsius": y_ticks.tolist(),
                   "time_mapping": x_coeff.tolist(), "temperature_mapping": y_coeff.tolist()}


def model_response():
    # Report §6: fixed properties,101nodes,dt=.01s,Neumann ghost nodes.
    n, dt, length, k, rho, c = 101, .01, .02362, 130, 1850, 700
    dx, alpha = length / (n - 1), k / (rho * c)
    d = np.diag(np.full(n, -2.)) + np.diag(np.ones(n - 1), 1) + np.diag(np.ones(n - 1), -1)
    d[0, 1] = d[-1, -2] = 2
    r = alpha * dt / dx ** 2
    lhs_inv = np.linalg.inv(np.eye(n) - .5 * r * d)
    rhs_matrix = np.eye(n) + .5 * r * d
    temperature, values = np.zeros(n), [0.]
    for step in range(350):
        q_before, q_after = (1e6 if step < 300 else 0), (1e6 if step + 1 < 300 else 0)
        rhs = rhs_matrix @ temperature
        rhs[0] += dt * alpha * (q_before + q_after) / (k * dx)
        temperature = lhs_inv @ rhs
        values.append(float(temperature[-1]))
    assert abs(values[300] - 67.9732740431) < 1e-7
    return np.arange(351) * dt, np.array(values)


def make_svg(bands, time, unit):
    width, height = 1000, 740
    left, right, top, bottom = 100, 940, 180, 622
    x = lambda t: left + (right - left) * t / 3.5
    y = lambda temp: bottom - (bottom - top) * temp / 52
    paths = {key: list(zip(time, unit * flux)) for key, flux in FLUX.items()}
    path = lambda points: " ".join(f"{'M' if i == 0 else 'L'}{x(t):.2f},{y(temp):.2f}" for i, (t, temp) in enumerate(points))
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
           '<title id="title">Graphite response: baseline and hot conditions on the same axes</title>',
           '<desc id="desc">Blue is baseline; orange is hot. Solid measured bands are digitized from the original figures. Dashed model curves are reconstructed using the reported one-dimensional model. The hot fitted heat flux is 2.25 times baseline. At 3 seconds, the model curves differ by about 22.1 degrees Celsius. Original fit RMSE is 1.02 degrees for baseline and 3.02 for hot.</desc>',
           '<rect width="1000" height="740" fill="#fffdf9"/>',
           '<style>text{font-family:Arial,Helvetica,sans-serif;fill:#38332d} .grid{stroke:#e4dfd6;stroke-width:1} .small{font-size:17px} .tick{font-size:18px}</style>']
    def text(value, px, py, size=20, color="#38332d", anchor="start", weight="400"):
        svg.append(f'<text x="{px:.2f}" y="{py:.2f}" text-anchor="{anchor}" style="font-size:{size}px;fill:{color};font-weight:{weight}">{value}</text>')
    text("Baseline vs. hot: one shared temperature scale", 35, 40, 28, weight="700")
    text("Graphite back-face temperature rise · nominal 3 s flame exposure", 35, 70, 19, "#6b6358")
    for key, px, label, rmse in [("baseline", 35, "Baseline", "1.02"), ("hot", 520, "Hot", "3.02")]:
        color = COLORS[key]
        svg.append(f'<rect x="{px}" y="90" width="445" height="64" fill="{color}" fill-opacity=".06"/>')
        text(f"{label} · fitted flux {FLUX[key]:.4f} MW/m²", px + 14, 116, 20, color, weight="700")
        text(f"Reported fit RMSE: {rmse} °C", px + 14, 141, 17, "#6b6358")
    svg.append(f'<rect x="{x(3):.2f}" y="{top}" width="{right-x(3):.2f}" height="{bottom-top}" fill="#eee8de" fill-opacity=".55"/>')
    for temp in range(0, 51, 10):
        yy = y(temp)
        svg.append(f'<line class="grid" x1="{left}" x2="{right}" y1="{yy:.2f}" y2="{yy:.2f}"/>')
        text(str(temp), left - 15, yy + 6, 18, anchor="end")
    for t in np.arange(0, 3.51, .5):
        xx = x(t)
        svg.append(f'<line class="grid" x1="{xx:.2f}" x2="{xx:.2f}" y1="{top}" y2="{bottom}"/>')
        text(f"{t:.1f}", xx, bottom + 28, 18, anchor="middle")
    gap_area = paths["hot"] + list(reversed(paths["baseline"]))
    svg.append(f'<path d="{path(gap_area)} Z" fill="#cbbbaa" fill-opacity=".22"/>')
    for key in ["baseline", "hot"]:
        svg.append(f'<path d="{path(paths[key])}" fill="none" stroke="{COLORS[key]}" stroke-width="3" stroke-dasharray="9 6"/>')
        for b in bands[key]:
            xx0, xx1, yy = x(b["t_start"]), x(b["t_end"]), y(b["temperature"])
            svg.append(f'<line x1="{xx0:.2f}" x2="{xx1:.2f}" y1="{yy:.2f}" y2="{yy:.2f}" stroke="{COLORS[key]}" stroke-width="5" stroke-linecap="round"/>')
    svg.append(f'<path d="M{left},{top} V{bottom} H{right}" fill="none" stroke="#81776a" stroke-width="1.5"/>')
    svg.append(f'<line x1="{x(3):.2f}" x2="{x(3):.2f}" y1="{top}" y2="{bottom}" stroke="#82796c" stroke-width="1.6" stroke-dasharray="5 5"/>')
    text("Flame off · 3 s", x(3), top - 9, 17, "#6b6358", anchor="middle")
    text("2.25× inferred flux", x(.2), y(44), 25, weight="700")
    text("under the hot condition", x(.2), y(44) + 27, 19, "#6b6358")
    text("Shading: separation between model curves", x(.2), y(44) + 57, 16, "#6b6358")
    hot3, baseline3 = unit[300] * FLUX["hot"], unit[300] * FLUX["baseline"]
    xx = x(3) + 17
    svg.append(f'<path d="M{xx-6:.2f},{y(hot3):.2f} h12 M{xx:.2f},{y(hot3):.2f} V{y(baseline3):.2f} M{xx-6:.2f},{y(baseline3):.2f} h12" fill="none" stroke="#554b40" stroke-width="1.8"/>')
    text(f"≈{hot3-baseline3:.1f} °C", xx - 29, y((hot3 + baseline3) / 2) - 4, 22, anchor="end", weight="700")
    text("model gap at 3 s", xx - 29, y((hot3 + baseline3) / 2) + 20, 16, "#6b6358", anchor="end")
    text("Time since detected onset (s)", (left + right) / 2, 686, 21, anchor="middle")
    svg.append('<text transform="translate(29,402) rotate(-90)" text-anchor="middle" style="font-size:21px">Back-face temperature rise, ΔTᵦ (°C)</text>')
    svg.append('<line x1="140" x2="190" y1="717" y2="717" stroke="#61584d" stroke-width="5" stroke-linecap="round"/>')
    text("Measured bands (digitized)", 203, 723, 17)
    svg.append('<line x1="550" x2="600" y1="717" y2="717" stroke="#61584d" stroke-width="3" stroke-dasharray="9 6"/>')
    text("Model fit (reconstructed)", 613, 723, 17)
    svg.append('</svg>')
    return "\n".join(svg) + "\n"


def main():
    bands, calibration = {}, {}
    for kind in FLUX:
        bands[kind], calibration[kind] = measured_bands(kind)
    time, unit = model_response()
    (ASSETS / "graphite-inverse-fit-overlay.svg").write_text(make_svg(bands, time, unit))
    with (OUT / "thermal-overlay-digitized-bands.csv").open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["condition", "start_time_s_approx", "end_time_s_approx", "temperature_rise_c_approx"])
        for kind, values in bands.items():
            for b in values:
                writer.writerow([kind, f'{b["t_start"]:.4f}', f'{b["t_end"]:.4f}', f'{b["temperature"]:.4f}'])
    (OUT / "thermal-overlay-provenance.json").write_text(json.dumps({
        "report": {"title": "Torch-Based Ablative Characterization Campaign Report", "date": "2026-03-01", "sources": "Figures 3 and 4; model in section 6; flux and original RMSE in Table 4"},
        "measurement_method": "Horizontal band digitization from raster figures, not raw samples. Endpoint timing is approximate; dot-center uncertainty is a few pixels. No measured data interpolation or refitting.",
        "calibration": calibration,
        "model": {"method": "Crank–Nicolson, ghost-node Neumann BCs", "nodes": 101, "dt_s": .01, "L_m": .02362, "k_W_mK": 130, "rho_kg_m3": 1850, "c_J_kgK": 700, "pulse_s": 3, "flux_MW_m2": FLUX},
        "reported_RMSE_C": {"baseline": 1.02, "hot": 3.02},
        "model_temperature_at_3s_C": {kind: unit[300] * flux for kind, flux in FLUX.items()},
        "band_counts": {kind: len(values) for kind, values in bands.items()}
    }, indent=2) + "\n")
    print(json.dumps({"bands": {kind: len(values) for kind, values in bands.items()}, "model_gap_at_3s_C": unit[300] * (FLUX["hot"] - FLUX["baseline"])}))


if __name__ == "__main__":
    main()
