// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 5ac7816, mod/panorama/scripts/bettermap_overlay.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// The credit line's visibility (spec docs/specs/2026-10-04-credit-label.md C2): shown only
// while Valve shows its match / build line at the bottom right - a match, not the hideout, the
// main menu or Valve's detailed debug mode. Loaded only by our generated
// layout/citadel_hud_and_db_overlay.vxml: the always-on overlay is its own JS context, which no
// HUD module reaches. bettermap_overlay.vcss shows #BetterMapCredit and lifts Valve's line
// under SHOWN_CLASS.
var QolLiteMapOverlay = (function () {
    var POLL_SEC = 1;                        // no event for the label's text is known; a credit may appear a second late
    var VALVE_LINE_ID = "ClientServerDebugStats";
    var SHOWN_CLASS = "BmCreditShown";       // on the overlay root
    var HIDEOUT_CLASS = "InHideout";         // Valve's: moves its line to the top left (citadel_hud_and_db_overlay.css:51)
    var DETAILED_CLASS = "Detailed";         // Valve's: the detailed debug stats, top left (:59)

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
            $.Msg("[BetterMap] overlay: " + e);   // QolLiteMapLog lives in the HUD context, not here
        }
        $.Schedule(POLL_SEC, _tick);
    }

    _tick();
    return {};
})();
