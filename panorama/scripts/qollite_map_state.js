// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ ca29290, mod/panorama/scripts/bettermap_state.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

var QolLiteMapState = (function () {
    var DEFAULTS = {
        poiCratesEnabled: false,
        poiStatuesEnabled: false,
        poiToughEnabled: false,    // 6722 tough crates (heavy melee, big gold)
        poiLevelMode: "auto",      // "auto" = follow is_underground, "both" = show all levels
        poiMarkerSizePx: 3,
        poiOpacity: 0.8,
        poiFrom3Min: true,        // hide each POI until its own spawn time (3:00/5:00/10:00 on 6722); key name kept for saved settings
        minimapSizePx: 400,
        minimapSizeMinPx: 200,
        minimapSizeMaxPx: 800,
        minimapSizeStepPx: 20,
        mapOpacity: 0.95,
        minimapCorner: "bottom-right", // "bottom-right" | "bottom-left" | "top-right" | "top-left"
        minimapOffsetX: 0,             // -1..1: >0 fraction of the free travel from the anchored horizontal edge, <0 past it (max half off-screen)
        minimapOffsetY: 0,             // -1..1: same for the anchored vertical edge
        hudFullWidth: false,           // lift the clamp_width cap (6722: Valve 21:9 option, 1920px) -> full monitor width
        minimalMap: false,
        minimalMapOpacity: 0.9,        // QOL Lite local delta (not in upstream BetterMap): map-layer opacity in Minimalist mode
        playerIconScalePct: 100,       // player markers on the minimap, % of Valve's size
        playerIconScaleMinPct: 50,     // limits: one CSS rule per step in hud_minimap.vcss (bm_player_scale_*)
        playerIconScaleMaxPct: 200,
        playerIconScaleStepPct: 10,
        ultLargeMapEnabled: true,      // on by default; enlarge the minimap while aiming a map ability (Mirage Traveler)
        urnTrackerEnabled: false       // off by default (opt-in): predicts an objective, a
                                       // grey-area category in Deadlock - let the player choose it
    };

    var _state = null;

    function reset() {
        _state = {};
        for (var k in DEFAULTS) {
            if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) {
                _state[k] = DEFAULTS[k];
            }
        }
    }

    function get() {
        if (!_state) { reset(); }
        return _state;
    }

    function patch(obj) {
        if (!_state) { reset(); }
        for (var k in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, k)) {
                _state[k] = obj[k];
            }
        }
    }

    reset();

    return {
        DEFAULTS: DEFAULTS,
        get: get,
        patch: patch,
        reset: reset
    };
})();
