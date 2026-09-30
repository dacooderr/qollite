// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ ca29290, mod/panorama/scripts/bettermap_umm.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// Universal Mod Manager (UMM) adapter.
//
// When a UMM core is present it hosts BetterMap's settings as a tab in its
// shared window AND owns persistence - Panorama has no storage API, and UMM's
// server-side hero-build-description trick is the only channel that survives a
// restart (see docs/knowledge/panorama_notes.md). Standalone is unaffected:
// without UMM this module simply never hears back, and the in-HUD settings panel
// stays the settings UI + there is no persistence (memory only).
//
// Protocol, verified against the decompiled core
// (references/mods/Mod Manager/panorama/scripts/umm_core.js):
//   bus         = "ClientUI_FireOutput"; JSON payloads namespaced by {umm:1}
//   mod  -> core  {umm:1, t:"register", id, name, settings, values}
//   core -> mod   {umm:1, t:"hello"}              (re-announce -> resend register)
//   core -> mod   {umm:1, t:"set", id, key, value}
// The core replays every value back as `set` right after a register, which is
// how a returning player's saved values arrive - we just apply what we're told.
var QolLiteMapUmmAdapter = (function () {
    var CHANNEL = "ClientUI_FireOutput";
    var PROTOCOL = 1;
    var MOD_ID = "bettermap";
    var MOD_NAME = "BetterMap";

    // One entry per UMM widget, mapped to QolLiteMapState. `key` = a 1:1 state
    // key; get/set instead when the widget value needs a transform (level mode
    // <-> bool, opacity fraction <-> integer percent for a nicer slider).
    // `group` entries are UMM section headers (umm_core.js renders them, carries
    // no value); they mirror the in-HUD panel's Overlay / Minimap tabs.
    // Built on first use, not at script load: slider limits come from
    // QolLiteMapState.DEFAULTS and cross-script load order is not guaranteed.
    var SCHEMA = null;

    function _buildSchema() {
        var D = QolLiteMapState.DEFAULTS;
        return [
        { type: "group", label: "Crates & Statues" },
        { id: "poiCratesEnabled",  type: "toggle", label: "Show Crates",         key: "poiCratesEnabled" },
        { id: "poiStatuesEnabled", type: "toggle", label: "Show Golden Statues", key: "poiStatuesEnabled" },
        { id: "poiToughEnabled",   type: "toggle", label: "Show Tough Crates",   key: "poiToughEnabled" },
        { id: "poiFrom3Min",       type: "toggle", label: "Hide Objects Until Spawned", key: "poiFrom3Min" },
        {
            id: "poiLevelAuto", type: "toggle", label: "Auto Level (Underground)",
            get: function (s) { return s.poiLevelMode === "auto"; },
            set: function (v) { return { poiLevelMode: v ? "auto" : "both" }; }
        },
        { id: "poiMarkerSizePx", type: "slider", label: "Marker Size", min: 1, max: 8, step: 1, unit: "px", key: "poiMarkerSizePx" },
        {
            id: "poiOpacityPct", type: "slider", label: "Marker Opacity", min: 10, max: 100, step: 5, unit: "%",
            get: function (s) { return Math.round((Number(s.poiOpacity) || 0.8) * 100); },
            set: function (v) { return { poiOpacity: Math.max(0.01, Math.min(1, v / 100)) }; }
        },
        { id: "urnTrackerEnabled", type: "toggle", label: "Urn Spawn Tracker", key: "urnTrackerEnabled" },
        { type: "group", label: "Minimap" },
        {
            id: "minimapSizePx", type: "slider", label: "Minimap Size", unit: "px", key: "minimapSizePx",
            min: D.minimapSizeMinPx, max: D.minimapSizeMaxPx, step: D.minimapSizeStepPx
        },
        {
            id: "playerIconScalePct", type: "slider", label: "Player Icon Size", unit: "%", key: "playerIconScalePct",
            min: D.playerIconScaleMinPct, max: D.playerIconScaleMaxPct, step: D.playerIconScaleStepPct
        },
        {
            id: "mapOpacityPct", type: "slider", label: "Map Opacity", min: 10, max: 100, step: 5, unit: "%",
            get: function (s) { return Math.round((Number(s.mapOpacity) || 0.95) * 100); },
            set: function (v) { return { mapOpacity: Math.max(0.01, Math.min(1, v / 100)) }; }
        },
        {
            id: "minimapCorner", type: "select", label: "Minimap Corner", key: "minimapCorner",
            options: [
                { value: "bottom-right", label: "Bottom-Right" },
                { value: "bottom-left", label: "Bottom-Left" },
                { value: "top-right", label: "Top-Right" },
                { value: "top-left", label: "Top-Left" }
            ]
        },
        {
            id: "minimapOffsetXPct", type: "slider", label: "Minimap Offset X", min: -100, max: 100, step: 5, unit: "%",
            get: function (s) { return Math.round((Number(s.minimapOffsetX) || 0) * 100); },
            set: function (v) { return { minimapOffsetX: Math.max(-1, Math.min(1, v / 100)) }; }
        },
        {
            id: "minimapOffsetYPct", type: "slider", label: "Minimap Offset Y", min: -100, max: 100, step: 5, unit: "%",
            get: function (s) { return Math.round((Number(s.minimapOffsetY) || 0) * 100); },
            set: function (v) { return { minimapOffsetY: Math.max(-1, Math.min(1, v / 100)) }; }
        },
        { id: "hudFullWidth", type: "toggle", label: "Full-Width HUD", key: "hudFullWidth" },
        { id: "minimalMap", type: "toggle", label: "Minimalist Minimap", key: "minimalMap" },
        // QOL Lite local delta (not in upstream BetterMap) - see qollite_map_minimal.js. Widget id kept from the
        // pre-6711 bundle so saved values still apply.
        {
            id: "minimalMapOpacityPct", type: "slider", label: "Minimalist Map Opacity", min: 0, max: 100, step: 5, unit: "%",
            get: function (s) {
                var v = Number(s.minimalMapOpacity);
                return Math.round((isNaN(v) ? D.minimalMapOpacity : Math.max(0, Math.min(1, v))) * 100);
            },
            set: function (v) { return { minimalMapOpacity: Math.max(0, Math.min(1, Number(v) / 100)) }; }
        },
        { id: "ultLargeMapEnabled", type: "toggle", label: "Larger Map for Traveler (Mirage)", key: "ultLargeMapEnabled" }
        ];
    }

    function _schema() {
        if (!SCHEMA) { SCHEMA = _buildSchema(); }
        return SCHEMA;
    }

    var _present = false;

    function _widgetValue(entry, state) {
        return entry.get ? entry.get(state) : state[entry.key];
    }

    function _send(payload) {
        try { $.DispatchEvent(CHANNEL, JSON.stringify(payload)); } catch (e) {}
    }

    function _register() {
        var state = QolLiteMapState.get();
        var settings = [];
        var values = {};
        var defaults = QolLiteMapState.DEFAULTS;
        var schema = _schema();
        for (var i = 0; i < schema.length; i++) {
            var e = schema[i];
            if (e.type === "group") { settings.push({ type: "group", label: e.label }); continue; }
            var w = { id: e.id, type: e.type, label: e.label };
            if (e.type === "slider") {
                w.min = e.min; w.max = e.max; w.step = e.step; w.unit = e.unit;
            } else if (e.type === "select") {
                w.options = e.options;
            }
            // UMM's reset button restores `default` (umm_core.js createToggle/
            // createSlider/createSelect), so it must be the factory value - the
            // live value would make a re-register (on `hello`) redefine "reset".
            w["default"] = _widgetValue(e, defaults);
            settings.push(w);
            values[e.id] = _widgetValue(e, state);
        }
        _send({ umm: PROTOCOL, t: "register", id: MOD_ID, name: MOD_NAME, settings: settings, values: values });
    }

    // Re-sync every subsystem from state; idempotent, so applying one `set` this
    // way is fine even though it refreshes all three.
    function _applyAll() {
        if (typeof QolLiteMapPoi !== "undefined" && QolLiteMapPoi.refresh) { QolLiteMapPoi.refresh(); }
        if (typeof QolLiteMapSize !== "undefined" && QolLiteMapSize.apply) { QolLiteMapSize.apply(); }
        if (typeof QolLiteMapSize !== "undefined" && QolLiteMapSize.applyClampWidth) { QolLiteMapSize.applyClampWidth(); }
        if (typeof QolLiteMapPosition !== "undefined" && QolLiteMapPosition.apply) { QolLiteMapPosition.apply(); }
        if (typeof QolLiteMapSettings !== "undefined" && QolLiteMapSettings.applyMapOpacity) { QolLiteMapSettings.applyMapOpacity(); }
        if (typeof QolLiteMapMinimal !== "undefined" && QolLiteMapMinimal.refresh) { QolLiteMapMinimal.refresh(); }
        if (typeof QolLiteMapUrn !== "undefined" && QolLiteMapUrn.refresh) { QolLiteMapUrn.refresh(); }
        if (typeof QolLiteMapPlayer !== "undefined" && QolLiteMapPlayer.refresh) { QolLiteMapPlayer.refresh(); }
    }

    function _entryByWidgetId(id) {
        var schema = _schema();
        for (var i = 0; i < schema.length; i++) { if (schema[i].id === id) { return schema[i]; } }
        return null;
    }

    function _onSet(key, value) {
        var e = _entryByWidgetId(key);
        if (!e) { return; }
        var patch = e.set ? e.set(value) : (function () { var o = {}; o[e.key] = value; return o; })();
        QolLiteMapState.patch(patch);
        _applyAll();
        if (typeof QolLiteMapLog !== "undefined") { QolLiteMapLog.log("umm: set " + key + " = " + value); }
    }

    function _markPresent() {
        if (_present) { return; }
        _present = true;
        if (typeof QolLiteMapLog !== "undefined") { QolLiteMapLog.info("umm: core present - deferring settings UI to UMM"); }
        // UMM now hosts settings + persistence; retire our own in-HUD panel so
        // there is one source of truth. (Standalone stays the no-UMM fallback.)
        if (typeof QolLiteMapSettings !== "undefined" && QolLiteMapSettings.setUmmActive) {
            QolLiteMapSettings.setUmmActive(true);
        }
    }

    function _onMessage(payload) {
        if (typeof payload !== "string" || payload.indexOf("\"umm\"") === -1) { return; }
        var msg;
        try { msg = JSON.parse(payload); } catch (e) { return; }
        if (!msg || msg.umm !== PROTOCOL) { return; }

        if (msg.t === "hello") {
            _markPresent();
            _register();
        } else if (msg.t === "set" && msg.id === MOD_ID) {
            _markPresent();
            _onSet(msg.key, msg.value);
        }
    }

    function init() {
        try { $.RegisterForUnhandledEvent(CHANNEL, _onMessage); } catch (e) {}
        _register();
    }

    return { init: init };
})();
