// Bundled from BetterMap (gfkm) - do not edit here: change upstream and re-bundle.
// Upstream: github.com/gfkm/BetterMap @ 3ad1ca1, mod/panorama/scripts/bettermap_state.js
// Renamed for QOL Lite: Bettermap* -> QolLiteMap*, BettermapUmm -> QolLiteMapUmmAdapter,
// POI_DATA/URN_DATA -> QolLiteMapPoiData/QolLiteMapUrnData. "[BetterMap]" log prefix, UMM id
// "bettermap" and bm_/Bm class names are upstream names kept on purpose. Doc paths in the
// comments below (docs/..., hud.vcss, hud_minimap.vcss) refer to the upstream repository.
"use strict";

// The in-memory settings object. Setting defaults come from QolLiteMapSchema (the
// one list of settings), plus its LIMITS. Persistence lives in qollite_map_store.js
// (standalone) or UMM. DEFAULTS is built on first use, not at script load: the
// cross-script load order is not guaranteed (panorama_notes.md), so the schema
// may not have loaded yet when this file does.
var QolLiteMapState = (function () {
    var _defaults = null;
    var _state = null;

    function _own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

    function _defaultsObj() {
        if (!_defaults) {
            var d = QolLiteMapSchema.defaults();
            var limits = QolLiteMapSchema.LIMITS;
            for (var k in limits) { if (_own(limits, k)) { d[k] = limits[k]; } }
            _defaults = Object.freeze(d);
        }
        return _defaults;
    }

    function reset() {
        var d = _defaultsObj();
        _state = {};
        for (var k in d) { if (_own(d, k)) { _state[k] = d[k]; } }
    }

    function get() {
        if (!_state) { reset(); }
        return _state;
    }

    function patch(obj) {
        var s = get();
        for (var k in obj) { if (_own(obj, k)) { s[k] = obj[k]; } }
    }

    // Only the player settings (schema keys) - what is saved and sent to the popup.
    function values() {
        var s = get(), out = {}, list = QolLiteMapSchema.list();
        for (var i = 0; i < list.length; i++) { out[list[i].key] = s[list[i].key]; }
        return out;
    }

    var api = { get: get, patch: patch, reset: reset, values: values };
    Object.defineProperty(api, "DEFAULTS", { get: _defaultsObj, enumerable: true });
    return api;
})();
