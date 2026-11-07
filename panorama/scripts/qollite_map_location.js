// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_location.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Location Label Size (spec docs/specs/2026-10-14-camp-icons-and-location-label.md §5): Valve's district /
// building label next to the minimap, #minimap_location in hud.xml (inside #minimap_persp), scaled with an
// inline pre-transform scale. Inline because the panel is in Valve's HUD tree, outside HudMinimap, where our
// only stylesheet (hud_minimap.vcss) does not reach (probe E4). The scale grows the label about its centre
// (camp probe run 2); 100 % clears the inline value, so Valve's CSS sizes it again.
// Valve precedent: Dota 2 popups/popup_settings.js:34 sets style.preTransformScale2d.
var QolLiteMapLocation = (function () {
    var LABEL_ID = "minimap_location";
    var KEY = "locationLabelScalePct";
    var NATIVE_PCT = 100;

    function _apply() {
        var label = QolLiteMapHud.find(LABEL_ID);
        if (!label) { return; }
        var pct = QolLiteMapSchema.sanitize(KEY, QolLiteMapState.get()[KEY]);
        if (pct === undefined) { pct = NATIVE_PCT; }
        // null clears the inline value (Valve idiom, dota play.js); preTransformScale2d is a base property, so
        // it can be unset, unlike an alias such as margin (camp probe runs 1-8).
        label.style.preTransformScale2d = pct === NATIVE_PCT ? null : String(pct / 100);
    }

    function init() { _apply(); }

    // Re-apply from state (QolLiteMapApply).
    function refresh() { _apply(); }

    return { init: init, refresh: refresh };
})();
