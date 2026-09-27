"""Digitize visible raster strokes, NOT original thermocouple samples.

Run with Python 3, numpy and Pillow. The source image is read-only. Outputs
are deterministic CSV/JSON/SVG artifacts in the build's analysis directory.
"""
from pathlib import Path
from collections import Counter
import base64
import csv
import hashlib
import json
import math
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/builds/ablative-material-testing-fixture/chambersafe-back-face-reported.png"
DEST = SOURCE.parent / "analysis"
CLASSIFICATION = "DIGITIZED_NOT_RAW"
RGB = {"baseline_20s": (31, 119, 180), "hot_10s": (255, 127, 14)}
COLORS = {"baseline_20s": "#2077ac", "hot_10s": "#c65e10"}


def groups(values):
    return [g for g in np.split(values, np.flatnonzero(np.diff(values) > 1) + 1) if len(g)]


def calibrate(a):
    """Detect tick strokes in strips that exclude axes, text and curves."""
    black = a.max(axis=2) < 40
    xs = [float(g.mean()) for g in groups(np.flatnonzero(black[1268:1282, 260:1860].sum(0) > 7) + 260)]
    ys = [float(g.mean()) for g in groups(np.flatnonzero(black[160:1260, 225:242].sum(1) > 8) + 160)]
    assert len(xs) == 7 and len(ys) == 5, "Source changed: inspect and recalibrate ticks"
    xt, yt = np.arange(0, 61, 10), np.array([.4, .2, 0, -.2, -.4])
    xc, yc = np.polyfit(xs, xt, 1), np.polyfit(ys, yt, 1)
    # Plot limits selected from visible frame. The top-right legend ends at
    # y=272; cropping to y>=290 excludes all legend pixels and no data pixels.
    return xc, yc, {
        "x_ticks_px": xs, "x_ticks_log_seconds": xt.tolist(),
        "y_ticks_px": ys, "y_ticks_delta_c": yt.tolist(),
        "x_mapping_seconds_per_pixel_and_intercept": xc.tolist(),
        "y_mapping_c_per_pixel_and_intercept": yc.tolist(),
        "max_tick_residual_s": float(np.max(abs(np.polyval(xc, xs) - xt))),
        "max_tick_residual_c": float(np.max(abs(np.polyval(yc, ys) - yt))),
        "included_pixel_rectangle_xyxy": [280, 290, 1840, 1260],
        "legend": "Excluded by y >= 290 px; data start at y=321 px or below.",
        "pixel_time_resolution_s": float(abs(xc[0])),
        "pixel_temperature_resolution_c": float(abs(yc[0])),
    }


