// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 0237ebe, mod/panorama/scripts/bettermap_draw.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Minimap drawing rules shared by qollite_map_position.js and qollite_map_poi.js.
var QolLiteMapDraw = (function () {
    var EDGE_GAP = 15;   // min edge margin (vanilla ~15px) so the map never sits flush
    // Markers are tiny, so type is conveyed by colour alone (owner directive):
    // crate = blue, statue = yellow, tough crate = green (the outline colour the
    // game itself gives it: misc.vdata m_colorOutline 50,205,50).
    var POI_RGB = { crate: "74, 158, 255", statue: "255, 207, 74", tough: "50, 205, 50" };

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

    function hasPoiType(t) { return Object.prototype.hasOwnProperty.call(POI_RGB, t); }

    function poiColor(t, opacity) {
        return hasPoiType(t) ? "rgba(" + POI_RGB[t] + ", " + Number(opacity).toFixed(2) + ")" : null;
    }

    return { EDGE_GAP: EDGE_GAP, frac: frac, margin: margin, placement: placement,
             hasPoiType: hasPoiType, poiColor: poiColor };
})();
