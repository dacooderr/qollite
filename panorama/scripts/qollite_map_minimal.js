// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_minimal.js
"use strict";

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
            if (p) { p.style.opacity = on ? "0" : null; }
        }
    }

    function init() {
        _apply();
    }

    function refresh() { _apply(); }

    return { init: init, refresh: refresh };
})();
