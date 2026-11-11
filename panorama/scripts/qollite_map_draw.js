// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_draw.js
"use strict";

var QolLiteMapDraw = (function () {
    var EDGE_GAP = 15;
    var POI_COLOR_KEY = { crate: "poiCrateColor", statue: "poiStatueColor", tough: "poiToughColor", apple: "poiAppleColor" };
    var PALETTE = [
        [0, [0, 0, 0]], [0.08, [255, 0, 0]], [0.22, [255, 255, 0]], [0.36, [0, 255, 0]],
        [0.50, [0, 255, 255]], [0.64, [0, 0, 255]], [0.78, [255, 0, 255]], [0.92, [255, 0, 0]],
        [1, [255, 255, 255]]
    ];
    var ROUND_EPS = 1e-9;

    function frac(v) { v = Number(v); if (isNaN(v)) { return 0; } return Math.max(-1, Math.min(1, v)); }

    function margin(f, span, M) {
        if (f < 0) { return Math.round(EDGE_GAP + f * (EDGE_GAP + M / 2)); }
        var free = Math.max(0, span - M - EDGE_GAP);
        return Math.round(Math.min(EDGE_GAP + f * free, Math.max(0, span - M)));
    }

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

    function poiColor(t, pos, opacity) {
        if (!hasPoiType(t)) { return null; }
        var rgb = paletteRgb(pos);
        return "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", " + Number(opacity).toFixed(2) + ")";
    }

    return { EDGE_GAP: EDGE_GAP, frac: frac, margin: margin, placement: placement,
             paletteRgb: paletteRgb, hasPoiType: hasPoiType, colorKey: colorKey, poiColor: poiColor };
})();
