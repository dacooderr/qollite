// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 8d87d86, mod/panorama/scripts/bettermap_minimap.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Read-only probes into Valve's C++ HudMinimap - the one place that knows where
// the engine hangs its state classes. The engine sets them on #hud_minimap or
// above (hud_minimap.css: `.invert_map.HudMinimap`,
// `.dl_midtown.is_underground .backgroundImage1`, `.useZoomedMinimap #hud_minimap`),
// so walking up from a panel inside it finds each class wherever it lives.
//
// The anchor is #MinimapBackgroundTest (hud_minimap.xml, present in the
// 2026-07 build and in 6722). Build 6722 deleted #map_render, the previous
// anchor, which silently turned every level/targeting/invert check into false.
var QolLiteMapMinimap = (function () {
    var ANCHOR_ID = "MinimapBackgroundTest";

    function _panel(id) {
        var ctx = $.GetContextPanel();
        return ctx ? ctx.FindChildTraverse(id) : null;
    }

    function anchor() { return _panel(ANCHOR_ID); }

    function hasClassAbove(cls) {
        var node = anchor();
        while (node) {
            if (node.BHasClass && node.BHasClass(cls)) { return true; }
            node = node.GetParent ? node.GetParent() : null;
        }
        return false;
    }

    // Team 2 (Sapphire / Archmother) sees the minimap turned 180deg: Valve sets
    // `invert_map` on #hud_minimap and flips the whole panel with
    // `.invert_map.HudMinimap { transform: scaleY(-1) scaleX(-1) }`, while the
    // engine keeps placing markers in world orientation. Our overlay lives outside
    // that panel, so every mod marker must be mirrored the same way - positions
    // only, never the marker itself (a flipped panel would render text upside down).
    function isInverted() { return hasClassAbove("invert_map"); }

    // World-oriented minimap u/v (0..1, pipeline data) -> where it is drawn now.
    function toScreen(u, v) {
        return isInverted() ? { u: 1 - u, v: 1 - v } : { u: u, v: v };
    }

    // ---- DEBUG-only probes (build 6722 study; the debugger's JS console does not
    // execute in the retail client, so the mod itself reports into console.log) ----
    var PROBE_CENSUS_SEC = [20, 200, 620];  // real seconds after HUD load; ~3:00/~10:00 game time when loaded near match start
    var PROBE_CLASS_POLL_SEC = 0.5;
    var PROBE_CLASSES = ["dl_midtown", "is_underground", "in_tunnels", "useZoomedMinimap",
                         "invert_map", "map_targeting", "gScoreboardOpen", "ShowNewMinimap"];
    var _probeClassKey = null;

    // Which engine .map_button markers exist, grouped by panel type + id, and
    // whether Panorama exposes any entity API - the two ways crates could be
    // tracked natively (see docs/knowledge/build_6722_changes.md).
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

    // Logs the engine state classes each time the set changes (surface ->
    // underground -> rat tunnels) to confirm where hasClassAbove finds them.
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
