#!/usr/bin/env python3
"""Bundle BetterMap into QOL Lite as panorama/scripts/qollite_map_*.js.

BetterMap is a first-party mod with its own repository. Its scripts are
regenerated from an upstream commit by this tool -- editing the bundled copies
here loses the change on the next rebuild (docs/BUNDLE.md).

Transformation (derived from the pre-6711 bundle, closest upstream commit 60fa437):
  * file names: the FILES table (bettermap.js -> qollite_map_bootstrap.js,
    bettermap_umm.js -> qollite_map_umm_adapter.js, bettermap_<x>.js ->
    qollite_map_<x>.js, <x>_data.js -> qollite_map_<x>_data.js)
  * globals: BettermapUmm -> QolLiteMapUmmAdapter, Bettermap<X> -> QolLiteMap<X>,
    POI_DATA -> QolLiteMapPoiData, URN_DATA -> QolLiteMapUrnData; upstream script
    file names mentioned in comments are renamed the same way
  * kept verbatim: "[BetterMap]" log prefix, UMM id "bettermap" / name "BetterMap",
    bm_* / Bm* classes -- load-bearing names, not branding
  * not minified: readable upstream source is shipped on purpose
  * a 6-line provenance header per file
  * QOL Lite local delta on top: "Minimalist Map Opacity" (DELTAS). Each anchor
    must match exactly once, so an upstream change that moves it fails the build
    instead of silently dropping the delta.

Usage:
    python scripts/bundle_bettermap.py --upstream <BetterMap checkout> --rev <commit>
    python scripts/bundle_bettermap.py --upstream <BetterMap checkout> --rev <commit> --check

The upstream checkout is only read (`git show`), never its working tree.

Exit codes:  0 = written / identical   1 = --check found differences   2 = error
"""

import re
import sys

from bundle_common import BundleError, cli, git_show, short_sha

UPSTREAM_URL = "github.com/gfkm/BetterMap"
UPSTREAM_DIR = "mod/panorama/scripts"
OUT_PREFIX = "qollite_map_"

# Upstream file -> bundled file. Not a mechanical rule (umm -> umm_adapter,
# bettermap.js -> bootstrap); the table is the rule. Order follows BetterMap's
# hud.xml script order; it only affects reporting.
FILES = {
    "bettermap_log.js": "qollite_map_log.js",
    "poi_data.js": "qollite_map_poi_data.js",
    "urn_data.js": "qollite_map_urn_data.js",
    "bettermap_state.js": "qollite_map_state.js",
    "bettermap_minimap.js": "qollite_map_minimap.js",
    "bettermap_settings.js": "qollite_map_settings.js",
    "bettermap_size.js": "qollite_map_size.js",
    "bettermap_position.js": "qollite_map_position.js",
    "bettermap_poi.js": "qollite_map_poi.js",
    "bettermap_umm.js": "qollite_map_umm_adapter.js",
    "bettermap_minimal.js": "qollite_map_minimal.js",
    "bettermap_player.js": "qollite_map_player.js",
    "bettermap_preview.js": "qollite_map_preview.js",
    "bettermap_urn.js": "qollite_map_urn.js",
    "bettermap.js": "qollite_map_bootstrap.js",
}

# Anything matching this after renaming is an upstream name that escaped the rules.
LEFTOVER = re.compile(r"\bBettermap\w*|\bPOI_DATA\b|\bURN_DATA\b|\bbettermap_\w+\.js\b")

# ---- QOL Lite local delta: "Minimalist Map Opacity" -------------------------------------------
# Present in the pre-6711 QOL Lite bundle (state key minimalMapOpacity, UMM widget
# minimalMapOpacityPct, in-HUD slider #minimap_minimal_opacity_slider) but in no upstream
# BetterMap commit. Kept so users' saved UMM value keeps applying; ported to build 6711.
# Anchors are matched against the already-renamed source (QolLiteMap* names).
DELTA_TAG = "QOL Lite local delta (not in upstream BetterMap)"

