// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 5ac7816, mod/panorama/scripts/bettermap_draw.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Minimap drawing rules shared by qollite_map_position.js and qollite_map_poi.js.
var QolLiteMapDraw = (function () {
    var EDGE_GAP = 15;   // min edge margin (vanilla ~15px) so the map never sits flush
    // Markers are tiny, so type is conveyed by colour alone (owner directive); the player
    // picks each type's colour (spec docs/specs/2026-10-01-healing-apples-and-marker-colors.md).
    // POI type -> its colour setting in qollite_map_schema.js.
    var POI_COLOR_KEY = { crate: "poiCrateColor", statue: "poiStatueColor", tough: "poiToughColor", apple: "poiAppleColor" };
    // Valve's colour track, the one the settings window's colour slider draws
    // (panorama/styles/popups/settings_color_slider.css .ColorSliderTrack, build 6728):
    // a colour setting stores a position on it (spec C5), and the HUD has no colour
    // slider to ask, so the colour is derived here.
    var PALETTE = [
        [0, [0, 0, 0]], [0.08, [255, 0, 0]], [0.22, [255, 255, 0]], [0.36, [0, 255, 0]],
        [0.50, [0, 255, 255]], [0.64, [0, 0, 255]], [0.78, [255, 0, 255]], [0.92, [255, 0, 0]],
        [1, [255, 255, 255]]
    ];
    // Channels round down (probe P3's readbacks do); the epsilon
    // keeps a channel whose exact value is an integer (every stop, and e.g. 0.108 -> 51)
    // from flooring one low through float error.
    var ROUND_EPS = 1e-9;

    function frac(v) { v = Number(v); if (isNaN(v)) { return 0; } return Math.max(-1, Math.min(1, v)); }

    // Margin from the anchored edge: a fixed EDGE_GAP plus `f` of the travel
    // beyond it, never pushing the far edge past the opposite side. Negative f
    // walks from EDGE_GAP down to -M/2 (map centre on the edge; owner 2026-09-30:
    // at most half off-screen).
    function margin(f, span, M) {
        if (f < 0) { return Math.round(EDGE_GAP + f * (EDGE_GAP + M / 2)); }
        var free = Math.max(0, span - M - EDGE_GAP);
        return Math.round(Math.min(EDGE_GAP + f * free, Math.max(0, span - M)));
    }

    // Where the map sits inside its bounds (the clamp container): margins from the
    // right and bottom edges, in the units of `bounds`. The map is always anchored
    // bottom-right (D18: the corner setting was removed; offset 100% reaches the
    // left / top edge, so the offsets cover every position).
    function placement(state, bounds, mapSize) {
        var fx = frac(state.minimapOffsetX), fy = frac(state.minimapOffsetY);
        return { fx: fx, fy: fy, marginH: margin(fx, bounds.w, mapSize), marginV: margin(fy, bounds.h, mapSize) };
    }

    function paletteRgb(pos) {
        var p = Number(pos);
        if (isNaN(p)) { p = 0; }
        p = Math.max(0, Math.min(1, p));
        for (var i = 1; i < PALETTE.length; i++) {
            if (p <= PALETTE[i][0]) {
                var a = PALETTE[i - 1], b = PALETTE[i];
                var t = (p - a[0]) / (b[0] - a[0]);
                var out = [];
                for (var c = 0; c < 3; c++) { out.push(Math.floor(a[1][c] + (b[1][c] - a[1][c]) * t + ROUND_EPS)); }
                return out;
            }
        }
        return PALETTE[PALETTE.length - 1][1].slice();
    }

    function hasPoiType(t) { return Object.prototype.hasOwnProperty.call(POI_COLOR_KEY, t); }
    function colorKey(t) { return hasPoiType(t) ? POI_COLOR_KEY[t] : null; }

    // pos: the type's palette position (state[colorKey(t)]).
    function poiColor(t, pos, opacity) {
        if (!hasPoiType(t)) { return null; }
        var rgb = paletteRgb(pos);
        return "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", " + Number(opacity).toFixed(2) + ")";
    }

    return { EDGE_GAP: EDGE_GAP, frac: frac, margin: margin, placement: placement,
             paletteRgb: paletteRgb, hasPoiType: hasPoiType, colorKey: colorKey, poiColor: poiColor };
})();
