// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_overlay.js
"use strict";

var QolLiteMapOverlay = (function () {
    var POLL_SEC = 1;
    var VALVE_LINE_ID = "ClientServerDebugStats";
    var SHOWN_CLASS = "BmCreditShown";
    var HIDEOUT_CLASS = "InHideout";
    var DETAILED_CLASS = "Detailed";

    function _valveLineShown(label) {
        if (!label || !label.text) { return false; }
        if (label.BHasClass(DETAILED_CLASS)) { return false; }
        for (var p = label.GetParent(); p; p = p.GetParent()) {
            if (p.BHasClass(HIDEOUT_CLASS)) { return false; }
        }
        return true;
    }

    function _tick() {
        try {
            var root = $.GetContextPanel();
            if (root) { root.SetHasClass(SHOWN_CLASS, _valveLineShown(root.FindChildTraverse(VALVE_LINE_ID))); }
        } catch (e) {
            $.Msg("[BetterMap] overlay: " + e);
        }
        $.Schedule(POLL_SEC, _tick);
    }

    _tick();
    return {};
})();