def extract(a, xc, yc, calibration):
    rows, segments, masks = {}, {}, {}
    # Four pixels include half-width of colored/antialiased strokes, cap
    # location, and tick-position rounding. This is graphical uncertainty,
    # NOT sensor uncertainty or statistical confidence.
    dt = 4 * abs(xc[0]) + calibration["max_tick_residual_s"]
    dtemp = 4 * abs(yc[0]) + calibration["max_tick_residual_c"]
    for condition, rgb in RGB.items():
        mask = np.max(abs(a.astype(np.int16) - np.array(rgb)), axis=2) < 25
        mask[:290] = False
        mask[1260:] = False
        mask[:, :280] = False
        mask[:, 1840:] = False
        masks[condition] = mask
        pixel_y, pixel_x = np.where(mask)
        start = max(int(math.ceil(-xc[1] / xc[0])), int(pixel_x.min()))
        end = int(pixel_x.max())
        records = []
        for x in range(start, end + 1):
            yy = np.flatnonzero(mask[:, x])
            row = {"classification": CLASSIFICATION, "condition": condition,
                   "source_x_px": x, "time_from_log_start_s_approx": float(np.polyval(xc, x)),
                   "time_graphical_uncertainty_s": float(dt),
                   "delta_t_center_c_approx": None,
                   "visible_band_low_c_approx": None, "visible_band_high_c_approx": None,
                   "source_y_center_px": None, "source_y_min_px": None, "source_y_max_px": None,
                   "temperature_graphical_uncertainty_c": float(dtemp),
                   "status": "missing_occluded_or_unresolved", "source_colored_pixel_count": int(len(yy))}
            if len(yy):
                span = int(yy[-1] - yy[0] + 1)
                row.update({"source_y_min_px": int(yy[0]), "source_y_max_px": int(yy[-1]),
                            "visible_band_low_c_approx": float(np.polyval(yc, yy[-1]) - dtemp),
                            "visible_band_high_c_approx": float(np.polyval(yc, yy[0]) + dtemp)})
                if span <= 8 and len(yy) >= 4:
                    center = float((yy[0] + yy[-1]) / 2)
                    row.update({"delta_t_center_c_approx": float(np.polyval(yc, center)),
                                "source_y_center_px": center, "status": "narrow_visible_horizontal_band"})
                elif span <= 8:
                    row["status"] = "partial_stroke_or_occlusion_no_center"
                else:
                    row["status"] = "vertical_transition_or_merged_strokes_no_center"
            records.append(row)
        # A stable segment requires >=4 contiguous columns, near-identical
        # centers and narrow vertical support. Vertical jumps are never samples.
        runs, active = [], []
        for row in records + [{"status": "end"}]:
            narrow = row["status"] == "narrow_visible_horizontal_band"
            if active and (not narrow or abs(row["source_y_center_px"] - active[0]["source_y_center_px"]) > 1):
                if len(active) >= 4:
                    runs.append(active)
                active = []
            if narrow:
                active.append(row)
        segs = []
        for i, run in enumerate(runs, 1):
            centers = [r["source_y_center_px"] for r in run]
            cy = float(np.median(centers))
            segs.append({"classification": CLASSIFICATION, "condition": condition, "visible_segment_id": i,
                         "time_start_log_s_approx": run[0]["time_from_log_start_s_approx"],
                         "time_end_log_s_approx": run[-1]["time_from_log_start_s_approx"],
                         "delta_t_c_approx": float(np.polyval(yc, cy)),
                         "time_graphical_uncertainty_s": float(dt),
                         "temperature_graphical_uncertainty_c": float(dtemp),
                         "source_x_start_px": run[0]["source_x_px"], "source_x_end_px": run[-1]["source_x_px"],
                         "source_y_center_px": cy, "status": "visible_horizontal_segment_not_sample_sequence"})
        rows[condition], segments[condition] = records, segs
    return rows, segments, masks


