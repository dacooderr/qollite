// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap_minimap.js
"use strict";

var QolLiteMapMinimap = (function () {
    var ANCHOR_ID = "MinimapBackgroundTest";

    function _panel(id) { return QolLiteMapHud.find(id); }

    function anchor() { return _panel(ANCHOR_ID); }

    function hasClassAbove(cls) {
        var node = anchor();
        while (node) {
            if (node.BHasClass && node.BHasClass(cls)) { return true; }
            node = node.GetParent ? node.GetParent() : null;
        }
        return false;
    }

    function isInverted() { return hasClassAbove("invert_map"); }

    function toScreen(u, v) {
        return isInverted() ? { u: 1 - u, v: 1 - v } : { u: u, v: v };
    }

    var PROBE_CENSUS_SEC = [20, 200, 620];
    var PROBE_CLASS_POLL_SEC = 0.5;
    var PROBE_CLASSES = ["dl_midtown", "is_underground", "in_tunnels", "useZoomedMinimap",
                         "invert_map", "map_targeting", "gScoreboardOpen", "gMinimapTargeting", "ShowNewMinimap"];
    var _probeClassKey = null;

    function _probeCensus() {
        var hud = _panel("hud_minimap");
        if (!hud) { QolLiteMapLog.log("probe: no #hud_minimap"); return; }
        var members = [];
        for (var k in hud) { members.push(k); }
        var buttons = hud.FindChildrenWithClassTraverse ? hud.FindChildrenWithClassTraverse("map_button") : [];
        var groups = {};
        for (var i = 0; i < buttons.length; i++) {
            var n = buttons[i].paneltype + "#" + buttons[i].id;
            groups[n] = (groups[n] || 0) + 1;
        }
        QolLiteMapLog.log("probe: globals Entities=" + typeof Entities + " Players=" + typeof Players +
            " Game=" + typeof Game + " GameUI=" + typeof GameUI + " GameEvents=" + typeof GameEvents);
        QolLiteMapLog.log("probe: panel members " + members.join(","));
        QolLiteMapLog.log("probe: map_button x" + buttons.length + " " + JSON.stringify(groups));
    }

    function _probeClasses() {
        var hud = _panel("hud_minimap");
        var on = [];
        for (var i = 0; i < PROBE_CLASSES.length; i++) {
            var c = PROBE_CLASSES[i];
            var self = !!(hud && hud.BHasClass && hud.BHasClass(c));
            if (self) { on.push(c + "@hud_minimap"); }
            else if (hasClassAbove(c)) { on.push(c + "@ancestor"); }
        }
        var key = on.join(" ");
        if (key !== _probeClassKey) {
            _probeClassKey = key;
            QolLiteMapLog.log("probe: minimap classes [" + key + "]");
        }
        $.Schedule(PROBE_CLASS_POLL_SEC, _probeClasses);
    }

    function init() {
        if (!anchor()) { QolLiteMapLog.error("minimap: anchor #" + ANCHOR_ID + " not found - level detection is off"); }
        if (QolLiteMapLog.isDebug()) {
            for (var i = 0; i < PROBE_CENSUS_SEC.length; i++) { $.Schedule(PROBE_CENSUS_SEC[i], _probeCensus); }
            _probeClasses();
        }
    }

    return { init: init, anchor: anchor, hasClassAbove: hasClassAbove, isInverted: isInverted, toScreen: toScreen };
})();
