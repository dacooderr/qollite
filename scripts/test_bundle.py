#!/usr/bin/env python3
"""Offline tests for the first-party bundlers (bundle_bettermap.py, bundle_mer.py,
bundle_common.py) -- synthetic inputs only: no git, no upstream checkout, no network.

    python scripts/test_bundle.py

What this does NOT cover: that a real upstream commit bundles to the tree. That
is `--check` against the upstream checkout (see the bundlers' usage).

Exit code 0 if every case passes.
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bundle_bettermap as bb  # noqa: E402
import bundle_common as bc  # noqa: E402
import bundle_mer as bm  # noqa: E402

SHA = "0123456789abcdef0123456789abcdef01234567"


class BetterMapRename(unittest.TestCase):
    def test_globals(self):
        src = "var BettermapState = x; BettermapUmm.register(); POI_DATA[0]; URN_DATA.a;\n"
        self.assertEqual(bb.rename(src),
                         "var QolLiteMapState = x; QolLiteMapUmmAdapter.register(); "
                         "QolLiteMapPoiData[0]; QolLiteMapUrnData.a;\n")

    def test_load_bearing_names_kept(self):
        src = 'var MOD_ID = "bettermap", MOD_NAME = "BetterMap"; $.Msg("[BetterMap] x"); "bm_urn BmMinimalMap"\n'
        self.assertEqual(bb.rename(src), src)

    def test_word_boundary(self):
        # Only a capitalised suffix is a module global; MY_POI_DATA is someone else's name.
        src = "Bettermapx; MY_POI_DATA; POI_DATA_X\n"
        self.assertEqual(bb.rename(src), src)

    def test_file_names_in_comments(self):
        src = "// see bettermap_log.js and bettermap.js, poi_data.js\n"
        self.assertEqual(bb.rename(src),
                         "// see qollite_map_log.js and qollite_map_bootstrap.js, qollite_map_poi_data.js\n")

    def test_path_qualified_file_names_untouched(self):
        src = "// upstream mod/panorama/scripts/bettermap_log.js\n"
        self.assertEqual(bb.rename(src), src)

    def test_leftovers_detected(self):
        self.assertEqual(bb.leftovers("x BettermapFoo; y bettermap_x.js; POI_DATA"),
                         ["BettermapFoo", "POI_DATA", "bettermap_x.js"])
        self.assertEqual(bb.leftovers("QolLiteMapState"), [])

    def test_leftovers_agree_with_rename_on_paths(self):
        # rename() keeps path-qualified names on purpose; leftovers() must not then reject them.
        self.assertEqual(bb.leftovers(bb.rename("// mod/panorama/scripts/bettermap_store.js\n")), [])

    def test_leftovers_catch_irregular_names(self):
        self.assertEqual(bb.leftovers("// see bettermap.js and urn_data.js"),
                         ["bettermap.js", "urn_data.js"])
        self.assertEqual(bb.leftovers("qollite_map_poi_data.js qollite_map_bootstrap.js"), [])

    def test_transform_fails_on_unrenamed(self):
        # `Bettermap` alone (no capital suffix) survives rename() and must stop the build.
        with self.assertRaises(bc.BundleError):
            bb.transform("bettermap_log.js", "var Bettermap = 1;\n", "abc1234")

    def test_eol_matches_text_mode_git_show(self):
        self.assertEqual(bb.normalise_eol("a\r\nb\rc\n"), "a\nb\nc\n")


class BetterMapFiles(unittest.TestCase):
    def test_every_output_is_prefixed_and_unique(self):
        outs = list(bb.FILES.values())
        self.assertEqual(len(outs), len(set(outs)))
        for name in outs:
            self.assertTrue(name.startswith(bb.OUT_PREFIX) and name.endswith(".js"), name)

    def test_irregular_names(self):
        self.assertEqual(bb.FILES["bettermap.js"], "qollite_map_bootstrap.js")
        self.assertEqual(bb.FILES["bettermap_umm.js"], "qollite_map_umm_adapter.js")
        self.assertEqual(bb.FILES["poi_data.js"], "qollite_map_poi_data.js")

    def test_every_delta_targets_a_bundled_file(self):
        self.assertLessEqual(set(bb.DELTAS), set(bb.FILES.values()))

    def test_bettermap_3_modules(self):
        for mod in ("schema", "draw", "icons", "apply", "store_codec", "store",
                    "settings_bus", "slider", "popup"):
            self.assertEqual(bb.FILES[f"bettermap_{mod}.js"], f"qollite_map_{mod}.js")
        # Removed upstream in 3.0 (the in-HUD settings panel; player sizing moved to icons).
        self.assertNotIn("bettermap_settings.js", bb.FILES)
        self.assertNotIn("bettermap_player.js", bb.FILES)

    def test_unlisted_upstream_module_fails(self):
        listed = [f"{bb.UPSTREAM_DIR}/{up}" for up in bb.FILES]
        bb.check_listing(listed)
        with self.assertRaises(bc.BundleError):
            bb.check_listing(listed + [f"{bb.UPSTREAM_DIR}/bettermap_new.js"])

    def test_listed_module_missing_upstream_fails(self):
        with self.assertRaises(bc.BundleError):
            bb.check_listing([f"{bb.UPSTREAM_DIR}/bettermap_log.js"])

    def test_no_local_deltas(self):
        # "Minimalist Map Opacity" was dropped at BetterMap 3.0: upstream's Map Opacity
        # covers it, and 3.0 resets every UMM-saved BetterMap value anyway (docs/BUNDLE.md).
        self.assertEqual(bb.DELTAS, {})

    def test_header(self):
        h = bb.header("abc1234", "bettermap_log.js")
        self.assertIn("github.com/gfkm/BetterMap @ abc1234, mod/panorama/scripts/bettermap_log.js\n", h)
        self.assertEqual(h.count("\n"), 6)


class BetterMapDeltas(unittest.TestCase):
    DELTAS = {"f.js": [("anchor\n", "anchor\npatched\n")]}

    def test_applies(self):
        self.assertEqual(bb.apply_deltas("f.js", "a\nanchor\nb\n", self.DELTAS), "a\nanchor\npatched\nb\n")

    def test_missing_anchor_fails_loudly(self):
        with self.assertRaises(bc.BundleError):
            bb.apply_deltas("f.js", "a\nb\n", self.DELTAS)

    def test_ambiguous_anchor_fails_loudly(self):
        with self.assertRaises(bc.BundleError):
            bb.apply_deltas("f.js", "anchor\nanchor\n", self.DELTAS)

    def test_file_without_deltas_passes_through(self):
        self.assertEqual(bb.apply_deltas("other.js", "x\n", self.DELTAS), "x\n")


class MerRename(unittest.TestCase):
    def test_globals_longest_first(self):
        self.assertEqual(bm.rename_globals("NotifClockBridge.a(); NotifClock.b();"),
                         "QolLiteNotificationsClockBridge.a(); QolLiteNotificationsClock.b();")

    def test_globals_word_boundary(self):
        self.assertEqual(bm.rename_globals("NotifLogger; MY_NOTIF_CONFIG; NOTIF_CONFIG"),
                         "NotifLogger; MY_NOTIF_CONFIG; QolLiteNotificationsConfig")

    def test_file_names(self):
        self.assertEqual(bm.rename_files("// notif.js loads notif_umm.js and event_schedule.js\n"),
                         "// qollite_notifications_bootstrap.js loads qollite_notifications_umm_adapter.js"
                         " and qollite_notifications_event_schedule.js\n")

    def test_path_qualified_and_suffixed_names_untouched(self):
        src = "// mod/panorama/scripts/notif.js x.notif.js notif.jsx my_notif.js\n"
        self.assertEqual(bm.rename_files(src), src)

    def test_every_output_is_unique(self):
        outs = [bm.bundled_name(u) for u in bm.FILES]
        self.assertEqual(len(set(outs)), len(bm.FILES))
        self.assertEqual(bm.bundled_name("notif.js"), "qollite_notifications_bootstrap.js")
        self.assertEqual(bm.bundled_name("notif_urn.js"), "qollite_notifications_urn_detector.js")


class MerDebug(unittest.TestCase):
    SRC = "var x;\nvar DEBUG = true; // upstream note\n    // continued note\nvar y;\n"

    def test_flips_and_replaces_comment(self):
        out = bm.disable_debug(self.SRC)
        self.assertEqual(out, "var x;\n" + bm.DEBUG_OFF + "var y;\n")
        self.assertNotIn("DEBUG = true", out)

    def test_missing_fails(self):
        with self.assertRaises(bc.BundleError):
            bm.disable_debug("var DEBUG = false;\n")

    def test_duplicate_fails(self):
        with self.assertRaises(bc.BundleError):
            bm.disable_debug(self.SRC + self.SRC)

    def test_only_log_file_is_flipped(self):
        out = bm.transform("notif_config.js", "var DEBUG = true;\nx\n", "abc1234")
        self.assertIn("var DEBUG = true;", out)
        out = bm.transform("notif_log.js", self.SRC, "abc1234")
        self.assertIn("var DEBUG = false;", out)


class MerAscii(unittest.TestCase):
    def test_string_literals_escaped(self):
        self.assertEqual(bm.to_ascii('var s = "\u0420\u0443"; var t = \'\u00e9\'; var u = `\u2014`;'),
                         'var s = "\\u0420\\u0443"; var t = \'\\u00e9\'; var u = `\\u2014`;')

    def test_comments_transliterated(self):
        self.assertEqual(bm.to_ascii("// a \u2014 b \u2192 c\u2026\n/* \u201cq\u201d \u2019 */"),
                         '// a - b -> c...\n/* "q" \' */')

    def test_escaped_quote_does_not_end_string(self):
        self.assertEqual(bm.to_ascii('"a\\"\u00e9" // \u2014'), '"a\\"\\u00e9" // -')

    def test_comment_markers_inside_strings_ignored(self):
        self.assertEqual(bm.to_ascii('"http://x \u00e9"'), '"http://x \\u00e9"')

    def test_line_comment_ends_at_newline(self):
        self.assertEqual(bm.to_ascii('// c\n"\u00e9"'), '// c\n"\\u00e9"')

    def test_unmapped_comment_char_fails(self):
        with self.assertRaises(bc.BundleError):
            bm.to_ascii("// \u00e9\n")

    def test_transform_output_is_ascii_with_header(self):
        out = bm.transform("notif_strings.js", 'var NOTIF_STRINGS = { ru: "\u0420" }; // \u2014\n', "abc1234")
        self.assertTrue(all(ord(c) < 128 for c in out))
        self.assertTrue(out.startswith("// Bundled from Map Event Reminders (github.com/gfkm/MapEventReminders)"
                                       " @ abc1234, mod/panorama/scripts/notif_strings.js.\n"))
        self.assertIn('var QolLiteNotificationsStrings = { ru: "\\u0420" }; // -\n', out)

    def test_transform_rejects_cr(self):
        with self.assertRaises(bc.BundleError):
            bm.transform("notif_config.js", "x\r\n", "abc1234")


class Common(unittest.TestCase):
    def test_short_sha(self):
        self.assertEqual(bc.short_sha(SHA), "0123456")

    def _tree(self, tmp, files):
        for name, data in files.items():
            with open(os.path.join(tmp, name), "wb") as fh:
                fh.write(data)

    def test_compare_identical(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._tree(tmp, {"p_a.js": b"a\n"})
            self.assertEqual(bc.compare({"p_a.js": "a\n"}, tmp, "p_"), [])

    def test_compare_ignores_crlf_checkout(self):
        # A Windows checkout with text=auto holds CRLF while git stores LF;
        # that must not read as a difference (it did, and --check lied).
        with tempfile.TemporaryDirectory() as tmp:
            self._tree(tmp, {"p_a.js": b"a\r\nb\r\n"})
            self.assertEqual(bc.compare({"p_a.js": "a\nb\n"}, tmp, "p_"), [])

    def test_compare_still_sees_content_change(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._tree(tmp, {"p_a.js": b"a\r\n"})
            self.assertEqual(bc.compare({"p_a.js": "b\n"}, tmp, "p_"), [("DIFF", "p_a.js")])

    def test_write_keeps_crlf_and_skips_crlf_twin(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._tree(tmp, {"p_same.js": b"s\r\n", "p_edit.js": b"old\r\n"})
            written = bc.write({"p_same.js": "s\n", "p_edit.js": "x\ny\n", "p_new.js": "n\n"}, tmp)
            self.assertEqual(sorted(written), ["p_edit.js", "p_new.js"])
            with open(os.path.join(tmp, "p_edit.js"), "rb") as fh:
                self.assertEqual(fh.read(), b"x\r\ny\r\n")
            with open(os.path.join(tmp, "p_new.js"), "rb") as fh:
                self.assertEqual(fh.read(), b"n\r\n")

    def test_compare_missing_and_extra(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._tree(tmp, {"p_old.js": b"x", "other.js": b"y"})
            self.assertEqual(bc.compare({"p_a.js": "a\n"}, tmp, "p_"),
                             [("MISSING", "p_a.js"), ("EXTRA", "p_old.js")])

    def test_write_is_lf_and_skips_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._tree(tmp, {"p_same.js": b"s\n"})
            written = bc.write({"p_same.js": "s\n", "p_new.js": "a\nb\n"}, tmp)
            self.assertEqual(written, ["p_new.js"])
            with open(os.path.join(tmp, "p_new.js"), "rb") as fh:
                self.assertEqual(fh.read(), b"a\nb\n")


if __name__ == "__main__":
    unittest.main()