def make_summary(rows, segments, calibration):
    metrics = {}
    for key, records in rows.items():
        segs = segments[key]
        ymax = max(s["delta_t_c_approx"] for s in segs)
        ymin = min(s["delta_t_c_approx"] for s in segs)
        first_max = min((s for s in segs if abs(s["delta_t_c_approx"] - ymax) < .003), key=lambda s: s["time_start_log_s_approx"])
        dt = records[0]["time_graphical_uncertainty_s"]
        # A narrow spike can reach the maximum while having no resolvable
        # horizontal plateau. Identify its graphical cap, but do not turn the
        # vertical stroke into a measured sample or plateau.
        max_cap = next(r for r in records if r["visible_band_high_c_approx"] is not None
                       and r["visible_band_high_c_approx"] >= ymax)
        metrics[key] = {
            "visible_time_window_log_s_approx": [round(records[0]["time_from_log_start_s_approx"], 2), round(records[-1]["time_from_log_start_s_approx"], 2)],
            "visible_maximum_delta_c_approx": round(ymax, 3),
            "visible_minimum_delta_c_approx": round(ymin, 3),
            "first_visible_maximum_segment_log_s_approx": [round(first_max["time_start_log_s_approx"], 2), round(first_max["time_end_log_s_approx"], 2)],
            "first_visible_maximum_time_graphical_interval_log_s": [round(first_max["time_start_log_s_approx"] - dt, 2), round(first_max["time_start_log_s_approx"] + dt, 2)],
            "first_visible_maximum_cap_log_s_approx": round(max_cap["time_from_log_start_s_approx"], 2),
            "first_visible_maximum_cap_time_graphical_interval_log_s": [round(max_cap["time_from_log_start_s_approx"] - dt, 2), round(max_cap["time_from_log_start_s_approx"] + dt, 2)],
            "maximum_timing_note": "Cap timing can identify an unresolved narrow spike; the first accepted horizontal segment can occur later. Neither is an original sample time.",
            "visible_horizontal_segment_count_not_samples": len(segs),
            "pixel_columns_not_samples": len(records),
            "pixel_column_status_counts": dict(Counter(r["status"] for r in records)),
        }
    # Blue onset means the first resolvable positive departure from its zero
    # plateau in log coordinates. The orange record has early baseline chatter;
    # no unique physical onset is assigned.
    baseline = segments["baseline_20s"]
    positive = next(s for s in baseline if s["delta_t_c_approx"] > .03)
    first_positive_column = next(r for r in rows["baseline_20s"]
                                if r["delta_t_center_c_approx"] is not None and r["delta_t_center_c_approx"] > .03)
    last_zero = max(s["time_end_log_s_approx"] for s in baseline
                    if abs(s["delta_t_c_approx"]) < .01 and s["time_end_log_s_approx"] < positive["time_start_log_s_approx"])
    dt = positive["time_graphical_uncertainty_s"]
    metrics["baseline_20s"]["first_resolved_rise_log_s_graphical_bracket"] = [round(last_zero - dt, 2), round(first_positive_column["time_from_log_start_s_approx"] + dt, 2)]
    metrics["hot_10s"]["first_resolved_rise_log_s_graphical_bracket"] = None
    return {
        "classification": CLASSIFICATION,
        "source": {"file": SOURCE.name, "sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(), "dimensions_px": [1920, 1440]},
        "method": "Tick-calibrated color masks; per-column graphical envelopes; centers only for narrow visible horizontal strokes; >=4-column stable runs form visible segments. No smoothing, interpolation, refitting or original sample recovery.",
        "calibration": calibration,
        "graphical_uncertainty": {"time_s_approx": round(dt, 3), "temperature_c_approx": round(positive["temperature_graphical_uncertainty_c"], 4), "interpretation": "Conservative 4-pixel stroke/cap allowance plus tick fit residual. Not instrument uncertainty or a confidence interval."},
        "results": metrics,
        "reported_value_comparison": {
            "baseline_table6_maximum_delta_c": .317,
            "hot_table6_maximum_delta_c": .241,
            "hot_visible_curve_maximum_delta_c_approx": metrics["hot_10s"]["visible_maximum_delta_c_approx"],
            "hot_table_minus_curve_c_approx": round(.241 - metrics["hot_10s"]["visible_maximum_delta_c_approx"], 3),
            "status": "Unresolved report-versus-figure discrepancy; do not replace one with the other.",
        },
        "temperature_processing": {"reported_gain": 1.0129, "reported_raw_increment_c": .0625, "gain_times_increment_c": .0625 * 1.0129, "gain_reapplied": False, "note": "The plot is already baseline-subtracted and corrected. Its visible increment is about 0.063 C; do not apply gain again."},
        "limitations": [
            "Digitized figure pixels are not raw measurements; pixel columns and visible segments do not imply original sample count, sampling cadence, or individual measurement times.",
            "Time is from start of each log, not synchronized flame-on time. Source legend labels 20 s and 10 s are nominal exposure durations, not plotted time-window lengths.",
            "Vertical strokes and dense merged transitions produce only graphical min/max envelopes; blank center fields are intentional.",
            "Missing colored pixels inside a trace can be occluded by the other trace; no interpolated values are inserted.",
            "Hot baseline chatter prevents assigning a unique physical onset. The blue first visible rise is only log-relative, not a thermal lag measurement.",
            "No response integral is reported: uncertain transition columns, occlusion, unequal windows and unsynchronized logs would require explicit assumptions.",
            "No thermal model fit, conductivity, diffusivity, heat flux, heat-shield effectiveness or energy absorption can be validated from these back-face figure pixels alone.",
        ],
    }


def write_csv(path, records):
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(records[0]))
        writer.writeheader()
        for row in records:
            writer.writerow({k: f"{v:.6f}" if isinstance(v, float) else v for k, v in row.items()})


