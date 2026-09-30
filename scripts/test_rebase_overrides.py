#!/usr/bin/env python3
"""Offline tests for rebase_overrides.py's text handling -- no git, no tracker."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rebase_overrides as ro  # noqa: E402

HEADER = "<!-- xml reconstructed by Source 2 Viewer 20.0.0.0 - https://valveresourceformat.github.io -->"


class Normalise(unittest.TestCase):
    def test_drops_decompiler_header_only_on_first_line(self):
        text = HEADER + "\n<root>\n" + HEADER + "\n</root>\n"
        self.assertEqual(ro.normalise(text), "<root>\n" + HEADER + "\n</root>\n")

    def test_maps_valve_6711_style_refs_to_repo_form(self):
        valve = '<include src="s2r://panorama/styles/hud.vcss" />\n@import url("s2r://panorama/styles/base/x.vcss");\n'
        ours = '<include src="s2r://panorama/styles/hud.vcss_c" />\n@import url("s2r://panorama/styles/base/x.vcss_c");\n'
        self.assertEqual(ro.normalise(valve), ro.normalise(ours))

    def test_leaves_non_style_refs_alone(self):
        line = 'src="s2r://panorama/images/a_png.vtex"\n'
        self.assertEqual(ro.normalise(line), line)

    def test_keeps_trailing_whitespace_when_asked(self):
        self.assertEqual(ro.normalise("a  \nb\n", strip_ws=False), "a  \nb\n")
        self.assertEqual(ro.normalise("a  \nb\n"), "a\nb\n")

    def test_crlf_is_folded(self):
        self.assertEqual(ro.normalise("a\r\nb\r\n"), "a\nb\n")


class Paths(unittest.TestCase):
    def test_base_copies_map_to_their_valve_file(self):
        self.assertEqual(ro.valve_path("panorama/styles/base/hud.css"), "panorama/styles/hud.css")
        self.assertEqual(ro.valve_path("panorama/styles/base/post_game/x.css"), "panorama/styles/post_game/x.css")
        self.assertEqual(ro.valve_path("panorama/styles/topbar_rank_base/objectives_map.css"),
                         "panorama/styles/objectives_map.css")

    def test_alias_for_mod_named_fork(self):
        self.assertEqual(ro.valve_path("panorama/styles/topbar_rank_topbar.css"),
                         "panorama/styles/citadel_hud_top_bar.css")

    def test_valve_path_is_identity(self):
        self.assertEqual(ro.valve_path("panorama/layout/hud.xml"), "panorama/layout/hud.xml")


class Helpers(unittest.TestCase):
    def test_eof_of_preserves_blank_line(self):
        self.assertEqual(ro.eof_of("x\n\n"), "\n\n")
        self.assertEqual(ro.eof_of("x"), "")

    def test_diff_size_counts_changed_lines(self):
        self.assertEqual(ro.diff_size("a\nb\nc\n", "a\nB\nc\nd\n"), 3)
        self.assertEqual(ro.diff_size("a\n", "a\n"), 0)

    def test_header_of(self):
        self.assertEqual(ro.header_of(HEADER + "\n<root/>"), HEADER)
        self.assertIsNone(ro.header_of("<root/>"))


if __name__ == "__main__":
    unittest.main()
