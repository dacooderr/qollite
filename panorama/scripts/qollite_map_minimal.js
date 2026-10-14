// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ a9f121a, mod/panorama/scripts/bettermap_minimal.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Minimalist minimap: strips the decorative chrome down to just the map render + markers.
//   - Inside the C++ HudMinimap panel the map's own layers are styled by our hud_minimap.vcss
//     (#hud_minimap.BmMinimalMap ...), which that panel loads: the class goes on #hud_minimap.
//   - Outside it, Valve's frame (the compass image with its world-blur) and blur layer are hidden
//     with inline opacity: our CSS does not reach panels outside the minimap (probe E4, spec §4).
//     Valve's hud.css (6774) gives #minimap_container and #HudMinimapContainer no backing, border
//     radius or world-blur, so nothing is written there.
// The class also stays on #minimap_persp, where it has always been (nothing styles it there now).
var QolLiteMapMinimal = (function () {
    var CLASS = "BmMinimalMap";
    var HIDDEN_IDS = ["minimap_frame", "minimap_blur"];

    function _panel(id) { return QolLiteMapHud.find(id); }

    function _apply() {
        var on = !!QolLiteMapState.get().minimalMap;
        var hud = _panel("hud_minimap");
        if (hud && hud.SetHasClass) { hud.SetHasClass(CLASS, on); }
        var persp = _panel("minimap_persp");
        if (persp && persp.SetHasClass) { persp.SetHasClass(CLASS, on); }
        for (var i = 0; i < HIDDEN_IDS.length; i++) {
            var p = _panel(HIDDEN_IDS[i]);
            // null clears the inline value: Valve's CSS again (Valve idiom, dota play.js).
            if (p) { p.style.opacity = on ? "0" : null; }
        }
    }

    function init() {
        _apply();
    }

    // Re-apply from state (QolLiteMapApply.all).
    function refresh() { _apply(); }

    return { init: init, refresh: refresh };
})();
