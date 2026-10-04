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
  * QOL Lite local deltas on top (DELTAS) -- none since BetterMap 3.0. Each anchor
    must match exactly once, so an upstream change that moves it fails the build
    instead of silently dropping the delta.
  * every upstream script must be in FILES and every FILES entry upstream, so a
    module added or removed upstream fails the build instead of being skipped

Usage:
    python scripts/bundle_bettermap.py --upstream <BetterMap checkout> --rev <commit>
    python scripts/bundle_bettermap.py --upstream <BetterMap checkout> --rev <commit> --check

The upstream checkout is only read (`git show`), never its working tree.

Exit codes:  0 = written / identical   1 = --check found differences   2 = error
"""

import re
import sys

from bundle_common import BundleError, cli, git, git_show, short_sha

UPSTREAM_URL = "github.com/gfkm/BetterMap"
UPSTREAM_DIR = "mod/panorama/scripts"
OUT_PREFIX = "qollite_map_"

# Upstream file -> bundled file. Not a mechanical rule (umm -> umm_adapter,
# bettermap.js -> bootstrap); the table is the rule. Order follows BetterMap's
# hud.xml script order, then the settings window's; it only affects reporting.
FILES = {
    "bettermap_log.js": "qollite_map_log.js",
    "poi_data.js": "qollite_map_poi_data.js",
    "urn_data.js": "qollite_map_urn_data.js",
    "bettermap_schema.js": "qollite_map_schema.js",
    "bettermap_state.js": "qollite_map_state.js",
    "bettermap_draw.js": "qollite_map_draw.js",
    "bettermap_minimap.js": "qollite_map_minimap.js",
    "bettermap_size.js": "qollite_map_size.js",
    "bettermap_position.js": "qollite_map_position.js",
    "bettermap_poi.js": "qollite_map_poi.js",
    "bettermap_umm.js": "qollite_map_umm_adapter.js",
    "bettermap_minimal.js": "qollite_map_minimal.js",
    "bettermap_icons.js": "qollite_map_icons.js",
    "bettermap_preview.js": "qollite_map_preview.js",
    "bettermap_urn.js": "qollite_map_urn.js",
    "bettermap_apply.js": "qollite_map_apply.js",
    "bettermap_store_codec.js": "qollite_map_store_codec.js",
    "bettermap_store.js": "qollite_map_store.js",
    "bettermap_settings_bus.js": "qollite_map_settings_bus.js",
    "bettermap.js": "qollite_map_bootstrap.js",
    # Loaded by the settings window (popups/popup_settings.xml), not the HUD.
    "bettermap_slider.js": "qollite_map_slider.js",
    "bettermap_popup.js": "qollite_map_popup.js",
    # Loaded by the always-on overlay (citadel_hud_and_db_overlay.xml): the credit line.
    "bettermap_overlay.js": "qollite_map_overlay.js",
}

# Modules upstream has deleted, under the names they were bundled as. Not bundled (FILES is the
# build); only so that upstream comments naming them are renamed instead of failing the build.
RETIRED = {
    "bettermap_settings.js": "qollite_map_settings.js",   # in-HUD settings panel, removed in 3.0
    "bettermap_player.js": "qollite_map_player.js",       # replaced by bettermap_icons.js in 3.0
}

# Anything matching this after renaming is an upstream name that escaped the rules. File names
# use rename()'s lookbehind: a path-qualified name describes upstream and is kept on purpose.
LEFTOVER = re.compile(r"\bBettermap\w*|\bPOI_DATA\b|\bURN_DATA\b"
                      r"|(?<![\w/])(?:bettermap(?:_\w+)?|poi_data|urn_data)\.js\b")

# ---- QOL Lite local deltas ----------------------------------------------------------------
# {bundled file: [(anchor, replacement), ...]}, matched against the already-renamed source.
# Empty since BetterMap 3.0: the one delta, "Minimalist Map Opacity", was dropped there
# (docs/BUNDLE.md section 3). Label any new one with DELTA_TAG.
DELTA_TAG = "QOL Lite local delta (not in upstream BetterMap)"

DELTAS = {}


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
    for up, ql in list(files.items()) + list(RETIRED.items()):
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


def check_listing(paths):
    """`paths`: the .js files under UPSTREAM_DIR at the commit. Fails on a module
    FILES does not know (it would ship unbundled) or one upstream no longer has."""
    names = {p[len(UPSTREAM_DIR) + 1:] for p in paths if p.endswith(".js")}
    extra = sorted(names - set(FILES))
    gone = sorted(set(FILES) - names)
    if extra or gone:
        raise BundleError(f"FILES out of date with upstream: not in FILES {extra}, gone upstream {gone}")


def build(upstream, full_sha):
    short = short_sha(full_sha)
    check_listing(git(upstream, "ls-tree", "--name-only", full_sha, UPSTREAM_DIR + "/")
                  .decode("utf-8").split())
    return {FILES[up]: transform(up, git_show(upstream, full_sha, f"{UPSTREAM_DIR}/{up}"), short)
            for up in FILES}


if __name__ == "__main__":
    sys.exit(cli(__doc__, build, OUT_PREFIX))