DELTAS = {
    "qollite_map_state.js": [
        ("        minimalMap: false,\n",
         "        minimalMap: false,\n"
         "        minimalMapOpacity: 0.9,        // " + DELTA_TAG + ": map-layer opacity in Minimalist mode\n"),
    ],
    "qollite_map_minimal.js": [
        # apply: fade the map layers while minimal mode is on
        ("        var persp = _panel(\"minimap_persp\");\n"
         "        if (persp && persp.SetHasClass) { persp.SetHasClass(CLASS, on); }\n"
         "    }\n",
         "        var persp = _panel(\"minimap_persp\");\n"
         "        if (persp && persp.SetHasClass) { persp.SetHasClass(CLASS, on); }\n"
         "        _applyMinimalOpacity(on);\n"
         "    }\n"
         "\n"
         "    // " + DELTA_TAG + ": \"Minimalist Map Opacity\".\n"
         "    // The pre-6711 bundle faded #canvas + .backgroundImage. Build 6711 draws the map as\n"
         "    // backgroundImage1..3 whose per-level opacity is Valve CSS (surface / underground /\n"
         "    // rat tunnels), so an inline opacity on them would show every level at once. Their\n"
         "    // common parent, the minimap anchor #MinimapBackgroundTest, has no CSS opacity, so\n"
         "    // the fade goes there. Off: null clears the inline value and hands it back to CSS.\n"
         "    function _minimalOpacity() {\n"
         "        var v = Number(QolLiteMapState.get().minimalMapOpacity);\n"
         "        if (isNaN(v)) { v = QolLiteMapState.DEFAULTS.minimalMapOpacity; }\n"
         "        return Math.max(0, Math.min(1, v));\n"
         "    }\n"
         "\n"
         "    function _applyMinimalOpacity(on) {\n"
         "        var layers = QolLiteMapMinimap.anchor();\n"
         "        if (layers && layers.style) { layers.style.opacity = on ? String(_minimalOpacity()) : null; }\n"
         "    }\n"),
        # sync the in-HUD slider
        ("        if (t && typeof t.SetSelected === \"function\") { t.SetSelected(!!QolLiteMapState.get().minimalMap); }\n"
         "    }\n",
         "        if (t && typeof t.SetSelected === \"function\") { t.SetSelected(!!QolLiteMapState.get().minimalMap); }\n"
         "        var row = _panel(\"minimap_minimal_opacity_slider\");   // " + DELTA_TAG + "\n"
         "        var ctrl = row ? row.FindChildTraverse(\"Slider\") : null;\n"
         "        if (ctrl) { ctrl.value = _minimalOpacity(); }\n"
         "    }\n"),
        # bind the in-HUD slider (before the toggle's early return, so a missing toggle cannot skip it)
        ("    function bindControls() {\n"
         "        var t = _panel(\"minimap_minimal_toggle\");\n",
         "    function bindControls() {\n"
         "        _bindOpacitySlider();\n"
         "        var t = _panel(\"minimap_minimal_toggle\");\n"),
        ("    function init() {\n",
         "    // " + DELTA_TAG + ": the in-HUD \"Minimalist Map Opacity\" slider (0..1 percentage widget).\n"
         "    function _bindOpacitySlider() {\n"
         "        var row = _panel(\"minimap_minimal_opacity_slider\");\n"
         "        var ctrl = row ? row.FindChildTraverse(\"Slider\") : null;\n"
         "        if (!ctrl) { return; }\n"
         "        ctrl.SetPanelEvent(\"onvaluechanged\", function () {\n"
         "            QolLiteMapState.patch({ minimalMapOpacity: Math.max(0, Math.min(1, Math.round(ctrl.value * 100) / 100)) });\n"
         "            _apply();\n"
         "        });\n"
         "    }\n"
         "\n"
         "    function init() {\n"),
    ],
    "qollite_map_umm_adapter.js": [
        ("        { id: \"minimalMap\", type: \"toggle\", label: \"Minimalist Minimap\", key: \"minimalMap\" },\n",
         "        { id: \"minimalMap\", type: \"toggle\", label: \"Minimalist Minimap\", key: \"minimalMap\" },\n"
         "        // " + DELTA_TAG + " - see qollite_map_minimal.js. Widget id kept from the\n"
         "        // pre-6711 bundle so saved values still apply.\n"
         "        {\n"
         "            id: \"minimalMapOpacityPct\", type: \"slider\", label: \"Minimalist Map Opacity\", min: 0, max: 100, step: 5, unit: \"%\",\n"
         "            get: function (s) {\n"
         "                var v = Number(s.minimalMapOpacity);\n"
         "                return Math.round((isNaN(v) ? D.minimalMapOpacity : Math.max(0, Math.min(1, v))) * 100);\n"
         "            },\n"
         "            set: function (v) { return { minimalMapOpacity: Math.max(0, Math.min(1, Number(v) / 100)) }; }\n"
         "        },\n"),
    ],
}


def normalise_eol(text):
    """CRLF and lone CR -> LF. The bundle was first produced by reading `git show`
    in text mode, which applies exactly this universal-newline translation."""
    return text.replace("\r\n", "\n").replace("\r", "\n")


def rename(src, files=FILES):
    src = re.sub(r"\bBettermapUmm\b", "QolLiteMapUmmAdapter", src)
    src = re.sub(r"\bBettermap([A-Z]\w*)", r"QolLiteMap\1", src)
    src = re.sub(r"\bPOI_DATA\b", "QolLiteMapPoiData", src)
    src = re.sub(r"\bURN_DATA\b", "QolLiteMapUrnData", src)
    # Script file names mentioned in comments. The lookbehind leaves path-qualified
    # names (mod/panorama/scripts/bettermap_x.js) alone: those describe upstream.
    for up, ql in files.items():
        src = re.sub(r"(?<![\w/])" + re.escape(up), ql, src)
    return src


def apply_deltas(name, src, deltas=DELTAS):
    for old, new in deltas.get(name, []):
        if src.count(old) != 1:
            raise BundleError(f"delta anchor not unique/absent in {name}: {old[:80]!r}")
        src = src.replace(old, new)
    return src


def leftovers(src):
    return sorted(set(LEFTOVER.findall(src)))


def header(short, up):
    return (
        "// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.\n"
        f"// Upstream: {UPSTREAM_URL} @ {short}, {UPSTREAM_DIR}/{up}\n"
        "// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,\n"
        "// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. \"[BetterMap]\" log prefix, UMM id\n"
        "// \"bettermap\" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the\n"
        "// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.\n"
    )


def transform(up, src, short):
    """One upstream file's text -> the bundled file's text. Pure; no git."""
    name = FILES[up]
    out = apply_deltas(name, rename(normalise_eol(src)))
    left = leftovers(out)
    if left:
        raise BundleError(f"unrenamed identifiers in {name}: {left}")
    return header(short, up) + out


def build(upstream, full_sha):
    short = short_sha(full_sha)
    return {FILES[up]: transform(up, git_show(upstream, full_sha, f"{UPSTREAM_DIR}/{up}"), short)
            for up in FILES}


if __name__ == "__main__":
    sys.exit(cli(__doc__, build, OUT_PREFIX))
