// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ ca29290, mod/panorama/scripts/bettermap.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

(function () {
    // Run each module init in isolation: a throw in one must not silently abort
    // the rest. (The pre-diagnostic bootstrap chained them, so one failure hid
    // every following init - which is exactly how checkpoint #1 stayed invisible.)
    function _run(name, fn) {
        try {
            fn();
            if (typeof QolLiteMapLog !== "undefined") { QolLiteMapLog.log("init ok: " + name); }
        } catch (e) {
            var msg = "init threw in " + name + ": " + (e && e.message ? e.message : e);
            if (typeof QolLiteMapLog !== "undefined") { QolLiteMapLog.error(msg); }
            else { try { $.Msg("[BetterMap] [ERROR] " + msg); } catch (e2) {} }
        }
    }

    function init() {
        if (typeof QolLiteMapLog !== "undefined") { QolLiteMapLog.info("boot: initializing modules"); }
        _run("minimap", function () { QolLiteMapMinimap.init(); });
        _run("settings", function () { QolLiteMapSettings.init(); });
        _run("size", function () { QolLiteMapSize.init(); });
        _run("position", function () { QolLiteMapPosition.init(); });
        _run("poi", function () { QolLiteMapPoi.init(); });
        _run("minimal", function () { QolLiteMapMinimal.init(); });
        _run("player", function () { QolLiteMapPlayer.init(); });
        _run("preview", function () { QolLiteMapPreview.init(); });
        _run("urn", function () { QolLiteMapUrn.init(); });
        _run("umm", function () { QolLiteMapUmmAdapter.init(); });
        if (typeof QolLiteMapLog !== "undefined") { QolLiteMapLog.log("boot: init() complete"); }
    }

    var _attempts = 0;
    var MAX_ATTEMPTS = 20;

    function _missing() {
        var m = [];
        if (typeof QolLiteMapState === "undefined") m.push("State");
        if (typeof QolLiteMapMinimap === "undefined") m.push("Minimap");
        if (typeof QolLiteMapSettings === "undefined") m.push("Settings");
        if (typeof QolLiteMapSize === "undefined") m.push("Size");
        if (typeof QolLiteMapPosition === "undefined") m.push("Position");
        if (typeof QolLiteMapPoi === "undefined") m.push("Poi");
        if (typeof QolLiteMapMinimal === "undefined") m.push("Minimal");
        if (typeof QolLiteMapPlayer === "undefined") m.push("Player");
        if (typeof QolLiteMapPreview === "undefined") m.push("Preview");
        if (typeof QolLiteMapUrn === "undefined") m.push("Urn");
        if (typeof QolLiteMapUmmAdapter === "undefined") m.push("Umm");
        return m;
    }

    function tryInit() {
        _attempts++;
        var missing = _missing();
        if (missing.length === 0) {
            init();
        } else if (_attempts < MAX_ATTEMPTS) {
            $.Schedule(0.05, tryInit);
        } else {
            var msg = "boot: gave up after " + MAX_ATTEMPTS + " attempts; missing modules: " + missing.join(", ");
            if (typeof QolLiteMapLog !== "undefined") { QolLiteMapLog.error(msg); }
            else { try { $.Msg("[BetterMap] [ERROR] " + msg); } catch (e) {} }
        }
    }

    $.Schedule(0, tryInit);
})();
