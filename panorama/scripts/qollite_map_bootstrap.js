// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3ad1ca1, mod/panorama/scripts/bettermap.js
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
        _run("size", function () { QolLiteMapSize.init(); });
        _run("position", function () { QolLiteMapPosition.init(); });
        _run("poi", function () { QolLiteMapPoi.init(); });
        _run("minimal", function () { QolLiteMapMinimal.init(); });
        _run("icons", function () { QolLiteMapIcons.init(); });
        _run("preview", function () { QolLiteMapPreview.init(); });
        _run("urn", function () { QolLiteMapUrn.init(); });
        _run("umm", function () { QolLiteMapUmmAdapter.init(); });
        // After the features: a load re-applies all of them.
        _run("store", function () {
            QolLiteMapStore.init(function (source) {
                try { QolLiteMapApply.all(); }
                catch (e) { QolLiteMapLog.error("apply after load threw: " + (e && e.message ? e.message : e)); }
                // An open settings window asked before the load finished: push the loaded values.
                QolLiteMapSettingsBus.broadcast();
                QolLiteMapLog.log("settings applied from " + source);
            }, function (values) { QolLiteMapUmmAdapter.seed(values); });
        });
        _run("settings-bus", function () { QolLiteMapSettingsBus.init(); });
        if (typeof QolLiteMapLog !== "undefined") { QolLiteMapLog.log("boot: init() complete"); }
    }

    var _attempts = 0;
    var MAX_ATTEMPTS = 20;

    function _missing() {
        var m = [];
        var need = {
            Log: typeof QolLiteMapLog, Schema: typeof QolLiteMapSchema, State: typeof QolLiteMapState, Draw: typeof QolLiteMapDraw,
            Minimap: typeof QolLiteMapMinimap, Size: typeof QolLiteMapSize, Position: typeof QolLiteMapPosition,
            Poi: typeof QolLiteMapPoi, Minimal: typeof QolLiteMapMinimal, Icons: typeof QolLiteMapIcons,
            Preview: typeof QolLiteMapPreview, Urn: typeof QolLiteMapUrn, Umm: typeof QolLiteMapUmmAdapter,
            Apply: typeof QolLiteMapApply, StoreCodec: typeof QolLiteMapStoreCodec, Store: typeof QolLiteMapStore,
            SettingsBus: typeof QolLiteMapSettingsBus
        };
        for (var k in need) { if (need[k] === "undefined") { m.push(k); } }
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
