// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 0237ebe, mod/panorama/scripts/bettermap_minimal.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Minimalist minimap: strips the decorative chrome (frame, blur, dark backing,
// old flat background, zipline lanes, neutral/upper overlays) down to just the
// map render + markers. The toggle class is set on BOTH #hud_minimap and
// #minimap_persp because the two sets of layers live in different style scopes:
// the map's own layers are inside the C++ HudMinimap panel (styled by our
// hud_minimap.vcss copy that the panel loads), the frame/blur/backing are our
// wrapper panels in hud.vcss - a class on only one wouldn't reach both.
var QolLiteMapMinimal = (function () {
    var CLASS = "BmMinimalMap";

    function _panel(id) {
        var ctx = $.GetContextPanel();
        return ctx ? ctx.FindChildTraverse(id) : null;
    }

    function _apply() {
        var on = !!QolLiteMapState.get().minimalMap;
        var hud = _panel("hud_minimap");
        if (hud && hud.SetHasClass) { hud.SetHasClass(CLASS, on); }
        var persp = _panel("minimap_persp");
        if (persp && persp.SetHasClass) { persp.SetHasClass(CLASS, on); }
    }

    function init() {
        _apply();
    }

    // Re-apply from state (QolLiteMapApply.all).
    function refresh() { _apply(); }

    return { init: init, refresh: refresh };
})();
