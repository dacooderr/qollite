// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3d4444c, mod/panorama/scripts/bettermap.js
"use strict";

(function () {
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

    var _featuresStarted = false;

    function _onHudBuild(n) {
        if (!_featuresStarted) { return; }
        try { QolLiteMapApply.all(); }
        catch (e) { QolLiteMapLog.error("apply after hud build #" + n + " threw: " + (e && e.message ? e.message : e)); }
    }

    function init() {
        if (typeof QolLiteMapLog !== "undefined") { QolLiteMapLog.info("boot: initializing modules"); }
        _run("hud", function () { QolLiteMapHud.onReady(_onHudBuild); QolLiteMapHud.init(); });
        _run("minimap", function () { QolLiteMapMinimap.init(); });
        _run("view", function () { QolLiteMapView.init(); });
        _run("size", function () { QolLiteMapSize.init(); });
        _run("position", function () { QolLiteMapPosition.init(); });
        _run("tabmap", function () { QolLiteMapTabMap.init(); });
        _run("rotate", function () { QolLiteMapRotate.init(); });
        _run("poi", function () { QolLiteMapPoi.init(); });
        _run("minimal", function () { QolLiteMapMinimal.init(); });
        _run("icons", function () { QolLiteMapIcons.init(); });
        _run("location", function () { QolLiteMapLocation.init(); });
        _run("preview", function () { QolLiteMapPreview.init(); });
        _run("urn", function () { QolLiteMapUrn.init(); });
        _featuresStarted = true;
        _run("umm", function () { QolLiteMapUmmAdapter.init(); });
        _run("store", function () {
            QolLiteMapStore.init(function (source) {
                try { QolLiteMapApply.all(); }
                catch (e) { QolLiteMapLog.error("apply after load threw: " + (e && e.message ? e.message : e)); }
                QolLiteMapSettingsBus.broadcast();
                QolLiteMapLog.log("settings applied from " + source);
            }, function (values) { QolLiteMapUmmAdapter.seed(values); });
        });
        _run("popup", function () { QolLiteMapPopup.init(); });
        _run("settings-mount", function () { QolLiteMapSettingsMount.init(); });
        if (typeof QolLiteMapLog !== "undefined") { QolLiteMapLog.log("boot: init() complete"); }
    }

    var _attempts = 0;
    var MAX_ATTEMPTS = 20;

    function _missing() {
        var m = [];
        var need = {
            Log: typeof QolLiteMapLog, Schema: typeof QolLiteMapSchema, Hud: typeof QolLiteMapHud,
            State: typeof QolLiteMapState, Draw: typeof QolLiteMapDraw,
            Minimap: typeof QolLiteMapMinimap, View: typeof QolLiteMapView, Size: typeof QolLiteMapSize, Position: typeof QolLiteMapPosition,
            TabMap: typeof QolLiteMapTabMap, Rotate: typeof QolLiteMapRotate,
            Poi: typeof QolLiteMapPoi, Minimal: typeof QolLiteMapMinimal, Icons: typeof QolLiteMapIcons,
            Location: typeof QolLiteMapLocation,
            Preview: typeof QolLiteMapPreview, Urn: typeof QolLiteMapUrn, Umm: typeof QolLiteMapUmmAdapter,
            Apply: typeof QolLiteMapApply, StoreCodec: typeof QolLiteMapStoreCodec, Store: typeof QolLiteMapStore,
            SettingsBus: typeof QolLiteMapSettingsBus, Slider: typeof QolLiteMapSlider, Popup: typeof QolLiteMapPopup,
            SettingsNav: typeof QolLiteMapSettingsNav, SettingsMount: typeof QolLiteMapSettingsMount
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