def make_reconstruction(rows, segments):
    left, right, top, bottom = 100, 1040, 150, 580
    x = lambda t: left + t / 67 * (right - left)
    y = lambda v: bottom - (v + .2) / .56 * (bottom - top)
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 750" role="img" aria-labelledby="title desc">',
           '<title id="title">ChamberSafe: digitized visible back-face traces, not raw data</title>',
           '<desc id="desc">Visible raster envelopes and horizontal-stroke centers calibrated from original figure ticks. Blue baseline 20-second label peaks near 0.317 degrees Celsius. Orange hot 10-second label peaks near 0.214 degrees Celsius. Gaps are not interpolated. Time is relative to each log, not flame ignition.</desc>',
           '<rect width="1120" height="750" fill="#fffdf9"/>',
           '<style>text{font-family:Arial,sans-serif;fill:#36332f} .small{font-size:16px} .tick{font-size:17px} .grid{stroke:#e5e0d8;stroke-width:1}</style>',
           '<text x="38" y="40" font-size="27" font-weight="700">ChamberSafe · digitized figure, not raw data</text>',
           '<text x="38" y="70" font-size="18">Approximate back-face temperature rise · original figure calibration retained</text>',
           '<text x="38" y="103" class="small">Dark marks: visible horizontal-stroke centers. Pale bands: visible pixel envelopes.</text>',
           '<text x="38" y="127" class="small">Blank centers / gaps are unresolved, merged or occluded; no smoothing or interpolation.</text>']
    for temp in [-.2, -.1, 0, .1, .2, .3]:
        yy = y(temp)
        svg.extend([f'<line class="grid" x1="{left}" x2="{right}" y1="{yy:.2f}" y2="{yy:.2f}"/>', f'<text class="tick" x="85" y="{yy+6:.2f}" text-anchor="end">{temp:.1f}</text>'])
    for time in range(0, 61, 10):
        xx = x(time)
        svg.extend([f'<line class="grid" x1="{xx:.2f}" x2="{xx:.2f}" y1="{top}" y2="{bottom}"/>', f'<text class="tick" x="{xx:.2f}" y="608" text-anchor="middle">{time}</text>'])
    for key, records in rows.items():
        color = COLORS[key]
        for row in records:
            if row["visible_band_low_c_approx"] is not None:
                xx = x(row["time_from_log_start_s_approx"])
                svg.append(f'<line x1="{xx:.2f}" x2="{xx:.2f}" y1="{y(row["visible_band_low_c_approx"]):.2f}" y2="{y(row["visible_band_high_c_approx"]):.2f}" stroke="{color}" stroke-opacity=".14" stroke-width=".7"/>')
        for seg in segments[key]:
            svg.append(f'<line x1="{x(seg["time_start_log_s_approx"]):.2f}" x2="{x(seg["time_end_log_s_approx"]):.2f}" y1="{y(seg["delta_t_c_approx"]):.2f}" y2="{y(seg["delta_t_c_approx"]):.2f}" stroke="{color}" stroke-width="3"/>')
    svg.extend([
        f'<path d="M{left},{top} V{bottom} H{right}" stroke="#766d62" fill="none"/>',
        '<text x="570" y="644" text-anchor="middle" font-size="20">Time from start of each log (s) · NOT flame-on time</text>',
        '<text transform="translate(30 365) rotate(-90)" text-anchor="middle" font-size="20">Back-face rise, ΔTᵦ (°C)</text>',
        '<line x1="55" x2="95" y1="680" y2="680" stroke="#2077ac" stroke-width="4"/><text x="105" y="686" font-size="18">Baseline (20 s label): peak ≈0.317 °C</text>',
        '<line x1="580" x2="620" y1="680" y2="680" stroke="#c65e10" stroke-width="4"/><text x="630" y="686" font-size="18">Hot (10 s label): peak ≈0.214 °C</text>',
        '<text x="55" y="719" class="small">Table 6 reports hot peak 0.241 °C. The ≈0.027 °C difference remains unresolved.</text>',
        '</svg>'])
    return '\n'.join(svg) + '\n'


