"""Source-regression checks; these test digitization, not physical accuracy."""
import unittest
import numpy as np
from PIL import Image
import digitize_chambersafe as d


class DigitizationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.a = np.array(Image.open(d.SOURCE).convert("RGB"))
        cls.xc, cls.yc, cls.cal = d.calibrate(cls.a)
        cls.rows, cls.segments, cls.masks = d.extract(cls.a, cls.xc, cls.yc, cls.cal)
        cls.summary = d.make_summary(cls.rows, cls.segments, cls.cal)

    def test_source_dimensions_and_tick_count(self):
        self.assertEqual(self.a.shape, (1440, 1920, 3))
        self.assertEqual(len(self.cal["x_ticks_px"]), 7)
        self.assertEqual(len(self.cal["y_ticks_px"]), 5)
        self.assertAlmostEqual(float(np.polyval(self.xc, 318)), 0, places=8)
        self.assertAlmostEqual(float(np.polyval(self.xc, 1656)), 60, places=8)

    def test_legend_not_data(self):
        for mask in self.masks.values():
            self.assertFalse(mask[:290].any())

    def test_transitions_are_not_point_estimates(self):
        for rows in self.rows.values():
            transitions = [r for r in rows if "transition" in r["status"]]
            self.assertTrue(transitions)
            self.assertTrue(all(r["delta_t_center_c_approx"] is None for r in transitions))

    def test_occlusion_remains_missing(self):
        missing = [r for r in self.rows["baseline_20s"] if r["status"] == "missing_occluded_or_unresolved"]
        self.assertEqual(len(missing), 243)
        self.assertTrue(all(r["delta_t_center_c_approx"] is None for r in missing))
        self.assertTrue(all(r["visible_band_low_c_approx"] is None for r in missing))

    def test_centers_within_graphical_envelopes(self):
        for rows in self.rows.values():
            for row in rows:
                if row["delta_t_center_c_approx"] is not None:
                    self.assertLessEqual(row["visible_band_low_c_approx"], row["delta_t_center_c_approx"])
                    self.assertGreaterEqual(row["visible_band_high_c_approx"], row["delta_t_center_c_approx"])

    def test_peak_discrepancy_is_preserved(self):
        self.assertAlmostEqual(self.summary["results"]["baseline_20s"]["visible_maximum_delta_c_approx"], .317)
        self.assertAlmostEqual(self.summary["results"]["hot_10s"]["visible_maximum_delta_c_approx"], .214)
        self.assertAlmostEqual(self.summary["reported_value_comparison"]["hot_table6_maximum_delta_c"], .241)
        self.assertAlmostEqual(self.summary["reported_value_comparison"]["hot_table_minus_curve_c_approx"], .027)

    def test_no_gain_reapplication(self):
        self.assertFalse(self.summary["temperature_processing"]["gain_reapplied"])
        temps = sorted(set(round(s["delta_t_c_approx"], 8) for s in self.segments["baseline_20s"]))
        self.assertAlmostEqual(float(np.median(np.diff(temps))), .0633, places=4)

    def test_time_is_log_relative_and_not_equal_duration(self):
        self.assertEqual(self.summary["results"]["baseline_20s"]["visible_time_window_log_s_approx"], [0., 52.96])
        self.assertEqual(self.summary["results"]["hot_10s"]["visible_time_window_log_s_approx"], [0., 66.59])
        self.assertIsNone(self.summary["results"]["hot_10s"]["first_resolved_rise_log_s_graphical_bracket"])

    def test_csv_classification_and_segment_counts_are_not_samples(self):
        for rows in self.rows.values():
            self.assertTrue(all(r["classification"] == "DIGITIZED_NOT_RAW" for r in rows))
        self.assertEqual(len(self.segments["baseline_20s"]), 16)
        self.assertEqual(len(self.segments["hot_10s"]), 54)

    def test_all_runtime_invariants(self):
        d.checks(self.a, self.rows, self.segments, self.masks, self.summary)


if __name__ == "__main__":
    unittest.main()
