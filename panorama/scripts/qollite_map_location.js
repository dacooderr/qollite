// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_location.js
"use strict";

var QolLiteMapLocation = (function () {
    var LABEL_ID = "minimap_location";
    var KEY = "locationLabelScalePct";
    var NATIVE_PCT = 100;

    function _apply() {
        var label = QolLiteMapHud.find(LABEL_ID);
        if (!label) { return; }
        var pct = QolLiteMapSchema.sanitize(KEY, QolLiteMapState.get()[KEY]);
        if (pct === undefined) { pct = NATIVE_PCT; }
        label.style.preTransformScale2d = pct === NATIVE_PCT ? null : String(pct / 100);
    }

    function init() { _apply(); }

    function refresh() { _apply(); }

    return { init: init, refresh: refresh };
})();