def make_overlay(segments, calibration):
    data = base64.b64encode(SOURCE.read_bytes()).decode()
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1570" role="img" aria-labelledby="title desc">',
           '<title id="title">Digitization verification overlay on original ChamberSafe plot</title>',
           '<desc id="desc">Original PNG is shown unchanged. Magenta overlays mark accepted blue horizontal centers; teal overlays mark accepted orange horizontal centers. Crosshairs mark axis calibration ticks. Unresolved strokes have no centerline overlay.</desc>',
           '<rect width="1920" height="1570" fill="white"/>',
           f'<image width="1920" height="1440" href="data:image/png;base64,{data}"/>']
    for key, segs in segments.items():
        color = "#db2db9" if key == "baseline_20s" else "#086a60"
        for seg in segs:
            svg.append(f'<line x1="{seg["source_x_start_px"]}" x2="{seg["source_x_end_px"]}" y1="{seg["source_y_center_px"]}" y2="{seg["source_y_center_px"]}" stroke="{color}" stroke-width="2"/>')
    for px in calibration["x_ticks_px"]:
        svg.append(f'<path d="M{px-7},1267 H{px+7} M{px},1260 V1275" stroke="#db2db9" stroke-width="2"/>')
    for py in calibration["y_ticks_px"]:
        svg.append(f'<path d="M234,{py-7} V{py+7} M227,{py} H242" stroke="#db2db9" stroke-width="2"/>')
    svg.extend(['<text x="70" y="1480" font-family="Arial,sans-serif" font-size="26" fill="#282828">DIGITIZED, NOT RAW · Centerline overlays: magenta = baseline; teal = hot.</text>',
                '<text x="70" y="1520" font-family="Arial,sans-serif" font-size="24" fill="#555">Crosshairs = tick calibration. Original source is embedded unchanged. Blank overlays = unresolved pixels.</text>', '</svg>'])
    return '\n'.join(svg) + '\n'


def checks(a, rows, segments, masks, summary):
    assert a.shape == (1440, 1920, 3)
    assert abs(summary["results"]["baseline_20s"]["visible_maximum_delta_c_approx"] - .317) < .004
    assert abs(summary["results"]["hot_10s"]["visible_maximum_delta_c_approx"] - .214) < .004
    assert abs(summary["reported_value_comparison"]["hot_table_minus_curve_c_approx"] - .027) < .004
    for key, records in rows.items():
        assert all(r["classification"] == CLASSIFICATION for r in records)
        assert not masks[key][:290].any(), "Legend must be excluded"
        assert all(r["delta_t_center_c_approx"] is None for r in records if "transition" in r["status"] or "missing" in r["status"])
        assert all(s["source_x_end_px"] - s["source_x_start_px"] >= 3 for s in segments[key])
        assert all(r["time_from_log_start_s_approx"] >= -1e-9 for r in records)
        for r in records:
            if r["delta_t_center_c_approx"] is not None:
                assert r["visible_band_low_c_approx"] <= r["delta_t_center_c_approx"] <= r["visible_band_high_c_approx"]
    assert not summary["temperature_processing"]["gain_reapplied"]


def main():
    a = np.array(Image.open(SOURCE).convert("RGB"))
    xc, yc, calibration = calibrate(a)
    rows, segments, masks = extract(a, xc, yc, calibration)
    summary = make_summary(rows, segments, calibration)
    checks(a, rows, segments, masks, summary)
    DEST.mkdir(parents=True, exist_ok=True)
    for condition in RGB:
        write_csv(DEST / f"digitized-chambersafe-{condition}-columns-NOT-RAW.csv", rows[condition])
        write_csv(DEST / f"digitized-chambersafe-{condition}-segments-NOT-RAW.csv", segments[condition])
    (DEST / "digitized-chambersafe-summary.json").write_text(json.dumps(summary, indent=2) + '\n')
    (DEST / "digitized-chambersafe-reconstruction.svg").write_text(make_reconstruction(rows, segments))
    (DEST / "digitized-chambersafe-source-overlay.svg").write_text(make_overlay(segments, calibration))
    print(json.dumps({"checks": "passed", "results": summary["results"], "uncertainty": summary["graphical_uncertainty"]}, indent=2))


if __name__ == "__main__":
    main()
